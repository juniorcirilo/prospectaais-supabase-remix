import { useState } from "react";
import {
  Search, Plus, Play, Clock, CheckCircle2, AlertCircle, Download,
  Globe, RefreshCw, Trash2, Eye, Sparkles, Settings2, AlertTriangle, Copy, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatCard from "@/components/StatCard";
import { useScrapingJobs, type ScrapingJob } from "@/hooks/useScrapingJobs";
import { useLeadSearches, type LeadSearch } from "@/hooks/useLeadSearches";
import { useContacts } from "@/hooks/useContacts";
import LeadSearchChat from "@/components/scraping/LeadSearchChat";
import LeadSearchDetail from "@/components/scraping/LeadSearchDetail";
import LeadSearchConfig from "@/components/scraping/LeadSearchConfig";

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border", icon: <Clock className="w-3 h-3" /> },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border", icon: <Clock className="w-3 h-3" /> },
  running: { label: "Buscando", className: "bg-info/10 text-info border-info/20", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  enriching: { label: "Enriquecendo", className: "bg-warning/10 text-warning border-warning/20", icon: <Sparkles className="w-3 h-3 animate-pulse" /> },
  completed: { label: "Concluído", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertCircle className="w-3 h-3" /> },
};

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo",
  firecrawl: "Firecrawl",
  firecrawl_site: "Firecrawl+Site",
  apollo_firecrawl: "Apollo+FC",
};

