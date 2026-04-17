import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!firecrawlKey) {
    return new Response(
      JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "jobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job
    const { data: job, error: jobErr } = await supabase
      .from("scraping_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as running
    const startTime = Date.now();
    await supabase
      .from("scraping_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);

    // Format URL
    let formattedUrl = job.url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL for company info:", formattedUrl);

    // Schema for company information extraction
    const extractionSchema = {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Nome da empresa" },
        description: { type: "string", description: "Descrição completa da empresa, o que faz, missão, visão" },
        services: { type: "string", description: "Serviços ou produtos oferecidos pela empresa" },
        industry: { type: "string", description: "Setor ou segmento de atuação" },
        phone: { type: "string", description: "Telefone principal da empresa" },
        whatsapp: { type: "string", description: "Número de WhatsApp da empresa (se disponível)" },
        email: { type: "string", description: "E-mail de contato da empresa" },
        address: { type: "string", description: "Endereço completo da empresa" },
        city: { type: "string", description: "Cidade da empresa" },
        state: { type: "string", description: "Estado da empresa" },
        website: { type: "string", description: "Website oficial" },
        cnpj: { type: "string", description: "CNPJ da empresa (se disponível)" },
        founding_year: { type: "string", description: "Ano de fundação" },
        employees_count: { type: "string", description: "Número estimado de funcionários" },
        linkedin_url: { type: "string", description: "URL do LinkedIn da empresa" },
        instagram: { type: "string", description: "URL ou @ do Instagram" },
        facebook: { type: "string", description: "URL da página do Facebook" },
        youtube: { type: "string", description: "URL do canal do YouTube" },
        tiktok: { type: "string", description: "URL ou @ do TikTok" },
        opening_hours: { type: "string", description: "Horário de funcionamento" },
        key_people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
          },
          description: "Pessoas-chave mencionadas no site (sócios, diretores, equipe)",
        },
        differentials: { type: "string", description: "Diferenciais competitivos ou pontos fortes destacados" },
        certifications: { type: "string", description: "Certificações, prêmios ou selos mencionados" },
        clients_or_partners: { type: "string", description: "Clientes, parceiros ou cases mencionados" },
        extra_info: { type: "string", description: "Qualquer outra informação relevante encontrada" },
      },
    };

    // Call Firecrawl scrape with extract format
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["extract"],
        extract: {
          schema: extractionSchema,
          prompt: `Extraia o máximo de informações possível sobre esta empresa. Busque: nome, descrição detalhada, serviços/produtos, contatos (telefone, WhatsApp, e-mail), endereço, redes sociais (LinkedIn, Instagram, Facebook, YouTube, TikTok), CNPJ, ano de fundação, número de funcionários, horário de funcionamento, pessoas-chave (sócios, diretores, equipe com nome, cargo, e-mail e telefone), diferenciais, certificações, clientes/parceiros e qualquer outra informação relevante. Seja o mais completo possível.`,
        },
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      console.error("Firecrawl error:", data);
      await supabase
        .from("scraping_jobs")
        .update({
          status: "failed",
          error_message: data.error || `Firecrawl returned ${response.status}`,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ success: false, error: data.error || "Scrape failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract company data from response
    const companyData = data?.data?.extract || data?.extract || {};

    console.log("Extracted company data:", JSON.stringify(companyData).slice(0, 500));

    // Count how many fields were filled
    const filledFields = Object.entries(companyData).filter(
      ([_, v]) => v && v !== "" && (!Array.isArray(v) || v.length > 0)
    ).length;

    const keyPeopleCount = Array.isArray(companyData.key_people) ? companyData.key_people.length : 0;

    // Update job as completed with company data
    await supabase
      .from("scraping_jobs")
      .update({
        status: "completed",
        contacts_found: filledFields,
        contacts_valid: keyPeopleCount,
        result_data: companyData,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", jobId);

    console.log(`Job ${jobId} completed: ${filledFields} fields extracted, ${keyPeopleCount} key people found`);

    return new Response(
      JSON.stringify({
        success: true,
        fields_extracted: filledFields,
        key_people_found: keyPeopleCount,
        company_data: companyData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scraping error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
