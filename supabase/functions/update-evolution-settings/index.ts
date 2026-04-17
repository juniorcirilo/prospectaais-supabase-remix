import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, { requireAdmin: true });
  if (auth instanceof Response) return auth;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { instance_id, groups_ignore, reject_call, msg_call, always_online, read_messages, webhook_enabled } = await req.json().catch(() => ({}));

    if (typeof instance_id !== 'string' || groups_ignore === undefined) {
      return jsonResponse({ success: false, error: 'Campos obrigatórios: instance_id, groups_ignore' }, 400);
    }

    // Buscar dados da instância
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, provider_type')
      .eq('id', instance_id)
      .single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ success: false, error: 'Instância não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar secrets da instância
    const { data: secrets, error: secretsError } = await supabase
      .from('whatsapp_instance_secrets')
      .select('api_url, api_key')
      .eq('instance_id', instance_id)
      .single();

    if (secretsError || !secrets) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais da instância não encontradas' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = secrets.api_url.replace(/\/$/, '');

    // Chamar Evolution API: POST /settings/set/{instance_name}
    const payload = {
      rejectCall: reject_call ?? false,
      msgCall: reject_call ? (msg_call ?? '') : '',
      groupsIgnore: groups_ignore,
      alwaysOnline: always_online ?? false,
      readMessages: read_messages ?? false,
      readStatus: false,
      syncFullHistory: false,
    };

    console.log(`[update-evolution-settings] Updating settings for ${instance.instance_name}:`, payload);

    const res = await fetch(`${baseUrl}/settings/set/${instance.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': secrets.api_key,
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    console.log(`[update-evolution-settings] Response (${res.status}): ${resText.substring(0, 300)}`);

    if (!res.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Evolution API respondeu ${res.status}: ${resText.substring(0, 200)}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se webhook_enabled foi explicitamente passado, atualizar o webhook na Evolution API
    if (webhook_enabled !== undefined) {
      const webhookUrl = `${supabaseUrl}/functions/v1/flow-webhook`;

      const webhookPayload = {
        webhook: {
          enabled: webhook_enabled,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      };

      console.log(`[update-evolution-settings] Updating webhook for ${instance.instance_name}: enabled=${webhook_enabled}`);

      const webhookRes = await fetch(`${baseUrl}/webhook/set/${instance.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': secrets.api_key,
        },
        body: JSON.stringify(webhookPayload),
      });

      const webhookText = await webhookRes.text();
      console.log(`[update-evolution-settings] Webhook response (${webhookRes.status}): ${webhookText.substring(0, 300)}`);

      if (!webhookRes.ok) {
        console.warn(`[update-evolution-settings] Webhook update failed: ${webhookText.substring(0, 200)}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[update-evolution-settings] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
