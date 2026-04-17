import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// JSON Response helper
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Auth validation
async function requireAuth(
  req: Request,
  opts: { requireAdmin?: boolean } = {}
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "Não autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return jsonResponse({ success: false, error: "Token inválido" }, 401);
  }

  const userId = data.claims.sub as string;
  const email = data.claims.email as string | undefined;

  // Check role using service-role client (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = !!roleData;

  if (opts.requireAdmin && !isAdmin) {
    return jsonResponse({ success: false, error: "Acesso restrito a administradores" }, 403);
  }

  return { userId, email, isAdmin };
}

serve(async (req) => {
  try {
    console.log(`[create-evolution-instance] ⭐ START: Received ${req.method} request`);

    if (req.method === 'OPTIONS') {
      console.log('[create-evolution-instance] ✅ OPTIONS request');
      return new Response(null, { headers: corsHeaders });
    }

    console.log('[create-evolution-instance] ✅ Checking auth...');
    const auth = await requireAuth(req, { requireAdmin: false });
    console.log('[create-evolution-instance] ✅ Auth check done:', auth instanceof Response ? 'FAILED' : 'SUCCESS');
    if (auth instanceof Response) {
      console.log('[create-evolution-instance] ❌ Auth failed, returning');
      return auth;
    }

    console.log('[create-evolution-instance] ✅ Creating Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[create-evolution-instance] ✅ Supabase client created');

  try {
    const bodyData = await req.json().catch(() => ({}));
    console.log('[create-evolution-instance] ✅ Body parsed:', JSON.stringify(bodyData));
    const { instance_name, name, is_default } = bodyData;
    console.log('[create-evolution-instance] ✅ Extracted vars:', { 
      instance_name, 
      name, 
      is_default,
      instance_name_type: typeof instance_name,
      name_type: typeof name,
      instance_name_len: instance_name?.length,
      name_len: name?.length,
    });

    const isInstanceNameString = typeof instance_name === 'string';
    const isNameString = typeof name === 'string';
    const isInstanceNameEmpty = instance_name?.length === 0;
    const isNameEmpty = name?.length === 0;
    const isInstanceNameTooLong = instance_name?.length > 100;
    const isNameTooLong = name?.length > 100;

    console.log('[create-evolution-instance] Validation checks:', {
      isInstanceNameString,
      isNameString,
      isInstanceNameEmpty,
      isNameEmpty,
      isInstanceNameTooLong,
      isNameTooLong,
    });

    if (!isInstanceNameString || !isNameString || isInstanceNameEmpty || isNameEmpty || isInstanceNameTooLong || isNameTooLong) {
      const errorMsg = `instance_name e name são obrigatórios (max 100 chars). Got: instance_name=${typeof instance_name}(len:${instance_name?.length}), name=${typeof name}(len:${name?.length})`;
      console.log('[create-evolution-instance] ❌ Validation FAILED:', errorMsg);
      return jsonResponse({ success: false, error: errorMsg }, 400);
    }
    console.log('[create-evolution-instance] ✅ Validation passed');

    console.log('[create-evolution-instance] ✅ Reading app_settings...');
    const { data: settings, error: settingsErr } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);

    if (settingsErr) {
      console.log('[create-evolution-instance] ❌ Settings error:', settingsErr);
      return jsonResponse({ success: false, error: `Erro ao ler configurações: ${settingsErr.message}` }, 500);
    }

    console.log('[create-evolution-instance] ✅ Settings retrieved:', settings);
    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.key] = s.value;

    const api_url = settingsMap['evolution_api_url'];
    const api_key = settingsMap['evolution_api_key'];

    console.log('[create-evolution-instance] Settings map:', { 
      has_evolution_api_url: !!api_url, 
      has_evolution_api_key: !!api_key,
      api_url_sample: api_url?.substring(0, 20),
      api_key_sample: api_key?.substring(0, 20),
    });

    if (!api_url || !api_key) {
      const errorMsg = 'Evolution API não configurada. Vá em Configurações e salve a URL e API Key.';
      console.log('[create-evolution-instance] ❌', errorMsg);
      return jsonResponse({ success: false, error: errorMsg }, 400);
    }
    console.log('[create-evolution-instance] ✅ API credentials found');

    const baseUrl = api_url.replace(/\/$/, '');

    console.log(`[create-evolution-instance] ✅ Creating instance: ${instance_name} at ${baseUrl}`);
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': api_key },
      body: JSON.stringify({
        instanceName: instance_name,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        groupsIgnore: true,
      }),
    });

    const createText = await createRes.text();
    console.log(`[create-evolution-instance] Evolution API response (${createRes.status}): ${createText.substring(0, 500)}`);

    let createData: any = {};
    try { 
      createData = JSON.parse(createText); 
      console.log('[create-evolution-instance] ✅ Parsed Evolution response:', JSON.stringify(createData).substring(0, 300));
    } catch (parseErr) {
      console.log('[create-evolution-instance] ⚠️ Failed to parse Evolution response:', parseErr);
    }

    if (!createRes.ok && createRes.status !== 200 && createRes.status !== 201) {
      const errorMsg = `Erro ao criar instância na Evolution API: ${createRes.status}`;
      console.log('[create-evolution-instance] ❌', errorMsg, createText.substring(0, 200));
      return jsonResponse({
        success: false,
        error: errorMsg,
        details: createText.substring(0, 300),
      }, 400);
    }
    console.log('[create-evolution-instance] ✅ Instance created successfully on Evolution API');

    console.log('[create-evolution-instance] ✅ Attempting to get QR code...');
    let qrCode: string | null = null;
    qrCode = createData?.qrcode?.base64 || createData?.hash?.qrcode || null;
    
    console.log('[create-evolution-instance] QR code from create response:', { has_qr: !!qrCode });

    if (!qrCode) {
      console.log('[create-evolution-instance] ⚠️ No QR code in create response, fetching separately...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const qrRes = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: 'GET',
        headers: { 'apikey': api_key },
      });
      if (qrRes.ok) {
        const qrText = await qrRes.text();
        try {
          const qrData = JSON.parse(qrText);
          qrCode = qrData?.base64 || qrData?.qrcode?.base64 || null;
          console.log('[create-evolution-instance] ✅ QR code fetched:', { has_qr: !!qrCode });
        } catch {
          console.log('[create-evolution-instance] ⚠️ Failed to parse QR response');
        }
      } else {
        console.log('[create-evolution-instance] ⚠️ QR fetch failed with status:', qrRes.status);
      }
    }

    console.log('[create-evolution-instance] ✅ Saving instance to database...');
    const { data: instance, error: insertError } = await supabase
      .from('whatsapp_instances')
      .insert({
        name,
        instance_name,
        provider_type: 'evolution_self_hosted',
        status: qrCode ? 'qr_required' : 'disconnected',
        qr_code: qrCode,
        is_default: is_default ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.log('[create-evolution-instance] ❌ Insert error:', insertError);
      return jsonResponse({ success: false, error: `Erro ao salvar instância: ${insertError.message}` }, 500);
    }
    console.log('[create-evolution-instance] ✅ Instance saved:', { id: instance?.id });

    console.log('[create-evolution-instance] ✅ Saving instance secrets...');
    const { error: secretsError } = await supabase
      .from('whatsapp_instance_secrets')
      .insert({ instance_id: instance.id, api_url, api_key });

    if (secretsError) {
      console.log('[create-evolution-instance] ❌ Secrets error:', secretsError);
      await supabase.from('whatsapp_instances').delete().eq('id', instance.id);
      return jsonResponse({ success: false, error: `Erro ao salvar secrets: ${secretsError.message}` }, 500);
    }
    console.log('[create-evolution-instance] ✅ Secrets saved');

    console.log('[create-evolution-instance] ✅ Configuring webhook...');
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
    try {
      await fetch(`${baseUrl}/webhook/set/${instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': api_key },
        body: JSON.stringify({
          webhook: {
            enabled: true, url: webhookUrl, webhook_by_events: false, webhook_base64: false,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        }),
      });
      console.log('[create-evolution-instance] ✅ Webhook configured');
    } catch (webhookErr) {
      console.warn('[create-evolution-instance] ⚠️ Failed to set webhook (non-fatal):', webhookErr);
    }

    console.log('[create-evolution-instance] ✅✅✅ Instance creation completed successfully!');
    return jsonResponse({
      success: true, instance_id: instance.id, qr_code: qrCode, status: instance.status,
    }, 200);

  } catch (error: unknown) {
    console.error('[create-evolution-instance] ❌❌❌ CATCH ERROR');
    console.error('Error type:', typeof error);
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
    return jsonResponse({ 
      success: false, 
      error: `Erro inesperado: ${errorStr}`,
      timestamp: new Date().toISOString(),
    }, 500);
  }
});