import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('All retries failed');
}

function normalizeBrazilianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  if (digits.length === 10) {
    const firstDigit = parseInt(digits[2], 10);
    if (firstDigit >= 6) digits = digits.slice(0, 2) + '9' + digits.slice(2);
  }
  return '55' + digits;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { instance_id, phone_number, content, message_type = 'text', media_url, file_name } = await req.json();

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, instance_id_external, provider_type, status')
      .eq('id', instance_id).single();

    if (instanceError || !instance) throw new Error('Instance not found');
    if (instance.status !== 'connected') throw new Error(`Instance is not connected. Status: ${instance.status}`);

    const { data: secrets, error: secretsError } = await supabase
      .from('whatsapp_instance_secrets').select('api_url, api_key').eq('instance_id', instance_id).single();

    if (secretsError || !secrets) throw new Error('Instance secrets not found');

    const instanceIdentifier = instance.provider_type === 'evolution_cloud' && instance.instance_id_external
      ? instance.instance_id_external : instance.instance_name;

    const formattedNumber = normalizeBrazilianPhone(phone_number) ?? phone_number.replace(/\D/g, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': secrets.api_key };
    const base = secrets.api_url.replace(/\/$/, '');

    let endpoint: string;
    let payload: any;

    switch (message_type) {
      case 'text':
        endpoint = `${base}/message/sendText/${instanceIdentifier}`;
        payload = { number: formattedNumber, text: content };
        break;
      case 'audio':
        endpoint = `${base}/message/sendWhatsAppAudio/${instanceIdentifier}`;
        payload = { number: formattedNumber, audio: media_url };
        break;
      case 'image':
        endpoint = `${base}/message/sendMedia/${instanceIdentifier}`;
        payload = { number: formattedNumber, mediatype: 'image', media: media_url, caption: content || '' };
        break;
      case 'document':
        endpoint = `${base}/message/sendMedia/${instanceIdentifier}`;
        payload = { number: formattedNumber, mediatype: 'document', media: media_url, caption: content || '', fileName: file_name || 'document' };
        break;
      default:
        throw new Error(`Unsupported message type: ${message_type}`);
    }

    const response = await fetchWithRetry(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    const responseText = await response.text();

    if (!response.ok) throw new Error(`Evolution API error: ${responseText}`);

    let responseData;
    try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

    const messageId = responseData?.key?.id || responseData?.messageId || responseData?.id;

    return new Response(JSON.stringify({ success: true, messageId, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});