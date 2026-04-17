import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { base_text, instruction, count = 10, mode = 'full' } = await req.json();
    if (!base_text && mode !== 'generate_copy') throw new Error('base_text is required');
    if (base_text && (typeof base_text !== 'string' || base_text.length > 5000)) throw new Error('base_text inválido');
    if (typeof count !== 'number' || count < 1 || count > 50) throw new Error('count fora do intervalo (1-50)');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const isFragment = mode === 'fragment';
    const isRewrite = mode === 'rewrite';
    const isInline = mode === 'inline';

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === 'generate_copy') {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é criar uma copy completa para WhatsApp baseada nas instruções do usuário.

REGRAS OBRIGATÓRIAS:
- Use variáveis de envio com {{nome}}, {{empresa}}, {{cidade}} onde fizer sentido para personalização
- Adicione variações usando spintax {opção1|opção2|opção3} em trechos estratégicos (saudações, CTAs, transições, adjetivos)
- A copy deve soar natural, humana e persuasiva
- Adequada para WhatsApp (informal mas profissional)
- Inclua pelo menos 3-5 blocos de variação {|} espalhados na mensagem
- Inclua pelo menos 2-3 variáveis {{}} de personalização
- Use APENAS formatação nativa do WhatsApp: *negrito*, _itálico_, ~tachado~, \`monoespaçado\`
- NUNCA use Markdown (**, ##, [], etc). Apenas a sintaxe do WhatsApp.
- Retorne APENAS a mensagem final, sem explicações ou comentários.

EXEMPLO de formato esperado:
{Olá|E aí|Oi} {{nome}}, tudo {bem|certo|tranquilo}? Aqui é da {{empresa}}.`;

      userPrompt = `Instruções para a copy:
${instruction || base_text}

Crie uma copy completa para WhatsApp seguindo as regras.`;
    } else if (mode === 'enhance_copy') {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é MELHORAR uma copy existente de WhatsApp adicionando:

1. VARIÁVEIS DE PERSONALIZAÇÃO: Identifique onde faz sentido usar {{nome}}, {{empresa}}, {{cidade}} e substitua termos genéricos por variáveis
2. VARIAÇÕES (SPINTAX): Adicione blocos {opção1|opção2|opção3} em pontos estratégicos como:
   - Saudações
   - Adjetivos e advérbios
   - Frases de transição
   - CTAs (chamadas para ação)
   - Expressões coloquiais
3. MELHORIA GERAL: Torne o texto mais persuasivo, natural e profissional

REGRAS:
- Mantenha o sentido e tom original
- Adicione pelo menos 3-5 blocos de variação {|}
- Adicione variáveis {{}} onde fizer sentido (não force se não caber)
- Se já existirem variáveis ou spintax, preserve e adicione mais
- Use APENAS formatação nativa do WhatsApp: *negrito*, _itálico_, ~tachado~, \`monoespaçado\`
- NUNCA use Markdown (**, ##, [], etc). Apenas a sintaxe do WhatsApp.
- Retorne APENAS a mensagem melhorada, sem explicações.`;

      userPrompt = `Copy original:
"""
${base_text}
"""
${instruction ? `\nInstrução adicional: ${instruction}\n` : ''}
Melhore esta copy adicionando variáveis e variações.`;
    } else if (isInline) {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é gerar UM trecho de texto para ser inserido dentro de uma mensagem já existente.
Regras:
- Gere APENAS o trecho solicitado, NÃO a mensagem inteira
- O trecho deve se encaixar naturalmente no contexto da mensagem
- Soar humano e adequado para WhatsApp
- Ser conciso (1-2 frases no máximo)
- Use APENAS formatação nativa do WhatsApp: *negrito*, _itálico_, ~tachado~. NUNCA Markdown.
- Retorne APENAS o trecho gerado, sem aspas, explicações ou numeração.`;

      userPrompt = `Contexto da mensagem completa:
"""
${base_text}
"""

${instruction ? `Gere um trecho com esta instrução: ${instruction}` : 'Gere um trecho que continue/complemente naturalmente esta mensagem.'}

Retorne APENAS o trecho a ser inserido.`;
    } else if (isRewrite) {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é reescrever uma mensagem de WhatsApp, melhorando-a. Regras:
- Manter o sentido e objetivo original
- Melhorar a clareza, persuasão e naturalidade
- Soar humana e adequada para WhatsApp
- Manter comprimento similar
- Preservar variáveis {{nome}}, {{empresa}}, etc. EXATAMENTE como estão
- Preservar blocos de spintax {opção1|opção2} EXATAMENTE como estão
- Use APENAS formatação nativa do WhatsApp: *negrito*, _itálico_, ~tachado~. NUNCA Markdown (**, ##, etc).
- Retorne APENAS a mensagem reescrita, sem explicações ou numeração.`;

      userPrompt = `Mensagem original:
"""
${base_text}
"""
${instruction ? `\nInstrução especial: ${instruction}\n` : ''}
Reescreva esta mensagem.`;
    } else if (isFragment) {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é gerar variações alternativas de um TRECHO de mensagem. Cada variação deve:
- Ter tamanho similar ao original
- Manter o mesmo sentido e intenção
- Usar palavras e estruturas diferentes
- Soar natural

Retorne APENAS as variações, uma por linha, numeradas (1., 2., etc).
Não inclua explicações.`;

      userPrompt = `Trecho original: "${base_text}"
${instruction ? `\nInstrução: ${instruction}\n` : ''}
Gere ${Math.min(count, 10)} variações alternativas deste trecho.`;
    } else {
      systemPrompt = `Você é um especialista em copywriting para WhatsApp marketing no Brasil.
Sua tarefa é gerar variações de uma mensagem base. Cada variação deve:
- Manter o sentido e objetivo da mensagem original
- Variar estrutura, palavras, tom e abordagem
- Soar natural e humana (não robótica)
- Ser adequada para WhatsApp (informal mas profissional)
- Ter comprimento similar ao original

Retorne APENAS as variações, uma por linha, numeradas (1., 2., etc).
Não inclua explicações, apenas as mensagens.`;

      userPrompt = `Mensagem base:
"""
${base_text}
"""

${instruction ? `Instrução adicional: ${instruction}\n` : ''}
Gere ${Math.min(count, 20)} variações únicas desta mensagem.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI error:', response.status, t);
      throw new Error('Erro ao gerar variações');
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    if (isRewrite || isInline || mode === 'generate_copy' || mode === 'enhance_copy') {
      const rewritten = rawContent.replace(/^["']|["']$/g, '').trim();
      return new Response(JSON.stringify({ success: true, rewritten }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse numbered lines
    const variations = rawContent
      .split('\n')
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((line: string) => line.length > 10);

    return new Response(JSON.stringify({ success: true, variations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
