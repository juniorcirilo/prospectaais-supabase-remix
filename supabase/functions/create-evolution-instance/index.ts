import { serve } from "https://deno.land/std@0.168.0/http/server.ts"\;

serve(async (req) => {
  console.log("[🔧 TEST] Received", req.method, "request");
  
  if (req.method === 'OPTIONS') {
    console.log("[🔧 TEST] Responding to OPTIONS");
    return new Response(null, { 
      headers: { "Access-Control-Allow-Origin": "*" } 
    });
  }

  try {
    console.log("[🔧 TEST] Parsing body...");
    const body = await req.json().catch((err) => {
      console.error("[🔧 TEST] JSON parse failed:", err);
      return {};
    });
    console.log("[🔧 TEST] Body received:", JSON.stringify(body));

    console.log("[🔧 TEST] Returning 200 OK");
    return new Response(JSON.stringify({
      success: true,
      message: "✅ Function is deployed and responding!",
      received: body,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json" 
      },
    });
  } catch (error) {
    console.error("[🔧 TEST] Unexpected error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json" 
      },
    });
  }
});
