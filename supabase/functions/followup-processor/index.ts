import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * followup-processor
 *
 * Processes active follow-up enrollments whose next_send_at has passed.
 * Sends the current step message and advances to the next step or completes.
 *
 * Called periodically (every 1-5 minutes via cron or manual invocation).
 */

function phoneBRVariants(p: string): string[] {
  const variantSet = new Set<string>();
  variantSet.add(p);
  if (p.startsWith("55") && p.length >= 12) {
    const withoutCC = p.substring(2);
    variantSet.add(withoutCC);
    const ddd = p.substring(2, 4);
    const localNumber = p.substring(4);
    if (localNumber.length === 8) {
      variantSet.add(`55${ddd}9${localNumber}`);
      variantSet.add(`${ddd}9${localNumber}`);
    } else if (localNumber.length === 9 && localNumber.startsWith("9")) {
      variantSet.add(`55${ddd}${localNumber.substring(1)}`);
      variantSet.add(`${ddd}${localNumber.substring(1)}`);
    }
  } else if (!p.startsWith("55") && p.length >= 10) {
    variantSet.add(`55${p}`);
    const ddd = p.substring(0, 2);
    const localNumber = p.substring(2);
    if (localNumber.length === 8) {
      variantSet.add(`${ddd}9${localNumber}`);
      variantSet.add(`55${ddd}9${localNumber}`);
    } else if (localNumber.length === 9 && localNumber.startsWith("9")) {
      variantSet.add(`${ddd}${localNumber.substring(1)}`);
      variantSet.add(`55${ddd}${localNumber.substring(1)}`);
    }
  }
  return Array.from(variantSet);
}

function normalizeBrazilianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    const firstDigit = parseInt(number[0], 10);
    if (firstDigit >= 6) digits = ddd + "9" + number;
  }
  return "55" + digits;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Get enrollments ready to process
    const { data: dueEnrollments, error: enrollErr } = await supabase
      .from("followup_enrollments")
      .select("*, followup_sequences!inner(*)")
      .eq("status", "active")
      .lte("next_send_at", now)
      .order("next_send_at", { ascending: true })
      .limit(50);

    if (enrollErr) throw enrollErr;
    console.log(`[followup-processor] Found ${dueEnrollments?.length || 0} due enrollments (now=${now})`);
    if (!dueEnrollments || dueEnrollments.length === 0) {
      // Debug: check if there are active enrollments at all
      const { data: allActive } = await supabase
        .from("followup_enrollments")
        .select("id, next_send_at, status")
        .eq("status", "active")
        .limit(5);
      console.log(`[followup-processor] Active enrollments: ${JSON.stringify(allActive)}`);
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No due enrollments" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const enrollment of dueEnrollments) {
      try {
        console.log(`[followup-processor] Processing enrollment ${enrollment.id}: step=${enrollment.current_step}, contact=${enrollment.contact_id}`);
        const seq = (enrollment as any).followup_sequences;
        if (!seq || seq.status !== "active") {
          // Sequence deactivated, pause enrollment
          await supabase
            .from("followup_enrollments")
            .update({ status: "paused" })
            .eq("id", enrollment.id);
          continue;
        }

        // Check TTL
        const enrolledAt = new Date(enrollment.enrolled_at);
        const ttlMs = (seq.ttl_days || 30) * 24 * 60 * 60 * 1000;
        if (Date.now() - enrolledAt.getTime() > ttlMs) {
          await supabase
            .from("followup_enrollments")
            .update({ status: "expired", completed_at: now })
            .eq("id", enrollment.id);

          await supabase.from("followup_logs").insert({
            enrollment_id: enrollment.id,
            step_position: enrollment.current_step,
            action: "expired",
            reason: `TTL of ${seq.ttl_days} days exceeded`,
          });

          // Execute post-actions for no_reply
          await executePostAction(supabase, seq, enrollment, "no_reply");
          continue;
        }

        // Check max_attempts (total messages sent, not per cycle)
        const maxAttempts = seq.max_attempts || 999;
        const { count: totalSent } = await supabase
          .from("followup_logs")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_id", enrollment.id)
          .eq("action", "sent");

        if ((totalSent || 0) >= maxAttempts) {
          await supabase
            .from("followup_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);

          await supabase.from("followup_logs").insert({
            enrollment_id: enrollment.id,
            step_position: enrollment.current_step,
            action: "max_reached",
            reason: `Max attempts (${maxAttempts}) reached across all cycles`,
          });

          await executePostAction(supabase, seq, enrollment, "no_reply");
          continue;
        }

        // Check send window
        const sendWindow = (seq.send_window || {}) as Record<string, any>;
        const seqTimezone = seq.timezone || "America/Sao_Paulo";
        if (!isWithinSendWindow(sendWindow, seqTimezone)) {
          // Reschedule to next valid window
          const nextSend = calculateNextSendTime(sendWindow, seqTimezone);
          await supabase
            .from("followup_enrollments")
            .update({ next_send_at: nextSend })
            .eq("id", enrollment.id);
          continue;
        }

        // Get steps for this sequence
        const { data: steps } = await supabase
          .from("followup_steps")
          .select("*")
          .eq("sequence_id", seq.id)
          .order("position", { ascending: true });

        if (!steps || steps.length === 0) {
          await supabase
            .from("followup_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);
          continue;
        }

        const currentStep = steps.find(
          (s: any) => s.position === enrollment.current_step
        );
        if (!currentStep) {
          // All steps done
          await supabase
            .from("followup_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);

          await executePostAction(supabase, seq, enrollment, "no_reply");
          continue;
        }

        // Get contact phone
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, phone, name, tags, is_blacklisted")
          .eq("id", enrollment.contact_id)
          .single();

        if (!contact) {
          await supabase
            .from("followup_enrollments")
            .update({ status: "failed" })
            .eq("id", enrollment.id);
          continue;
        }

        // Check if contact replied since last send (or enrollment)
        const phoneNorm = normalizeBrazilianPhone(contact.phone);
        if (phoneNorm) {
          const variants = phoneBRVariants(phoneNorm);
          const onReplyBehavior = seq.on_reply_behavior || "pause_resume";
          const hasReplied = await checkIfRepliedSince(
            supabase,
            variants,
            enrollment.enrolled_at,
            enrollment.contact_id
          );
          if (hasReplied) {
            if (onReplyBehavior === "cancel") {
              // Cancel definitively
              await supabase
                .from("followup_enrollments")
                .update({ status: "converted", completed_at: now })
                .eq("id", enrollment.id);
              await supabase.from("followup_logs").insert({
                enrollment_id: enrollment.id,
                step_position: enrollment.current_step,
                action: "converted",
                reason: "Contact replied - sequence cancelled",
              });
              await executePostAction(supabase, seq, enrollment, "convert");
            } else {
              // pause_resume or restart: pause and set paused_at
              await supabase
                .from("followup_enrollments")
                .update({
                  status: "paused_by_reply",
                  variables: {
                    ...(enrollment.variables as Record<string, any> || {}),
                    _paused_at: now,
                    _reply_behavior: onReplyBehavior,
                  },
                })
                .eq("id", enrollment.id);
              await supabase.from("followup_logs").insert({
                enrollment_id: enrollment.id,
                step_position: enrollment.current_step,
                action: "paused",
                reason: `Contact replied - paused (${onReplyBehavior})`,
              });
            }
            continue;
          }
        }

        // Check blacklist
        if (contact.is_blacklisted) {
          await supabase
            .from("followup_enrollments")
            .update({ status: "skipped", completed_at: now })
            .eq("id", enrollment.id);

          await supabase.from("followup_logs").insert({
            enrollment_id: enrollment.id,
            step_position: enrollment.current_step,
            action: "skipped",
            reason: "Contact is blacklisted",
          });
          continue;
        }

        // ── SEND MESSAGE ──
        // Resolve which instance to use
        const instanceId =
          currentStep.instance_id || await getDefaultInstanceId(supabase);

        if (!instanceId) {
          console.error(
            `[followup-processor] No instance available for enrollment ${enrollment.id}`
          );
          await supabase.from("followup_logs").insert({
            enrollment_id: enrollment.id,
            step_position: enrollment.current_step,
            action: "error",
            reason: "No WhatsApp instance available",
          });
          errors++;
          continue;
        }

        // Prepare message content with variable substitution
        let messageContent = currentStep.content || "";
        messageContent = messageContent
          .replace(/\{\{nome\}\}/gi, contact.name || "")
          .replace(/\{\{name\}\}/gi, contact.name || "")
          .replace(/\{\{phone\}\}/gi, contact.phone || "");

        // Add enrollment variables
        const vars = (enrollment.variables || {}) as Record<string, any>;
        for (const [key, val] of Object.entries(vars)) {
          messageContent = messageContent.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "gi"),
            String(val)
          );
        }

        // ── AI PROMPT: generate message via Lovable AI Gateway ──
        if (currentStep.content_type === "ai_prompt") {
          try {
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

            // Fetch last 10 conversation messages for context
            const { data: convHistory } = await supabase
              .from("conversation_messages")
              .select("content, direction, created_at")
              .eq("contact_id", enrollment.contact_id)
              .order("created_at", { ascending: false })
              .limit(10);

            // Map to chat format (reverse to chronological order)
            const historyMessages = (convHistory || [])
              .reverse()
              .filter((m: any) => m.content?.trim())
              .map((m: any) => ({
                role: m.direction === "inbound" ? "user" : "assistant",
                content: m.content,
              }));

            // Wrap user's prompt with strict output rules
            const wrappedSystemPrompt = `Você é um assistente de follow-up via WhatsApp. Sua tarefa é gerar UMA ÚNICA mensagem pronta para envio direto ao contato.

REGRAS OBRIGATÓRIAS:
- Gere APENAS o texto da mensagem, nada mais
- NUNCA inclua opções, alternativas, numeração, dicas, explicações ou comentários
- NUNCA use Markdown (**, ##, ---, etc). Use APENAS formatação WhatsApp: *negrito*, _itálico_, ~tachado~
- A mensagem deve soar natural, humana e como se fosse escrita por uma pessoa real
- Seja conciso e direto — mensagens longas demais são ignoradas no WhatsApp
- NÃO inclua saudações genéricas se o histórico já mostra conversa em andamento
- Use o nome do contato quando disponível no contexto
- Adapte o tom ao histórico: se a conversa era informal, continue informal

INSTRUÇÕES DO USUÁRIO PARA ESTA MENSAGEM:
${messageContent}`;

            const aiMessages = [
              { role: "system", content: wrappedSystemPrompt },
              ...historyMessages,
            ];

            console.log(`[followup-processor] AI prompt for enrollment ${enrollment.id}: calling gateway with ${historyMessages.length} history messages`);

            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: aiMessages,
                stream: false,
              }),
            });

            if (!aiResponse.ok) {
              const errText = await aiResponse.text();
              throw new Error(`AI gateway error ${aiResponse.status}: ${errText}`);
            }

            const aiData = await aiResponse.json();
            messageContent = aiData.choices?.[0]?.message?.content || "";

            if (!messageContent.trim()) {
              throw new Error("AI returned empty content");
            }

            console.log(`[followup-processor] AI generated message for enrollment ${enrollment.id}: ${messageContent.substring(0, 100)}...`);
          } catch (aiErr: any) {
            console.error(`[followup-processor] AI prompt failed for enrollment ${enrollment.id}:`, aiErr);
            await supabase.from("followup_logs").insert({
              enrollment_id: enrollment.id,
              step_position: enrollment.current_step,
              action: "error",
              reason: `AI prompt failed: ${aiErr.message}`,
            });
            errors++;
            continue; // Will retry next cycle
          }
        }

        // Resolve message type
        let messageType = "text";
        let mediaUrl: string | undefined;
        if (currentStep.content_type === "audio_tts") {
          messageType = "audio";
          // TTS would require ElevenLabs integration - for now send as text
          // TODO: integrate TTS generation
        } else if (
          currentStep.content_type === "media" &&
          currentStep.media_urls?.length > 0
        ) {
          messageType = "image";
          mediaUrl = currentStep.media_urls[0];
        }

        // Send via send-evolution-message
        const { data: sendResult, error: sendErr } = await supabase.functions.invoke(
          "send-evolution-message",
          {
            body: {
              instance_id: instanceId,
              phone_number: contact.phone,
              content: messageContent,
              message_type: messageType,
              media_url: mediaUrl,
            },
          }
        );

        if (sendErr || !sendResult?.success) {
          const errMsg =
            sendErr?.message || sendResult?.error || "Unknown send error";
          console.error(
            `[followup-processor] Send failed for enrollment ${enrollment.id}:`,
            errMsg
          );

          await supabase.from("followup_logs").insert({
            enrollment_id: enrollment.id,
            step_position: enrollment.current_step,
            action: "error",
            reason: errMsg,
          });

          errors++;
          // Don't advance step on error, will retry next cycle
          continue;
        }

        // ── PERSIST OUTBOUND MESSAGE to conversation_messages ──
        await supabase.from("conversation_messages").insert({
          contact_id: enrollment.contact_id,
          direction: "outbound",
          content: messageContent,
          source: "followup",
          source_id: enrollment.id,
          instance_id: instanceId,
          message_id: sendResult.messageId || null,
        });

        // Log success
        await supabase.from("followup_logs").insert({
          enrollment_id: enrollment.id,
          step_position: enrollment.current_step,
          action: "sent",
          message_id: sendResult.messageId || null,
          reason: `Step ${enrollment.current_step + 1} sent successfully`,
        });

        // Advance to next step or complete
        const nextStepPosition = enrollment.current_step + 1;
        const nextStep = steps.find((s: any) => s.position === nextStepPosition);

        if (nextStep) {
          // Calculate next send time based on step delay
          const nextSendAt = calculateDelayedTime(
            nextStep.delay_value,
            nextStep.delay_unit,
            nextStep.delay_type,
            sendWindow,
            seqTimezone
          );

          await supabase
            .from("followup_enrollments")
            .update({
              current_step: nextStepPosition,
              next_send_at: nextSendAt,
            })
            .eq("id", enrollment.id);
        } else {
          // All steps completed
          await supabase
            .from("followup_enrollments")
            .update({
              status: "completed",
              completed_at: now,
              current_step: nextStepPosition,
            })
            .eq("id", enrollment.id);

          await executePostAction(supabase, seq, enrollment, "no_reply");
        }

        processed++;

        // Small delay between sends to avoid rate limiting
        await delay(500);
      } catch (err: any) {
        console.error(
          `[followup-processor] Error processing enrollment ${enrollment.id}:`,
          err
        );
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, errors, total: dueEnrollments.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[followup-processor] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ── Helpers ──

async function getDefaultInstanceId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("is_active", true)
    .eq("status", "connected")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id;

  // Fallback: any connected instance
  const { data: any_inst } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("is_active", true)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  return any_inst?.id || null;
}

