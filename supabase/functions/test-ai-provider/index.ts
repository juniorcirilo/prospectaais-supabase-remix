import { corsHeaders, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

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
        break;

      default:
        return new Response(JSON.stringify({ error: "provider desconhecido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch(testUrl, {
      method: "GET",
      headers: testHeaders,
      ...(testBody && { method: "POST", body: JSON.stringify(testBody) }),
    });

    if (response.ok || response.status === 401) {
      // 401 significa que a chave foi reconhecida mas pode estar inválida
      // Mas pelo menos prova que o provider está acessível
      return new Response(
        JSON.stringify({
          success: response.ok,
          message: response.ok ? `${provider} conectado com sucesso!` : `${provider} reconhecido (chave possivelmente inválida)`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: `Falha ao conectar com ${provider}` }), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[test-ai-provider] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
