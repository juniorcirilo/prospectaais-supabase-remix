import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeBRPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (parseInt(num[0], 10) >= 6) digits = ddd + "9" + num;
  }
  return "55" + digits;
}

// ─── Industry inference from free-text query ───
const INDUSTRY_MAP: Record<string, string[]> = {
  advocacia: ["legal", "law practice", "advocacia", "advogado", "jurídico", "escritório de advocacia", "law firm"],
  restaurante: ["restaurants", "food & beverages", "restaurante", "gastronomia", "alimentação"],
  saúde: ["hospital & health care", "medical practice", "health", "saúde", "clínica", "médico"],
  dentista: ["health", "dental", "odontologia", "dentista", "odontológico"],
  hotel: ["hospitality", "hotels", "hotel", "hotelaria", "pousada", "resort"],
  imobiliária: ["real estate", "imobiliária", "imóveis", "corretor"],
  contabilidade: ["accounting", "contabilidade", "contador", "escritório contábil"],
  educação: ["education", "ensino", "escola", "faculdade", "universidade"],
  academia: ["health, wellness and fitness", "academia", "fitness", "gym"],
  "e-commerce": ["e-commerce", "retail", "loja virtual", "marketplace"],
  tecnologia: ["information technology", "software", "tech", "tecnologia", "ti"],
  engenharia: ["civil engineering", "construction", "engenharia", "construtora"],
  beleza: ["cosmetics", "beauty", "estética", "salão", "beleza"],
  pet: ["veterinary", "pet", "veterinária", "petshop"],
  logística: ["logistics", "transportation", "logística", "transporte", "frete"],
  marketing: ["marketing and advertising", "marketing", "agência", "publicidade"],
  financeiro: ["financial services", "banking", "fintech", "financeiro", "investimento"],
  seguros: ["insurance", "seguros", "seguradora", "corretora de seguros"],
  farmácia: ["pharmaceuticals", "farmácia", "drogaria"],
  agro: ["farming", "agriculture", "agronegócio", "agro", "agrícola"],
};

