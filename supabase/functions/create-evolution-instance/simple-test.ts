import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[SIMPLE] START");
  
  if (req.method === 'OPTIONS') {
    console.log("[SIMPLE] OPTIONS");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SIMPLE] Got request");
    const body = await req.json().catch(() => ({}));
    console.log("[SIMPLE] Body:", body);

    return new Response(JSON.stringify({
      success: true,
      message: "OK - Simple function works!",
      received: body,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[SIMPLE] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
