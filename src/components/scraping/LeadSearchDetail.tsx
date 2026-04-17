import { ArrowLeft, RefreshCw, Download, CheckCircle2, AlertCircle, Clock, Sparkles, ExternalLink, Star, ListPlus, Building2, Users, ChevronDown, ChevronRight, Globe, Phone, Mail, MapPin, Briefcase, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StatCard from "@/components/StatCard";
import { LeadSearch, useLeadSearches } from "@/hooks/useLeadSearches";
import { useState } from "react";
import GenerateListDialog from "./GenerateListDialog";

interface Props {
  search: LeadSearch;
  onBack: () => void;
}

const STEP_LABELS: Record<string, string> = {
  match: "Match Apollo",
  org_enrich: "Org Enrich",
  collaborators: "Expansão",
  firecrawl: "Scrape Sites",
  persist_companies: "Salvando Empresas",
  ai_summaries: "Resumos IA",
  update_contacts: "Atualizando Contatos",
};

const STEP_ORDER = ["match", "org_enrich", "collaborators", "firecrawl", "persist_companies", "ai_summaries", "update_contacts"];

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo",
  firecrawl: "Firecrawl Web",
  firecrawl_site: "Firecrawl + Site",
  apollo_firecrawl: "Apollo + Firecrawl",
};

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
  running: { label: "Buscando", className: "bg-info/10 text-info", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  enriching: { label: "Enriquecendo", className: "bg-warning/10 text-warning", icon: <Sparkles className="w-3 h-3 animate-pulse" /> },
  completed: { label: "Concluído", className: "bg-success/10 text-success", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive", icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{score}</span>
    </div>
  );
}

interface CompanyGroup {
  companyName: string;
  companyId?: string;
  contacts: any[];
  website?: string;
  city?: string;
  industry?: string;
  revenue?: string;
  employees_count?: string;
  company_description?: string;
  company_linkedin?: string;
  instagram?: string;
  avgScore: number;
  hasExpanded: boolean;
}

function groupByCompany(results: any[]): { grouped: CompanyGroup[]; ungrouped: any[] } {
  const companyMap = new Map<string, any[]>();
  const ungrouped: any[] = [];

  for (const c of results) {
    const company = (c.company || c.organization_name || "").trim();
    if (!company || company.length < 2) { ungrouped.push(c); continue; }
    const key = company.toLowerCase();
    if (!companyMap.has(key)) companyMap.set(key, []);
    companyMap.get(key)!.push(c);
  }

  const grouped: CompanyGroup[] = [];
  for (const [_, contacts] of companyMap.entries()) {
    const ref = contacts[0];
    const scores = contacts.map((c: any) => c.ai_score || 0).filter((s: number) => s > 0);
    grouped.push({
      companyName: ref.company || ref.organization_name || "",
      companyId: ref._lead_company_id,
      contacts,
      website: ref.website, city: ref.city, industry: ref.industry,
      revenue: ref.revenue, employees_count: ref.employees_count,
      company_description: ref.company_description, company_linkedin: ref.company_linkedin,
      instagram: ref.instagram,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
      hasExpanded: contacts.some((c: any) => c._source === "expansion"),
    });
  }

  grouped.sort((a, b) => {
    if (b.contacts.length !== a.contacts.length) return b.contacts.length - a.contacts.length;
    return b.avgScore - a.avgScore;
  });

  return { grouped, ungrouped };
}

