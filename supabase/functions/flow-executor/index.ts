import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── helpers ──────────────────────────────────────────────────────────

function delayMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_, options) => {
    const parts = options.split("|");
    return parts[Math.floor(Math.random() * parts.length)];
  });
}

function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

function durationToMs(duration: number, unit: string): number {
  switch (unit) {
    case "hours": return duration * 3600_000;
    case "days": return duration * 86400_000;
    case "minutes":
    default: return duration * 60_000;
  }
}

// ── main ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { execution_id } = await req.json();
    if (!execution_id) throw new Error("execution_id is required");

    // Load execution
    const { data: execution, error: execErr } = await supabase
      .from("flow_executions")
      .select("*")
      .eq("id", execution_id)
      .single();
    if (execErr || !execution) throw new Error(`Execution not found: ${execErr?.message}`);
    if (execution.status === "completed" || execution.status === "failed") {
      return json({ ok: true, skipped: true, reason: "already_finished" });
    }

    const flowId = execution.flow_id;
    let variables: Record<string, any> = (execution.variables as Record<string, any>) || {};
    let currentNodeId: string | null = execution.current_node_id;

    // Load all nodes & edges for this flow
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from("flow_nodes").select("*").eq("flow_id", flowId),
      supabase.from("flow_edges").select("*").eq("flow_id", flowId),
    ]);
    const allNodes = nodesRes.data || [];
    const allEdges = edgesRes.data || [];

    const nodeMap = new Map(allNodes.map((n: any) => [n.id, n]));

    const MAX_STEPS = 50; // safety limit
    let steps = 0;

    while (currentNodeId && steps < MAX_STEPS) {
      steps++;
      const node = nodeMap.get(currentNodeId);
      if (!node) {
        console.error(`[flow-executor] Node ${currentNodeId} not found`);
        break;
      }

      const config = (node.config as Record<string, any>) || {};
      const nodeType = node.type as string;
      let nextHandle: string | null = null; // for branching

      console.log(`[flow-executor] Step ${steps}: ${nodeType} node ${node.id} | config: ${JSON.stringify(config).substring(0, 300)}`);

      // ── TRIGGER (just pass through) ──
      if (nodeType === "trigger") {
        // already processed by webhook, advance
      }

      // ── MESSAGE ──
      else if (nodeType === "message") {
        const contentType = config.content_type || "text";
        const rawContent = config.content || "";
        const finalContent = replaceVariables(resolveSpintax(rawContent), variables);
        const phone = variables.phone;

        if (!phone) {
          await logStep(supabase, execution_id, node.id, "message_skipped", { reason: "no phone" });
        } else {
          // Find which instance to use - check if there's one in variables (from campaign) or use default
          const instanceId = variables.instance_id || await getDefaultInstanceId(supabase);

          if (!instanceId) {
            await logStep(supabase, execution_id, node.id, "message_error", { reason: "no instance available" });
          } else {
            // Send via send-evolution-message edge function
            const sendPayload: Record<string, any> = {
              instance_id: instanceId,
              phone_number: phone,
              content: finalContent,
              message_type: contentType,
            };
            if (config.media_url) sendPayload.media_url = config.media_url;

            const { data: sendResult, error: sendErr } = await supabase.functions.invoke(
              "send-evolution-message",
              { body: sendPayload }
            );

            if (sendErr) {
              console.error(`[flow-executor] Send error:`, sendErr);
              await logStep(supabase, execution_id, node.id, "message_error", { error: sendErr.message });
            } else {
              await logStep(supabase, execution_id, node.id, "message_sent", {
                content_preview: finalContent.substring(0, 100),
                type: contentType,
                result: sendResult,
              });

              // ── WAIT FOR REPLY ──
              console.log(`[flow-executor] MESSAGE node ${node.id} wait_for_reply=${config.wait_for_reply} (type: ${typeof config.wait_for_reply})`);
              if (config.wait_for_reply) {
                const timeoutHours = config.wait_timeout_hours || 24;
                const timeoutAt = new Date(Date.now() + timeoutHours * 3600_000).toISOString();
                const defaultNext = getNextNodeId(allEdges, node.id, "default");
                const timeoutNext = getNextNodeId(allEdges, node.id, "timeout");

                await supabase.from("flow_executions").update({
                  status: "waiting",
                  current_node_id: node.id,
                  variables: {
                    ...variables,
                    _waiting_for: "reply",
                    _waiting_node_id: node.id,
                    _timeout_at: timeoutAt,
                    _default_next: defaultNext,
                    _timeout_next: timeoutNext,
                  },
                }).eq("id", execution_id);

                await logStep(supabase, execution_id, node.id, "message_waiting", {
                  timeout_at: timeoutAt,
                  timeout_hours: timeoutHours,
                  default_next: defaultNext,
                  timeout_next: timeoutNext,
                });

                return json({ ok: true, paused: true, reason: "waiting_for_reply", timeout_at: timeoutAt });
              }
            }
          }
        }
      }

      // ── DELAY ──
      else if (nodeType === "delay") {
        const duration = config.duration || 1;
        const unit = config.unit || "minutes";
        const waitMode = config.wait_mode || "fixed";
        const waitMs = durationToMs(duration, unit);

        // For delays, we pause the execution and schedule a resume
        // Short delays (< 30s) can be done inline; longer ones need to be scheduled
        if (waitMs <= 30_000) {
          await logStep(supabase, execution_id, node.id, "delay_inline", { ms: waitMs });
          await delayMs(waitMs);
        } else {
          // Park the execution - it will need an external scheduler or cron to resume
          const resumeAt = new Date(Date.now() + waitMs).toISOString();
          
          // If wait_mode is "reply_or_timeout", we wait for a reply
          // The flow-webhook will handle advancing when a reply comes
          if (waitMode === "reply_or_timeout") {
            // Find the "replied" handle edge
            const repliedEdge = allEdges.find((e: any) => e.source_node_id === node.id && e.source_handle === "replied");
            const timeoutEdge = allEdges.find((e: any) => e.source_node_id === node.id && e.source_handle === "timeout");
            
            await supabase.from("flow_executions").update({
              status: "waiting",
              current_node_id: node.id,
              variables: {
                ...variables,
                _waiting_for: "reply_or_timeout",
                _timeout_at: resumeAt,
                _replied_next: repliedEdge?.target_node_id || null,
                _timeout_next: timeoutEdge?.target_node_id || null,
              },
            }).eq("id", execution_id);

            await logStep(supabase, execution_id, node.id, "delay_waiting", {
              mode: waitMode,
              timeout_at: resumeAt,
            });
            
            return json({ ok: true, paused: true, reason: "waiting_for_reply", resume_at: resumeAt });
          }

          // Fixed delay - park and schedule
          const nextNode = getNextNodeId(allEdges, node.id, null);
          await supabase.from("flow_executions").update({
            status: "waiting",
            current_node_id: nextNode || node.id,
            variables: {
              ...variables,
              _resume_at: resumeAt,
              _delay_node_id: node.id,
            },
          }).eq("id", execution_id);

          await logStep(supabase, execution_id, node.id, "delay_scheduled", {
            duration,
            unit,
            resume_at: resumeAt,
          });

          return json({ ok: true, paused: true, reason: "delay", resume_at: resumeAt });
        }
      }

      // ── CONDITION ──
      else if (nodeType === "condition") {
        // Support multi-condition with AND/OR logic
        const conditions: any[] = Array.isArray(config.conditions)
          ? config.conditions
          : [
              {
                source: config.source || "last_reply",
                operator: config.operator || "contains",
                value: config.value || "",
                field_name: config.field_name || "",
                case_sensitive: !!config.case_sensitive,
              },
            ];
        const logicOp: string = config.logic_operator || "and";

        const evalResults: { rule: any; testValue: string; result: boolean }[] = [];

        for (const rule of conditions) {
          const source = rule.source || "last_reply";
          const operator = rule.operator || "contains";
          const caseSensitive = !!rule.case_sensitive;
          const normalize = (v: string) => (caseSensitive ? v : v.toLowerCase());
          const compareValue = normalize(rule.value || "");

          let testValue = "";
          if (source === "last_reply") {
            testValue = normalize(variables.last_message || "");
          } else if (source === "tag" && variables.contact_id) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("tags")
              .eq("id", variables.contact_id)
              .single();
            testValue = normalize((contact?.tags || []).join(","));
          } else if (source === "custom_field") {
            const fieldName = rule.field_name || "";
            if (variables.contact_id) {
              const { data: contact } = await supabase
                .from("contacts")
                .select("custom_fields")
                .eq("id", variables.contact_id)
                .single();
              const cf = (contact?.custom_fields as Record<string, any>) || {};
              testValue = normalize(String(cf[fieldName] ?? ""));
            }
            if (!testValue && variables[`cf_${fieldName}`] != null) {
              testValue = normalize(String(variables[`cf_${fieldName}`]));
            }
            if (!testValue && variables[fieldName] != null) {
              testValue = normalize(String(variables[fieldName]));
            }
          }

          let ruleResult = false;
          switch (operator) {
            case "contains": ruleResult = testValue.includes(compareValue); break;
            case "not_contains": ruleResult = !testValue.includes(compareValue); break;
            case "equals": ruleResult = testValue === compareValue; break;
            case "starts_with": ruleResult = testValue.startsWith(compareValue); break;
          }

          evalResults.push({ rule: { source, operator, compareValue, caseSensitive }, testValue: testValue.substring(0, 100), result: ruleResult });
        }

        const result = logicOp === "or"
          ? evalResults.some((r) => r.result)
          : evalResults.every((r) => r.result);

        nextHandle = result ? "true" : "false";

        console.log(`[flow-executor] CONDITION eval: logic=${logicOp}, results=${JSON.stringify(evalResults.map(r => r.result))}, final=${result}`);

        await logStep(supabase, execution_id, node.id, "condition_evaluated", {
          logic_operator: logicOp,
          sub_conditions: evalResults,
          result,
          branch: nextHandle,
        });
      }

      // ── AI ──
      else if (nodeType === "ai") {
        const model = config.model || "gemini-2.5-flash";
        const systemPrompt = config.system_prompt || "Você é um assistente útil.";
        const outputMode = config.output_mode || "send";
        const fallback = config.fallback || "";

        // Build user message from context
        let userMessage = variables.last_message || "";

        try {
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
          if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

          const modelMap: Record<string, string> = {
            "gemini-2.5-flash": "google/gemini-2.5-flash",
            "gemini-2.5-pro": "google/gemini-2.5-pro",
            "gpt-5-mini": "openai/gpt-5-mini",
            "gpt-5": "openai/gpt-5",
          };

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: modelMap[model] || "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: replaceVariables(systemPrompt, variables) },
                { role: "user", content: userMessage },
              ],
              max_tokens: 1000,
            }),
          });

          const aiText = await aiResponse.text();
          console.log(`[flow-executor] AI response status: ${aiResponse.status}, body: ${aiText.substring(0, 300)}`);
          
          let aiContent = "";
          if (!aiResponse.ok) {
            console.error(`[flow-executor] AI API error: ${aiResponse.status} - ${aiText}`);
            aiContent = fallback || "Desculpe, ocorreu um erro ao processar.";
          } else {
            try {
              const aiJson = JSON.parse(aiText);
              aiContent = aiJson.choices?.[0]?.message?.content || aiJson.content || fallback;
            } catch {
              aiContent = fallback || "Desculpe, não consegui processar sua mensagem.";
            }
          }

          variables.ai_response = aiContent;

          if (outputMode === "send" && variables.phone) {
            const instanceId = variables.instance_id || await getDefaultInstanceId(supabase);
            if (instanceId) {
              await supabase.functions.invoke("send-evolution-message", {
                body: {
                  instance_id: instanceId,
                  phone_number: variables.phone,
                  content: aiContent,
                  message_type: "text",
                },
              });
            }
          }

          await logStep(supabase, execution_id, node.id, "ai_processed", {
            model,
            input_preview: userMessage.substring(0, 100),
            output_preview: aiContent.substring(0, 200),
            output_mode: outputMode,
          });

          // ── WAIT FOR REPLY (AI node) ──
          console.log(`[flow-executor] AI node ${node.id} wait_for_reply=${config.wait_for_reply} (type: ${typeof config.wait_for_reply})`);
          if (config.wait_for_reply) {
            const timeoutHours = config.wait_timeout_hours || 24;
            const timeoutAt = new Date(Date.now() + timeoutHours * 3600_000).toISOString();
            const defaultNext = getNextNodeId(allEdges, node.id, "default");
            const timeoutNext = getNextNodeId(allEdges, node.id, "timeout");

            await supabase.from("flow_executions").update({
              status: "waiting",
              current_node_id: node.id,
              variables: {
                ...variables,
                _waiting_for: "reply",
                _waiting_node_id: node.id,
                _timeout_at: timeoutAt,
                _default_next: defaultNext,
                _timeout_next: timeoutNext,
              },
            }).eq("id", execution_id);

            await logStep(supabase, execution_id, node.id, "ai_waiting", {
              timeout_at: timeoutAt,
              timeout_hours: timeoutHours,
              default_next: defaultNext,
              timeout_next: timeoutNext,
            });

            return json({ ok: true, paused: true, reason: "waiting_for_reply", timeout_at: timeoutAt });
          }
        } catch (aiError: any) {
          console.error(`[flow-executor] AI error:`, aiError);
          const fallbackMsg = fallback || "Desculpe, ocorreu um erro ao processar.";
          variables.ai_response = fallbackMsg;

          if (outputMode === "send" && variables.phone && fallbackMsg) {
            const instanceId = variables.instance_id || await getDefaultInstanceId(supabase);
            if (instanceId) {
              await supabase.functions.invoke("send-evolution-message", {
                body: {
                  instance_id: instanceId,
                  phone_number: variables.phone,
                  content: fallbackMsg,
                  message_type: "text",
                },
              });
            }
          }

          await logStep(supabase, execution_id, node.id, "ai_error", {
            error: aiError.message,
            fallback_used: fallbackMsg,
          });
        }
      }

      // ── SWITCH ──
      else if (nodeType === "switch") {
        const source = config.source || "last_reply";
        const caseSensitive = !!config.case_sensitive;
        const matchMode = config.match_mode || "exact";
        const cases: { value: string }[] = config.cases || [];
        const normalize = (v: string) => (caseSensitive ? v : v.toLowerCase());

        // Resolve the test value (same logic as condition)
        let testValue = "";
        if (source === "last_reply") {
          testValue = normalize(variables.last_message || "");
        } else if (source === "tag" && variables.contact_id) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("tags")
            .eq("id", variables.contact_id)
            .single();
          testValue = normalize((contact?.tags || []).join(","));
        } else if (source === "custom_field" || source === "variable") {
          const fieldName = config.field_name || "";
          if (source === "custom_field" && variables.contact_id) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("custom_fields")
              .eq("id", variables.contact_id)
              .single();
            const cf = (contact?.custom_fields as Record<string, any>) || {};
            testValue = normalize(String(cf[fieldName] ?? ""));
          }
          if (!testValue && variables[`cf_${fieldName}`] != null) {
            testValue = normalize(String(variables[`cf_${fieldName}`]));
          }
          if (!testValue && variables[fieldName] != null) {
            testValue = normalize(String(variables[fieldName]));
          }
        }

        // Find matching case
        let matchedIndex = -1;
        for (let i = 0; i < cases.length; i++) {
          const caseValue = normalize(cases[i].value || "");
          let matched = false;
          switch (matchMode) {
            case "exact": matched = testValue === caseValue; break;
            case "contains": matched = testValue.includes(caseValue); break;
            case "starts_with": matched = testValue.startsWith(caseValue); break;
          }
          if (matched) {
            matchedIndex = i;
            break;
          }
        }

        nextHandle = matchedIndex >= 0 ? `case-${matchedIndex}` : "default";

        console.log(`[flow-executor] SWITCH eval: source=${source}, testValue="${testValue}", matchMode=${matchMode}, matchedIndex=${matchedIndex}, handle=${nextHandle}`);

        await logStep(supabase, execution_id, node.id, "switch_evaluated", {
          source,
          test_value: testValue.substring(0, 100),
          match_mode: matchMode,
          matched_index: matchedIndex,
          matched_case: matchedIndex >= 0 ? cases[matchedIndex]?.value : "default",
          branch: nextHandle,
        });
      }

      // ── ACTION ──
      else if (nodeType === "action") {
        const actionType = config.action_type || "add_tag";

        // Resolve value based on value_source
        const resolveActionValue = (): string => {
          const vs = config.value_source || "manual";
          switch (vs) {
            case "last_reply": return variables.last_message || "";
            case "ai_response": return variables.ai_response || "";
            case "variable": return String(variables[config.field_value] ?? "");
            case "manual":
            default: return config.field_value || "";
          }
        };

        if (actionType === "end_flow") {
          await logStep(supabase, execution_id, node.id, "flow_ended", { reason: "end_flow_action" });
          await supabase.from("flow_executions").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            current_node_id: node.id,
            variables,
          }).eq("id", execution_id);
          return json({ ok: true, completed: true, steps });
        }

        if ((actionType === "add_tag" || actionType === "remove_tag") && variables.contact_id) {
          const tag = config.tag || "";
          if (tag) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("tags")
              .eq("id", variables.contact_id)
              .single();

            let tags: string[] = contact?.tags || [];
            if (actionType === "add_tag" && !tags.includes(tag)) {
              tags = [...tags, tag];
            } else if (actionType === "remove_tag") {
              tags = tags.filter((t: string) => t !== tag);
            }

            await supabase.from("contacts").update({ tags }).eq("id", variables.contact_id);
          }
          await logStep(supabase, execution_id, node.id, "action_tag", { action: actionType, tag: config.tag });
        }

        if (actionType === "update_field") {
          const fieldName = config.field_name || "";
          const fieldValue = resolveActionValue();
          if (fieldName) {
            variables[fieldName] = fieldValue;
          }
          await logStep(supabase, execution_id, node.id, "action_update_field", { field: fieldName, value: fieldValue, value_source: config.value_source || "manual" });
        }

        if (actionType === "set_custom_field") {
          const fieldName = config.field_name || "";
          const fieldValue = resolveActionValue();
          if (fieldName) {
            // Try to parse as number if possible
            let parsedValue: any = fieldValue;
            if (!isNaN(Number(fieldValue)) && fieldValue.trim() !== "") {
              parsedValue = Number(fieldValue);
            }
            // Always store in execution variables for immediate use by subsequent nodes
            variables[`cf_${fieldName}`] = parsedValue;
            variables[fieldName] = parsedValue;

            if (variables.contact_id) {
              // Also persist to contact's custom_fields in DB
              const { data: contact } = await supabase
                .from("contacts")
                .select("custom_fields")
                .eq("id", variables.contact_id)
                .single();
              const currentFields = (contact?.custom_fields as Record<string, any>) || {};
              const updatedFields = { ...currentFields, [fieldName]: parsedValue };
              await supabase.from("contacts").update({ custom_fields: updatedFields }).eq("id", variables.contact_id);
            }
          }
          await logStep(supabase, execution_id, node.id, "action_set_custom_field", { field: fieldName, value: fieldValue, value_source: config.value_source || "manual", contact_id: variables.contact_id || "none" });
        }

        if (actionType === "move_flow") {
          // TODO: implement cross-flow execution
          await logStep(supabase, execution_id, node.id, "action_move_flow", { target: config.target_flow_id });
        }
      }

      // ── Advance to next node ──
      const nextNodeId = getNextNodeId(allEdges, node.id, nextHandle);

      if (!nextNodeId) {
        // End of flow
        await supabase.from("flow_executions").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_node_id: node.id,
          variables,
        }).eq("id", execution_id);

        console.log(`[flow-executor] Flow completed for execution ${execution_id} after ${steps} steps`);
        return json({ ok: true, completed: true, steps });
      }

      currentNodeId = nextNodeId;

      // Update execution state
      await supabase.from("flow_executions").update({
        current_node_id: currentNodeId,
        variables,
      }).eq("id", execution_id);
    }

    if (steps >= MAX_STEPS) {
      console.warn(`[flow-executor] Hit max steps (${MAX_STEPS}) for execution ${execution_id}`);
      await supabase.from("flow_executions").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        variables: { ...variables, _error: "max_steps_reached" },
      }).eq("id", execution_id);
    }

    return json({ ok: true, steps });
  } catch (error: any) {
    console.error("[flow-executor] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Utilities ────────────────────────────────────────────────────────

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getNextNodeId(edges: any[], nodeId: string, handle: string | null): string | null {
  // If handle specified (condition branch), match it
  if (handle) {
    const edge = edges.find(
      (e: any) => e.source_node_id === nodeId && e.source_handle === handle
    );
    // Fallback: if handle is "default", also try null/empty handle (normal edges)
    if (!edge && handle === "default") {
      const fallback = edges.find(
        (e: any) => e.source_node_id === nodeId && (!e.source_handle || e.source_handle === "default")
      );
      return fallback?.target_node_id || null;
    }
    return edge?.target_node_id || null;
  }
  // Otherwise get the first/default edge
  const edge = edges.find(
    (e: any) => e.source_node_id === nodeId && (!e.source_handle || e.source_handle === "default")
  );
  // If no default/null handle found, try any edge from this node
  if (!edge) {
    const anyEdge = edges.find((e: any) => e.source_node_id === nodeId);
    return anyEdge?.target_node_id || null;
  }
  return edge.target_node_id;
}

async function getDefaultInstanceId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("status", "connected")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function logStep(
  supabase: any,
  executionId: string,
  nodeId: string,
  action: string,
  result: Record<string, any>
) {
  await supabase.from("flow_execution_logs").insert({
    execution_id: executionId,
    node_id: nodeId,
    action,
    result,
  });
}
