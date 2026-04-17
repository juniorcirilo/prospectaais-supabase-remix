import { corsHeaders, requireAuth } from "../_shared/auth.ts";
import { detectAIProvider, callAIProvider } from "../_shared/ai-providers.ts";

const SYSTEM_PROMPT_BASE = `Você é um assistente conversacional e amigável que ajuda a configurar sequências de follow-up para WhatsApp marketing.

PERSONALIDADE:
- Fale de forma natural, como um colega de trabalho que manja do assunto
- Use linguagem informal mas profissional. Pode usar "beleza", "show", "bora lá", "tranquilo"
- Quebre as respostas em partes menores e mais digeríveis
- Use emojis com moderação (1-2 por mensagem no máximo)
- NUNCA despeje toda a configuração de uma vez — vá construindo passo a passo com o usuário
- Quando o usuário der uma descrição completa, confirme cada parte de forma conversacional antes de chamar a ferramenta
- Faça comentários breves sobre as escolhas do usuário ("boa escolha!", "faz sentido", "isso costuma funcionar bem")

FLUXO DE CONVERSA:
- Ao receber uma descrição, NÃO chame a ferramenta imediatamente
- Primeiro, resuma o que entendeu de forma conversacional: "Beleza, deixa eu ver se entendi..."
- Depois monte step por step: "Ok, vamos montar as etapas 👇\n\n**Etapa 1** — após 24h..."
- Pergunte se quer ajustar algo: "Ficou bom assim ou quer mudar alguma coisa?"
- SÓ chame a ferramenta quando o usuário confirmar (ou se ele disser algo como "manda", "salva", "pode criar", "tá ótimo")
- Se o usuário parecer com pressa ou disser "cria direto" / "sem perguntas", aí sim pode chamar a ferramenta de primeira

MODO EDIÇÃO:
- Se o contexto incluir uma sequência existente, você está no modo edição
- Comece reconhecendo: "Vi aqui a sequência atual. O que você quer mudar?"
- Use edit_followup_sequence para aplicar alterações
- Se o usuário pedir para alterar apenas os steps, mantenha o restante da configuração inalterada
- Se o usuário pedir para adicionar um step, inclua os steps existentes + o novo
- Se o usuário pedir para remover um step, exclua-o da lista

BOAS PRÁTICAS (sugira de forma natural, NUNCA imponha):
- Intervalos muito curtos (< 5 min) podem parecer spam
- O ideal para follow-ups comerciais é entre 6h e 72h
- Progressão de tom: comece casual, fique mais direto no final
- 3-5 etapas costuma ser o sweet spot
Se o usuário pedir intervalos curtos, comente brevemente UMA vez e respeite a escolha.

MODO GUIADO:
Se o usuário pedir "modo guiado" ou "passo a passo", faça UMA pergunta por vez nesta ordem:
1. "Primeiro, qual vai ser o gatilho?" (liste as opções de forma amigável)
2. "Show! Quer associar a algum fluxo ou campanha?" (liste os disponíveis)
3. "Quantas etapas você imagina? E qual o intervalo entre elas?"
4. "Agora vamos pro conteúdo. O que a primeira mensagem vai dizer?" (sugira baseado no contexto)
5. "Quase lá! Janela de envio — quais dias e horários?"
6. "Última coisa: o que fazer quando converter ou quando não responder?"
Ao ter tudo, confirme e chame a ferramenta. NÃO faça múltiplas perguntas de uma vez.

REGRAS TÉCNICAS (não mencione para o usuário):
- Sempre responda em português do Brasil
- Use create_followup_sequence para novas e edit_followup_sequence para edições
- Se o usuário mencionar uma campanha ou fluxo pelo nome, use o ID correspondente

IMPORTANTE — DIFERENÇA ENTRE campaign_id E flow_id:
- campaign_id: Vincula a sequência a uma CAMPANHA DE BROADCAST. O enroller vai monitorar os destinatários dessa campanha e matricular quem NÃO respondeu após o delay. Use APENAS quando o gatilho for "no_reply" e o usuário EXPLICITAMENTE quiser fazer follow-up de uma campanha específica.
- flow_id: Vincula a sequência a um FLUXO DE AUTOMAÇÃO. Serve apenas como referência/contexto. NÃO ativa o enroller automático.
- NUNCA preencha campaign_id se o usuário só mencionou um fluxo. São coisas completamente diferentes.
- Se o usuário diz "associar ao fluxo X", use flow_id. Se diz "follow-up da campanha Y", use campaign_id.
- Na dúvida, PERGUNTE ao usuário se ele quer associar a uma campanha (para follow-up automático de quem não respondeu) ou a um fluxo (como referência).

Gatilhos disponíveis: no_reply, delivered_not_read, read_no_reply, pipeline_inactivity, deal_created, deal_stage_change, deal_lost, keyword_reply

Tipos de conteúdo: text, spintax, ai_rewrite, media, audio_tts, ai_prompt (usa o conteúdo como system prompt + histórico de conversa do contato para gerar mensagem personalizada via IA. Quando o usuário pedir mensagem contextual/personalizada/inteligente baseada no histórico, use ai_prompt.)

Tipos de delay: fixed, random, progressive

Unidades de delay: minutes, hours, days

Ações pós-conversão: move_pipeline, add_tag, notify, create_task
Ações pós-sem-resposta: tag_cold, winback_list, notify, nothing`;

