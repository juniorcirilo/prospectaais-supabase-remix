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
    const { instance_id } = await req.json().catch(() => ({}));
    if (typeof instance_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(instance_id)) {
      return jsonResponse({ success: false, error: 'instance_id inválido' }, 400);
    }

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances').select('*').eq('id', instance_id).single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ success: false, error: 'Instância não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: secrets } = await supabase
      .from('whatsapp_instance_secrets').select('api_url, api_key').eq('instance_id', instance_id).maybeSingle();

    let evolutionError: string | null = null;

    if (instance.provider_type !== 'official' && secrets?.api_url && secrets?.api_key) {
      try {
        const baseUrl = secrets.api_url.replace(/\/$/, '');
        const deleteRes = await fetch(`${baseUrl}/instance/delete/${instance.instance_name}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'apikey': secrets.api_key },
        });
        if (!deleteRes.ok) {
          const txt = await deleteRes.text();
          evolutionError = `Evolution API retornou ${deleteRes.status}: ${txt.substring(0, 200)}`;
        }
      } catch (err) {
        evolutionError = err instanceof Error ? err.message : 'Erro desconhecido';
      }
    }

    const { error: dbError } = await supabase
      .from('whatsapp_instances').update({ is_active: false }).eq('id', instance_id);

    if (dbError) {
      return new Response(JSON.stringify({ success: false, error: dbError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, evolution_error: evolutionError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});