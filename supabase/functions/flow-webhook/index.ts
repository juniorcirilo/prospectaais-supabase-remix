import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Log raw payload for debugging (first 500 chars)
    console.log(`[flow-webhook] Raw payload keys: ${Object.keys(body).join(", ")}`);
    console.log(`[flow-webhook] Raw body (truncated): ${JSON.stringify(body).substring(0, 500)}`);

    // Evolution API webhook payload structure
    // The event can come in different formats depending on the Evolution API version
    const event = body.event || (body.apikey ? body.event : null);
    
    // We only care about incoming messages
    const isIncomingMessage =
      event === "messages.upsert" ||
      event === "MESSAGES_UPSERT" ||
      event === "messages.update";

    if (!isIncomingMessage) {
      return new Response(JSON.stringify({ ok: true, skipped: true, event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evolution API v2 sends data in body.data, which can be an array or object
    const rawData = body.data;
    const messageData = Array.isArray(rawData) ? rawData[0] : (rawData || body);
    
    // Extract message ID for deduplication (Evolution API sends same event multiple times)
    const messageId = messageData.key?.id || messageData.id || "";
    if (!messageId) {
      console.log("[flow-webhook] No message ID found, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_message_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message content and sender info
    // Evolution v2 uses "lid" format (Linked ID) in remoteJid, real number is in remoteJidAlt
    const remoteJid = messageData.key?.remoteJid || messageData.remoteJid || "";
    const remoteJidAlt = messageData.key?.remoteJidAlt || "";
    const fromMe = messageData.key?.fromMe || false;

    // Ignore messages sent by us
    if (fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use remoteJidAlt (real number) if remoteJid is in lid format, otherwise use remoteJid
    const effectiveJid = remoteJid.includes("@lid") && remoteJidAlt ? remoteJidAlt : remoteJid;
    
    // Extract phone number (remove @s.whatsapp.net)
    const phone = effectiveJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // === DEDUPLICATION: Check if we already processed this message ===
    const { data: existing } = await supabase
      .from("webhook_message_dedup")
      .select("message_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existing) {
      console.log(`[flow-webhook] Duplicate message ${messageId}, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark this message as processed (insert first to win the race)
    const { error: dedupErr } = await supabase
      .from("webhook_message_dedup")
      .insert({ message_id: messageId, phone, flow_id: "00000000-0000-0000-0000-000000000000" });

    if (dedupErr) {
      // If insert fails due to unique constraint, another instance already processed it
      console.log(`[flow-webhook] Dedup insert conflict for ${messageId}, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate_race" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text content - handle both nested and flat structures
    const msgObj = messageData.message || {};
    const textContent =
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      messageData.body ||
      "";

    console.log(`[flow-webhook] Parsed - phone: ${phone}, msgId: ${messageId}, text: "${textContent.substring(0, 80)}"`);

    // ── PERSIST INBOUND MESSAGE to conversation_messages ──
    // Find contact_id by phone variants (needed for conversation_messages)
    const findContactId = async (phoneVars: string[]): Promise<string | null> => {
      for (const pv of phoneVars) {
        const { data: c } = await supabase
          .from("contacts")
          .select("id")
          .eq("phone", pv)
          .limit(1)
          .maybeSingle();
        if (c?.id) return c.id;
      }
      return null;
    };

    // Brazilian phone normalization: the 9th digit may or may not be present
    const phoneBRVariants = (p: string): string[] => {
      const variants = [p];
      if (p.startsWith("55") && p.length >= 12) {
        const ddd = p.substring(2, 4);
        const localNumber = p.substring(4);
        if (localNumber.length === 8) {
          variants.push(`55${ddd}9${localNumber}`);
        } else if (localNumber.length === 9 && localNumber.startsWith("9")) {
          variants.push(`55${ddd}${localNumber.substring(1)}`);
        }
      }
      return variants;
    };
    const phoneVariants = phoneBRVariants(phone);

    // ── PERSIST INBOUND MESSAGE ──
    const inboundContactId = await findContactId(phoneVariants);
    if (inboundContactId) {
      await supabase.from("conversation_messages").insert({
        contact_id: inboundContactId,
        direction: "inbound",
        content: textContent,
        source: "webhook",
        instance_id: null, // resolved later
        message_id: messageId,
      });
      console.log(`[flow-webhook] Saved inbound message for contact ${inboundContactId}`);
    }

    // === CHECK FOR WAITING EXECUTIONS (wait_for_reply) ===
    const { data: waitingExecs } = await supabase
      .from("flow_executions")
      .select("*")
      .eq("status", "waiting")
      .filter("variables->>_waiting_for", "eq", "reply");

    // Filter by phone variants (handles 9th digit mismatch)
    const matchingWaiting = (waitingExecs || []).filter((e: any) =>
      phoneVariants.includes(e.variables?.phone)
    );

    if (matchingWaiting.length > 0) {
      console.log(`[flow-webhook] Found ${matchingWaiting.length} waiting execution(s) for ${phone}`);
      const resumed: string[] = [];

      for (const exec of matchingWaiting) {
        const vars = (exec.variables as Record<string, any>) || {};
        const defaultNext = vars._default_next || null;

        // Update execution: set last_message, move to the default next node, resume
        const { _waiting_for, _waiting_node_id, _timeout_at, _default_next, _timeout_next, ...cleanVars } = vars;
        
        // If there's no next node, mark the execution as completed
        const newStatus = defaultNext ? "in_progress" : "completed";
        const updatePayload: Record<string, any> = {
          status: newStatus,
          current_node_id: defaultNext || exec.current_node_id,
          variables: { ...cleanVars, last_message: textContent },
        };
        if (!defaultNext) {
          updatePayload.completed_at = new Date().toISOString();
        }
        await supabase.from("flow_executions").update(updatePayload).eq("id", exec.id);
        
        console.log(`[flow-webhook] Resumed execution ${exec.id} with status=${newStatus}, next=${defaultNext || "none (completed)"}`);

        await supabase.from("flow_execution_logs").insert({
          execution_id: exec.id,
          node_id: _waiting_node_id || exec.current_node_id,
          action: "reply_received",
          result: { phone, message_preview: textContent.substring(0, 100) },
        });

        // Fire-and-forget: invoke executor to continue
        if (defaultNext) {
          supabase.functions.invoke("flow-executor", {
            body: { execution_id: exec.id },
          }).catch((err: any) => console.error(`[flow-webhook] resume error:`, err));
        }

        resumed.push(exec.id);
      }

      return new Response(JSON.stringify({ ok: true, resumed: resumed.length, execution_ids: resumed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the instance name from webhook data
    const instanceName = body.instance?.instanceName || body.instanceName || body.instance || "";

    // Resolve the internal instance_id from the instance name
    let resolvedInstanceId: string | null = null;
    if (instanceName) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .or(`instance_name.eq.${instanceName},instance_id_external.eq.${instanceName}`)
        .limit(1)
        .maybeSingle();
      resolvedInstanceId = inst?.id || null;
    }

    // === CAMPAIGN-LINKED FLOWS ===
    console.log(`[flow-webhook] Phone variants for campaign matching: ${JSON.stringify(phoneVariants)}`);

    const { data: campaignMatches, error: campaignError } = await supabase
      .from("broadcast_recipients")
      .select("campaign_id, phone_number, broadcast_campaigns!inner(id, flow_id, name)")
      .in("phone_number", phoneVariants)
      .not("broadcast_campaigns.flow_id", "is", null);

    if (campaignError) {
      console.error("[flow-webhook] Campaign query error:", campaignError);
    }
    console.log(`[flow-webhook] Campaign matches found: ${campaignMatches?.length || 0}`);

    const campaignFlowIds = new Set<string>();
    const campaignContext: Record<string, string> = {};
    if (campaignMatches && campaignMatches.length > 0) {
      for (const match of campaignMatches) {
        const campaign = (match as any).broadcast_campaigns;
        if (campaign?.flow_id) {
          campaignFlowIds.add(campaign.flow_id);
          campaignContext[campaign.flow_id] = campaign.id;
          console.log(`[flow-webhook] Campaign "${campaign.name}" linked to flow ${campaign.flow_id}`);
        }
      }
    }
    console.log(`[flow-webhook] Total campaign-linked flow IDs: ${campaignFlowIds.size}`);

    // Find all active flows
    const { data: flows, error: flowsError } = await supabase
      .from("flows")
      .select("id, trigger_type, trigger_config")
      .eq("status", "active");

    if (flowsError) {
      console.error("[flow-webhook] Error fetching flows:", flowsError);
      throw flowsError;
    }

    if ((!flows || flows.length === 0) && campaignFlowIds.size === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find trigger nodes for each flow to check their config
    // Include both active flows AND campaign-linked flows
    const allFlowIds = new Set([
      ...(flows || []).map((f: any) => f.id),
      ...campaignFlowIds,
    ]);
    const flowIds = Array.from(allFlowIds);

    if (flowIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: triggerNodes, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("id, flow_id, config")
      .eq("type", "trigger")
      .in("flow_id", flowIds);

    if (nodesError) {
      console.error("[flow-webhook] Error fetching trigger nodes:", nodesError);
      throw nodesError;
    }

    const matchedExecutions: any[] = [];

    for (const triggerNode of (triggerNodes || [])) {
      const config = (triggerNode.config as any) || {};
      const triggerType = config.trigger_type || "message_received";

      let matches = false;

      // === TEST MODE: if enabled, only trigger for the specified phone ===
      const testMode = !!config.test_mode;
      const testPhone = (config.test_phone || "").replace(/\D/g, "");
      if (testMode && testPhone) {
        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone !== testPhone && !cleanPhone.endsWith(testPhone) && !testPhone.endsWith(cleanPhone)) {
          console.log(`[flow-webhook] Test mode: skipping flow ${triggerNode.flow_id} - phone ${phone} != test phone ${testPhone}`);
          continue;
        }
      }

      if (triggerType === "message_received") {
        // Match any message, or filter by optional keyword
        const filterKeyword = (config.filter_keyword || "").trim().toLowerCase();
        if (!filterKeyword) {
          matches = true;
        } else {
          matches = textContent.toLowerCase().includes(filterKeyword);
        }
      } else if (triggerType === "keyword") {
        const keyword = (config.keyword || "").trim().toLowerCase();
        const matchMode = config.match_mode || "contains";

        if (keyword) {
          const lowerText = textContent.toLowerCase();
          switch (matchMode) {
            case "exact":
              matches = lowerText === keyword;
              break;
            case "starts_with":
              matches = lowerText.startsWith(keyword);
              break;
            case "contains":
            default:
              matches = lowerText.includes(keyword);
              break;
          }
        }
      }
      // "after_campaign" triggers match if the phone is a recipient of a linked campaign
      else if (triggerType === "after_campaign") {
        matches = campaignFlowIds.has(triggerNode.flow_id);
      }
      // "manual" triggers are not activated by webhook

      if (!matches) continue;

      // Check if contact already has an active execution in this flow for this phone
      const { data: existingExec } = await supabase
        .from("flow_executions")
        .select("id, variables")
        .eq("flow_id", triggerNode.flow_id)
        .in("status", ["waiting", "in_progress"]);

      // Skip if there's already an active execution for this phone in this flow
      const hasActiveForPhone = existingExec?.some((e: any) => phoneVariants.includes(e.variables?.phone));
      if (hasActiveForPhone) {
        console.log(`[flow-webhook] Skipping flow ${triggerNode.flow_id} - already active for ${phone}`);
        continue;
      }

      // Find contact by phone (try all variants)
      let contactId: string | null = null;
      for (const pv of phoneVariants) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("phone", pv)
          .limit(1)
          .maybeSingle();
        if (contact?.id) {
          contactId = contact.id;
          break;
        }
      }

      // Find next node(s) connected to the trigger
      const { data: edges } = await supabase
        .from("flow_edges")
        .select("target_node_id")
        .eq("source_node_id", triggerNode.id)
        .eq("flow_id", triggerNode.flow_id);

      const nextNodeId = edges && edges.length > 0 ? edges[0].target_node_id : null;

      // Create execution
      const { data: execution, error: execError } = await supabase
        .from("flow_executions")
        .insert({
          flow_id: triggerNode.flow_id,
          contact_id: contactId,
          current_node_id: nextNodeId || triggerNode.id,
          status: nextNodeId ? "in_progress" : "waiting",
          variables: {
            phone,
            last_message: textContent,
            instance_name: instanceName,
            instance_id: resolvedInstanceId,
            contact_id: contactId,
            triggered_at: new Date().toISOString(),
            ...(campaignContext[triggerNode.flow_id] ? { campaign_id: campaignContext[triggerNode.flow_id] } : {}),
          },
        })
        .select()
        .single();

      if (execError) {
        console.error("[flow-webhook] Error creating execution:", execError);
        continue;
      }

      // Log the trigger
      await supabase.from("flow_execution_logs").insert({
        execution_id: execution.id,
        node_id: triggerNode.id,
        action: "trigger_activated",
        result: {
          trigger_type: triggerType,
          phone,
          message_preview: textContent.substring(0, 100),
          instance: instanceName,
        },
      });

      matchedExecutions.push(execution);
      console.log(`[flow-webhook] Flow ${triggerNode.flow_id} triggered for ${phone}, execution ${execution.id}`);

      // Fire-and-forget: invoke the flow executor to process nodes
      if (nextNodeId) {
        supabase.functions.invoke("flow-executor", {
          body: { execution_id: execution.id },
        }).then((res: any) => {
          if (res.error) console.error(`[flow-webhook] flow-executor error:`, res.error);
          else console.log(`[flow-webhook] flow-executor result:`, JSON.stringify(res.data));
        }).catch((err: any) => {
          console.error(`[flow-webhook] flow-executor invoke failed:`, err);
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        matched: matchedExecutions.length,
        executions: matchedExecutions.map((e: any) => e.id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[flow-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
