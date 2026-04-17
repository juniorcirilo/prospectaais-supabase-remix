import { useState, useMemo } from "react";
import { BarChart3, Trophy, TrendingUp, Crown, MessageSquareReply, Send, XCircle, Clock, Zap, Users, Sparkles, Settings2, FileText, Loader2, Lightbulb, Gauge, MessageCircle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import StatCard from "@/components/StatCard";
import { useBroadcasts } from "@/hooks/useBroadcasts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, PieChart, Pie, Cell,
} from "recharts";

// ── Types ──

interface CampaignStats {
  campaignId: string;
  total: number;
  sent: number;
  failed: number;
  replied: number;
  responseRate: number;
  deliveryRate: number;
  failRate: number;
  durationMin: number | null;
  velocity: number | null;
}

interface AISection {
  title: string;
  icon: string;
  content: string;
}

interface AIChartItem {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

interface AIChart {
  title: string;
  type: "bar" | "horizontal_bar" | "score";
  data: AIChartItem[];
}

interface AIAnalysisResult {
  sections: AISection[];
  charts: AIChart[];
  verdict: string;
}

// ── Constants ──

const CHART_COLORS = [
  "hsl(187, 85%, 53%)", "hsl(38, 92%, 50%)", "hsl(263, 70%, 50%)",
  "hsl(142, 60%, 45%)", "hsl(210, 80%, 55%)",
];

const COLOR_MAP: Record<string, string> = {
  primary: "hsl(187, 85%, 53%)",
  success: "hsl(142, 60%, 45%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(0, 72%, 51%)",
  info: "hsl(210, 80%, 55%)",
  accent: "hsl(263, 70%, 50%)",
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  summary: <Brain className="w-4 h-4" />,
  message: <MessageCircle className="w-4 h-4" />,
  performance: <Gauge className="w-4 h-4" />,
  engine: <Settings2 className="w-4 h-4" />,
  insights: <Lightbulb className="w-4 h-4" />,
};

// ── Hooks ──

function useCampaignStats(campaignIds: string[]) {
  return useQuery({
    queryKey: ["campaign-stats", campaignIds],
    enabled: campaignIds.length >= 2,
    queryFn: async () => {
      const results: CampaignStats[] = [];
      for (const id of campaignIds) {
        const { data, error } = await supabase.rpc("get_campaign_response_stats", { p_campaign_id: id });
        if (error) throw error;
        const s = data as unknown as { total: number; sent: number; failed: number; replied: number };
        const { data: campaign } = await supabase.from("broadcast_campaigns").select("started_at, completed_at").eq("id", id).single();
        let durationMin: number | null = null;
        let velocity: number | null = null;
        if (campaign?.started_at && campaign?.completed_at) {
          durationMin = (new Date(campaign.completed_at).getTime() - new Date(campaign.started_at).getTime()) / 60000;
          if (durationMin > 0) velocity = s.sent / durationMin;
        }
        results.push({
          campaignId: id, total: s.total, sent: s.sent, failed: s.failed, replied: s.replied,
          responseRate: s.sent > 0 ? (s.replied / s.sent) * 100 : 0,
          deliveryRate: s.total > 0 ? (s.sent / s.total) * 100 : 0,
          failRate: s.total > 0 ? (s.failed / s.total) * 100 : 0,
          durationMin, velocity,
        });
      }
      return results;
    },
  });
}

// ── Sub-components ──

function HighlightedMessage({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}}|\{[^{}]*\|[^{}]*\})/g);
  return (
    <p className="text-xs text-foreground/70 bg-muted/30 rounded-md p-3 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(/^{{[^}]+}}$/))
          return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[11px] font-medium">{part}</span>;
        if (part.match(/^\{[^{}]*\|[^{}]*\}$/))
          return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono text-[11px] font-medium">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function MetricItem({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
      <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

/** Renders an AI-generated chart */
function AIChartRenderer({ chart }: { chart: AIChart }) {
  if (chart.type === "score") {
    return (
      <div className="space-y-3">
        {chart.data.map((item, i) => {
          const max = item.max || 10;
          const pct = Math.min((item.value / max) * 100, 100);
          const fill = COLOR_MAP[item.color || "primary"] || COLOR_MAP.primary;
          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/80">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}/{max}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: fill }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (chart.type === "horizontal_bar") {
    const maxVal = Math.max(...chart.data.map((d) => d.value), 1);
    return (
      <div className="space-y-2.5">
        {chart.data.map((item, i) => {
          const pct = (item.value / maxVal) * 100;
          const fill = COLOR_MAP[item.color || "primary"] || COLOR_MAP.primary;
          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/80">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: fill }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Default bar chart
  const chartData = chart.data.map((d) => ({ name: d.label, value: d.value, fill: COLOR_MAP[d.color || "primary"] || COLOR_MAP.primary }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 14%)" />
        <XAxis dataKey="name" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "hsl(217, 33%, 8%)", border: "1px solid hsl(217, 33%, 14%)", borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Renders a markdown section with proper styling */
function AnalysisSection({ section }: { section: AISection }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {SECTION_ICONS[section.icon] || <Brain className="w-4 h-4" />}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
      </div>
      <div className="pl-9 text-sm leading-relaxed text-foreground/80 [&_strong]:text-foreground [&_strong]:font-semibold [&_em]:text-primary [&_code]:bg-primary/10 [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_ul]:space-y-1.5 [&_ul]:my-2 [&_ol]:space-y-1.5 [&_ol]:my-2 [&_li]:leading-relaxed [&_p]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-foreground/60 [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:mt-3 [&_h4]:mb-1">
        <ReactMarkdown>{section.content}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function ABTest() {
  const { campaigns, isLoading: loadingCampaigns } = useBroadcasts();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);

  const eligibleCampaigns = campaigns.filter((c) => c.status === "completed" || c.status === "processing");
  const { data: stats, isLoading: loadingStats } = useCampaignStats(selectedIds);

  const analysisMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("campaign-ai-analysis", { body: { campaign_ids: ids } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AIAnalysisResult;
    },
    onSuccess: (result) => { setAiResult(result); toast.success("Análise gerada!"); },
    onError: (err: Error) => { toast.error(`Erro: ${err.message}`); },
  });

  const toggleCampaign = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setAiResult(null);
  };

  const bestResponseRate = stats ? Math.max(...stats.map((s) => s.responseRate)) : 0;
  const bestCampaignName = stats
    ? campaigns.find((c) => c.id === stats.find((s) => s.responseRate === bestResponseRate)?.campaignId)?.name
    : null;
  const totalSent = stats?.reduce((sum, s) => sum + s.sent, 0) ?? 0;
  const sortedRates = stats ? [...stats].map((s) => s.responseRate).sort((a, b) => b - a) : [];
  const diff = sortedRates.length >= 2 ? (sortedRates[0] - sortedRates[sortedRates.length - 1]).toFixed(1) : null;

  // Data charts
  const barChartData = useMemo(() => {
    if (!stats) return [];
    return stats.map((s) => ({
      name: campaigns.find((c) => c.id === s.campaignId)?.name?.substring(0, 18) || "?",
      Enviados: s.sent, Falhas: s.failed, Respostas: s.replied,
    }));
  }, [stats, campaigns]);

  const rateChartData = useMemo(() => {
    if (!stats) return [];
    return stats.map((s) => ({
      name: campaigns.find((c) => c.id === s.campaignId)?.name?.substring(0, 18) || "?",
      "Taxa Resposta": +s.responseRate.toFixed(1),
      "Taxa Entrega": +s.deliveryRate.toFixed(1),
      "Taxa Falha": +s.failRate.toFixed(1),
    }));
  }, [stats, campaigns]);

  const radarData = useMemo(() => {
    if (!stats || stats.length < 2) return [];
    const maxV = Math.max(...stats.map((s) => s.velocity || 0), 1);
    const maxT = Math.max(...stats.map((s) => s.total), 1);
    return ["Entrega %", "Resposta %", "Velocidade", "Volume"].map((metric) => {
      const entry: Record<string, any> = { metric };
      stats.forEach((s, i) => {
        const label = campaigns.find((c) => c.id === s.campaignId)?.name?.substring(0, 15) || `C${i + 1}`;
        switch (metric) {
          case "Entrega %": entry[label] = +s.deliveryRate.toFixed(1); break;
          case "Resposta %": entry[label] = +s.responseRate.toFixed(1); break;
          case "Velocidade": entry[label] = +((s.velocity || 0) / maxV * 100).toFixed(1); break;
          case "Volume": entry[label] = +(s.total / maxT * 100).toFixed(1); break;
        }
      });
      return entry;
    });
  }, [stats, campaigns]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return stats.map((s, i) => ({
      name: campaigns.find((c) => c.id === s.campaignId)?.name?.substring(0, 18) || "?",
      value: s.sent, fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [stats, campaigns]);

  const hasStats = stats && stats.length >= 2;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comparador de Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare métricas de campanhas finalizadas lado a lado</p>
        </div>
        <div className="flex gap-2">
          {hasStats && (
            <Button className="gap-2" onClick={() => analysisMutation.mutate(selectedIds)} disabled={analysisMutation.isPending}>
              {analysisMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar Análise com IA
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2"><BarChart3 className="w-4 h-4" />Selecionar ({selectedIds.length})</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-80 overflow-y-auto" align="end">
              <p className="text-sm font-medium text-foreground mb-3">Escolha 2 ou mais campanhas</p>
              {loadingCampaigns ? <p className="text-sm text-muted-foreground">Carregando...</p> : eligibleCampaigns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma campanha finalizada</p> : (
                <div className="space-y-2">
                  {eligibleCampaigns.map((c) => (
                    <label key={c.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleCampaign(c.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.total_recipients} dest. • <Badge variant={c.status === "completed" ? "secondary" : "default"} className="text-[10px] px-1.5 py-0">{c.status === "completed" ? "Concluída" : "Em andamento"}</Badge></p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stat cards */}
      {hasStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Campanhas" value={String(stats.length)} icon={<BarChart3 className="w-5 h-5 text-primary" />} />
          <StatCard title="Total Enviados" value={totalSent.toLocaleString("pt-BR")} subtitle={`${stats.length} campanhas`} icon={<Send className="w-5 h-5 text-info" />} />
          <StatCard title="Melhor Taxa Resposta" value={`${bestResponseRate.toFixed(1)}%`} subtitle={bestCampaignName ?? ""} icon={<Trophy className="w-5 h-5 text-warning" />} />
          <StatCard title="Diferença" value={diff ? `${diff}pp` : "—"} subtitle="Melhor vs pior" icon={<TrendingUp className="w-5 h-5 text-success" />} />
        </div>
      )}

      {/* Data-driven charts */}
      {hasStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Volume de Mensagens</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 14%)" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(217, 33%, 8%)", border: "1px solid hsl(217, 33%, 14%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="Enviados" fill="hsl(187, 85%, 53%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Respostas" fill="hsl(142, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Falhas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Taxas Comparativas (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rateChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 14%)" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(217, 33%, 8%)", border: "1px solid hsl(217, 33%, 14%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="Taxa Entrega" fill="hsl(210, 80%, 55%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Taxa Resposta" fill="hsl(142, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Taxa Falha" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {radarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Perfil Comparativo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(217, 32%, 14%)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: "hsl(215, 20%, 40%)", fontSize: 10 }} domain={[0, 100]} />
                    {stats.map((s, i) => {
                      const label = campaigns.find((c) => c.id === s.campaignId)?.name?.substring(0, 15) || `C${i + 1}`;
                      return <Radar key={s.campaignId} name={label} dataKey={label} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} />;
                    })}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de Envios</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={{ stroke: "hsl(215, 20%, 40%)" }}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(217, 33%, 8%)", border: "1px solid hsl(217, 33%, 14%)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Analysis Result */}
      {aiResult && (
        <div className="space-y-4">
          {/* Verdict banner */}
          {aiResult.verdict && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium text-foreground">{aiResult.verdict}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sections — left 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-primary/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Análise Comparativa com IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {aiResult.sections.map((section, i) => (
                    <div key={i}>
                      {i > 0 && <Separator className="mb-5" />}
                      <AnalysisSection section={section} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* AI Charts — right col */}
            {aiResult.charts.length > 0 && (
              <div className="space-y-4">
                {aiResult.charts.map((chart, i) => (
                  <Card key={i} className="border-accent/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-accent" />
                        {chart.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AIChartRenderer chart={chart} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedIds.length < 2 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-foreground">Selecione pelo menos 2 campanhas</p>
            <p className="text-sm text-muted-foreground mt-1">Use o botão acima para escolher campanhas finalizadas e compará-las</p>
          </CardContent>
        </Card>
      )}

      {loadingStats && selectedIds.length >= 2 && (
        <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground animate-pulse">Calculando métricas...</p></CardContent></Card>
      )}

      {/* Campaign detail cards */}
      {hasStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats.map((s) => {
            const campaign = campaigns.find((c) => c.id === s.campaignId);
            if (!campaign) return null;
            const isWinner = s.responseRate === bestResponseRate && bestResponseRate > 0;
            return (
              <Card key={s.campaignId} className={isWinner ? "ring-1 ring-warning/50 shadow-[0_0_15px_hsl(var(--warning)/0.1)]" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 truncate">
                      {isWinner && <Crown className="w-4 h-4 text-warning shrink-0" />}{campaign.name}
                    </CardTitle>
                    {isWinner && <Badge className="bg-warning/10 text-warning border-warning/20 shrink-0">Melhor</Badge>}
                  </div>
                  <CardDescription>{campaign.message_type} • {campaign.status === "completed" ? "Concluída" : "Em andamento"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Taxa de Resposta</p>
                    <p className="text-3xl font-bold text-primary">{s.responseRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.replied} de {s.sent} responderam</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricItem icon={Users} label="Destinatários" value={s.total} />
                    <MetricItem icon={Send} label="Enviados" value={s.sent} />
                    <MetricItem icon={MessageSquareReply} label="Respostas" value={s.replied} color="text-success" />
                    <MetricItem icon={XCircle} label="Falhas" value={s.failed} color="text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Taxa de entrega</span><span className="text-foreground font-medium">{s.deliveryRate.toFixed(1)}%</span></div>
                    <Progress value={s.deliveryRate} className="h-1.5" />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {s.durationMin !== null && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.durationMin < 60 ? `${Math.round(s.durationMin)}min` : `${(s.durationMin / 60).toFixed(1)}h`}</span>}
                    {s.velocity !== null && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{s.velocity.toFixed(1)} msg/min</span>}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Settings2 className="w-3 h-3" /> Motor de Disparo</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Lote</span><span className="text-foreground">{campaign.batch_size} msgs</span>
                      <span className="text-muted-foreground">Delay</span><span className="text-foreground">{(campaign.delay_min_ms / 1000).toFixed(0)}-{(campaign.delay_max_ms / 1000).toFixed(0)}s</span>
                      <span className="text-muted-foreground">Pausa lotes</span><span className="text-foreground">{campaign.delay_between_batches}-{campaign.delay_between_batches_max}s</span>
                      <span className="text-muted-foreground">Rotação</span><span className="text-foreground">{campaign.rotation_strategy} ({(campaign.instance_ids || []).length} inst.)</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Mensagem</p>
                    <HighlightedMessage text={campaign.message_template} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
