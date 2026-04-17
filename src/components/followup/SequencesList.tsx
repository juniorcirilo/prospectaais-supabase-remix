import { Plus, Play, Pause, Trash2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FollowupSequence, useFollowupSequences } from "@/hooks/useFollowup";

interface Props {
  onNewSequence: () => void;
  onSelectSequence: (seq: FollowupSequence) => void;
}

const triggerLabels: Record<string, string> = {
  no_reply: "Sem resposta",
  delivered_not_read: "Entregue, não lido",
  read_no_reply: "Lido, sem resposta",
  pipeline_inactivity: "Inatividade no pipeline",
  deal_created: "Deal criado",
  deal_stage_change: "Mudança de etapa",
  deal_lost: "Deal perdido",
  keyword_reply: "Palavra-chave",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", className: "bg-success/10 text-success border-success/20" },
  paused: { label: "Pausada", className: "bg-warning/10 text-warning border-warning/20" },
};

export default function SequencesList({ onNewSequence, onSelectSequence }: Props) {
  const { data: sequences = [], isLoading, updateSequence, deleteSequence } = useFollowupSequences();

  const toggleStatus = (e: React.MouseEvent, seq: FollowupSequence) => {
    e.stopPropagation();
    const newStatus = seq.status === "active" ? "paused" : "active";
    updateSequence.mutate({ id: seq.id, status: newStatus });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSequence.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sequences.length} sequência{sequences.length !== 1 ? "s" : ""} configurada{sequences.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={onNewSequence}>
          <Sparkles className="w-4 h-4 mr-1" /> Nova Sequência com IA
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : sequences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma sequência de follow-up criada ainda.</p>
            <Button onClick={onNewSequence}>
              <Plus className="w-4 h-4 mr-1" /> Criar primeira sequência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Etapas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((seq) => {
                  const sc = statusConfig[seq.status] || statusConfig.draft;
                  return (
                    <TableRow
                      key={seq.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => onSelectSequence(seq)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-foreground">{seq.name}</p>
                            {seq.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{seq.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {triggerLabels[seq.trigger_type] || seq.trigger_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{seq.max_attempts}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{seq.ttl_days}d</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => toggleStatus(e, seq)}>
                            {seq.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, seq.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
