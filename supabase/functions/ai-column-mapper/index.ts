import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuth } from "../_shared/auth.ts";
import { callAIUnified } from "../_shared/ai-providers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { headers, sampleRows } = await req.json();
    if (!Array.isArray(headers) || headers.length > 200) throw new Error("headers inválidos");
    const systemPrompt = `Você é um assistente que mapeia colunas de CSV para campos de contato.
Campos disponíveis: phone (telefone/celular), name (nome), company (empresa), city (cidade), tags (etiquetas), status.
Colunas que não correspondem a nenhum destes campos devem ser listadas em "custom_fields" para serem salvas como campos personalizados.

IMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem explicação.`;

    const userPrompt = `Colunas CSV: ${JSON.stringify(headers)}
Dados exemplo (3 primeiras linhas): ${JSON.stringify(sampleRows)}

Mapeie cada coluna. Retorne JSON: {"mapping": {"phone": "coluna_telefone", "name": "coluna_nome", ...}, "custom_fields": ["col_extra1", "col_extra2"]}
Apenas inclua no mapping campos que realmente correspondem. Não force mapeamentos errados.`;

    // Call AI provider (supports Groq/OpenAI/Gemini/Lovable/Anthropic)
    const aiResult = await callAIUnified({
      systemPrompt,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    });

    if (!aiResult.ok) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", aiResult.status, aiResult.raw);
      throw new Error("AI gateway error");
    }

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = (aiResult.text || "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-column-mapper error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});