import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, GitBranch, MoreHorizontal, Play, Pause, Trash2, Copy, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFlows, useCreateFlow, useDeleteFlow, useUpdateFlow } from "@/hooks/useFlows";
import { format } from "date-fns";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  paused: { label: "Pausado", variant: "outline" },
};

const triggerMap: Record<string, string> = {
  manual: "Manual",
  post_dispatch: "Pós-disparo",
  keyword: "Palavra-chave",
  reply: "Resposta recebida",
};

export default function Flows() {
  const navigate = useNavigate();
  const { data: flows, isLoading } = useFlows();
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();
  const updateFlow = useUpdateFlow();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("manual");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const flow = await createFlow.mutateAsync({
      name: newName,
      description: newDesc,
      trigger_type: newTrigger,
    });
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setNewTrigger("manual");
    navigate(`/flows/${flow.id}/edit`);
  };

  const toggleStatus = (flow: any) => {
    const next = flow.status === "active" ? "paused" : "active";
    updateFlow.mutate({ id: flow.id, status: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxos</h1>
          <p className="text-muted-foreground text-sm">
            Automações conversacionais que continuam após o disparo
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Fluxo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-40" />
          ))}
        </div>
      ) : !flows?.length ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum fluxo criado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crie seu primeiro fluxo para automatizar conversas após disparos.
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Fluxo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => {
            const st = statusMap[flow.status] || statusMap.draft;
            return (
              <Card
                key={flow.id}
                className="hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/flows/${flow.id}/edit`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{flow.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => navigate(`/flows/${flow.id}/edit`)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(flow)}>
                          {flow.status === "active" ? (
                            <><Pause className="w-4 h-4 mr-2" /> Pausar</>
                          ) : (
                            <><Play className="w-4 h-4 mr-2" /> Ativar</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteFlow.mutate(flow.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {flow.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{flow.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {triggerMap[flow.trigger_type] || flow.trigger_type}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Atualizado em {format(new Date(flow.updated_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fluxo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Follow-up pós-venda"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descreva o objetivo deste fluxo..."
                rows={2}
              />
            </div>
            <div>
              <Label>Gatilho de ativação</Label>
              <Select value={newTrigger} onValueChange={setNewTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="post_dispatch">Pós-disparo</SelectItem>
                  <SelectItem value="reply">Resposta recebida</SelectItem>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createFlow.isPending}>
              Criar e Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
