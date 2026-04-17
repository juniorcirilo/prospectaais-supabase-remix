import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, GripVertical, Plus, Lock, Bot, User, AlertTriangle } from "lucide-react";
import { usePipelineStages, useDeals, usePipelineMutations, PipelineStage } from "@/hooks/usePipeline";

const STAGE_COLORS = [
  { value: "border-slate-500", label: "Cinza", preview: "bg-slate-500" },
  { value: "border-cyan-500", label: "Ciano", preview: "bg-cyan-500" },
  { value: "border-violet-500", label: "Violeta", preview: "bg-violet-500" },
  { value: "border-orange-500", label: "Laranja", preview: "bg-orange-500" },
  { value: "border-emerald-500", label: "Verde", preview: "bg-emerald-500" },
  { value: "border-red-500", label: "Vermelho", preview: "bg-red-500" },
  { value: "border-blue-500", label: "Azul", preview: "bg-blue-500" },
  { value: "border-yellow-500", label: "Amarelo", preview: "bg-yellow-500" },
  { value: "border-pink-500", label: "Rosa", preview: "bg-pink-500" },
  { value: "border-indigo-500", label: "Índigo", preview: "bg-indigo-500" },
];

interface PipelineSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function PipelineSettingsModal({ open, onClose }: PipelineSettingsModalProps) {
  const { data: stages = [], isLoading } = usePipelineStages();
  const { data: deals = [] } = useDeals();
  const { createStage, updateStage, deleteStage, reorderStages } = usePipelineMutations();

  const [localStages, setLocalStages] = useState<PipelineStage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIsAiManaged, setEditIsAiManaged] = useState(false);
  const [editTriggerCriteria, setEditTriggerCriteria] = useState("");
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageColor, setNewStageColor] = useState("border-slate-500");
  const [newStageIsAiManaged, setNewStageIsAiManaged] = useState(false);
  const [newStageTriggerCriteria, setNewStageTriggerCriteria] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ stageId: string; stageName: string } | null>(null);
  const [moveToStageId, setMoveToStageId] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (stages.length > 0) setLocalStages(stages);
  }, [stages]);

  const handleEdit = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditTitle(stage.title);
    setEditColor(stage.color);
    setEditIsAiManaged(stage.is_ai_managed);
    setEditTriggerCriteria(stage.ai_trigger_criteria || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateStage.mutateAsync({
      id: editingId,
      title: editTitle,
      color: editColor,
      is_ai_managed: editIsAiManaged,
      ai_trigger_criteria: editTriggerCriteria || null,
    });
    setEditingId(null);
  };

  const handleDeleteClick = (stage: PipelineStage) => {
    const dealsInStage = deals.filter(d => d.stage_id === stage.id);
    if (dealsInStage.length > 0) {
      const otherStages = localStages.filter(s => s.id !== stage.id);
      setMoveToStageId(otherStages[0]?.id || "");
      setDeleteConfirm({ stageId: stage.id, stageName: stage.title });
    } else {
      deleteStage.mutate({ stageId: stage.id });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteStage.mutateAsync({ stageId: deleteConfirm.stageId, moveToStageId });
    setDeleteConfirm(null);
  };

  const handleAddStage = async () => {
    if (!newStageTitle.trim()) return;
    await createStage.mutateAsync({
      title: newStageTitle,
      color: newStageColor,
      is_ai_managed: newStageIsAiManaged,
      ai_trigger_criteria: newStageTriggerCriteria || null,
    });
    setNewStageTitle("");
    setNewStageColor("border-slate-500");
    setNewStageIsAiManaged(false);
    setNewStageTriggerCriteria("");
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newStages = [...localStages];
    const draggedItem = newStages[draggedIndex];
    newStages.splice(draggedIndex, 1);
    newStages.splice(index, 0, draggedItem);
    setLocalStages(newStages);
    setDraggedIndex(index);
  };
  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    await reorderStages.mutateAsync(localStages.map(s => s.id));
    setDraggedIndex(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>⚙️ Configurar Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing stages */}
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                localStages.map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 border rounded-lg bg-card cursor-move hover:bg-accent/50 transition-colors ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    <div className={`w-3 h-3 rounded-full ${stage.color.replace("border-", "bg-")}`} />

                    {editingId === stage.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1" placeholder="Nome da etapa" />
                          <Select value={editColor} onValueChange={setEditColor}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STAGE_COLORS.map(c => (
                                <SelectItem key={c.value} value={c.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${c.preview}`} />{c.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tipo de Estágio:</Label>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant={!editIsAiManaged ? "default" : "outline"} onClick={() => setEditIsAiManaged(false)} className="flex-1">
                              <User className="w-3 h-3 mr-1" />Manual
                            </Button>
                            <Button type="button" size="sm" variant={editIsAiManaged ? "default" : "outline"} onClick={() => setEditIsAiManaged(true)} className="flex-1">
                              <Bot className="w-3 h-3 mr-1" />Automático
                            </Button>
                          </div>
                        </div>
                        {editIsAiManaged && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Critérios para IA mover para este estágio:</Label>
                            <Textarea value={editTriggerCriteria} onChange={(e) => setEditTriggerCriteria(e.target.value)} placeholder="Ex: Lead demonstrou interesse claro..." className="h-20 text-sm resize-none" />
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={handleSaveEdit}>Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          {stage.is_ai_managed ? (
                            stage.ai_trigger_criteria ? (
                              <span title="Estágio automático com critério"><Bot className="w-4 h-4 text-primary" /></span>
                            ) : (
                              <span title="Sem critério configurado"><AlertTriangle className="w-4 h-4 text-yellow-500" /></span>
                            )
                          ) : (
                            <span title="Estágio manual"><User className="w-4 h-4 text-muted-foreground" /></span>
                          )}
                          <span className="font-medium">{stage.title}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(stage)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {stage.is_system ? (
                          <Button size="sm" variant="ghost" disabled title="Etapa de sistema">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(stage)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new stage */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium">Nova Etapa</Label>
              <div className="flex gap-2">
                <Input value={newStageTitle} onChange={(e) => setNewStageTitle(e.target.value)} placeholder="Nome da etapa" className="flex-1" />
                <Select value={newStageColor} onValueChange={setNewStageColor}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_COLORS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${c.preview}`} />{c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de Estágio:</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={!newStageIsAiManaged ? "default" : "outline"} onClick={() => setNewStageIsAiManaged(false)} className="flex-1">
                    <User className="w-3 h-3 mr-1" />Manual
                  </Button>
                  <Button type="button" size="sm" variant={newStageIsAiManaged ? "default" : "outline"} onClick={() => setNewStageIsAiManaged(true)} className="flex-1">
                    <Bot className="w-3 h-3 mr-1" />Automático
                  </Button>
                </div>
              </div>
              {newStageIsAiManaged && (
                <div>
                  <Label className="text-xs text-muted-foreground">Critérios para IA mover para este estágio:</Label>
                  <Textarea value={newStageTriggerCriteria} onChange={(e) => setNewStageTriggerCriteria(e.target.value)} placeholder="Ex: Lead demonstrou interesse claro..." className="h-20 text-sm resize-none" />
                </div>
              )}
              <Button onClick={handleAddStage} className="w-full">
                <Plus className="w-4 h-4 mr-1" />Adicionar Etapa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover etapa "{deleteConfirm?.stageName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem deals nesta etapa. Para onde deseja movê-los?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={moveToStageId} onValueChange={setMoveToStageId}>
            <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
            <SelectContent>
              {localStages.filter(s => s.id !== deleteConfirm?.stageId).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Mover e Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
