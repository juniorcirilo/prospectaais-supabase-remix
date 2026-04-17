import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFollowupLogs, useFollowupSequences } from "@/hooks/useFollowup";
import { Send, SkipForward, XCircle, AlertTriangle } from "lucide-react";

const actionConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  sent: { label: "Enviado", icon: <Send className="w-3 h-3" />, className: "bg-success/10 text-success border-success/20" },
  skipped: { label: "Pulado", icon: <SkipForward className="w-3 h-3" />, className: "bg-info/10 text-info border-info/20" },
  cancelled: { label: "Cancelado", icon: <XCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive border-destructive/20" },
  alerted: { label: "Alertado", icon: <AlertTriangle className="w-3 h-3" />, className: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Falhou", icon: <XCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function LogsTab() {
  const { data: sequences = [] } = useFollowupSequences();
  const [filterSeq, setFilterSeq] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const { data: logs = [], isLoading } = useFollowupLogs({
    sequenceId: filterSeq !== "all" ? filterSeq : undefined,
    action: filterAction !== "all" ? filterAction : undefined,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={filterSeq} onValueChange={setFilterSeq}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as sequências" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as sequências</SelectItem>
            {sequences.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todas as ações" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(actionConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum log encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Message ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const ac = actionConfig[log.action] || actionConfig.sent;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.enrollment_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">#{log.step_position + 1}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ac.className}>
                          <span className="flex items-center gap-1.5">{ac.icon}{ac.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{log.reason || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.message_id?.slice(0, 12) || "—"}</TableCell>
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