async function checkIfRepliedSince(
  supabase: any,
  phoneVariants: string[],
  since: string,
  contactId?: string
): Promise<boolean> {
  // Primary: check conversation_messages (indexed, reliable)
  if (contactId) {
    const { count } = await supabase
      .from("conversation_messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .eq("direction", "inbound")
      .gt("created_at", since);

    if ((count || 0) > 0) return true;
  }

  // Fallback: check flow_executions (legacy, for transition period)
  const { data: executions } = await supabase
    .from("flow_executions")
    .select("id, variables, started_at")
    .gt("started_at", since)
    .limit(200);

  if (!executions) return false;

  return executions.some((e: any) => phoneVariants.includes(e.variables?.phone));
}

function getLocalDate(timezone: string): Date {
  // Get the current time in the specified timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")),
    parseInt(get("hour")), parseInt(get("minute")), parseInt(get("second"))
  );
}

function isWithinSendWindow(sendWindow: Record<string, any>, timezone?: string): boolean {
  const now = timezone ? getLocalDate(timezone) : new Date();
  const days = sendWindow.days as boolean[] | undefined;
  const startStr = sendWindow.start || "08:00";
  const endStr = sendWindow.end || "18:00";

  // Check day of week (Mon=0 to Sun=6)
  const dayIndex = (now.getDay() + 6) % 7;
  if (days && !days[dayIndex]) return false;

  // Check time
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function calculateNextSendTime(sendWindow: Record<string, any>, timezone?: string): string {
  const now = timezone ? getLocalDate(timezone) : new Date();
  const realNow = new Date();
  const offsetMs = realNow.getTime() - now.getTime(); // UTC offset
  const days = sendWindow.days as boolean[] | undefined;
  const startStr = sendWindow.start || "08:00";
  const [startH, startM] = startStr.split(":").map(Number);

  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayIndex = (candidate.getDay() + 6) % 7;

    if (days && !days[dayIndex]) continue;

    if (offset === 0) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      if (currentMinutes < startMinutes) {
        candidate.setHours(startH, startM, 0, 0);
        return new Date(candidate.getTime() + offsetMs).toISOString();
      }
      continue;
    }

    candidate.setHours(startH, startM, 0, 0);
    return new Date(candidate.getTime() + offsetMs).toISOString();
  }

  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  fallback.setHours(startH, startM, 0, 0);
  return new Date(fallback.getTime() + offsetMs).toISOString();
}

