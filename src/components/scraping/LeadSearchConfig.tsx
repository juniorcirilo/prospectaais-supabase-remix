import { useState, useEffect } from "react";
import { ArrowLeft, Play, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLeadSearches } from "@/hooks/useLeadSearches";
import { useContacts } from "@/hooks/useContacts";

interface Props {
  onBack: () => void;
  searchId?: string | null;
}

const SENIORITIES = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
  { value: "intern", label: "Intern" },
];

const DEPARTMENTS = [
  "engineering", "sales", "marketing", "finance", "hr", "operations",
  "product", "design", "legal", "support", "it", "executive",
];

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"];

const FUNDING_STAGES = ["seed", "series_a", "series_b", "series_c", "series_d", "ipo", "private_equity"];

const EMAIL_STATUSES = [
  { value: "verified", label: "Verificado" },
  { value: "likely", label: "Provável" },
  { value: "guessed", label: "Adivinhado" },
  { value: "unavailable", label: "Indisponível" },
];

const FIRECRAWL_TIME_FILTERS = [
  { value: "", label: "Qualquer período" },
  { value: "qdr:h", label: "Última hora" },
  { value: "qdr:d", label: "Último dia" },
  { value: "qdr:w", label: "Última semana" },
  { value: "qdr:m", label: "Último mês" },
  { value: "qdr:y", label: "Último ano" },
];

