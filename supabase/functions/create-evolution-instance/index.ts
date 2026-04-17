import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  console.log(`[create-evolution-instance] Received ${req.method} request`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, { requireAdmin: true });
  if (auth instanceof Response) return auth;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { instance_name, name, is_default } = await req.json().catch(() => ({}));

    if (typeof instance_name !== 'string' || typeof name !== 'string' || instance_name.length === 0 || name.length === 0 || instance_name.length > 100 || name.length > 100) {
      return jsonResponse({ success: false, error: 'instance_name e name são obrigatórios (max 100 chars)' }, 400);
    }

    // Read Evolution API credentials from app_settings
    const { data: settings, error: settingsErr } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);

    if (settingsErr) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao ler configurações' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.key] = s.value;

    const api_url = settingsMap['evolution_api_url'];
    const api_key = settingsMap['evolution_api_key'];

    if (!api_url || !api_key) {
      return new Response(JSON.stringify({ success: false, error: 'Evolution API não configurada. Vá em Configurações e salve a URL e API Key.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = api_url.replace(/\/$/, '');

    // 1. Create instance on Evolution API
    console.log(`[create-evolution-instance] Creating instance: ${instance_name} at ${baseUrl}`);
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
    console.log(`[create-evolution-instance] Create response (${createRes.status}): ${createText.substring(0, 500)}`);

    let createData: any = {};
    try { createData = JSON.parse(createText); } catch {}

    if (!createRes.ok && createRes.status !== 200 && createRes.status !== 201) {
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar instância na Evolution API: ${createRes.status}`,
        details: createText,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get QR Code
    let qrCode: string | null = null;
    qrCode = createData?.qrcode?.base64 || createData?.hash?.qrcode || null;

    if (!qrCode) {
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
        } catch {}
      }
    }

    // 3. Save to database
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
      return new Response(JSON.stringify({ success: false, error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Save secrets
    const { error: secretsError } = await supabase
      .from('whatsapp_instance_secrets')
      .insert({ instance_id: instance.id, api_url, api_key });

    if (secretsError) {
      await supabase.from('whatsapp_instances').delete().eq('id', instance.id);
      return new Response(JSON.stringify({ success: false, error: secretsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Auto-configure webhook
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
    } catch (webhookErr) {
      console.warn('[create-evolution-instance] Failed to set webhook (non-fatal):', webhookErr);
    }

    return new Response(JSON.stringify({
      success: true, instance_id: instance.id, qr_code: qrCode, status: instance.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[create-evolution-instance] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