function calculateDelayedTime(
  delayValue: number,
  delayUnit: string,
  delayType: string,
  sendWindow: Record<string, any>,
  timezone?: string
): string {
  let delayMs: number;

  switch (delayUnit) {
    case "minutes":
      delayMs = delayValue * 60 * 1000;
      break;
    case "hours":
      delayMs = delayValue * 60 * 60 * 1000;
      break;
    case "days":
      delayMs = delayValue * 24 * 60 * 60 * 1000;
      break;
    default:
      delayMs = delayValue * 60 * 60 * 1000;
  }

  // For random delay, add up to 50% variation
  if (delayType === "random") {
    const variation = Math.random() * 0.5;
    delayMs = Math.floor(delayMs * (1 + variation));
  }

  const candidateTime = new Date(Date.now() + delayMs);

  // Convert to local time for window check
  const localNow = timezone ? getLocalDate(timezone) : new Date();
  const realNow = new Date();
  const offsetMs = realNow.getTime() - localNow.getTime();

  const localCandidate = new Date(candidateTime.getTime() - offsetMs);

  // Ensure the candidate time falls within the send window
  const days = sendWindow.days as boolean[] | undefined;
  const startStr = sendWindow.start || "08:00";
  const endStr = sendWindow.end || "18:00";
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);

  // Check if candidate is within window
  for (let offset = 0; offset < 7; offset++) {
    const check = new Date(localCandidate.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayIndex = (check.getDay() + 6) % 7;

    if (days && !days[dayIndex]) continue;

    if (offset === 0) {
      const mins = check.getHours() * 60 + check.getMinutes();
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      if (mins >= startMins && mins < endMins) {
        return new Date(check.getTime() + offsetMs).toISOString();
      }
      if (mins < startMins) {
        check.setHours(startH, startM, 0, 0);
        return new Date(check.getTime() + offsetMs).toISOString();
      }
      continue;
    }

    check.setHours(startH, startM, 0, 0);
    return new Date(check.getTime() + offsetMs).toISOString();
  }

  return candidateTime.toISOString();
}

