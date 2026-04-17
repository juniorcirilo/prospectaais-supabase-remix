import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse, requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAuth(req, { requireAdmin: true });
  if (auth instanceof Response) return auth;

  try {
    const { api_key } = await req.json().catch(() => ({}));

    if (!api_key || typeof api_key !== "string" || api_key.length > 500) {
      return jsonResponse({ ok: false, message: "API Key inválida" }, 400);
    }

    const apolloResponse = await fetch("https://api.apollo.io/v1/auth/health", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": api_key.trim(),
      },
    });

    const rawBody = await apolloResponse.text();
    let body: { healthy?: boolean; is_logged_in?: boolean } = {};

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }

    // Apollo pode responder 200 mesmo com key inválida (is_logged_in = false)
    const isValid = apolloResponse.ok && body.healthy === true && body.is_logged_in === true;

    if (isValid) {
      return new Response(JSON.stringify({ ok: true, message: "API Key válida — conexão com Apollo OK!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: false,
        message:
          body.healthy === true && body.is_logged_in === false
            ? "API Key sem autenticação válida no Apollo (is_logged_in=false). Gere uma nova key em Settings > Integrations > API."
            : `Falha ao validar API Key (HTTP ${apolloResponse.status})`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: err instanceof Error ? err.message : "Erro de conexão",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
