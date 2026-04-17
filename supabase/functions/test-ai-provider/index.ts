import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight first, before any auth checks
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Now check auth for actual requests
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { provider, key } = await req.json();

    if (!provider || !key) {
      return new Response(JSON.stringify({ error: "provider e key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let testUrl: string;
    let testHeaders: Record<string, string>;
    let testBody: any;
    let method = "GET";

    switch (provider) {
      case "groq":
        testUrl = "https://api.groq.com/openai/v1/models";
        testHeaders = {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        };
        break;

      case "gemini":
        testUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${key}`;
        testHeaders = {
          "Content-Type": "application/json",
        };
        testBody = {
          contents: [{ parts: [{ text: "test" }] }],
        };
        method = "POST";
        break;

      case "openai":
        testUrl = "https://api.openai.com/v1/models";
        testHeaders = {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        };
        break;

      case "lovable":
        testUrl = "https://ai.gateway.lovable.dev/v1/models";
        testHeaders = {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        };
        break;

      case "anthropic":
        testUrl = "https://api.anthropic.com/v1/messages";
        testHeaders = {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        };
        testBody = {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 10,
          messages: [{ role: "user", content: "test" }],
        };
        method = "POST";
        break;

      default:
        return new Response(JSON.stringify({ error: "provider desconhecido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const fetchOpts: RequestInit = {
      method,
      headers: testHeaders,
    };

    if (testBody) {
      fetchOpts.body = JSON.stringify(testBody);
    }

    const response = await fetch(testUrl, fetchOpts);

    if (response.ok || response.status === 401) {
      return new Response(
        JSON.stringify({
          success: response.ok,
          message: response.ok 
            ? `${provider} conectado com sucesso!` 
            : `${provider} reconhecido (chave possivelmente inválida)`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: `Falha ao conectar com ${provider}` }),
      {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[test-ai-provider] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
