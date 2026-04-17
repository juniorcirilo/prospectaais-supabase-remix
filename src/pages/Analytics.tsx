import { BarChart3, MessageCircle, Send, CheckCheck, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── hooks ────────────────────────────────────────────────── */

function useGlobalStats() {
  return useQuery({
    queryKey: ["analytics-global"],
    queryFn: async () => {
      const { count: totalSent } = await supabase
        .from("broadcast_recipients")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      const { count: totalFailed } = await supabase
        .from("broadcast_recipients")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { count: totalRecipients } = await supabase
        .from("broadcast_recipients")
        .select("*", { count: "exact", head: true });

      const { count: totalInbound } = await supabase
        .from("conversation_messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound");

      const { count: totalCampaigns } = await supabase
        .from("broadcast_campaigns")
        .select("*", { count: "exact", head: true });

      return {
        totalSent: totalSent || 0,
        totalFailed: totalFailed || 0,
        totalRecipients: totalRecipients || 0,
        totalInbound: totalInbound || 0,
        totalCampaigns: totalCampaigns || 0,
      };
    },
  });
}

function useCampaignBreakdown() {
  return useQuery({
    queryKey: ["analytics-campaigns"],
    queryFn: async () => {
      const { data: campaigns } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!campaigns?.length) return [];

      const rows = await Promise.all(
        campaigns.map(async (c) => {
          const { data: stats } = await supabase.rpc("get_campaign_response_stats", {
            p_campaign_id: c.id,
          });
          const s = stats as { total: number; sent: number; failed: number; replied: number } | null;
          return {
            id: c.id,
            name: c.name,
            status: c.status,
            messageType: c.message_type,
            total: s?.total || 0,
            sent: s?.sent || 0,
            failed: s?.failed || 0,
            replied: s?.replied || 0,
            deliveryRate: s && s.total > 0 ? ((s.sent / s.total) * 100).toFixed(1) : "0",
            responseRate: s && s.sent > 0 ? ((s.replied / s.sent) * 100).toFixed(1) : "0",
          };
        })
      );
      return rows;
    },
  });
}

function useDailyVolume() {
  return useQuery({
    queryKey: ["analytics-daily-volume"],
    queryFn: async () => {
      const days: { name: string; enviados: number; falhas: number; respostas: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = startOfDay(subDays(day, -1)).toISOString();

        const { count: sent } = await supabase
          .from("broadcast_recipients")
          .select("*", { count: "exact", head: true })
          .eq("status", "sent")
          .gte("sent_at", dayStart)
          .lt("sent_at", dayEnd);

        const { count: failed } = await supabase
          .from("broadcast_recipients")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd);

        const { count: replies } = await supabase
          .from("conversation_messages")
          .select("*", { count: "exact", head: true })
          .eq("direction", "inbound")
          .gte("created_at", dayStart)
          .lt("created_at", dayEnd);

        days.push({
          name: format(day, "dd/MM", { locale: ptBR }),
          enviados: sent || 0,
          falhas: failed || 0,
          respostas: replies || 0,
        });
      }
      return days;
    },
  });
}

function useRecentMessages() {
  return useQuery({
    queryKey: ["analytics-recent-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_messages")
        .select("id, content, direction, created_at, contact_id")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!data?.length) return [];

      // Get contact names
      const contactIds = [...new Set(data.map((m) => m.contact_id))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .in("id", contactIds);

      const contactMap = new Map<string, { id: string; name: string | null; phone: string | null }>(
        (contacts || []).map((c) => [c.id, c])
      );

      return data.map((m) => ({
        id: m.id,
        content: m.content,
        direction: m.direction as "inbound" | "outbound",
        time: format(new Date(m.created_at), "dd/MM HH:mm"),
        contactName: contactMap.get(m.contact_id)?.name || "Desconhecido",
        contactPhone: contactMap.get(m.contact_id)?.phone || "",
      }));
    },
  });
}

/* ── component ────────────────────────────────────────────── */

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(var(--info, 210 80% 55%))",
];

const statusLabels: Record<string, string> = {
  active: "Ativa",
  sending: "Enviando",
  paused: "Pausada",
  completed: "Concluída",
  draft: "Rascunho",
  error: "Erro",
};

export default function Analytics() {
  const { data: stats, isLoading: statsLoading } = useGlobalStats();
  const { data: campaigns } = useCampaignBreakdown();
  const { data: dailyData } = useDailyVolume();
  const { data: messages } = useRecentMessages();

  const deliveryRate = stats && stats.totalRecipients > 0
    ? ((stats.totalSent / stats.totalRecipients) * 100).toFixed(1)
    : "0";

  const responseRate = stats && stats.totalSent > 0
    ? ((stats.totalInbound / stats.totalSent) * 100).toFixed(1)
    : "0";

  // Pie data for campaign status distribution
  const statusCounts = campaigns?.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const pieData = Object.entries(statusCounts).map(([key, val]) => ({
    name: statusLabels[key] || key,
    value: val,
  }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Análise de Respostas</h1>
        <p className="text-sm text-muted-foreground mt-1">Métricas reais do sistema de disparos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Enviados"
          value={statsLoading ? "..." : String(stats?.totalSent ?? 0)}
          icon={<Send className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Respostas Recebidas"
          value={statsLoading ? "..." : String(stats?.totalInbound ?? 0)}
          icon={<MessageCircle className="w-5 h-5 text-success" />}
        />
        <StatCard
          title="Taxa de Entrega"
          value={statsLoading ? "..." : `${deliveryRate}%`}
          icon={<CheckCheck className="w-5 h-5 text-info" />}
        />
        <StatCard
          title="Taxa de Resposta"
          value={statsLoading ? "..." : `${responseRate}%`}
          icon={<BarChart3 className="w-5 h-5 text-warning" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily volume */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Volume Diário — Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="enviados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Enviados" />
                  <Bar dataKey="respostas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Respostas" />
                  <Bar dataKey="falhas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Falhas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por Campanha</CardTitle>
          <CardDescription>Últimas 10 campanhas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="text-right">Taxa Entrega</TableHead>
                <TableHead className="text-right">Taxa Resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns?.length ? campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground max-w-[200px] truncate">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{c.messageType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.total}</TableCell>
                  <TableCell className="text-right text-success">{c.sent}</TableCell>
                  <TableCell className="text-right text-destructive">{c.failed}</TableCell>
                  <TableCell className="text-right text-primary">{c.replied}</TableCell>
                  <TableCell className="text-right font-medium">{c.deliveryRate}%</TableCell>
                  <TableCell className="text-right font-medium">{c.responseRate}%</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Nenhuma campanha encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagens Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages?.length ? messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-foreground">{m.contactName}</TableCell>
                  <TableCell>
                    <Badge variant={m.direction === "inbound" ? "default" : "secondary"}>
                      {m.direction === "inbound" ? "Recebida" : "Enviada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{m.content}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.time}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma mensagem encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
