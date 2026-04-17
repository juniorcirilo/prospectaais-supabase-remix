import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requireAuth } from "../_shared/auth.ts";
import { detectAIProvider, callAIProvider } from "../_shared/ai-providers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { campaign_ids } = await req.json();
    if (!campaign_ids || !Array.isArray(campaign_ids) || campaign_ids.length < 2 || campaign_ids.length > 10) {
      return jsonResponse({ error: "Envie entre 2 e 10 campaign_ids" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaigns, error: cErr } = await supabase
      .from("broadcast_campaigns")
      .select("id, name, message_template, message_type, status, total_recipients, sent_count, failed_count, started_at, completed_at, delay_min_ms, delay_max_ms, batch_size, delay_between_batches, delay_between_batches_max, rotation_strategy, instance_ids, media_urls, media_rotation_mode")
      .in("id", campaign_ids);
    if (cErr) throw cErr;

    const statsPromises = campaign_ids.map(async (id: string) => {
      const { data } = await supabase.rpc("get_campaign_response_stats", { p_campaign_id: id });
      return { campaign_id: id, ...(data as any) };
    });
    const stats = await Promise.all(statsPromises);

    const campaignSummaries = campaigns!.map((c: any) => {
      const st = stats.find((s: any) => s.campaign_id === c.id);
      const durationMin = c.started_at && c.completed_at
        ? (new Date(c.completed_at).getTime() - new Date(c.started_at).getTime()) / 60000 : null;
      const velocity = durationMin && durationMin > 0 ? (st?.sent || 0) / durationMin : null;
      const responseRate = st?.sent > 0 ? ((st.replied / st.sent) * 100).toFixed(1) : "0";
      const deliveryRate = st?.total > 0 ? ((st.sent / st.total) * 100).toFixed(1) : "0";

      return `## Campanha: "${c.name}"
- Tipo: ${c.message_type}
- Mensagem template: """${c.message_template.substring(0, 500)}"""
- Total destinatários: ${c.total_recipients}
- Enviados: ${st?.sent || 0} | Falhas: ${st?.failed || 0}
- Respostas: ${st?.replied || 0} (Taxa: ${responseRate}%)
- Taxa de entrega: ${deliveryRate}%
- Duração: ${durationMin ? `${Math.round(durationMin)} min` : "N/A"}
- Velocidade: ${velocity ? `${velocity.toFixed(1)} msg/min` : "N/A"}
- Motor: batch=${c.batch_size}, delay=${c.delay_min_ms}-${c.delay_max_ms}ms, pausa=${c.delay_between_batches}-${c.delay_between_batches_max}s
- Rotação: ${c.rotation_strategy}, ${(c.instance_ids || []).length} instância(s)
- Mídias: ${(c.media_urls || []).length} arquivo(s), modo=${c.media_rotation_mode}`;
    }).join("\n\n---\n\n");

    // Use multi-provider AI instead of hardcoded Lovable
    const aiConfig = detectAIProvider();
    console.log(`[campaign-ai-analysis] Using provider: ${aiConfig.provider}`);

    const systemPrompt = `Você é um analista especialista em campanhas de disparo WhatsApp.
Analise as campanhas fornecidas e retorne uma análise estruturada usando a tool "campaign_analysis".

Para o campo "sections" crie seções com análise detalhada. Cada seção tem título e conteúdo em Markdown.

Para o campo "charts" crie gráficos relevantes para visualizar os dados. Cada gráfico tem:
- title: título do gráfico
- type: "bar", "horizontal_bar", ou "score"  
- data: array de objetos com campos para o eixo X e valores

Exemplos de charts úteis:
- Pontuação por critério (score de 0-10 para CTA, Personalização, Estrutura, etc.)
- Riscos identificados (score de severity)
- Comparação de configurações do motor

Seja direto, técnico e acionável no conteúdo.`;

    const messages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: `Analise e compare estas ${campaigns!.length} campanhas:\n\n${campaignSummaries}`,
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "campaign_analysis",
          description: "Retorna a análise estruturada das campanhas com seções e gráficos",
          parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Título da seção (ex: Resumo Executivo, Análise das Mensagens)" },
                        icon: { type: "string", enum: ["summary", "message", "performance", "engine", "insights"], description: "Ícone da seção" },
                        content: { type: "string", description: "Conteúdo em Markdown com **negrito**, *itálico*, `código` para variáveis, listas com -, > para destaques" },
                      },
                      required: ["title", "icon", "content"],
                      additionalProperties: false,
                    },
                  },
                  charts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        type: { type: "string", enum: ["bar", "horizontal_bar", "score"] },
                        data: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              value: { type: "number" },
                              max: { type: "number", description: "Valor máximo para score (default 10)" },
                              color: { type: "string", enum: ["primary", "success", "warning", "destructive", "info", "accent"], description: "Cor da barra" },
                            },
                            required: ["label", "value"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "type", "data"],
                      additionalProperties: false,
                    },
                  },
                  verdict: {
                    type: "string",
                    description: "Veredicto final em uma frase curta e impactante",
                  },
                },
                required: ["sections", "charts", "verdict"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "campaign_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await aiResponse.json();
    
    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      // Fallback: if no tool call, return raw content
      const content = aiData.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ 
        sections: [{ title: "Análise", icon: "summary", content }],
        charts: [],
        verdict: "",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campaign-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