const STEP_LABELS: Record<string, string> = {
  match: "Match",
  org_enrich: "Org",
  collaborators: "Expansão",
  firecrawl: "Scrape",
  persist_companies: "Salvando",
  ai_summaries: "IA",
  update_contacts: "Atualizando",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function InfoField({ label, value, isLink, className }: { label: string; value: string; isLink?: boolean; className?: string }) {
  return (
    <div className={className}>
      <span className="text-muted-foreground text-xs">{label}</span>
      {isLink ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">{value}</a>
      ) : (
        <p className="text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}

export default function Scraping() {
  const [view, setView] = useState<"list" | "chat" | "detail" | "config">("list");
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>(["name", "phone", "company", "city"]);
  const [targetListId, setTargetListId] = useState<string>("");

  const { jobs, isLoading: jobsLoading, startJob, deleteJob } = useScrapingJobs();
  const { searches, stats, isLoading: searchesLoading, deleteSearch, enrichSearch, resumeEnrichment, isSearchStuck, cloneSearch } = useLeadSearches();
  const { lists } = useContacts();

  const selectedSearch = selectedSearchId ? searches.find(s => s.id === selectedSearchId) || null : null;

  if (view === "chat") {
    return <div className="animate-fade-in-up"><LeadSearchChat onBack={() => setView("list")} /></div>;
  }
  if (view === "detail" && selectedSearch) {
    return <LeadSearchDetail search={selectedSearch} onBack={() => { setView("list"); setSelectedSearchId(null); }} />;
  }
  if (view === "config") {
    return <LeadSearchConfig onBack={() => { setView("list"); setSelectedSearchId(null); }} searchId={selectedSearchId} />;
  }

  const handleStartScrape = () => {
    if (!url.trim()) return;
    startJob.mutate({ url: url.trim(), fields: selectedFields, target_list_id: targetListId || null }, {
      onSuccess: () => setUrl(""),
    });
  };

  const runningSearch = searches.find((s) => s.status === "running" || s.status === "enriching");

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Geração de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Busca inteligente via Apollo + Firecrawl com deduplicação automática</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("config")} className="gap-1.5">
            <Settings2 className="w-4 h-4" /> Manual
          </Button>
          <Button size="sm" onClick={() => setView("chat")} className="gap-1.5">
            <Sparkles className="w-4 h-4" /> Buscar com IA
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Encontrados" value={stats.totalFound.toLocaleString("pt-BR")} subtitle={`${stats.totalSearches} buscas`} icon={<Download className="w-5 h-5 text-primary" />} />
        <StatCard title="Novos Leads" value={stats.totalNew.toLocaleString("pt-BR")} subtitle="não duplicados" icon={<CheckCircle2 className="w-5 h-5 text-success" />} />
        <StatCard title="Buscas Ativas" value={String(stats.activeSearches)} subtitle={`${stats.totalSearches} no total`} icon={<RefreshCw className="w-5 h-5 text-info" />} changeType={stats.activeSearches > 0 ? "up" : "neutral"} />
        <StatCard title="Listas" value={String(lists.length)} subtitle={`${searches.filter(s => s.target_list_id).length} vinculadas`} icon={<Globe className="w-5 h-5 text-warning" />} />
      </div>

      {/* Running progress */}
      {runningSearch && (
        <Card className="glow-border cursor-pointer" onClick={() => { setSelectedSearchId(runningSearch.id); setView("detail"); }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {runningSearch.status === "enriching" ? (
                  <Sparkles className="w-4 h-4 text-warning animate-pulse" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-info animate-spin" />
                )}
                <span className="text-sm font-medium">{runningSearch.name}</span>
                <Badge className={runningSearch.status === "enriching" ? "bg-warning/10 text-warning border-warning/20" : "bg-info/10 text-info border-info/20"}>
                  {runningSearch.status === "enriching"
                    ? `Enriquecendo • ${STEP_LABELS[runningSearch.enrich_step || ""] || runningSearch.enrich_step || "..."}`
                    : "Executando"}
                </Badge>
                {runningSearch.enrich_cursor != null && runningSearch.enrich_cursor > 0 && (
                  <span className="text-xs text-muted-foreground">cursor: {runningSearch.enrich_cursor}</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {runningSearch.contacts_found} encontrados • {runningSearch.contacts_new} novos
                {runningSearch.contacts_enriched > 0 && ` • ${runningSearch.contacts_enriched} enriquecidos`}
              </span>
            </div>
            <Progress
              value={runningSearch.status === "enriching" && runningSearch.contacts_found > 0
                ? (runningSearch.contacts_enriched / runningSearch.contacts_found) * 100
                : 50}
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="searches" className="w-full">
        <TabsList>
          <TabsTrigger value="searches" className="gap-1.5"><Search className="w-4 h-4" /> Buscas de Leads</TabsTrigger>
          <TabsTrigger value="scraping" className="gap-1.5"><Globe className="w-4 h-4" /> Pesquisa de Empresa</TabsTrigger>
        </TabsList>

        {/* Lead Searches tab */}
        <TabsContent value="searches">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de Buscas</CardTitle></CardHeader>
            <CardContent>
              {searchesLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
              ) : searches.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Search className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma busca realizada ainda.</p>
                  <Button size="sm" onClick={() => setView("chat")} className="gap-1.5">
                    <Sparkles className="w-4 h-4" /> Criar primeira busca com IA
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Encontrados</TableHead>
                      <TableHead className="text-right">Novos</TableHead>
                      <TableHead className="text-right">Enriquecidos</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searches.map((s) => {
                      const sc = statusConfig[s.status] || statusConfig.draft;
                      const isPartial = s.status === "completed" && s.contacts_enriched === 0 && s.contacts_found > 0;
                      const stuck = isSearchStuck(s);
                      return (
                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSearchId(s.id); setView("detail"); }}>
                          <TableCell className="font-medium">{s.name || "Sem nome"}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{SOURCE_LABELS[s.source] || s.source}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={sc.className}>
                                <span className="flex items-center gap-1">{sc.icon}{sc.label}</span>
                              </Badge>
                              {isPartial && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/40 text-warning bg-warning/5">
                                  parcial
                                </Badge>
                              )}
                              {stuck && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive bg-destructive/5">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> travado
                                </Badge>
                              )}
                              {s.status === "enriching" && s.enrich_step && !stuck && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/30 text-warning">
                                  {STEP_LABELS[s.enrich_step] || s.enrich_step}
                                  {s.enrich_cursor != null && s.enrich_cursor > 0 ? ` (${s.enrich_cursor})` : ""}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{s.contacts_found}</TableCell>
                          <TableCell className="text-right font-medium text-success">{s.contacts_new}</TableCell>
                          <TableCell className="text-right font-medium text-info">{s.contacts_enriched}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Clone button */}
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => cloneSearch.mutate(s.id)}
                                disabled={cloneSearch.isPending}
                                title="Clonar busca"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              {/* Edit cloned (draft) searches */}
                              {s.status === "draft" && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={() => { setSelectedSearchId(s.id); setView("config"); }}
                                  title="Editar configuração"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {/* Resume/reprocess button */}
                              {(stuck || isPartial || (s.status === "completed" && s.enrich_step) || s.status === "failed") && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-warning hover:text-warning"
                                  onClick={() => resumeEnrichment.mutate(s.id)}
                                  disabled={resumeEnrichment.isPending}
                                  title={
                                    stuck ? "Retomar enriquecimento travado"
                                    : s.status === "failed" ? "Retomar do último checkpoint"
                                    : s.enrich_step ? `Retomar de ${STEP_LABELS[s.enrich_step] || s.enrich_step}${s.enrich_cursor ? ` (${s.enrich_cursor})` : ""}`
                                    : "Continuar enriquecimento"
                                  }
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${resumeEnrichment.isPending ? "animate-spin" : ""}`} />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSearch.mutate(s.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company info scrape tab */}
        <TabsContent value="scraping">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pesquisa de Empresa</CardTitle>
              <CardDescription>Informe a URL de um site para extrair informações completas da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="https://empresa.com.br" value={url} onChange={(e) => setUrl(e.target.value)} className="pl-10" onKeyDown={(e) => e.key === "Enter" && handleStartScrape()} />
                </div>
                <Button className="gap-2" onClick={handleStartScrape} disabled={!url.trim() || startJob.isPending}>
                  <Search className="w-4 h-4" />{startJob.isPending ? "Analisando..." : "Analisar Empresa"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {jobs.length > 0 && (
            <div className="mt-4 space-y-4">
              {jobs.map((job) => {
                const sc = statusConfig[job.status] || statusConfig.pending;
                const companyData = job.result_data && typeof job.result_data === "object" && !Array.isArray(job.result_data) ? job.result_data as Record<string, any> : null;

                return (
                  <Card key={job.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{companyData?.company_name || job.url}</CardTitle>
                          <Badge variant="outline" className={sc.className}>
                            <span className="flex items-center gap-1">{sc.icon}{sc.label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDate(job.created_at)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteJob.mutate(job.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {companyData?.description && (
                        <CardDescription className="mt-2 line-clamp-3">{companyData.description}</CardDescription>
                      )}
                    </CardHeader>
                    {companyData && (
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          {companyData.industry && <InfoField label="Setor" value={companyData.industry} />}
                          {companyData.services && <InfoField label="Serviços" value={companyData.services} className="md:col-span-2" />}
                          {companyData.phone && <InfoField label="Telefone" value={companyData.phone} />}
                          {companyData.whatsapp && <InfoField label="WhatsApp" value={companyData.whatsapp} />}
                          {companyData.email && <InfoField label="E-mail" value={companyData.email} />}
                          {companyData.address && <InfoField label="Endereço" value={companyData.address} />}
                          {companyData.city && <InfoField label="Cidade" value={`${companyData.city}${companyData.state ? ` - ${companyData.state}` : ""}`} />}
                          {companyData.cnpj && <InfoField label="CNPJ" value={companyData.cnpj} />}
                          {companyData.founding_year && <InfoField label="Fundação" value={companyData.founding_year} />}
                          {companyData.employees_count && <InfoField label="Funcionários" value={companyData.employees_count} />}
                          {companyData.opening_hours && <InfoField label="Horário" value={companyData.opening_hours} />}
                          {companyData.website && <InfoField label="Website" value={companyData.website} isLink />}
                          {companyData.linkedin_url && <InfoField label="LinkedIn" value={companyData.linkedin_url} isLink />}
                          {companyData.instagram && <InfoField label="Instagram" value={companyData.instagram} isLink={String(companyData.instagram).startsWith("http")} />}
                          {companyData.facebook && <InfoField label="Facebook" value={companyData.facebook} isLink />}
                          {companyData.youtube && <InfoField label="YouTube" value={companyData.youtube} isLink />}
                          {companyData.tiktok && <InfoField label="TikTok" value={companyData.tiktok} isLink={String(companyData.tiktok).startsWith("http")} />}
                          {companyData.differentials && <InfoField label="Diferenciais" value={companyData.differentials} className="md:col-span-2" />}
                          {companyData.certifications && <InfoField label="Certificações" value={companyData.certifications} />}
                          {companyData.clients_or_partners && <InfoField label="Clientes/Parceiros" value={companyData.clients_or_partners} className="md:col-span-2" />}
                          {companyData.extra_info && <InfoField label="Outras Informações" value={companyData.extra_info} className="lg:col-span-3" />}
                        </div>

                        {Array.isArray(companyData.key_people) && companyData.key_people.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-sm font-semibold mb-3">Pessoas-chave ({companyData.key_people.length})</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {(companyData.key_people as any[]).map((person: any, idx: number) => (
                                <div key={idx} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                                  <p className="font-medium text-sm">{person.name}</p>
                                  {person.role && <p className="text-xs text-muted-foreground">{person.role}</p>}
                                  {person.email && <p className="text-xs text-primary">{person.email}</p>}
                                  {person.phone && <p className="text-xs text-muted-foreground">{person.phone}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                    {job.error_message && (
                      <CardContent className="pt-0">
                        <p className="text-xs text-destructive">{job.error_message}</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
