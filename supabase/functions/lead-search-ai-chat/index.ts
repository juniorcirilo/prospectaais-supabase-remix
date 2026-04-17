import { corsHeaders, requireAuth } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `Você é um assistente conversacional que ajuda a configurar buscas de leads para prospecção B2B.

PERSONALIDADE:
- Fale de forma natural, como um colega de trabalho
- Use linguagem informal mas profissional
- Use emojis com moderação (1-2 por mensagem)
- NUNCA despeje toda a configuração de uma vez
- Quando o usuário der uma descrição, confirme antes de chamar a ferramenta

FONTES DISPONÍVEIS:
- "apollo" — Banco B2B estruturado (melhor para empresa/cargo/indústria)
- "firecrawl" — Busca geral na web com extração estruturada
- "firecrawl_site" — Web com domínio fixo (LinkedIn, Google Maps, etc)
- "apollo_firecrawl" — Ambos em paralelo com merge automático

BLOCOS DE CONFIGURAÇÃO:
1. **Persona** (quem buscar): títulos/cargos, senioridade, departamento, palavras-chave, tempo no cargo, anos de experiência
2. **Empresa** (onde trabalha): nome, domínio, indústria/setor, tamanho (funcionários), receita anual, tecnologias usadas, estágio de funding, ano de fundação, capital aberto, vagas em aberto
3. **Localização**: cidade/estado/país da pessoa e da empresa, país-alvo web
4. **Enriquecimento**: email corporativo, email pessoal, telefone direto, enriquecer via site (Firecrawl scrape)
5. **Filtros de qualidade**: status do email (verified/likely/guessed/unavailable), tem email, tem telefone, empresa atual apenas, período de publicação (Firecrawl), ordenação
6. **Volume**: resultados por busca (10-100), unidade de volume (contatos ou empresas), máximo total de leads, enriquecimento em lote
7. **Avançado**: campos a extrair, domínio extra Firecrawl, schema customizado, timeout, deduplicação automática, exportar pro CRM

COMO FUNCIONA O ENRIQUECIMENTO (Deep Waterfall automático):
- O enriquecimento é feito APÓS a busca, clicando no botão "Enriquecer" na interface
- O sistema executa automaticamente um pipeline de 4 etapas:
  1. Apollo People Match — encontra dados pessoais via email/nome
  2. Apollo Org Enrich — busca métricas da empresa via domínio
  3. Apollo Collaborator Search — encontra outros decisores na mesma empresa
  4. Firecrawl Site Scrape — extrai telefones, emails e redes sociais do site oficial
- Após a coleta, a IA gera um resumo executivo e score de relevância para cada lead
- NÃO existe webhook, NÃO é assíncrono externo — tudo roda internamente
- NUNCA mencione webhooks, waterfall assíncrono, ou URLs de callback para o usuário

SENIORIDADES: owner, founder, c_suite, partner, vp, director, manager, senior, entry, intern

DEPARTAMENTOS: engineering, sales, marketing, finance, hr, operations, product, design, legal, support, it, executive

RANGES DE FUNCIONÁRIOS: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001+

ESTÁGIOS DE FUNDING: seed, series_a, series_b, series_c, series_d, ipo, private_equity

HIERARQUIA DE UI POR FONTE:
- Apollo → blocos 1, 2, 3, 4, 5, 6
- Firecrawl → blocos 1, 3, 5, 6 + query livre
- Ambos → todos os blocos + bloco 7 com dedup

FLUXO DE CONVERSA:
- Se o usuário descrever o que quer, resuma e confirme
- Se pedir modo guiado, pergunte UMA coisa por vez: fonte → persona → empresa → localização → enriquecimento → volume → confirma
- SÓ chame a ferramenta quando o usuário confirmar

MODO GUIADO:
1. "Qual fonte de busca?" (Apollo, Firecrawl Web, Firecrawl + Site, Apollo + Firecrawl)
2. "Quem você quer encontrar? Cargo, senioridade, departamento, palavras-chave..."
3. "Em que tipo de empresa? Setor, tamanho, tecnologias, receita..."
4. "Localização?" (cidade, estado, país)
5. "Quer revelar dados de contato na busca? Email corporativo, pessoal, telefone..."
6. "Quantas empresas quer buscar?" (padrão SEMPRE volume_unit: "companies"; só use "contacts" se o usuário pedir explicitamente contagem por contatos)
7. Confirma e chama a ferramenta

TEMPLATES COMUNS:
- "Donos de restaurante em São Paulo" → Apollo, persona: owner, location: São Paulo
- "CTOs de startups SaaS" → Apollo, persona: CTO, c_suite, company: employee_ranges 11-50
- "Dentistas no Rio de Janeiro" → Firecrawl, query: dentista, location: Rio
- "Diretores de marketing de e-commerce" → Apollo, persona: director, departments: marketing

REGRAS TÉCNICAS:
- Sempre responda em português do Brasil
- Se o usuário mencionar uma lista pelo nome, use o ID correspondente
- NUNCA mencione webhooks, URLs de callback, ou processos assíncronos externos
- Se o usuário pedir enriquecimento, explique que após a busca ele pode clicar em "Enriquecer" e o sistema faz tudo automaticamente (Apollo + Firecrawl + IA)
- Quando o usuário confirmar, chame a ferramenta IMEDIATAMENTE sem perguntas extras desnecessárias
- Seja direto e objetivo: se o usuário disse "manda bala" ou "pode criar", CRIE a busca na hora
- IMPORTANTE: Use volume_unit: "companies" como padrão em TODAS as buscas
- Só use volume_unit: "contacts" quando o usuário pedir explicitamente contagem por contatos
- Se o usuário diz "25 resultados" sem especificar, trate como 25 empresas

REGRA CRÍTICA DE INDÚSTRIA/SETOR:
- Quando o usuário mencionar um tipo específico de empresa ou setor (ex: "escritórios de advocacia", "restaurantes", "hotéis", "dentistas", "clínicas"), você OBRIGATORIAMENTE deve preencher o campo company.industries com os termos relevantes em inglês e português.
- Exemplos:
  - "escritórios de advocacia" → company.industries: ["legal", "law practice", "advocacia", "advogado", "jurídico", "escritório de advocacia"]
  - "restaurantes" → company.industries: ["restaurants", "food & beverages", "restaurante", "gastronomia"]
  - "hotéis" → company.industries: ["hospitality", "hotels", "hotel", "hotelaria"]
  - "clínicas médicas" → company.industries: ["hospital & health care", "medical practice", "saúde", "clínica"]
  - "dentistas" → company.industries: ["health", "dental", "odontologia", "dentista"]
- NUNCA deixe company.industries vazio quando o usuário especificar um setor.
- Se estiver em dúvida sobre os termos, inclua o máximo possível de variações (em inglês e português).`;


