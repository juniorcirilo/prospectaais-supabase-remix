// Version: native-fetch (no external imports — deployable via Management API body field)
// All Supabase interactions done via REST API using native fetch()

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sbQuery(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  query: string
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}&select=*`, {
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [data], error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

async function sbInsert(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  row: Record<string, unknown>
): Promise<{ data: any | null; error: string | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }
    const data = await res.json();
    return { data: Array.isArray(data) ? data[0] : data, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

async function sbDelete(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  filter: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
    });
  } catch { /* ignore */ }
}

async function getUser(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string
): Promise<{ id: string; email?: string } | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": anonKey,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ? { id: data.id, email: data.email } : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  console.log(`[create-evolution-instance] ${req.method} request`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Nao autenticado" }, 401);
    }
    const user = await getUser(supabaseUrl, anonKey, authHeader);
    if (!user) {
      return jsonResponse({ success: false, error: "Token invalido" }, 401);
    }
    console.log(`[create-evolution-instance] Auth OK, userId=${user.id}`);

    // Body
    const bodyData = await req.json().catch(() => ({}));
    const { instance_name, name, is_default } = bodyData;

    // Validation
    if (
      typeof instance_name !== "string" || instance_name.length === 0 || instance_name.length > 100 ||
      typeof name !== "string" || name.length === 0 || name.length > 100
    ) {
      return jsonResponse({
        success: false,
        error: `instance_name e name sao obrigatorios (max 100 chars). Got: ${typeof instance_name}/${typeof name}`,
      }, 400);
    }

    // Read Evolution API credentials from app_settings
    const { data: settings, error: settingsErr } = await sbQuery(
      supabaseUrl, serviceKey,
      "app_settings",
      "key=in.(evolution_api_url,evolution_api_key)"
    );
    if (settingsErr || !settings) {
      return jsonResponse({ success: false, error: `Erro ao ler configuracoes: ${settingsErr}` }, 500);
    }
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    const api_url = settingsMap["evolution_api_url"];
    const api_key = settingsMap["evolution_api_key"];
    console.log(`[create-evolution-instance] api_url=${api_url ? api_url.substring(0, 20) : "EMPTY"}`);

    if (!api_url || !api_key) {
      return jsonResponse({
        success: false,
        error: "Evolution API nao configurada. Va em Configuracoes e salve a URL e API Key.",
      }, 400);
    }

    const baseUrl = api_url.replace(/\/$/, "");

    // Create instance on Evolution API
    console.log(`[create-evolution-instance] Creating instance ${instance_name} at ${baseUrl}`);
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": api_key },
      body: JSON.stringify({
        instanceName: instance_name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        groupsIgnore: true,
      }),
    });

    const createText = await createRes.text();
    console.log(`[create-evolution-instance] Evolution API (${createRes.status}): ${createText.substring(0, 300)}`);

    let createData: Record<string, unknown> = {};
    try { createData = JSON.parse(createText); } catch { /* ignore */ }

    if (!createRes.ok && createRes.status !== 200 && createRes.status !== 201) {
      return jsonResponse({
        success: false,
        error: `Erro ao criar instancia na Evolution API: ${createRes.status}`,
        details: createText.substring(0, 300),
      }, 400);
    }

    // Get QR Code
    let qrCode: string | null =
      (createData?.qrcode as any)?.base64 ||
      (createData?.hash as any)?.qrcode ||
      null;

    if (!qrCode) {
      await new Promise((r) => setTimeout(r, 1500));
      const qrRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        headers: { "apikey": api_key },
      });
      if (qrRes.ok) {
        try {
          const qrData = await qrRes.json();
          qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null;
        } catch { /* ignore */ }
      }
    }

    // Save to database
    const { data: instance, error: insertError } = await sbInsert(
      supabaseUrl, serviceKey,
      "whatsapp_instances",
      {
        name,
        instance_name,
        provider_type: "evolution_self_hosted",
        status: qrCode ? "qr_required" : "disconnected",
        qr_code: qrCode,
        is_default: is_default ?? false,
        is_active: true,
      }
    );
    if (insertError || !instance) {
      return jsonResponse({ success: false, error: `Erro ao salvar instancia: ${insertError}` }, 500);
    }
    console.log(`[create-evolution-instance] Instance saved id=${instance.id}`);

    // Save secrets
    const { error: secretsError } = await sbInsert(
      supabaseUrl, serviceKey,
      "whatsapp_instance_secrets",
      { instance_id: instance.id, api_url, api_key }
    );
    if (secretsError) {
      await sbDelete(supabaseUrl, serviceKey, "whatsapp_instances", `id=eq.${instance.id}`);
      return jsonResponse({ success: false, error: `Erro ao salvar secrets: ${secretsError}` }, 500);
    }

    // Auto-configure webhook (non-fatal)
    try {
      await fetch(`${baseUrl}/webhook/set/${instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": api_key },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: `${supabaseUrl}/functions/v1/evolution-webhook`,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
        }),
      });
    } catch (e) {
      console.warn("[create-evolution-instance] Webhook setup failed (non-fatal):", e);
    }

    return jsonResponse({ success: true, instance_id: instance.id, qr_code: qrCode, status: instance.status });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[create-evolution-instance] Catch Error:", msg);
    return jsonResponse({ success: false, error: `Erro inesperado: ${msg}` }, 500);
  }
});
