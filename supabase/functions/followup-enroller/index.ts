import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * followup-enroller
 *
 * Enrolls contacts into active follow-up sequences based on triggers.
 * Called periodically (cron) or after specific events (campaign sent, deal lost, etc.).
 *
 * Supported triggers:
 * - no_reply: contacts from a campaign who haven't replied after X hours
 * - deal_lost: deals marked as lost
 * - pipeline_inactivity: deals inactive for X hours
 * - keyword_reply: (handled in flow-webhook, not here)
 */

function phoneBRVariants(p: string): string[] {
  const variantSet = new Set<string>();
  variantSet.add(p);

  // If starts with 55, also add without country code
  if (p.startsWith("55") && p.length >= 12) {
    const withoutCC = p.substring(2); // e.g. 51981946452
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
  }
  // If doesn't start with 55, also add with country code
  else if (!p.startsWith("55") && p.length >= 10) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active sequences
    const { data: sequences, error: seqErr } = await supabase
      .from("followup_sequences")
      .select("*")
      .eq("status", "active");

    if (seqErr) throw seqErr;
    if (!sequences || sequences.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, enrolled: 0, message: "No active sequences" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalEnrolled = 0;
    let totalReactivated = 0;

    // ── REACTIVATE paused_by_reply enrollments where contact stopped replying ──
    const { data: pausedEnrollments } = await supabase
      .from("followup_enrollments")
      .select("*, followup_sequences!inner(*)")
      .eq("status", "paused_by_reply");

    if (pausedEnrollments && pausedEnrollments.length > 0) {
      for (const enrollment of pausedEnrollments) {
        const seq = (enrollment as any).followup_sequences;
        const vars = (enrollment.variables || {}) as Record<string, any>;
        const pausedAt = vars._paused_at;
        const replyBehavior = vars._reply_behavior || seq.on_reply_behavior || "pause_resume";
        const triggerConfig = (seq.trigger_config || {}) as Record<string, any>;
        const reactivateDelayHours = triggerConfig.delay_hours || 24;

        if (!pausedAt) continue;

        const pausedTime = new Date(pausedAt).getTime();
        const reactivateAfter = reactivateDelayHours * 60 * 60 * 1000;

        if (Date.now() - pausedTime < reactivateAfter) continue;

        // Contact hasn't replied again since pause - check
        const { data: contact } = await supabase
          .from("contacts")
          .select("phone")
          .eq("id", enrollment.contact_id)
          .single();

        if (!contact) continue;

        const normalized = normalizeBrazilianPhone(contact.phone);
        if (!normalized) continue;
        const variants = phoneBRVariants(normalized);

        // Check if contact replied AFTER the pause (use conversation_messages first)
        const { count: replyCount } = await supabase
          .from("conversation_messages")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", enrollment.contact_id)
          .eq("direction", "inbound")
          .gt("created_at", pausedAt);

        let repliedAfterPause = (replyCount || 0) > 0;

        // Fallback: check flow_executions if no conversation_messages found
        if (!repliedAfterPause) {
          const { data: recentExecs } = await supabase
            .from("flow_executions")
            .select("id, variables, started_at")
            .gt("started_at", pausedAt)
            .limit(200);

          repliedAfterPause = (recentExecs || []).some(
            (e: any) => variants.includes(e.variables?.phone)
          );
        }

        if (repliedAfterPause) {
          // Still active conversation, keep paused
          continue;
        }

        // Reactivate: reset step or resume
        const sendWindow = (seq.send_window || {}) as Record<string, any>;
        const nextSendAt = calculateNextSendTime(sendWindow, seq.timezone || "America/Sao_Paulo");
        const { _paused_at, _reply_behavior, ...cleanVars } = vars;

        const updateData: any = {
          status: "active",
          next_send_at: nextSendAt,
          variables: cleanVars,
        };

        if (replyBehavior === "restart") {
          updateData.current_step = 0;
        }

        await supabase
          .from("followup_enrollments")
          .update(updateData)
          .eq("id", enrollment.id);

        await supabase.from("followup_logs").insert({
          enrollment_id: enrollment.id,
          step_position: enrollment.current_step,
          action: "reactivated",
          reason: `No reply after pause - ${replyBehavior === "restart" ? "restarted from step 0" : "resumed from current step"}`,
        });

        totalReactivated++;
      }
    }

    for (const seq of sequences) {
      const triggerType = seq.trigger_type;
      const triggerConfig = (seq.trigger_config || {}) as Record<string, any>;
      const filters = (seq.filters || {}) as Record<string, any>;
      const delayHours = triggerConfig.delay_hours || 24;

      const cutoffTime = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

      // Get existing enrollments for this sequence to avoid duplicates
      const { data: existingEnrollments } = await supabase
        .from("followup_enrollments")
        .select("contact_id")
        .eq("sequence_id", seq.id)
        .in("status", ["active", "completed"]);

      const enrolledContactIds = new Set(
        (existingEnrollments || []).map((e: any) => e.contact_id)
      );

      let contactsToEnroll: Array<{ contact_id: string; trigger_data: Record<string, any> }> = [];

      // ── NO REPLY trigger (flow-based: waiting executions) ──
      if (triggerType === "no_reply" && seq.flow_id && !seq.campaign_id) {
        const { data: waitingExecs } = await supabase
          .from("flow_executions")
          .select("id, contact_id, started_at, variables")
          .eq("flow_id", seq.flow_id)
          .eq("status", "waiting");

        console.log(`[followup-enroller] Flow "${seq.name}": found ${waitingExecs?.length || 0} waiting execs, cutoff=${cutoffTime}`);

        if (waitingExecs && waitingExecs.length > 0) {
          for (const exec of waitingExecs) {
            const vars = (exec.variables || {}) as Record<string, any>;
            const waitingSince = vars._waiting_since || exec.started_at;
            const waitingTime = new Date(waitingSince).getTime();

            console.log(`[followup-enroller] Exec ${exec.id}: contact_id=${exec.contact_id}, phone=${vars.phone}, waitingSince=${waitingSince}, cutoff=${cutoffTime}, old_enough=${waitingTime <= new Date(cutoffTime).getTime()}`);

            if (waitingTime > new Date(cutoffTime).getTime()) continue; // Not old enough

            // Resolve contact_id: use exec.contact_id or look up by phone from variables
            let contactId = exec.contact_id as string | null;
            if (!contactId && vars.phone) {
              const phone = String(vars.phone);
              const normalized = normalizeBrazilianPhone(phone);
              const variants = normalized ? phoneBRVariants(normalized) : [phone];
              console.log(`[followup-enroller] Looking up contact for phone ${phone}, variants: ${JSON.stringify(variants)}`);
              
              // Try each variant
              for (const pv of variants) {
                const { data: contactMatch } = await supabase
                  .from("contacts")
                  .select("id")
                  .eq("phone", pv)
                  .limit(1)
                  .maybeSingle();
                if (contactMatch) {
                  contactId = contactMatch.id;
                  console.log(`[followup-enroller] Resolved phone variant ${pv} -> contact ${contactId}`);
                  break;
                }
              }
              if (!contactId) {
                console.log(`[followup-enroller] No contact found for any variant of ${phone}, skipping`);
                continue;
              }
            }
            if (!contactId || enrolledContactIds.has(contactId)) continue;

            // Apply tag filters if configured
            if (filters.include_tags?.length || filters.exclude_tags?.length) {
              const { data: contact } = await supabase
                .from("contacts")
                .select("tags")
                .eq("id", contactId)
                .single();

              if (contact) {
                const contactTags = contact.tags || [];
                if (filters.include_tags?.length) {
                  const hasRequired = filters.include_tags.some((t: string) => contactTags.includes(t));
                  if (!hasRequired) continue;
                }
                if (filters.exclude_tags?.length) {
                  const hasExcluded = filters.exclude_tags.some((t: string) => contactTags.includes(t));
                  if (hasExcluded) continue;
                }
              }
            }

            contactsToEnroll.push({
              contact_id: contactId,
              trigger_data: {
                flow_id: seq.flow_id,
                execution_id: exec.id,
                waiting_since: waitingSince,
              },
            });
            enrolledContactIds.add(contactId);
          }
        }

        console.log(`[followup-enroller] Flow waiting check for "${seq.name}": found ${contactsToEnroll.length} contacts`);
      }

      // ── NO REPLY trigger (campaign-based) ──
      else if (triggerType === "no_reply" && seq.campaign_id) {
        // Find campaign recipients who were sent but haven't had any reply
        const { data: recipients } = await supabase
          .from("broadcast_recipients")
          .select("phone_number, sent_at")
          .eq("campaign_id", seq.campaign_id)
          .eq("status", "sent")
          .lt("sent_at", cutoffTime);

        if (recipients && recipients.length > 0) {
          for (const r of recipients) {
            const normalized = normalizeBrazilianPhone(r.phone_number);
            if (!normalized) continue;

            const variants = phoneBRVariants(normalized);

            // Find contact by phone variants
            let contactId: string | null = null;
            for (const pv of variants) {
              const { data: contact } = await supabase
                .from("contacts")
                .select("id, tags")
                .eq("phone", pv)
                .limit(1)
                .maybeSingle();

              if (contact?.id) {
                contactId = contact.id;

                // Apply tag filters
                if (filters.include_tags?.length) {
                  const contactTags = contact.tags || [];
                  const hasRequired = filters.include_tags.some((t: string) =>
                    contactTags.includes(t)
                  );
                  if (!hasRequired) {
                    contactId = null;
                    continue;
                  }
                }
                if (filters.exclude_tags?.length) {
                  const contactTags = contact.tags || [];
                  const hasExcluded = filters.exclude_tags.some((t: string) =>
                    contactTags.includes(t)
                  );
                  if (hasExcluded) {
                    contactId = null;
                    continue;
                  }
                }
                break;
              }
            }

            if (contactId && !enrolledContactIds.has(contactId)) {
              // Check if contact has replied (look for conversation_messages first, then flow executions)
              const hasReplied = await checkIfReplied(supabase, variants, contactId);
              if (!hasReplied) {
                contactsToEnroll.push({
                  contact_id: contactId,
                  trigger_data: {
                    campaign_id: seq.campaign_id,
                    phone: normalized,
                    sent_at: r.sent_at,
                  },
                });
                enrolledContactIds.add(contactId);
              }
            }
          }
        }
      }

      // ── DEAL LOST trigger ──
      else if (triggerType === "deal_lost") {
        const { data: lostDeals } = await supabase
          .from("deals")
          .select("id, contact_phone, contact_name, title, lost_at, lost_reason")
          .not("lost_at", "is", null)
          .gt("lost_at", cutoffTime);

        if (lostDeals) {
          for (const deal of lostDeals) {
            if (!deal.contact_phone) continue;
            const normalized = normalizeBrazilianPhone(deal.contact_phone);
            if (!normalized) continue;
            const variants = phoneBRVariants(normalized);

            let contactId: string | null = null;
            for (const pv of variants) {
              const { data: contact } = await supabase
                .from("contacts")
                .select("id")
                .eq("phone", pv)
                .limit(1)
                .maybeSingle();
              if (contact?.id) { contactId = contact.id; break; }
            }

            if (contactId && !enrolledContactIds.has(contactId)) {
              contactsToEnroll.push({
                contact_id: contactId,
                trigger_data: {
                  deal_id: deal.id,
                  deal_title: deal.title,
                  phone: normalized,
                  lost_reason: deal.lost_reason,
                },
              });
              enrolledContactIds.add(contactId);
            }
          }
        }
      }

      // ── PIPELINE INACTIVITY trigger ──
      else if (triggerType === "pipeline_inactivity") {
        const inactivityHours = triggerConfig.inactivity_hours || delayHours;
        const inactivityCutoff = new Date(
          Date.now() - inactivityHours * 60 * 60 * 1000
        ).toISOString();

        const { data: staleDeals } = await supabase
          .from("deals")
          .select("id, contact_phone, contact_name, title, updated_at")
          .is("lost_at", null)
          .is("won_at", null)
          .lt("updated_at", inactivityCutoff);

        if (staleDeals) {
          for (const deal of staleDeals) {
            if (!deal.contact_phone) continue;
            const normalized = normalizeBrazilianPhone(deal.contact_phone);
            if (!normalized) continue;
            const variants = phoneBRVariants(normalized);

            let contactId: string | null = null;
            for (const pv of variants) {
              const { data: contact } = await supabase
                .from("contacts")
                .select("id")
                .eq("phone", pv)
                .limit(1)
                .maybeSingle();
              if (contact?.id) { contactId = contact.id; break; }
            }

            if (contactId && !enrolledContactIds.has(contactId)) {
              contactsToEnroll.push({
                contact_id: contactId,
                trigger_data: {
                  deal_id: deal.id,
                  deal_title: deal.title,
                  phone: normalized,
                  last_activity: deal.updated_at,
                },
              });
              enrolledContactIds.add(contactId);
            }
          }
        }
      }

      // ── Batch enroll ──
      if (contactsToEnroll.length > 0) {
        // Calculate first send time
        const sendWindow = (seq.send_window || {}) as Record<string, any>;
        const nextSendAt = calculateNextSendTime(sendWindow, seq.timezone || "America/Sao_Paulo");

        const enrollments = contactsToEnroll.map((c) => ({
          sequence_id: seq.id,
          contact_id: c.contact_id,
          current_step: 0,
          status: "active",
          next_send_at: nextSendAt,
          trigger_data: c.trigger_data,
          variables: {},
        }));

        const BATCH = 200;
        for (let i = 0; i < enrollments.length; i += BATCH) {
          const batch = enrollments.slice(i, i + BATCH);
          const { error: insertErr } = await supabase
            .from("followup_enrollments")
            .insert(batch);
          if (insertErr) {
            console.error(
              `[followup-enroller] Error enrolling batch for seq ${seq.id}:`,
              insertErr
            );
          }
        }

        totalEnrolled += contactsToEnroll.length;
        console.log(
          `[followup-enroller] Enrolled ${contactsToEnroll.length} contacts into "${seq.name}"`
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, enrolled: totalEnrolled, reactivated: totalReactivated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[followup-enroller] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkIfReplied(
  supabase: any,
  phoneVariants: string[],
  contactId?: string
): Promise<boolean> {
  // Primary: check conversation_messages (indexed, reliable)
  if (contactId) {
    const { count } = await supabase
      .from("conversation_messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .eq("direction", "inbound");

    if ((count || 0) > 0) return true;
  }

  // Fallback: check flow_executions (legacy, for transition period)
  const { data: executions } = await supabase
    .from("flow_executions")
    .select("id, variables")
    .in("status", ["in_progress", "completed", "waiting"])
    .limit(100);

  if (!executions) return false;

  return executions.some((e: any) => phoneVariants.includes(e.variables?.phone));
}

function getLocalDate(timezone: string): Date {
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

function calculateNextSendTime(
  sendWindow: Record<string, any>,
  timezone?: string
): string {
  const now = timezone ? getLocalDate(timezone) : new Date();
  const realNow = new Date();
  const offsetMs = realNow.getTime() - now.getTime();
  const days = sendWindow.days as boolean[] | undefined;
  const startStr = sendWindow.start || "08:00";
  const endStr = sendWindow.end || "18:00";

  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);

  // Try next 7 days to find a valid window
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayIndex = (candidate.getDay() + 6) % 7; // Mon=0, Sun=6

    if (days && !days[dayIndex]) continue;

    // Check if within time window
    if (offset === 0) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return realNow.toISOString(); // Now is fine
      }
      if (currentMinutes < startMinutes) {
        candidate.setHours(startH, startM, 0, 0);
        return new Date(candidate.getTime() + offsetMs).toISOString();
      }
      // Past end time, try next day
      continue;
    }

    candidate.setHours(startH, startM, 0, 0);
    return new Date(candidate.getTime() + offsetMs).toISOString();
  }

  // Fallback: next day at start time
  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  fallback.setHours(startH, startM, 0, 0);
  return new Date(fallback.getTime() + offsetMs).toISOString();
}