const EXTRACT_FIELDS = [
  { key: "name", label: "Nome" },
  { key: "company", label: "Empresa" },
  { key: "title", label: "Cargo" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "website", label: "Site" },
  { key: "revenue", label: "Receita" },
  { key: "employees", label: "Nº funcionários" },
];

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground inline-block ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export default function LeadSearchConfig({ onBack, searchId }: Props) {
  const { createSearch, updateSearch, searches } = useLeadSearches();
  const { lists } = useContacts();
  const isEditing = !!searchId;

  // Base
  const [name, setName] = useState("");
  const [source, setSource] = useState("apollo");
  const [targetListId, setTargetListId] = useState("");

  // Bloco 1 — Persona
  const [titles, setTitles] = useState("");
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [tenureMin, setTenureMin] = useState("");
  const [tenureMax, setTenureMax] = useState("");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");

  // Bloco 2 — Empresa
  const [companyNames, setCompanyNames] = useState("");
  const [companyDomains, setCompanyDomains] = useState("");
  const [industries, setIndustries] = useState("");
  const [employeeRanges, setEmployeeRanges] = useState<string[]>([]);
  const [revenueMin, setRevenueMin] = useState("");
  const [revenueMax, setRevenueMax] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [fundingStages, setFundingStages] = useState<string[]>([]);
  const [foundedMin, setFoundedMin] = useState("");
  const [foundedMax, setFoundedMax] = useState("");
  const [publiclyTraded, setPubliclyTraded] = useState(false);
  const [hiringKeywords, setHiringKeywords] = useState("");
  const [hiringPeriod, setHiringPeriod] = useState("");

  // Bloco 3 — Localização
  const [personLocations, setPersonLocations] = useState("");
  const [orgLocations, setOrgLocations] = useState("");
  const [country, setCountry] = useState("BR");

  // Bloco 4 — Enriquecimento
  const [revealCorpEmail, setRevealCorpEmail] = useState(false);
  const [revealPersonalEmail, setRevealPersonalEmail] = useState(false);
  const [revealPhone, setRevealPhone] = useState(false);
  const [waterfallEmail, setWaterfallEmail] = useState(false);
  const [waterfallPhone, setWaterfallPhone] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [firecrawlEnrich, setFirecrawlEnrich] = useState(false);
  const [fireEnrich, setFireEnrich] = useState(false);

  // Bloco 5 — Filtros
  const [emailStatuses, setEmailStatuses] = useState<string[]>([]);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [currentCompany, setCurrentCompany] = useState(true);
  const [timePeriod, setTimePeriod] = useState("");
  const [sortBy, setSortBy] = useState("");

  // Bloco 6 — Volume
  const [perPage, setPerPage] = useState(25);
  const [volumeUnit, setVolumeUnit] = useState<"contacts" | "companies">("companies");
  const [maxTotal, setMaxTotal] = useState("");
  const [bulkEnrichBatch, setBulkEnrichBatch] = useState("");

  // Bloco 7 — Avançado
  const [query, setQuery] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [extractFields, setExtractFields] = useState<string[]>(["name", "company", "title", "email", "phone"]);
  const [customSchema, setCustomSchema] = useState("");
  const [firecrawlTimeout, setFirecrawlTimeout] = useState(5);
  const [dedupEnabled, setDedupEnabled] = useState(true);
  const [exportToCrm, setExportToCrm] = useState(false);

  // Pre-fill from existing search when editing
  useEffect(() => {
    if (!searchId) return;
    const existing = searches.find((s) => s.id === searchId);
    if (!existing) return;
    const c = existing.config || {};
    setName(existing.name || "");
    setSource(existing.source || "apollo");
    setTargetListId(existing.target_list_id || "");
    if (c.query) setQuery(c.query);
    if (c.persona) {
      if (c.persona.titles) setTitles(c.persona.titles.join(", "));
      if (c.persona.seniorities) setSeniorities(c.persona.seniorities);
      if (c.persona.departments) setDepartments(c.persona.departments);
      if (c.persona.keywords) setKeywords(c.persona.keywords.join(", "));
      if (c.persona.tenure_months) { setTenureMin(String(c.persona.tenure_months.min || "")); setTenureMax(String(c.persona.tenure_months.max || "")); }
      if (c.persona.experience_years) { setExperienceMin(String(c.persona.experience_years.min || "")); setExperienceMax(String(c.persona.experience_years.max || "")); }
    }
    if (c.company) {
      if (c.company.names) setCompanyNames(c.company.names.join(", "));
      if (c.company.domains) setCompanyDomains(c.company.domains.join(", "));
      if (c.company.industries) setIndustries(c.company.industries.join(", "));
      if (c.company.employee_ranges) setEmployeeRanges(c.company.employee_ranges);
      if (c.company.revenue) { setRevenueMin(String(c.company.revenue.min || "")); setRevenueMax(String(c.company.revenue.max || "")); }
      if (c.company.technologies) setTechnologies(c.company.technologies.join(", "));
      if (c.company.funding_stages) setFundingStages(c.company.funding_stages);
      if (c.company.founded_year) { setFoundedMin(String(c.company.founded_year.min || "")); setFoundedMax(String(c.company.founded_year.max || "")); }
      if (c.company.publicly_traded) setPubliclyTraded(true);
      if (c.company.hiring) { setHiringKeywords(c.company.hiring.keywords || ""); setHiringPeriod(c.company.hiring.period || ""); }
    }
    if (c.location) {
      if (c.location.person_locations) setPersonLocations(c.location.person_locations.join(", "));
      if (c.location.org_locations) setOrgLocations(c.location.org_locations.join(", "));
      if (c.location.country) setCountry(c.location.country);
    }
    if (c.enrichment) {
      setRevealCorpEmail(!!c.enrichment.reveal_corp_email);
      setRevealPersonalEmail(!!c.enrichment.reveal_personal_emails);
      setRevealPhone(!!c.enrichment.reveal_phone);
      setWaterfallEmail(!!c.enrichment.waterfall_email);
      setWaterfallPhone(!!c.enrichment.waterfall_phone);
      if (c.enrichment.webhook_url) setWebhookUrl(c.enrichment.webhook_url);
      setFirecrawlEnrich(!!c.enrichment.firecrawl_enrich);
      setFireEnrich(!!c.enrichment.fire_enrich);
    }
    if (c.filters) {
      if (c.filters.email_status) setEmailStatuses(c.filters.email_status);
      if (c.filters.has_email) setHasEmail(true);
      if (c.filters.has_phone) setHasPhone(true);
      if (c.filters.current_company !== undefined) setCurrentCompany(c.filters.current_company);
      if (c.filters.time_period) setTimePeriod(c.filters.time_period);
      if (c.filters.sort_by) setSortBy(c.filters.sort_by);
    }
    if (c.volume) {
      if (c.volume.per_page) setPerPage(c.volume.per_page);
      if (c.volume.volume_unit) setVolumeUnit(c.volume.volume_unit);
      if (c.volume.max_total) setMaxTotal(String(c.volume.max_total));
      if (c.volume.bulk_enrich_batch) setBulkEnrichBatch(String(c.volume.bulk_enrich_batch));
    }
    if (c.advanced) {
      if (c.advanced.site_domain) setSiteDomain(c.advanced.site_domain);
      if (c.advanced.extract_fields) setExtractFields(c.advanced.extract_fields);
      if (c.advanced.custom_schema) setCustomSchema(JSON.stringify(c.advanced.custom_schema, null, 2));
      if (c.advanced.firecrawl_timeout) setFirecrawlTimeout(c.advanced.firecrawl_timeout);
      if (c.advanced.dedup_enabled !== undefined) setDedupEnabled(c.advanced.dedup_enabled);
      if (c.advanced.export_to_crm) setExportToCrm(c.advanced.export_to_crm);
    }
  }, [searchId, searches]);

  const isApollo = source === "apollo" || source === "apollo_firecrawl";
  const isFirecrawl = source === "firecrawl" || source === "firecrawl_site" || source === "apollo_firecrawl";
  const isSiteMode = source === "firecrawl_site";
  const isBoth = source === "apollo_firecrawl";

  const handleSubmit = () => {
    const config: any = {};
    if (query) config.query = query;

    // Persona
    const titlesArr = titles.split(",").map((s) => s.trim()).filter(Boolean);
    const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean);
    if (titlesArr.length || seniorities.length || departments.length || kw.length || tenureMin || experienceMin) {
      config.persona = {} as any;
      if (titlesArr.length) config.persona.titles = titlesArr;
      if (seniorities.length) config.persona.seniorities = seniorities;
      if (departments.length) config.persona.departments = departments;
      if (kw.length) config.persona.keywords = kw;
      if (tenureMin || tenureMax) config.persona.tenure_months = { min: Number(tenureMin) || 0, max: Number(tenureMax) || 999 };
      if (experienceMin || experienceMax) config.persona.experience_years = { min: Number(experienceMin) || 0, max: Number(experienceMax) || 99 };
    }

    // Company
    const cNames = companyNames.split(",").map((s) => s.trim()).filter(Boolean);
    const cDomains = companyDomains.split(",").map((s) => s.trim()).filter(Boolean);
    const industryArr = industries.split(",").map((s) => s.trim()).filter(Boolean);
    const techArr = technologies.split(",").map((s) => s.trim()).filter(Boolean);
    if (cNames.length || cDomains.length || industryArr.length || employeeRanges.length || revenueMin || techArr.length || fundingStages.length || foundedMin || publiclyTraded || hiringKeywords) {
      config.company = {} as any;
      if (cNames.length) config.company.names = cNames;
      if (cDomains.length) config.company.domains = cDomains;
      if (industryArr.length) config.company.industries = industryArr;
      if (employeeRanges.length) config.company.employee_ranges = employeeRanges;
      if (revenueMin || revenueMax) config.company.revenue = { min: Number(revenueMin) || 0, max: Number(revenueMax) || undefined };
      if (techArr.length) config.company.technologies = techArr;
      if (fundingStages.length) config.company.funding_stages = fundingStages;
      if (foundedMin || foundedMax) config.company.founded_year = { min: Number(foundedMin) || undefined, max: Number(foundedMax) || undefined };
      if (publiclyTraded) config.company.publicly_traded = true;
      if (hiringKeywords) {
        config.company.hiring = { keywords: hiringKeywords, period: hiringPeriod || "30d" };
      }
    }

    // Location
    const pLocs = personLocations.split(",").map((s) => s.trim()).filter(Boolean);
    const oLocs = orgLocations.split(",").map((s) => s.trim()).filter(Boolean);
    if (pLocs.length || oLocs.length || country) {
      config.location = {} as any;
      if (pLocs.length) config.location.person_locations = pLocs;
      if (oLocs.length) config.location.org_locations = oLocs;
      if (country) config.location.country = country;
    }

    // Enrichment
    if (revealCorpEmail || revealPersonalEmail || revealPhone || waterfallEmail || waterfallPhone || firecrawlEnrich || fireEnrich) {
      config.enrichment = {
        reveal_corp_email: revealCorpEmail,
        reveal_personal_emails: revealPersonalEmail,
        reveal_phone: revealPhone,
        waterfall_email: waterfallEmail,
        waterfall_phone: waterfallPhone,
        webhook_url: webhookUrl || undefined,
        firecrawl_enrich: firecrawlEnrich,
        fire_enrich: fireEnrich,
      };
    }

    // Filters
    if (emailStatuses.length || hasEmail || hasPhone || currentCompany || timePeriod || sortBy) {
      config.filters = {} as any;
      if (emailStatuses.length) config.filters.email_status = emailStatuses;
      if (hasEmail) config.filters.has_email = true;
      if (hasPhone) config.filters.has_phone = true;
      if (currentCompany) config.filters.current_company = true;
      if (timePeriod) config.filters.time_period = timePeriod;
      if (sortBy) config.filters.sort_by = sortBy;
    }

    // Volume
    config.volume = { per_page: perPage, volume_unit: volumeUnit };
    if (maxTotal) config.volume.max_total = Number(maxTotal);
    if (bulkEnrichBatch) config.volume.bulk_enrich_batch = Number(bulkEnrichBatch);

    // Advanced
    if (siteDomain || extractFields.length || customSchema || dedupEnabled || exportToCrm) {
      config.advanced = {} as any;
      if (siteDomain) config.advanced.site_domain = siteDomain;
      if (extractFields.length) config.advanced.extract_fields = extractFields;
      if (customSchema) {
        try { config.advanced.custom_schema = JSON.parse(customSchema); } catch { /* ignore */ }
      }
      config.advanced.firecrawl_timeout = firecrawlTimeout;
      config.advanced.dedup_enabled = dedupEnabled;
      config.advanced.export_to_crm = exportToCrm;
    }

    if (isEditing && searchId) {
      updateSearch.mutate({
        id: searchId,
        name: name || `Busca ${new Date().toLocaleDateString("pt-BR")}`,
        source,
        config,
        target_list_id: targetListId || null,
        autoExecute: true,
      }, { onSuccess: () => onBack() });
    } else {
      createSearch.mutate({
        name: name || `Busca ${new Date().toLocaleDateString("pt-BR")}`,
        source,
        config,
        target_list_id: targetListId || null,
        autoExecute: true,
      }, { onSuccess: () => onBack() });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{isEditing ? "Editar Busca de Leads" : "Configurar Busca de Leads"}</h1>
          <p className="text-xs text-muted-foreground">{isEditing ? "Ajuste os filtros e execute a busca" : "Configure todos os filtros e execute a busca"}</p>
        </div>
      </div>

      {/* ── Source selector ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fonte de Busca</CardTitle>
          <CardDescription>Define qual motor vai rodar e quais blocos aparecem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: "apollo", label: "Apollo", desc: "Banco B2B estruturado", emoji: "🏢" },
              { value: "firecrawl", label: "Firecrawl Web", desc: "Busca geral na web", emoji: "🌐" },
              { value: "firecrawl_site", label: "Firecrawl + Site", desc: "Domínio fixo (LinkedIn, etc)", emoji: "🔗" },
              { value: "apollo_firecrawl", label: "Apollo + Firecrawl", desc: "Paralelo com merge", emoji: "⚡" },
            ].map((s) => (
              <button key={s.value} onClick={() => setSource(s.value)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left text-sm transition-all ${
                  source === s.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <span className="text-lg">{s.emoji}</span>
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da busca</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: CTOs SaaS Brasil" />
            </div>
            <div className="space-y-2">
              <Label>Salvar na lista</Label>
              <Select value={targetListId} onValueChange={setTargetListId}>
                <SelectTrigger><SelectValue placeholder="Selecionar lista..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não salvar</SelectItem>
                  {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isFirecrawl && (
            <div className="space-y-2">
              <Label>Query livre (Firecrawl)</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: dentistas clínica odontológica São Paulo" />
            </div>
          )}
          {isSiteMode && (
            <div className="space-y-2">
              <Label>Domínio do site <InfoTip text="Ex: linkedin.com, maps.google.com, instagram.com" /></Label>
              <Input value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} placeholder="linkedin.com" />
            </div>
          )}
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["persona", "company", "location"]} className="space-y-3">
        {/* ── Bloco 1 — Persona ── */}
        <AccordionItem value="persona" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 text-sm font-medium">Bloco 1 — Persona (quem buscar)</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Cargo / Título <InfoTip text="Apollo: person_titles[] + Firecrawl query" /></Label>
              <Input value={titles} onChange={(e) => setTitles(e.target.value)} placeholder="CEO, CTO, Diretor Comercial, Gerente de Vendas" />
            </div>
            {isApollo && (
              <>
                <div className="space-y-2">
                  <Label>Senioridade</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {SENIORITIES.map((s) => (
                      <Badge key={s.value} variant={seniorities.includes(s.value) ? "default" : "secondary"} className="cursor-pointer" onClick={() => setSeniorities(toggleInArray(seniorities, s.value))}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DEPARTMENTS.map((d) => (
                      <Badge key={d} variant={departments.includes(d) ? "default" : "secondary"} className="cursor-pointer capitalize" onClick={() => setDepartments(toggleInArray(departments, d))}>
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Palavras-chave do perfil <InfoTip text="Apollo: keywords[] + Firecrawl query" /></Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="growth hacking, automação, vendas B2B" />
            </div>
            {isApollo && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tempo no cargo atual (meses)</Label>
                  <div className="flex gap-2">
                    <Input value={tenureMin} onChange={(e) => setTenureMin(e.target.value)} placeholder="Mín" type="number" className="w-24" />
                    <span className="text-muted-foreground self-center">a</span>
                    <Input value={tenureMax} onChange={(e) => setTenureMax(e.target.value)} placeholder="Máx" type="number" className="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Anos de experiência total</Label>
                  <div className="flex gap-2">
                    <Input value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} placeholder="Mín" type="number" className="w-24" />
                    <span className="text-muted-foreground self-center">a</span>
                    <Input value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} placeholder="Máx" type="number" className="w-24" />
                  </div>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Bloco 2 — Empresa (Apollo only) ── */}
        {isApollo && (
          <AccordionItem value="company" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 text-sm font-medium">Bloco 2 — Empresa (onde a pessoa trabalha)</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da empresa</Label>
                  <Input value={companyNames} onChange={(e) => setCompanyNames(e.target.value)} placeholder="Empresa A, Empresa B" />
                </div>
                <div className="space-y-2">
                  <Label>Domínio do site <InfoTip text="Apollo + Firecrawl site: operator" /></Label>
                  <Input value={companyDomains} onChange={(e) => setCompanyDomains(e.target.value)} placeholder="empresa.com.br" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Indústria / Setor <InfoTip text="Apollo: industryTagIds[]" /></Label>
                <Input value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="SaaS, Fintech, E-commerce, Saúde" />
              </div>
              <div className="space-y-2">
                <Label>Tamanho da empresa (nº funcionários)</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMPLOYEE_RANGES.map((r) => (
                    <Badge key={r} variant={employeeRanges.includes(r) ? "default" : "secondary"} className="cursor-pointer" onClick={() => setEmployeeRanges(toggleInArray(employeeRanges, r))}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receita anual (USD)</Label>
                  <div className="flex gap-2">
                    <Input value={revenueMin} onChange={(e) => setRevenueMin(e.target.value)} placeholder="Mín" type="number" />
                    <span className="text-muted-foreground self-center">a</span>
                    <Input value={revenueMax} onChange={(e) => setRevenueMax(e.target.value)} placeholder="Máx" type="number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ano de fundação</Label>
                  <div className="flex gap-2">
                    <Input value={foundedMin} onChange={(e) => setFoundedMin(e.target.value)} placeholder="De" type="number" className="w-24" />
                    <span className="text-muted-foreground self-center">a</span>
                    <Input value={foundedMax} onChange={(e) => setFoundedMax(e.target.value)} placeholder="Até" type="number" className="w-24" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tecnologias usadas <InfoTip text="Filtra empresas que usam tecnologias específicas" /></Label>
                <Input value={technologies} onChange={(e) => setTechnologies(e.target.value)} placeholder="React, Salesforce, HubSpot, Shopify" />
              </div>
              <div className="space-y-2">
                <Label>Estágio de funding</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {FUNDING_STAGES.map((f) => (
                    <Badge key={f} variant={fundingStages.includes(f) ? "default" : "secondary"} className="cursor-pointer capitalize" onClick={() => setFundingStages(toggleInArray(fundingStages, f))}>
                      {f.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Capital aberto? <InfoTip text="Apollo: publiclyTraded" /></Label>
                <Switch checked={publiclyTraded} onCheckedChange={setPubliclyTraded} />
              </div>
              <div className="space-y-2">
                <Label>Vagas em aberto (sinal de compra) <InfoTip text="Empresas contratando = sinal de crescimento" /></Label>
                <div className="flex gap-2">
                  <Input value={hiringKeywords} onChange={(e) => setHiringKeywords(e.target.value)} placeholder="Palavras-chave das vagas" className="flex-1" />
                  <Select value={hiringPeriod} onValueChange={setHiringPeriod}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 dias</SelectItem>
                      <SelectItem value="30d">30 dias</SelectItem>
                      <SelectItem value="90d">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Bloco 3 — Localização ── */}
        <AccordionItem value="location" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 text-sm font-medium">Bloco 3 — Localização</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Localização da pessoa <InfoTip text="Apollo: person_locations[] | Firecrawl: location" /></Label>
              <Input value={personLocations} onChange={(e) => setPersonLocations(e.target.value)} placeholder="São Paulo, Rio de Janeiro, Belo Horizonte" />
            </div>
            {isApollo && (
              <div className="space-y-2">
                <Label>Localização da empresa <InfoTip text="Apollo: organization_locations[]" /></Label>
                <Input value={orgLocations} onChange={(e) => setOrgLocations(e.target.value)} placeholder="Brasil, São Paulo - SP" />
              </div>
            )}
            {isFirecrawl && (
              <div className="space-y-2">
                <Label>País-alvo da busca web</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="US">Estados Unidos</SelectItem>
                    <SelectItem value="PT">Portugal</SelectItem>
                    <SelectItem value="AR">Argentina</SelectItem>
                    <SelectItem value="MX">México</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Bloco 4 — Enriquecimento (Apollo) ── */}
        {isApollo && (
          <AccordionItem value="enrichment" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 text-sm font-medium">Bloco 4 — Dados a Revelar (Enriquecimento)</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label>Email corporativo <InfoTip text="Apollo: reveal_personal_emails: false" /></Label>
                <Switch checked={revealCorpEmail} onCheckedChange={setRevealCorpEmail} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Email pessoal <InfoTip text="Apollo: reveal_personal_emails: true" /></Label>
                <Switch checked={revealPersonalEmail} onCheckedChange={setRevealPersonalEmail} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Telefone direto <InfoTip text="Apollo: reveal_phone_number: true" /></Label>
                <Switch checked={revealPhone} onCheckedChange={setRevealPhone} />
              </div>
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Waterfall enrichment (email) <InfoTip text="Entrega assíncrona — requer webhook" /></Label>
                  <Switch checked={waterfallEmail} onCheckedChange={setWaterfallEmail} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Waterfall enrichment (phone)</Label>
                  <Switch checked={waterfallPhone} onCheckedChange={setWaterfallPhone} />
                </div>
                {(waterfallEmail || waterfallPhone) && (
                  <div className="space-y-2">
                    <Label className="text-warning">⚠️ Webhook para retorno assíncrono</Label>
                    <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://seu-domínio.com/webhook" />
                    <p className="text-xs text-muted-foreground">Obrigatório quando waterfall está ativo. Dados chegam de forma assíncrona.</p>
                  </div>
                )}
              </div>
              {isFirecrawl && (
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Enriquecer com Firecrawl (site da empresa)</Label>
                    <Switch checked={firecrawlEnrich} onCheckedChange={setFirecrawlEnrich} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Fire-enrich (fallback) <InfoTip text="Usa Firecrawl como fallback quando Apollo não encontra" /></Label>
                    <Switch checked={fireEnrich} onCheckedChange={setFireEnrich} />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ── Bloco 5 — Filtros de Qualidade ── */}
        <AccordionItem value="filters" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 text-sm font-medium">Bloco 5 — Filtros de Qualidade</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {isApollo && (
              <>
                <div className="space-y-2">
                  <Label>Status do email <InfoTip text="Apollo: contactEmailStatus[]" /></Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EMAIL_STATUSES.map((s) => (
                      <Badge key={s.value} variant={emailStatuses.includes(s.value) ? "default" : "secondary"} className="cursor-pointer" onClick={() => setEmailStatuses(toggleInArray(emailStatuses, s.value))}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tem email?</Label>
                  <Switch checked={hasEmail} onCheckedChange={setHasEmail} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tem telefone direto?</Label>
                  <Switch checked={hasPhone} onCheckedChange={setHasPhone} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Empresa atual apenas <InfoTip text="Apollo: currentCompany: true" /></Label>
                  <Switch checked={currentCompany} onCheckedChange={setCurrentCompany} />
                </div>
              </>
            )}
            {isFirecrawl && (
              <>
                <div className="space-y-2">
                  <Label>Período de publicação</Label>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Qualquer período" /></SelectTrigger>
                    <SelectContent>
                      {FIRECRAWL_TIME_FILTERS.map((f) => (
                        <SelectItem key={f.value || "any"} value={f.value || "any"}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordenar resultados</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Relevância" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevância</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Bloco 6 — Volume e Paginação ── */}
        <AccordionItem value="volume" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 text-sm font-medium">Bloco 6 — Volume e Paginação</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Unidade de volume <InfoTip text="Contatos = retorna X pessoas. Empresas = busca contatos suficientes para cobrir X empresas únicas." /></Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={volumeUnit === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVolumeUnit("contacts")}
                  className="flex-1"
                >
                  Contatos
                </Button>
                <Button
                  type="button"
                  variant={volumeUnit === "companies" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVolumeUnit("companies")}
                  className="flex-1"
                >
                  Empresas
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{volumeUnit === "companies" ? `Empresas desejadas: ${perPage}` : `Resultados por busca: ${perPage}`} <InfoTip text={volumeUnit === "companies" ? "O sistema buscará contatos suficientes para cobrir este número de empresas únicas" : "Apollo max 100/página, Firecrawl 2 créditos/10"} /></Label>
              <Slider value={[perPage]} onValueChange={([v]) => setPerPage(v)} min={10} max={100} step={5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máximo total de leads <InfoTip text="Apollo até 50k, processado em batches" /></Label>
                <Input value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} type="number" placeholder="Ex: 500" />
              </div>
              {isApollo && (
                <div className="space-y-2">
                  <Label>Enriquecimento em lote <InfoTip text="Apollo Bulk Enrichment, máx 10" /></Label>
                  <Input value={bulkEnrichBatch} onChange={(e) => setBulkEnrichBatch(e.target.value)} type="number" placeholder="Máx 10" />
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Bloco 7 — Avançado (only when both or always collapsed) ── */}
        <AccordionItem value="advanced" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 text-sm font-medium">Bloco 7 — Configurações Avançadas</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Campos a extrair</Label>
              <div className="grid grid-cols-5 gap-2">
                {EXTRACT_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-1.5">
                    <Checkbox checked={extractFields.includes(f.key)} onCheckedChange={(checked) => {
                      setExtractFields(checked ? [...extractFields, f.key] : extractFields.filter((x) => x !== f.key));
                    }} id={`field-${f.key}`} />
                    <label htmlFor={`field-${f.key}`} className="text-xs cursor-pointer">{f.label}</label>
                  </div>
                ))}
              </div>
            </div>
            {isFirecrawl && (
              <>
                <div className="space-y-2">
                  <Label>Fonte Firecrawl extra <InfoTip text="Domínio específico ex: instagram.com, maps.google.com" /></Label>
                  <Input value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} placeholder="instagram.com" />
                </div>
                <div className="space-y-2">
                  <Label>Schema de extração customizado (JSON)</Label>
                  <Textarea value={customSchema} onChange={(e) => setCustomSchema(e.target.value)} placeholder='{"type": "object", "properties": {...}}' rows={4} className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Firecrawl: {firecrawlTimeout}s</Label>
                  <Slider value={[firecrawlTimeout]} onValueChange={([v]) => setFirecrawlTimeout(v)} min={1} max={30} step={1} />
                </div>
              </>
            )}
            {isBoth && (
              <div className="flex items-center justify-between">
                <Label>Deduplicação automática <InfoTip text="Por domínio + nome entre Apollo e Firecrawl" /></Label>
                <Switch checked={dedupEnabled} onCheckedChange={setDedupEnabled} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Exportar automaticamente pro CRM</Label>
              <Switch checked={exportToCrm} onCheckedChange={setExportToCrm} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={createSearch.isPending} className="gap-2">
          {createSearch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Executar Busca
        </Button>
      </div>
    </div>
  );
}