function CompanyAccordion({ group, hasEnrichedResults }: { group: CompanyGroup; hasEnrichedResults: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedContact, setExpandedContact] = useState<number | null>(null);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 cursor-pointer transition-colors">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Building2 className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">{group.companyName}</h3>
              {group.hasExpanded && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/40 text-success bg-success/5">expandido</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              {group.industry && <span>{group.industry}</span>}
              {group.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{group.city}</span>}
              {group.employees_count && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{group.employees_count} func.</span>}
              {group.website && (
                <a href={group.website.startsWith("http") ? group.website : `https://${group.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  <Globe className="w-3 h-3" />
                  {(() => { try { return new URL(group.website!.startsWith("http") ? group.website! : `https://${group.website}`).hostname; } catch { return "site"; } })()}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{group.contacts.length}</span>
              <span className="text-xs text-muted-foreground">contatos</span>
            </div>
            {group.avgScore > 0 && <ScoreBar score={group.avgScore} />}
            {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 border-l-2 border-border/40 pl-4 space-y-0">
          {group.company_description && (
            <p className="text-xs text-muted-foreground py-2 leading-relaxed">{group.company_description}</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                {hasEnrichedResults && <TableHead className="w-20">Score</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.contacts.map((c: any, i: number) => (
                <>
                  <TableRow
                    key={`contact-${i}`}
                    className={`cursor-pointer hover:bg-muted/50 ${expandedContact === i ? "bg-muted/30" : ""} ${c._source === "expansion" ? "border-l-2 border-l-success/40" : ""}`}
                    onClick={() => setExpandedContact(expandedContact === i ? null : i)}
                  >
                    <TableCell className="text-center">
                      {c._source === "expansion" ? <Users className="w-3.5 h-3.5 text-success inline" /> : c.ai_summary ? <Sparkles className="w-3.5 h-3.5 text-info inline" /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm font-medium">{c.name || "-"}</span>
                        {c.seniority && <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">{c.seniority}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.title || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{c.phone || "-"}</TableCell>
                    <TableCell className="text-xs">{c.email || "-"}</TableCell>
                    {hasEnrichedResults && (
                      <TableCell>{c.ai_score ? <ScoreBar score={c.ai_score} /> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    )}
                  </TableRow>
                  {expandedContact === i && (
                    <TableRow key={`detail-${i}`}>
                      <TableCell colSpan={hasEnrichedResults ? 6 : 5} className="bg-muted/20 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">Detalhes</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {c.linkedin_url && <div><span className="text-muted-foreground">LinkedIn: </span><a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Perfil <ExternalLink className="w-3 h-3" /></a></div>}
                              {c.instagram && <div><span className="text-muted-foreground">Instagram: </span><span className="text-foreground">{c.instagram}</span></div>}
                              {c.revenue && <div><span className="text-muted-foreground">Receita: </span><span className="text-foreground">{c.revenue}</span></div>}
                              {c._source && <div><span className="text-muted-foreground">Fonte: </span><Badge variant="outline" className={`text-[10px] px-1 py-0 ${c._source === "expansion" ? "border-success/40 text-success" : ""}`}>{c._source === "expansion" ? "Expansão" : c._source}</Badge></div>}
                            </div>
                          </div>
                          {c.ai_summary ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-info" /> Resumo IA</h4>
                              <p className="text-xs text-foreground leading-relaxed">{c.ai_summary}</p>
                              {c.ai_tags?.length > 0 && <div className="flex flex-wrap gap-1">{c.ai_tags.map((tag: string, ti: number) => <Badge key={ti} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>)}</div>}
                              {c.ai_insights && <div className="mt-1 p-2 rounded bg-info/5 border border-info/20"><p className="text-xs text-info flex items-start gap-1.5"><Star className="w-3 h-3 mt-0.5 shrink-0" />{c.ai_insights}</p></div>}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-xs text-muted-foreground"><p>Resumo IA não disponível</p></div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function LeadSearchDetail({ search, onBack }: Props) {
  const { executeSearch, enrichSearch, resumeEnrichment, isSearchStuck } = useLeadSearches();
  const sc = statusConfig[search.status] || statusConfig.draft;
  const results = Array.isArray(search.result_data) ? search.result_data : [];
  const duplicates = search.contacts_found - search.contacts_new;
  const enrichedResults = results.filter((c: any) => c.ai_summary);
  const expandedResults = results.filter((c: any) => c._source === "expansion");
  const isPartialComplete = search.status === "completed" && search.contacts_enriched === 0 && search.contacts_found > 0;
  const canEnrich = (["completed", "failed"].includes(search.status) && results.length > 0);

  const { grouped, ungrouped } = groupByCompany(results);
  const hasEnrichedResults = enrichedResults.length > 0;

  // Enrichment step info
  const enrichStep = search.enrich_step;
  const enrichCursor = search.enrich_cursor;
  const enrichHeartbeat = search.enrich_heartbeat;

  // Compute step progress for progress bar
  const currentStepIdx = enrichStep ? STEP_ORDER.indexOf(enrichStep) : -1;
  const stepProgress = currentStepIdx >= 0 ? ((currentStepIdx + 1) / STEP_ORDER.length) * 100 : 0;

  // Check if heartbeat is stale (>3 min)
  const isHeartbeatStale = isSearchStuck(search);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{search.name || "Busca sem nome"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={sc.className}>
              <span className="flex items-center gap-1">{sc.icon}{sc.label}</span>
            </Badge>
            {isPartialComplete && (
              <Badge variant="outline" className="border-warning/40 text-warning bg-warning/5">
                Concluído parcial
              </Badge>
            )}
            <Badge variant="secondary">{SOURCE_LABELS[search.source] || search.source}</Badge>
            {search.duration_ms && <span className="text-xs text-muted-foreground">{formatDuration(search.duration_ms)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && search.status === "completed" && (
            <GenerateListDialog contacts={results} searchName={search.name} />
          )}
          {(canEnrich || isPartialComplete || search.status === "failed") && (
            <Button
              variant="outline" size="sm"
              onClick={() => resumeEnrichment.mutate(search.id)}
              disabled={resumeEnrichment.isPending || enrichSearch.isPending}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {resumeEnrichment.isPending
                ? "Retomando..."
                : search.enrich_step
                  ? `Retomar de ${search.enrich_step}${search.enrich_cursor ? ` (${search.enrich_cursor})` : ""}`
                  : isPartialComplete ? "Continuar Enriquecimento"
                  : "Enriquecer"}
            </Button>
          )}
          {search.status !== "running" && search.status !== "enriching" && (
            <Button variant="outline" size="sm" onClick={() => executeSearch.mutate(search.id)}>
              <RefreshCw className="w-4 h-4 mr-1" /> Re-executar
            </Button>
          )}
        </div>
      </div>

      {search.status === "running" && (
        <Card><CardContent className="pt-6"><Progress value={50} className="h-2" /><p className="text-xs text-muted-foreground mt-2">Processando...</p></CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Encontrados" value={String(search.contacts_found)} subtitle="total" icon={<Download className="w-5 h-5 text-primary" />} />
        <StatCard title="Novos" value={String(search.contacts_new)} subtitle="adicionados" icon={<CheckCircle2 className="w-5 h-5 text-success" />} />
        <StatCard title="Empresas" value={String(grouped.length)} subtitle="únicas" icon={<Building2 className="w-5 h-5 text-primary" />} />
        <StatCard title="Expandidos" value={String(expandedResults.length)} subtitle="descobertos" icon={<Users className="w-5 h-5 text-success" />} />
        <StatCard title="Enriquecidos" value={String(search.contacts_enriched)} subtitle="com IA" icon={<Sparkles className="w-5 h-5 text-info" />} />
      </div>

      {search.error_message && (
        <Card><CardContent className="pt-6"><p className="text-sm text-destructive">{search.error_message}</p></CardContent></Card>
      )}

      {search.status === "enriching" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              {isHeartbeatStale ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <Sparkles className="w-4 h-4 text-warning animate-pulse" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">
                  {isHeartbeatStale ? "Enriquecimento possivelmente travado" : "Enriquecimento com IA em andamento..."}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {search.contacts_enriched}/{search.contacts_found} contatos
                  </p>
                  {enrichStep && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/30 text-warning">
                      {STEP_LABELS[enrichStep] || enrichStep}
                      {enrichCursor != null && enrichCursor > 0 ? ` (${enrichCursor})` : ""}
                    </Badge>
                  )}
                  {enrichHeartbeat && (
                    <span className="text-[10px] text-muted-foreground">
                      Último sinal: {new Date(enrichHeartbeat).toLocaleTimeString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={stepProgress} className="w-32 h-2" />
                {isHeartbeatStale && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => resumeEnrichment.mutate(search.id)}
                    disabled={resumeEnrichment.isPending}
                    className="text-xs"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${resumeEnrichment.isPending ? "animate-spin" : ""}`} />
                    Retomar
                  </Button>
                )}
              </div>
            </div>
            {/* Step progress indicators */}
            {enrichStep && (
              <div className="flex items-center gap-1 mt-3">
                {STEP_ORDER.map((step, idx) => {
                  const isCurrent = step === enrichStep;
                  const isDone = idx < currentStepIdx;
                  return (
                    <div key={step} className="flex items-center gap-1">
                      <div className={`h-1.5 rounded-full flex-1 min-w-[20px] ${isDone ? "bg-success" : isCurrent ? "bg-warning" : "bg-muted"}`} />
                      {idx < STEP_ORDER.length - 1 && <div className="w-0.5" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Company Accordion View */}
      {grouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empresas ({grouped.length})
              {expandedResults.length > 0 && (
                <Badge variant="secondary" className="gap-1 bg-success/10 text-success border-success/20">
                  <Users className="w-3 h-3" /> +{expandedResults.length} expandidos
                </Badge>
              )}
              {hasEnrichedResults && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="w-3 h-3" /> {enrichedResults.length} com resumo IA
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped.map((group, i) => (
              <CompanyAccordion key={i} group={group} hasEnrichedResults={hasEnrichedResults} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ungrouped contacts */}
      {ungrouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Contatos sem empresa ({ungrouped.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cidade</TableHead>
                  {hasEnrichedResults && <TableHead className="w-20">Score</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ungrouped.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{c.name || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.title || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{c.phone || "-"}</TableCell>
                    <TableCell className="text-xs">{c.email || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.city || "-"}</TableCell>
                    {hasEnrichedResults && (
                      <TableCell>{c.ai_score ? <ScoreBar score={c.ai_score} /> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
