// Shared AI Provider abstraction
// Suporta: Lovable, Gemini, OpenAI, Groq, Anthropic

export type AIProvider = "lovable" | "gemini" | "openai" | "groq" | "anthropic";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AIProviderOptions {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  tools?: any[];
  stream?: boolean;
}

/**
 * Detecta qual provider usar baseado em variáveis de ambiente
 * Ordem de prioridade: Lovable > Gemini > OpenAI > Groq > Anthropic
 */
export function detectAIProvider(): AIProviderConfig {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) return { provider: "lovable", apiKey: lovableKey, model: "google/gemini-2.5-flash" };

  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (geminiKey) return { provider: "gemini", apiKey: geminiKey, model: "gemini-2.5-flash" };

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) return { provider: "openai", apiKey: openaiKey, model: "gpt-4o-mini" };

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (groqKey) return { provider: "groq", apiKey: groqKey, model: "mixtral-8x7b-32768" };

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) return { provider: "anthropic", apiKey: anthropicKey, model: "claude-3-5-sonnet-20241022" };

  throw new Error("Nenhuma chave de IA configurada. Configure uma de: LOVABLE_API_KEY, GOOGLE_GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY");
}

/**
 * Faz requisição para o provider de IA selecionado
 */
export async function callAIProvider(
  config: AIProviderConfig,
  options: AIProviderOptions,
): Promise<Response> {
  switch (config.provider) {
    case "lovable":
      return callLovable(config.apiKey, options);
    case "gemini":
      return callGemini(config.apiKey, config.model, options);
    case "openai":
      return callOpenAI(config.apiKey, config.model, options);
    case "groq":
      return callGroq(config.apiKey, config.model, options);
    case "anthropic":
      return callAnthropic(config.apiKey, config.model, options);
    default:
      throw new Error(`Provider não suportado: ${config.provider}`);
  }
}

// ─── LOVABLE ───
async function callLovable(apiKey: string, options: AIProviderOptions): Promise<Response> {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: options.systemPrompt }, ...options.messages],
      tools: options.tools,
      stream: options.stream !== false,
    }),
  });
}

// ─── GEMINI ───
async function callGemini(apiKey: string, model: string, options: AIProviderOptions): Promise<Response> {
  // Gemini via REST API (não suporta tools com streaming nativamente em geral, mas podemos usar)
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: options.systemPrompt,
      contents: options.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      tools: options.tools
        ? [{
            function_declarations: options.tools.map((t) => ({
              name: t.function?.name || "",
              description: t.function?.description || "",
              parameters: t.function?.parameters || {},
            })),
          }]
        : undefined,
    }),
  });
}

// ─── OPENAI ───
async function callOpenAI(apiKey: string, model: string, options: AIProviderOptions): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: options.systemPrompt }, ...options.messages],
      tools: options.tools?.map((t) => ({ type: "function", function: t.function })),
      stream: options.stream !== false,
    }),
  });
}

// ─── GROQ ───
async function callGroq(apiKey: string, model: string, options: AIProviderOptions): Promise<Response> {
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: options.systemPrompt }, ...options.messages],
      tools: options.tools?.map((t) => ({ type: "function", function: t.function })),
      stream: options.stream !== false,
    }),
  });
}

// ─── ANTHROPIC (Claude) ───
async function callAnthropic(apiKey: string, model: string, options: AIProviderOptions): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: options.systemPrompt,
      messages: options.messages,
      tools: options.tools?.map((t) => ({
        name: t.function?.name || "",
        description: t.function?.description || "",
        input_schema: t.function?.parameters || {},
      })),
    }),
  });
}
