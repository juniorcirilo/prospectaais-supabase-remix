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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date().toISOString();

    // Find all waiting executions that have expired
    const { data: expired, error } = await supabase
      .from("flow_executions")
      .select("*")
      .eq("status", "waiting");

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return json({ ok: true, processed: 0 });
    }

    // Filter to only those with _timeout_at in the past
    const timedOut = expired.filter((exec: any) => {
      const vars = exec.variables || {};
      // Handle both reply-wait and delay-wait timeouts
      const timeoutAt = vars._timeout_at || vars._resume_at;
      if (!timeoutAt) return false;
      return new Date(timeoutAt) <= new Date(now);
    });

    console.log(`[check-flow-timeouts] Found ${timedOut.length} expired executions out of ${expired.length} waiting`);

    let processed = 0;

    for (const exec of timedOut) {
      const vars = (exec.variables as Record<string, any>) || {};
      const waitingFor = vars._waiting_for;

      if (waitingFor === "reply") {
        // Message wait_for_reply timeout
        const timeoutNext = vars._timeout_next;
        const waitingNodeId = vars._waiting_node_id || exec.current_node_id;

        // Clean internal vars
        const { _waiting_for, _waiting_node_id, _timeout_at, _default_next, _timeout_next, ...cleanVars } = vars;

        if (timeoutNext) {
          // Has a timeout route → advance to it
          await supabase.from("flow_executions").update({
            status: "in_progress",
            current_node_id: timeoutNext,
            variables: cleanVars,
          }).eq("id", exec.id);

          await supabase.from("flow_execution_logs").insert({
            execution_id: exec.id,
            node_id: waitingNodeId,
            action: "timeout_expired",
            result: { advanced_to: timeoutNext, timeout_at: vars._timeout_at },
          });

          // Invoke executor to continue from timeout node
          supabase.functions.invoke("flow-executor", {
            body: { execution_id: exec.id },
          }).catch((err: any) => console.error(`[check-flow-timeouts] executor error:`, err));
        } else {
          // No timeout route → mark as failed
          await supabase.from("flow_executions").update({
            status: "failed",
            completed_at: now,
            variables: { ...cleanVars, _error: "timeout_no_reply" },
          }).eq("id", exec.id);

          await supabase.from("flow_execution_logs").insert({
            execution_id: exec.id,
            node_id: waitingNodeId,
            action: "timeout_failed",
            result: { reason: "no_timeout_route", timeout_at: vars._timeout_at },
          });
        }
      } else if (waitingFor === "reply_or_timeout") {
        // Delay node reply_or_timeout mode
        const timeoutNext = vars._timeout_next;
        const delayNodeId = exec.current_node_id;
        const { _waiting_for, _timeout_at, _replied_next, _timeout_next, ...cleanVars } = vars;

        if (timeoutNext) {
          await supabase.from("flow_executions").update({
            status: "in_progress",
            current_node_id: timeoutNext,
            variables: cleanVars,
          }).eq("id", exec.id);

          await supabase.from("flow_execution_logs").insert({
            execution_id: exec.id,
            node_id: delayNodeId,
            action: "delay_timeout_expired",
            result: { advanced_to: timeoutNext },
          });

          supabase.functions.invoke("flow-executor", {
            body: { execution_id: exec.id },
          }).catch((err: any) => console.error(`[check-flow-timeouts] executor error:`, err));
        } else {
          await supabase.from("flow_executions").update({
            status: "failed",
            completed_at: now,
            variables: { ...cleanVars, _error: "delay_timeout" },
          }).eq("id", exec.id);
        }
      } else {
        // Fixed delay resume
        const { _resume_at, _delay_node_id, ...cleanVars } = vars;

        await supabase.from("flow_executions").update({
          status: "in_progress",
          variables: cleanVars,
        }).eq("id", exec.id);

        await supabase.from("flow_execution_logs").insert({
          execution_id: exec.id,
          node_id: _delay_node_id || exec.current_node_id,
          action: "delay_resumed",
          result: { resume_at: _resume_at },
        });

        supabase.functions.invoke("flow-executor", {
          body: { execution_id: exec.id },
        }).catch((err: any) => console.error(`[check-flow-timeouts] executor error:`, err));
      }

      processed++;
    }

    return json({ ok: true, processed });
  } catch (error: any) {
    console.error("[check-flow-timeouts] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