const STEP_SCHEMA = {
  type: "object",
  properties: {
    delay_value: { type: "number" },
    delay_unit: { type: "string", enum: ["minutes", "hours", "days"] },
    delay_type: { type: "string", enum: ["fixed", "random", "progressive"] },
    content_type: { type: "string", enum: ["text", "spintax", "ai_rewrite", "media", "audio_tts", "ai_prompt"] },
    content: { type: "string", description: "Texto da mensagem ou system prompt (para ai_prompt)" },
  },
  required: ["delay_value", "delay_unit", "content_type", "content"],
};

const SEQUENCE_PROPERTIES = {
  name: { type: "string", description: "Nome da sequência" },
  description: { type: "string", description: "Descrição da sequência" },
  trigger_type: {
    type: "string",
    enum: ["no_reply", "delivered_not_read", "read_no_reply", "pipeline_inactivity", "deal_created", "deal_stage_change", "deal_lost", "keyword_reply"],
  },
  trigger_delay_hours: { type: "number", description: "Horas de delay após o gatilho" },
  trigger_keywords: {
    type: "array",
    items: { type: "string" },
    description: "Palavras-chave (apenas para trigger keyword_reply)",
  },
  campaign_id: { type: "string", description: "UUID da campanha de broadcast associada (opcional)" },
  flow_id: { type: "string", description: "UUID do fluxo de automação associado (opcional)" },
  max_attempts: { type: "number", description: "Número máximo de etapas" },
  ttl_days: { type: "number", description: "Dias de validade da sequência" },
  min_interval_hours: { type: "number", description: "Intervalo mínimo entre mensagens em horas (0 = sem limite)" },
  include_tags: { type: "array", items: { type: "string" }, description: "Tags de inclusão" },
  exclude_tags: { type: "array", items: { type: "string" }, description: "Tags de exclusão" },
  send_days: { type: "array", items: { type: "boolean" }, description: "Dias permitidos [Seg, Ter, Qua, Qui, Sex, Sáb, Dom]" },
  send_start: { type: "string", description: "Horário de início (HH:MM)" },
  send_end: { type: "string", description: "Horário de fim (HH:MM)" },
  post_convert_action: { type: "string", enum: ["move_pipeline", "add_tag", "notify", "create_task"] },
  post_no_reply_action: { type: "string", enum: ["tag_cold", "winback_list", "notify", "nothing"] },
  steps: {
    type: "array",
    items: STEP_SCHEMA,
    description: "Etapas da sequência com delay e conteúdo",
  },
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_followup_sequence",
      description: "Cria uma sequência completa de follow-up com todas as configurações",
      parameters: {
        type: "object",
        properties: SEQUENCE_PROPERTIES,
        required: ["name", "trigger_type", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_followup_sequence",
      description: "Edita uma sequência de follow-up existente. Envie apenas os campos que devem ser alterados. Para steps, envie a lista completa (incluindo steps inalterados).",
      parameters: {
        type: "object",
        properties: {
          ...SEQUENCE_PROPERTIES,
          on_reply_behavior: { type: "string", enum: ["cancel", "pause_resume", "restart"], description: "Comportamento ao receber resposta" },
        },
        required: [],
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { messages, flows, campaigns, editingSequence } = await req.json();
    if (!Array.isArray(messages) || messages.length > 100) throw new Error("messages inválidos");
    console.log("[followup-ai-chat] Received request with", messages?.length, "messages", editingSequence ? `(editing: ${editingSequence.name})` : "(new)");
    
    // Detecta qual provedor de IA usar
    const aiConfig = detectAIProvider();
    console.log(`[followup-ai-chat] Usando provider: ${aiConfig.provider}`);

    // Build dynamic system prompt with available flows and campaigns
    let systemPrompt = SYSTEM_PROMPT_BASE;
    if (flows?.length) {
      systemPrompt += `\n\nFluxos disponíveis para associação:\n${flows.map((f: any) => `- "${f.name}" (ID: ${f.id}, status: ${f.status})`).join("\n")}`;
    }
    if (campaigns?.length) {
      systemPrompt += `\n\nCampanhas disponíveis para associação:\n${campaigns.map((c: any) => `- "${c.name}" (ID: ${c.id}, status: ${c.status})`).join("\n")}`;
    }

    // If editing, include the current sequence config as context
    if (editingSequence) {
      systemPrompt += `\n\n─── MODO EDIÇÃO ───\nVocê está editando a sequência existente. Use edit_followup_sequence para aplicar alterações.\n\nConfiguração atual:\n${JSON.stringify(editingSequence, null, 2)}`;
    }

    const response = await callAIProvider(aiConfig, {
      systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      tools: TOOLS,
      stream: true,
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error(`[followup-ai-chat] AI provider error (${aiConfig.provider}):`, status, t);
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402 || status === 401) {
        return new Response(JSON.stringify({ error: "Chave de API inválida ou créditos insuficientes." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Erro no provider de IA (${aiConfig.provider})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[followup-ai-chat] Streaming response back to client");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[followup-ai-chat] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
