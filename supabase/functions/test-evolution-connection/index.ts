import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractInstances(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.instances)) return record.instances;
    if (Array.isArray(record.data)) return record.data;
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return new Response(JSON.stringify({ ok: false, message: "Sessão inválida para testar a conexão" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, message: "Usuário não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));

    let apiUrl = typeof body.api_url === "string" ? body.api_url.trim() : "";
    let apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";

    if (!apiUrl || !apiKey) {
      const { data: settings, error: settingsError } = await adminClient
        .from("app_settings")
        .select("key, value")
        .in("key", ["evolution_api_url", "evolution_api_key"]);

      if (settingsError) {
        throw new Error("Não foi possível ler as credenciais salvas");
      }

      const settingsMap = Object.fromEntries((settings ?? []).map((item) => [item.key, item.value]));
      apiUrl ||= settingsMap.evolution_api_url ?? "";
      apiKey ||= settingsMap.evolution_api_key ?? "";
    }

    if (!apiUrl || !apiKey) {
      return new Response(JSON.stringify({ ok: false, message: "Informe a URL e a API Key da Evolution API" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/instance/fetchInstances`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    const rawBody = await response.text();
    let payload: unknown = rawBody;

    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      payload = rawBody;
    }

    if (!response.ok) {
      const message = typeof payload === "string" && payload.trim().length > 0
        ? `Falha ao validar conexão (HTTP ${response.status}): ${payload.slice(0, 160)}`
        : `Falha ao validar conexão (HTTP ${response.status})`;

      return new Response(JSON.stringify({ ok: false, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instances = extractInstances(payload);
    const count = instances.length;
    const message = count > 0
      ? `Conexão OK — ${count} instância(s) encontrada(s)`
      : "Conexão OK — API respondeu com sucesso";

    return new Response(JSON.stringify({ ok: true, message, count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao testar conexão";

    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});