function inferIndustriesFromQuery(query: string): string[] {
  if (!query) return [];
  const lower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const results: string[] = [];
  
  for (const [key, industries] of Object.entries(INDUSTRY_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Check if any industry keyword appears in the query
    if (lower.includes(normalizedKey)) {
      results.push(...industries);
      continue;
    }
    // Check if any of the industry strings appear in the query
    for (const ind of industries) {
      const normalizedInd = ind.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (lower.includes(normalizedInd)) {
        results.push(...industries);
        break;
      }
    }
  }
  
  return [...new Set(results)];
}

// ─── Post-collection sector relevance filter ───
function filterOffTopicResults(contacts: any[], config: any): any[] {
  const industries = config.company?.industries || [];
  const query = (config.query || "").toLowerCase();
  
  // Only filter if there's a clear sector intent
  if (industries.length === 0 && !query) return contacts;
  
  // Build keyword set from industries + query
  const sectorKeywords: string[] = [];
  for (const ind of industries) {
    sectorKeywords.push(ind.toLowerCase());
  }
  if (query) {
    // Extract meaningful words from query
    const words = query.split(/\s+/).filter((w: string) => w.length > 3);
    sectorKeywords.push(...words);
  }
  
  if (sectorKeywords.length === 0) return contacts;
  
  // For each contact, check if company/industry/website has some relevance
  // Be lenient: only filter out contacts that are clearly off-topic
  const DIRECTORY_DOMAINS = [
    "empresaqui.com.br", "listasdeempresas.com", "speedio.com.br", "guiafacil.com", 
    "cnpj.info", "econodata.com.br", "infoplex.com.br", "saleshunter.com.br",
    "zoho.com", "salesforce.com", "hubspot.com", "pipedrive.com",
  ];
  
  return contacts.filter((c: any) => {
    // Always keep contacts without enough info to judge
    const company = (c.company || c.organization_name || "").toLowerCase();
    const website = (c.website || "").toLowerCase();
    const industry = (c.industry || "").toLowerCase();
    
    if (!company && !website) return true; // Can't judge, keep
    
    // Filter out directory/tool companies
    for (const dir of DIRECTORY_DOMAINS) {
      if (website.includes(dir) || company.includes(dir.split(".")[0])) {
        console.log(`[lead-search] Filtered directory/tool company: ${company} (${website})`);
        return false;
      }
    }
    
    // If we have sector keywords, check for minimum relevance
    // Only reject if the company seems clearly from a different industry
    // AND the industry field is populated with something unrelated
    if (industry && sectorKeywords.length > 0) {
      const hasRelevance = sectorKeywords.some((kw: string) => 
        company.includes(kw) || industry.includes(kw) || website.includes(kw)
      );
      // Also check broad industry match
      const broadIndustryMatch = industries.some((ind: string) => 
        industry.includes(ind.toLowerCase()) || ind.toLowerCase().includes(industry)
      );
      
      // Only filter if both industry is populated AND clearly mismatched
      if (!hasRelevance && !broadIndustryMatch && industry.length > 3) {
        // Check if it's a known off-topic tech company
        const techCompanies = ["saleshunter", "zoho", "salesforce", "hubspot", "pipedrive", "microsoft", "google", "amazon"];
        if (techCompanies.some(tc => company.includes(tc))) {
          console.log(`[lead-search] Filtered off-topic tech company: ${company} (industry: ${industry})`);
          return false;
        }
      }
    }
    
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { searchId } = await req.json();
    if (!searchId) {
      return new Response(JSON.stringify({ success: false, error: "searchId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: search, error: searchErr } = await supabase
      .from("lead_searches").select("*").eq("id", searchId).single();
    if (searchErr || !search) {
      return new Response(JSON.stringify({ success: false, error: "Search not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    await supabase.from("lead_searches").update({
      status: "running", started_at: new Date().toISOString(),
    }).eq("id", searchId);

    const config = search.config as any;
    const source = search.source as string;
    const requestedCount = config.volume?.per_page || 25;
    const volumeUnit = config.volume?.volume_unit || config.volume?.unit || "companies";
    const MAX_CONTACTS_PER_COMPANY = 3;

    // ─── Normalize config: infer industries from query if missing ───
    if ((!config.company?.industries || config.company.industries.length === 0) && config.query) {
      const inferred = inferIndustriesFromQuery(config.query);
      if (inferred.length > 0) {
        if (!config.company) config.company = {};
        config.company.industries = inferred;
        console.log(`[lead-search] Inferred industries from query "${config.query}":`, inferred);
      }
    }

    // Also apply query as q_keywords fallback for Apollo when no persona keywords
    if (config.query && (!config.persona?.keywords || config.persona.keywords.length === 0)) {
      if (!config.persona) config.persona = {};
      if (!config.persona.keywords) config.persona.keywords = [];
      // Extract meaningful words from query
      const queryWords = config.query.split(/\s+/).filter((w: string) => w.length > 3 && !["para", "como", "mais", "onde", "quero", "buscar", "encontrar"].includes(w.toLowerCase()));
      if (queryWords.length > 0) {
        config.persona.keywords.push(...queryWords);
        console.log(`[lead-search] Added query words as persona keywords:`, queryWords);
      }
    }
    
    let allContacts: any[] = [];

    // Apollo search
    if (source === "apollo" || source === "apollo_firecrawl") {
      // Read Apollo key from app_settings (database)
      const { data: apolloSetting } = await supabase
        .from("app_settings").select("value").eq("key", "apollo_api_key").single();
      const apolloKey = apolloSetting?.value || null;
      if (apolloKey) {
        try {
          if (volumeUnit === "companies") {
            const apolloContacts = await searchApolloByCompanies(apolloKey, config, requestedCount, MAX_CONTACTS_PER_COMPANY);
            allContacts.push(...apolloContacts.map((c: any) => ({ ...c, _source: "apollo" })));
            console.log(`[lead-search] Apollo (company mode) returned ${apolloContacts.length} contacts`);
          } else {
            const apolloContacts = await searchApollo(apolloKey, config);
            allContacts.push(...apolloContacts.map((c: any) => ({ ...c, _source: "apollo" })));
            console.log(`[lead-search] Apollo returned ${apolloContacts.length} contacts`);
          }
        } catch (e) {
          console.error("[lead-search] Apollo error:", e);
        }
      } else {
        console.warn("[lead-search] apollo_api_key not configured in app_settings");
      }
    }

    // Firecrawl search
    if (source === "firecrawl" || source === "firecrawl_site" || source === "apollo_firecrawl") {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        try {
          const fcContacts = await searchFirecrawl(firecrawlKey, config, source === "firecrawl_site");
          allContacts.push(...fcContacts.map((c: any) => ({ ...c, _source: "firecrawl" })));
          console.log(`[lead-search] Firecrawl returned ${fcContacts.length} contacts`);
        } catch (e) {
          console.error("[lead-search] Firecrawl error:", e);
        }
      } else {
        console.warn("[lead-search] FIRECRAWL_API_KEY not configured");
      }
    }

    // Merge duplicates within the batch when both sources ran
    if (source === "apollo_firecrawl") {
      allContacts = mergeBatchDuplicates(allContacts);
    }

    // Deduplicate phone/email within the same company
    allContacts = deduplicateWithinCompany(allContacts);

    // Post-collection sector filter
    const beforeFilter = allContacts.length;
    allContacts = filterOffTopicResults(allContacts, config);
    if (allContacts.length < beforeFilter) {
      console.log(`[lead-search] Sector filter removed ${beforeFilter - allContacts.length} off-topic contacts`);
    }

    // Deduplicate and save via upsert_lead_contact
    let newCount = 0;
    const targetListId = search.target_list_id;

    for (const c of allContacts) {
      const phone = c.phone ? normalizeBRPhone(c.phone) : (c.phone_normalized || null);
      if (phone) c.phone = phone;

      const { data: result, error: upsertErr } = await supabase.rpc("upsert_lead_contact", {
        p_name: c.name || "",
        p_phone: phone || "",
        p_company: c.company || c.organization_name || "",
        p_city: c.city || c.location || "",
        p_tags: c.tags || ["lead-search"],
        p_list_id: targetListId || null,
        p_custom_fields: {
          email: c.email || "",
          linkedin: c.linkedin_url || "",
          title: c.title || "",
          source_search_id: searchId,
          ...(c.custom_fields || {}),
        },
        p_score: 0,
      });

      if (upsertErr) {
        console.error("[lead-search] upsert_lead_contact error:", upsertErr);
        continue;
      }

      if (result?.id) c._contact_id = result.id;
      if (result?.is_new) newCount++;
    }

    const durationMs = Date.now() - startTime;
    await supabase.from("lead_searches").update({
      status: "completed",
      contacts_found: allContacts.length,
      contacts_new: newCount,
      result_data: allContacts,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
    }).eq("id", searchId);

    console.log(`[lead-search] ${searchId} completed: ${allContacts.length} found, ${newCount} new`);

    // Trigger AI enrichment asynchronously (fire-and-forget)
    if (allContacts.length > 0) {
      console.log(`[lead-search] Triggering AI enrichment for ${searchId}`);
      fetch(`${supabaseUrl}/functions/v1/lead-enrich-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ searchId }),
      }).catch((e) => console.error("[lead-search] Enrichment trigger error:", e));
    }

    return new Response(JSON.stringify({
      success: true, contacts_found: allContacts.length, contacts_new: newCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[lead-search] Error:", error);
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── Apollo Search ───
async function searchApollo(apiKey: string, config: any): Promise<any[]> {
  const body: any = {
    per_page: config.volume?.per_page || 25,
    page: 1,
  };

  // Persona
  if (config.persona?.titles?.length) body.person_titles = config.persona.titles;
  if (config.persona?.seniorities?.length) body.person_seniorities = config.persona.seniorities;
  if (config.persona?.departments?.length) body.person_department_or_subdepartments = config.persona.departments;
  if (config.persona?.keywords?.length) body.q_keywords = config.persona.keywords.join(" ");

  // Company
  if (config.company?.names?.length) body.q_organization_name = config.company.names.join(" OR ");
  if (config.company?.domains?.length) body.organization_domains = config.company.domains;
  if (config.company?.industries?.length) body.q_organization_keyword_tags = config.company.industries;
  if (config.company?.employee_ranges?.length) body.organization_num_employees_ranges = config.company.employee_ranges;
  if (config.company?.technologies?.length) body.currently_using_any_of_technology_uids = config.company.technologies;
  if (config.company?.funding_stages?.length) body.organization_latest_funding_stage_cd = config.company.funding_stages;
  if (config.company?.founded_year?.min) body.organization_founded_year_min = config.company.founded_year.min;
  if (config.company?.founded_year?.max) body.organization_founded_year_max = config.company.founded_year.max;
  if (config.company?.publicly_traded) body.organization_publicly_traded = true;
  if (config.company?.revenue?.min) body.organization_revenue_min = config.company.revenue.min;
  if (config.company?.revenue?.max) body.organization_revenue_max = config.company.revenue.max;

  // Location
  if (config.location?.person_locations?.length) body.person_locations = config.location.person_locations;
  if (config.location?.org_locations?.length) body.organization_locations = config.location.org_locations;

  // Quality filters
  if (config.filters?.email_status?.length) body.contact_email_status = config.filters.email_status;
  if (config.filters?.current_company) body.person_titles_current_only = true;
  if (config.filters?.has_phone) body.reveal_phone_number = true;

  console.log("[lead-search] Apollo request body:", JSON.stringify(body));

  const resp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("[lead-search] Apollo response:", JSON.stringify(data));
    throw new Error(`Apollo error ${resp.status}: ${JSON.stringify(data)}`);
  }

  const people = data.people || [];
  console.log("[lead-search] Apollo returned", people.length, "people");
  return people.map((p: any) => {
    let website = p.organization?.website_url || "";
    if (website) {
      try {
        const u = new URL(website.startsWith("http") ? website : `https://${website}`);
        website = `${u.protocol}//${u.hostname}`;
      } catch { /* keep as-is */ }
    }
    return {
      name: p.name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.first_name || p.last_name || "")),
      email: p.email || "",
      phone: p.phone_numbers?.[0]?.sanitized_number || "",
      title: p.title || "",
      company: p.organization?.name || "",
      city: p.city || "",
      linkedin_url: p.linkedin_url || "",
      organization_name: p.organization?.name || "",
      website,
      revenue: p.organization?.estimated_annual_revenue || "",
      employees_count: p.organization?.estimated_num_employees || "",
      _apollo_person_id: p.id || "",
      _apollo_org_id: p.organization?.id || "",
    };
  });
}

// ─── Apollo Search by Companies (paginated, diverse) ───
async function searchApolloByCompanies(
  apiKey: string, config: any, targetCompanies: number, maxContactsPerCompany: number
): Promise<any[]> {
  const companyMap = new Map<string, any[]>();
  const MAX_PAGES = 15;
  const PER_PAGE = 100;

  const seniorityOrder: Record<string, number> = {
    owner: 0, founder: 1, c_suite: 2, partner: 3, vp: 4, director: 5, manager: 6,
    senior: 7, entry: 8, intern: 9,
  };

  for (let page = 1; page <= MAX_PAGES; page++) {
    const body: any = { per_page: PER_PAGE, page };

    if (config.persona?.titles?.length) body.person_titles = config.persona.titles;
    if (config.persona?.seniorities?.length) body.person_seniorities = config.persona.seniorities;
    if (config.persona?.departments?.length) body.person_department_or_subdepartments = config.persona.departments;
    if (config.persona?.keywords?.length) body.q_keywords = config.persona.keywords.join(" ");
    if (config.company?.names?.length) body.q_organization_name = config.company.names.join(" OR ");
    if (config.company?.domains?.length) body.organization_domains = config.company.domains;
    if (config.company?.industries?.length) body.q_organization_keyword_tags = config.company.industries;
    if (config.company?.employee_ranges?.length) body.organization_num_employees_ranges = config.company.employee_ranges;
    if (config.company?.technologies?.length) body.currently_using_any_of_technology_uids = config.company.technologies;
    if (config.company?.funding_stages?.length) body.organization_latest_funding_stage_cd = config.company.funding_stages;
    if (config.company?.founded_year?.min) body.organization_founded_year_min = config.company.founded_year.min;
    if (config.company?.founded_year?.max) body.organization_founded_year_max = config.company.founded_year.max;
    if (config.company?.publicly_traded) body.organization_publicly_traded = true;
    if (config.company?.revenue?.min) body.organization_revenue_min = config.company.revenue.min;
    if (config.company?.revenue?.max) body.organization_revenue_max = config.company.revenue.max;
    if (config.location?.person_locations?.length) body.person_locations = config.location.person_locations;
    if (config.location?.org_locations?.length) body.organization_locations = config.location.org_locations;
    if (config.filters?.email_status?.length) body.contact_email_status = config.filters.email_status;
    if (config.filters?.current_company) body.person_titles_current_only = true;

    console.log(`[lead-search] Apollo company-mode page ${page}/${MAX_PAGES}, target: ${targetCompanies} companies, current: ${companyMap.size}`);

    const resp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[lead-search] Apollo response:", JSON.stringify(data));
      throw new Error(`Apollo error ${resp.status}: ${JSON.stringify(data)}`);
    }

    const people = data.people || [];
    if (people.length === 0) {
      console.log(`[lead-search] Apollo returned 0 results on page ${page}, stopping`);
      break;
    }

    for (const p of people) {
      const companyName = p.organization?.name || "";
      if (!companyName) continue;
      const key = companyName.toLowerCase().trim();

      let website = p.organization?.website_url || "";
      if (website) {
        try {
          const u = new URL(website.startsWith("http") ? website : `https://${website}`);
          website = `${u.protocol}//${u.hostname}`;
        } catch { /* keep as-is */ }
      }

      const contact = {
        name: p.name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.first_name || p.last_name || "")),
        email: p.email || "",
        phone: p.phone_numbers?.[0]?.sanitized_number || "",
        title: p.title || "",
        seniority: p.seniority || "",
        company: companyName,
        city: p.city || "",
        linkedin_url: p.linkedin_url || "",
        organization_name: companyName,
        website,
        revenue: p.organization?.estimated_annual_revenue || "",
        employees_count: p.organization?.estimated_num_employees || "",
        _apollo_person_id: p.id || "",
        _apollo_org_id: p.organization?.id || "",
      };

      if (!companyMap.has(key)) companyMap.set(key, []);
      companyMap.get(key)!.push(contact);
    }

    if (companyMap.size >= targetCompanies) {
      console.log(`[lead-search] Reached ${companyMap.size} companies (target: ${targetCompanies}), stopping pagination`);
      break;
    }

    if (people.length < PER_PAGE) {
      console.log(`[lead-search] Apollo returned ${people.length}/${PER_PAGE} on page ${page}, no more results`);
      break;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const result: any[] = [];
  for (const [companyKey, companyContacts] of companyMap) {
    companyContacts.sort((a, b) => {
      const aOrder = seniorityOrder[a.seniority] ?? 99;
      const bOrder = seniorityOrder[b.seniority] ?? 99;
      return aOrder - bOrder;
    });
    result.push(...companyContacts.slice(0, maxContactsPerCompany));
  }

  console.log(`[lead-search] Company mode: ${companyMap.size} companies, ${result.length} total contacts (max ${maxContactsPerCompany}/company)`);
  return result;
}

// ─── Deduplicate phone/email within the same company ───
function deduplicateWithinCompany(contacts: any[]): any[] {
  const companyGroups = new Map<string, any[]>();
  for (const c of contacts) {
    const key = (c.company || c.organization_name || "").toLowerCase().trim();
    if (!key) continue;
    if (!companyGroups.has(key)) companyGroups.set(key, []);
    companyGroups.get(key)!.push(c);
  }

  for (const [_, group] of companyGroups) {
    if (group.length < 2) continue;

    const phoneCounts = new Map<string, number>();
    for (const c of group) {
      const phone = (c.phone || "").replace(/\D/g, "");
      if (phone.length >= 8) {
        phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
      }
    }
    for (const [phone, count] of phoneCounts) {
      if (count >= 2) {
        console.log(`[lead-search] Clearing shared company phone ${phone} from ${count} contacts`);
        for (const c of group) {
          if ((c.phone || "").replace(/\D/g, "") === phone) {
            c.company_phone = c.phone;
            c.phone = "";
          }
        }
      }
    }

    const emailCounts = new Map<string, number>();
    for (const c of group) {
      const email = (c.email || "").toLowerCase().trim();
      if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
    for (const [email, count] of emailCounts) {
      if (count >= 2) {
        console.log(`[lead-search] Clearing shared company email ${email} from ${count} contacts`);
        for (const c of group) {
          if ((c.email || "").toLowerCase().trim() === email) {
            c.company_email = c.email;
            c.email = "";
          }
        }
      }
    }
  }

  return contacts;
}

// ─── Firecrawl Search ───
async function searchFirecrawl(apiKey: string, config: any, isSiteMode: boolean): Promise<any[]> {
  const parts: string[] = [];
  
  if (config.company?.industries?.length) parts.push(config.company.industries.join(" "));
  if (config.company?.names?.length) parts.push(config.company.names.join(" "));
  
  if (config.persona?.titles?.length) parts.push(config.persona.titles.join(" "));
  if (config.persona?.seniorities?.length) {
    const seniorityLabels: Record<string, string> = {
      owner: "dono proprietário", founder: "fundador", c_suite: "CEO diretor",
      vp: "vice-presidente", director: "diretor", manager: "gerente",
    };
    const labels = config.persona.seniorities
      .map((s: string) => seniorityLabels[s] || s)
      .join(" ");
    parts.push(labels);
  }
  
  if (config.location?.person_locations?.length) parts.push(config.location.person_locations.join(" "));
  if (config.location?.org_locations?.length && !config.location?.person_locations?.length) {
    parts.push(config.location.org_locations.join(" "));
  }
  
  if (config.persona?.keywords?.length) parts.push(config.persona.keywords.join(" "));
  if (config.query) parts.push(config.query);

  let query = parts.join(" ") || "contatos comerciais empresas";
  query += " contato telefone email empresa";

  if (isSiteMode && config.advanced?.site_domain) {
    query = `site:${config.advanced.site_domain} ${query}`;
  }

  const limit = config.volume?.per_page || 10;

  const industry = config.company?.industries?.join(", ") || "empresas";
  const location = config.location?.person_locations?.join(", ") || config.location?.org_locations?.join(", ") || "";
  const extractPrompt = `Extraia APENAS contatos REAIS de pessoas que trabalham em ${industry}${location ? ` na região de ${location}` : ""}.

REGRAS OBRIGATÓRIAS:
- Extraia SOMENTE dados que estão EXPLICITAMENTE escritos na página
- NÃO INVENTE nomes, telefones, emails ou empresas
- Se o dado não existe na página, deixe o campo VAZIO (string vazia "")
- NÃO use nomes genéricos como "João da Silva", "Maria Oliveira", "Fulano de Tal"
- NÃO use telefones sequenciais como 1234-5678, 8765-4321, 9876-5432
- NÃO use telefones com dígitos repetidos como 8888-8888, 9999-9999
- Se a página mostra apenas o telefone da empresa (fixo), coloque no campo phone
- Se encontrar um WhatsApp ou celular específico, coloque no campo phone
- Prefira números de celular (com 9° dígito) quando disponíveis
- Ignore políticos, órgãos públicos e resultados que não sejam empresas do setor ${industry}

Para cada contato extraia: nome completo REAL, telefone REAL (com DDD), email REAL, nome da empresa, cidade, cargo/título, site, instagram, linkedin.`;

  console.log("[lead-search] Firecrawl query:", query);

  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      lang: "pt-br",
      country: config.location?.country || "BR",
      scrapeOptions: {
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              contacts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nome completo da pessoa" },
                    phone: { type: "string", description: "Telefone com DDD" },
                    email: { type: "string", description: "Email de contato" },
                    company: { type: "string", description: "Nome da empresa" },
                    city: { type: "string", description: "Cidade" },
                    title: { type: "string", description: "Cargo ou função" },
                    website: { type: "string", description: "Site da empresa" },
                    instagram: { type: "string", description: "Instagram da empresa ou pessoa" },
                    linkedin_url: { type: "string", description: "URL do LinkedIn" },
                    company_description: { type: "string", description: "Breve descrição da empresa" },
                  },
                },
              },
            },
          },
          prompt: extractPrompt,
        },
      },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("[lead-search] Firecrawl response:", JSON.stringify(data));
    throw new Error(`Firecrawl error ${resp.status}: ${JSON.stringify(data)}`);
  }

  const results = data.data || [];
  const contacts: any[] = [];
  for (const r of results) {
    const extract = r.extract || r.json || r.data?.json || {};
    const extracted = extract.contacts || [];
    contacts.push(...extracted);
  }
  
  const validContacts = contacts.filter((c: any) => {
    const name = (c.name || "").trim().toLowerCase();
    if (!name || name.length < 3) return false;
    if (/cadastr|grátis|gratuito|login|sign.?up|registr|inscreva/i.test(name)) return false;
    
    if (isGenericFakeName(c.name || "")) {
      console.log(`[lead-search] Filtered hallucinated name: ${c.name}`);
      return false;
    }
    
    const company = (c.company || "").trim().toLowerCase();
    if (!company || company.length < 2) return false;
    if (/cadastr|grátis|gratuito|exemplo|example/i.test(company)) return false;
    if (/^metalúrgica (xyz|abc|exemplo|silva|test)/i.test(company)) {
      console.log(`[lead-search] Filtered hallucinated company: ${c.company}`);
      return false;
    }
    
    const phone = (c.phone || "").trim();
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      const isFake = 
        /[x*]{3,}/i.test(phone) ||
        /cadastr|grátis/i.test(phone) ||
        digits.length < 8 ||
        isPlaceholderNumber(digits);
      if (isFake) {
        console.log(`[lead-search] Filtered fake phone: ${phone}`);
        c.phone = "";
      }
    }
    
    const email = (c.email || "").trim();
    if (email && (/\*{2,}/.test(email) || /cadastr|grátis|exemplo|example/i.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      c.email = "";
    }
    
    return true;
  });
  
  console.log(`[lead-search] Firecrawl extracted ${contacts.length} contacts, ${validContacts.length} valid after filtering, from ${results.length} pages`);
  return validContacts;
}

