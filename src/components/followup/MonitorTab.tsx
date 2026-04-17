import { Brain, Send, SkipForward, XCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatCard from "@/components/StatCard";
import { useFollowupEnrollments, useFollowupLogs } from "@/hooks/useFollowup";
import { useMemo } from "react";

const decisionConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  sent: { label: "Enviado", icon: <Send className="w-3 h-3" />, className: "bg-success/10 text-success border-success/20" },
  skipped: { label: "Pulado", icon: <SkipForward className="w-3 h-3" />, className: "bg-info/10 text-info border-info/20" },
  cancelled: { label: "Cancelado", icon: <XCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive border-destructive/20" },
  alerted: { label: "Alertado", icon: <AlertTriangle className="w-3 h-3" />, className: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Falhou", icon: <XCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function MonitorTab() {
  const { data: enrollments = [] } = useFollowupEnrollments();
  const { data: logs = [] } = useFollowupLogs();

  const stats = useMemo(() => {
    const active = enrollments.filter(e => e.status === "active").length;
    const paused = enrollments.filter(e => e.status === "paused").length;
    const completed = enrollments.filter(e => e.status === "completed").length;

    const today = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(l => l.sent_at?.startsWith(today));
    const sentToday = todayLogs.filter(l => l.action === "sent").length;
    const skippedToday = todayLogs.filter(l => l.action === "skipped").length;

    const actionCounts = { sent: 0, skipped: 0, cancelled: 0, alerted: 0, failed: 0 };
    todayLogs.forEach(l => {
      if (l.action in actionCounts) actionCounts[l.action as keyof typeof actionCounts]++;
    });

    return { active, paused, completed, sentToday, skippedToday, todayLogs: todayLogs.length, actionCounts };
  }, [enrollments, logs]);

  const recentLogs = logs.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Follow-ups Hoje" value={String(stats.todayLogs)} subtitle={`${stats.sentToday} enviados, ${stats.skippedToday} pulados`} icon={<Brain className="w-5 h-5 text-primary" />} />
        <StatCard title="Inscrições Ativas" value={String(stats.active)} subtitle={`${stats.paused} pausadas`} icon={<Clock className="w-5 h-5 text-warning" />} />
        <StatCard title="Leads Pausados" value={String(stats.paused)} subtitle="Aguardando atenção" icon={<AlertTriangle className="w-5 h-5 text-destructive" />} />
        <StatCard title="Completados" value={String(stats.completed)} subtitle="Sequências finalizadas" icon={<TrendingUp className="w-5 h-5 text-success" />} />
      </div>

      {/* Decision pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(stats.actionCounts).map(([action, count]) => {
          const total = stats.todayLogs || 1;
          const dc = decisionConfig[action];
          return (
            <Card key={action}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{dc?.label || action}</span>
                  <span className="text-lg font-bold text-foreground">{count}</span>
                </div>
                <Progress value={(count / total) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{total > 0 ? Math.round((count / total) * 100) : 0}% das decisões</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decisões Recentes</CardTitle>
          <CardDescription>Últimos envios e decisões do motor de follow-up</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log registrado ainda. As decisões aparecerão aqui quando o motor estiver ativo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Decisão</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => {
                  const dc = decisionConfig[log.action] || decisionConfig.sent;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.enrollment_id.slice(0, 8)}...</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">Etapa {log.step_position + 1}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={dc.className}>
                          <span className="flex items-center gap-1.5">{dc.icon}{dc.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.reason || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(log.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