async function executePostAction(
  supabase: any,
  seq: any,
  enrollment: any,
  type: "convert" | "no_reply"
): Promise<void> {
  const postActions = (seq.post_actions || {}) as Record<string, any>;
  const action =
    type === "convert" ? postActions.on_convert : postActions.on_no_reply;

  if (!action || action === "nothing") return;

  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, tags")
      .eq("id", enrollment.contact_id)
      .single();

    if (!contact) return;

    switch (action) {
      case "tag_cold": {
        const tags = [...(contact.tags || [])];
        if (!tags.includes("frio")) tags.push("frio");
        await supabase
          .from("contacts")
          .update({ tags, updated_at: new Date().toISOString() })
          .eq("id", contact.id);
        break;
      }
      case "add_tag": {
        const tagName = postActions.tag_name || "follow-up-convertido";
        const tags = [...(contact.tags || [])];
        if (!tags.includes(tagName)) tags.push(tagName);
        await supabase
          .from("contacts")
          .update({ tags, updated_at: new Date().toISOString() })
          .eq("id", contact.id);
        break;
      }
      case "winback_list": {
        const tags = [...(contact.tags || [])];
        if (!tags.includes("winback")) tags.push("winback");
        await supabase
          .from("contacts")
          .update({ tags, updated_at: new Date().toISOString() })
          .eq("id", contact.id);
        break;
      }
      case "move_pipeline": {
        // Move deal to a specific stage if configured
        const triggerData = (enrollment.trigger_data || {}) as Record<string, any>;
        if (triggerData.deal_id) {
          // Find first active stage to move to
          const { data: stages } = await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("is_active", true)
            .order("position", { ascending: true })
            .limit(1);

          if (stages?.[0]) {
            await supabase
              .from("deals")
              .update({
                stage_id: stages[0].id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", triggerData.deal_id);
          }
        }
        break;
      }
      case "notify": {
        console.log(
          `[followup-processor] Notification: ${type} for contact ${contact.id} in sequence ${seq.name}`
        );
        break;
      }
    }
  } catch (err) {
    console.error("[followup-processor] Post-action error:", err);
  }
}