// ─── Detect placeholder/fake phone numbers ───
function isPlaceholderNumber(digits: string): boolean {
  let local = digits;
  if (local.startsWith("55") && local.length > 11) local = local.slice(2);
  
  const sub = local.length === 11 ? local.slice(3) : local.slice(2);
  
  if (/^1234|^2345|^3456|^4567|^5678|^6789|^7890/.test(sub)) return true;
  if (/^9876|^8765|^7654|^6543|^5432|^4321/.test(sub)) return true;
  if (/^(\d)\1{5,}$/.test(sub)) return true;
  
  const digitCounts = new Map<string, number>();
  for (const d of sub) digitCounts.set(d, (digitCounts.get(d) || 0) + 1);
  const maxRepeat = Math.max(...digitCounts.values());
  if (maxRepeat >= 6 && sub.length <= 8) return true;
  
  if (/^(0000|9999|1111|0101|1010)/.test(sub)) return true;
  
  if (["12345678", "87654321", "98765432", "11111111", "22222222", "33333333", 
       "44444444", "55555555", "66666666", "77777777", "88888888", "99999999",
       "00000000", "11112222", "33334444"].includes(sub)) return true;
  
  return false;
}

// ─── Detect generic/fake names commonly hallucinated by LLMs ───
function isGenericFakeName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  const fakeNames = [
    "joão da silva", "joao da silva", "maria oliveira", "josé santos", "jose santos",
    "ana souza", "carlos pereira", "pedro almeida", "fulano de tal", "ciclano",
    "beltrano", "john doe", "jane doe", "nome completo", "nome do contato",
    "não informado", "nao informado", "desconhecido", "n/a", "teste",
  ];
  return fakeNames.some(f => lower === f || lower.startsWith(f));
}

// ─── Merge batch duplicates ───
function mergeBatchDuplicates(contacts: any[]): any[] {
  const map = new Map<string, any>();
  for (const c of contacts) {
    const phone = c.phone ? c.phone.replace(/\D/g, "") : "";
    const key = phone || `${(c.name || "").toLowerCase()}|${(c.company || "").toLowerCase()}`;
    if (!key || key === "|") { map.set(Math.random().toString(), c); continue; }
    if (map.has(key)) {
      const existing = map.get(key);
      for (const field of ["name", "email", "phone", "title", "company", "city", "linkedin_url"]) {
        if (!existing[field] && c[field]) existing[field] = c[field];
      }
    } else {
      map.set(key, { ...c });
    }
  }
  return Array.from(map.values());
}