const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nome descritivo da busca" },
    source: { type: "string", enum: ["apollo", "firecrawl", "firecrawl_site", "apollo_firecrawl"] },
    target_list_name: { type: "string", description: "Nome da lista destino (opcional)" },
    target_list_id: { type: "string", description: "UUID da lista destino (opcional)" },
    config: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query livre para Firecrawl" },
        persona: {
          type: "object",
          properties: {
            titles: { type: "array", items: { type: "string" }, description: "Cargos/títulos" },
            seniorities: { type: "array", items: { type: "string" }, description: "Níveis de senioridade" },
            departments: { type: "array", items: { type: "string" }, description: "Departamentos" },
            keywords: { type: "array", items: { type: "string" }, description: "Palavras-chave do perfil" },
            tenure_months: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } }, description: "Tempo no cargo atual (meses)" },
            experience_years: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } }, description: "Anos de experiência total" },
          },
        },
        company: {
          type: "object",
          properties: {
            names: { type: "array", items: { type: "string" } },
            domains: { type: "array", items: { type: "string" } },
            industries: { type: "array", items: { type: "string" }, description: "OBRIGATÓRIO quando o usuário especificar setor. Inclua termos em inglês e português. Ex: ['legal', 'law practice', 'advocacia']" },
            employee_ranges: { type: "array", items: { type: "string" }, description: "Ranges: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001+" },
            revenue: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } }, description: "Receita anual USD" },
            technologies: { type: "array", items: { type: "string" }, description: "Tecnologias usadas" },
            funding_stages: { type: "array", items: { type: "string" }, description: "seed, series_a, series_b, etc" },
            founded_year: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } } },
            publicly_traded: { type: "boolean" },
            hiring: { type: "object", properties: { keywords: { type: "string" }, period: { type: "string" } }, description: "Vagas em aberto como sinal de compra" },
          },
        },
        location: {
          type: "object",
          properties: {
            person_locations: { type: "array", items: { type: "string" } },
            org_locations: { type: "array", items: { type: "string" } },
            country: { type: "string", description: "País-alvo para Firecrawl" },
          },
        },
        enrichment: {
          type: "object",
          properties: {
            reveal_corp_email: { type: "boolean", description: "Revelar email corporativo na busca Apollo" },
            reveal_personal_emails: { type: "boolean", description: "Revelar emails pessoais na busca Apollo" },
            reveal_phone: { type: "boolean", description: "Revelar telefone direto na busca Apollo" },
            firecrawl_enrich: { type: "boolean", description: "Enriquecer via scrape do site da empresa" },
          },
        },
        filters: {
          type: "object",
          properties: {
            email_status: { type: "array", items: { type: "string" }, description: "verified, likely, guessed, unavailable" },
            has_email: { type: "boolean" },
            has_phone: { type: "boolean" },
            current_company: { type: "boolean" },
            time_period: { type: "string", description: "Firecrawl tbs: qdr:h, qdr:d, qdr:w, qdr:m, qdr:y" },
            sort_by: { type: "string", description: "relevance ou date" },
          },
        },
        volume: {
          type: "object",
          properties: {
            per_page: { type: "number", description: "Quantidade desejada (10-100)" },
            volume_unit: { type: "string", enum: ["contacts", "companies"], description: "Se 'companies', o sistema buscará contatos suficientes para cobrir N empresas únicas. Padrão: 'companies'" },
            max_total: { type: "number", description: "Máximo total de leads" },
            bulk_enrich_batch: { type: "number", description: "Lote de enriquecimento (máx 10)" },
          },
        },
        advanced: {
          type: "object",
          properties: {
            site_domain: { type: "string", description: "Domínio específico para Firecrawl" },
            extract_fields: { type: "array", items: { type: "string" }, description: "name, company, title, email, phone, linkedin, instagram, website, revenue, employees" },
            custom_schema: { type: "object", description: "Schema JSON customizado para extração Firecrawl" },
            firecrawl_timeout: { type: "number", description: "Timeout em segundos" },
            dedup_enabled: { type: "boolean", description: "Deduplicação automática entre fontes" },
            export_to_crm: { type: "boolean" },
          },
        },
      },
    },
  },
  required: ["name", "source", "config"],
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_lead_search",
      description: "Cria uma configuração completa de busca de leads",
      parameters: SEARCH_SCHEMA,
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { messages, lists } = await req.json();
    if (!Array.isArray(messages) || messages.length > 100) throw new Error("messages inválidos");
    console.log("[lead-search-ai-chat] Received", messages?.length, "messages");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (lists?.length) {
      systemPrompt += `\n\nListas disponíveis:\n${lists.map((l: any) => `- "${l.name}" (ID: ${l.id})`).join("\n")}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: TOOLS,
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error("[lead-search-ai-chat] AI gateway error:", status, t);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[lead-search-ai-chat] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
