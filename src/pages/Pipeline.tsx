import React, { useState, useRef, useEffect } from "react";
import {
  Plus, Search, MoreHorizontal, DollarSign, Loader2, CalendarClock, Tag, X,
  Building, User, Calendar, FileText, Phone, Mail, Paperclip,
  CheckCircle2, Circle, Clock, Trash2, Settings, Brain, Bot, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePipelineStages, useDeals, useDealActivities, usePipelineMutations, Deal } from "@/hooks/usePipeline";
import { CreateDealModal } from "@/components/pipeline/CreateDealModal";
import { LostReasonModal } from "@/components/pipeline/LostReasonModal";
import { PipelineSettingsModal } from "@/components/pipeline/PipelineSettingsModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Pipeline() {
  const { data: stages = [], isLoading: loadingStages } = usePipelineStages();
  const { data: deals = [], isLoading: loadingDeals } = useDeals();
  const { updateDeal, createActivity, updateActivity, deleteActivity } = usePipelineMutations();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState<"note" | "activity" | "email">("note");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [newActivityDescription, setNewActivityDescription] = useState("");

  const { data: activities = [], isLoading: loadingActivities } = useDealActivities(selectedDeal?.id || null);

  const dragItem = useRef<string | null>(null);

  // Realtime subscriptions
  useEffect(() => {
    const dealsChannel = supabase
      .channel("deals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        // React Query will refetch via invalidation
      })
      .subscribe();

    return () => { supabase.removeChannel(dealsChannel); };
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const onDragStart = (e: React.DragEvent, dealId: string) => {
    dragItem.current = dealId;
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const onDragEnd = (e: React.DragEvent) => {
    dragItem.current = null;
    (e.target as HTMLElement).style.opacity = "1";
  };

  const onDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = dragItem.current;
    if (!dealId) return;

    const targetStage = stages.find(s => s.id === targetStageId);
    const updates: any = { id: dealId, stage_id: targetStageId };

    if (targetStage?.title === "Ganho") {
      updates.won_at = new Date().toISOString();
    } else if (targetStage?.title === "Perdido") {
      // Show lost reason modal
      const deal = deals.find(d => d.id === dealId);
      if (deal) {
        setSelectedDeal(deal);
        setIsLostModalOpen(true);
      }
      return;
    }

    await updateDeal.mutateAsync(updates);
  };

  const handleMarkWon = async () => {
    if (!selectedDeal) return;
    const wonStage = stages.find(s => s.title === "Ganho");
    await updateDeal.mutateAsync({
      id: selectedDeal.id,
      stage_id: wonStage?.id,
      won_at: new Date().toISOString(),
    } as any);
    toast.success("Deal marcado como ganho!");
    setSelectedDeal(null);
  };

  const handleMarkLost = async (reason: string) => {
    if (!selectedDeal) return;
    const lostStage = stages.find(s => s.title === "Perdido");
    await updateDeal.mutateAsync({
      id: selectedDeal.id,
      stage_id: lostStage?.id,
      lost_at: new Date().toISOString(),
      lost_reason: reason,
    } as any);
    toast.success("Deal marcado como perdido");
    setSelectedDeal(null);
  };

  const handleMoveToStage = async (stageId: string) => {
    if (!selectedDeal) return;
    const stage = stages.find(s => s.id === stageId);
    if (stage?.title === "Ganho") {
      await handleMarkWon();
      return;
    }
    if (stage?.title === "Perdido") {
      setIsLostModalOpen(true);
      return;
    }
    await updateDeal.mutateAsync({ id: selectedDeal.id, stage_id: stageId } as any);
    setSelectedDeal({ ...selectedDeal, stage_id: stageId });
  };

  const handleCreateActivity = async () => {
    if (!selectedDeal || !newActivityTitle.trim()) return;
    await createActivity.mutateAsync({
      deal_id: selectedDeal.id,
      type: activeTab === "activity" ? "call" : activeTab === "email" ? "email" : "note",
      title: newActivityTitle,
      description: newActivityDescription || null,
    });
    setNewActivityTitle("");
    setNewActivityDescription("");
  };

  const filteredDeals = deals.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "medium": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    }
  };

  if (loadingStages || loadingDeals) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie oportunidades e acompanhe o fluxo de receita.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar oportunidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="outline" onClick={() => setIsSettingsModalOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />Configurar
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Novo Deal
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full gap-4 min-w-max">
          {stages.map((column) => {
            const columnDeals = filteredDeals.filter(d => d.stage_id === column.id);
            const totalValue = columnDeals.reduce((acc, curr) => acc + Number(curr.value), 0);
            const isWonColumn = column.title === "Ganho";
            const isLostColumn = column.title === "Perdido";

            return (
              <div
                key={column.id}
                className={`w-72 flex flex-col h-full rounded-xl border backdrop-blur-sm ${
                  isWonColumn ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                  : isLostColumn ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                  : "bg-muted/30 border-border"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={`p-3 border-b flex flex-col gap-1 rounded-t-xl ${
                  isWonColumn ? "bg-emerald-100/50 border-emerald-200 border-t-4 border-t-emerald-500 dark:bg-emerald-900/30"
                  : isLostColumn ? "bg-red-100/50 border-red-200 border-t-4 border-t-red-500 dark:bg-red-900/30"
                  : `border-border border-t-2 ${column.color}`
                }`}>
                  <div className="flex justify-between items-center">
                    <h3 className={`font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
                      isWonColumn ? "text-emerald-700 dark:text-emerald-400" : isLostColumn ? "text-red-700 dark:text-red-400" : "text-foreground"
                    }`}>
                      {column.is_ai_managed && <span title="Gerenciado pela IA"><Bot className="w-3 h-3 text-primary" /></span>}
                      {column.title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isWonColumn ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300"
                      : isLostColumn ? "bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300"
                      : "bg-muted text-muted-foreground"
                    }`}>{columnDeals.length}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                    Total: <span className={isWonColumn ? "text-emerald-700 dark:text-emerald-400" : isLostColumn ? "text-red-700 dark:text-red-400" : "text-foreground"}>{formatCurrency(totalValue)}</span>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {columnDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, deal.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setSelectedDeal(deal)}
                      className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-primary/10 transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(deal.priority)}`}>
                          {deal.priority === "high" ? "Alta" : deal.priority === "medium" ? "Média" : "Baixa"}
                        </span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h4 className="font-semibold text-foreground text-sm mb-0.5 leading-tight">{deal.title}</h4>
                      <p className="text-[10px] text-muted-foreground mb-2">{deal.company}</p>
                      {deal.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {deal.tags.map(tag => (
                            <span key={tag} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 text-foreground text-xs font-bold">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          {formatCurrency(Number(deal.value))}
                        </div>
                        {deal.due_date && (
                          <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(deal.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side Drawer */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedDeal(null)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${selectedDeal ? "translate-x-0" : "translate-x-full"}`}>
        {selectedDeal && (
          <>
            {/* Drawer Header */}
            <div className="flex-shrink-0 bg-card border-b border-border">
              <div className="p-6 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">{selectedDeal.title}</h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm flex-wrap">
                    <span className="font-semibold text-emerald-600">{formatCurrency(Number(selectedDeal.value))}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {selectedDeal.company || "Sem empresa"}</span>
                    {selectedDeal.contact_name && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedDeal.contact_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleMarkWon} className="bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-600">
                    Ganho
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsLostModalOpen(true)} className="bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-600">
                    Perdido
                  </Button>
                  <button onClick={() => setSelectedDeal(null)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Stage Progress */}
              <div className="px-6 pb-6 overflow-x-auto">
                <div className="flex items-center gap-1 w-full min-w-max">
                  {stages.map((col, idx) => {
                    const currentStageIndex = stages.findIndex(c => c.id === selectedDeal.stage_id);
                    const isCompleted = idx < currentStageIndex;
                    const isActive = idx === currentStageIndex;
                    return (
                      <div
                        key={col.id}
                        className={`flex-1 h-8 flex items-center justify-center px-2 relative cursor-pointer group transition-all first:rounded-l-md last:rounded-r-md ${
                          isCompleted ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                        onClick={() => handleMoveToStage(col.id)}
                      >
                        <span className="text-xs font-bold whitespace-nowrap z-10">{col.title}</span>
                        {idx !== stages.length - 1 && (
                          <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-background/20 z-20" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-background">
              {/* Action Composer */}
              <div className="p-6 border-b border-border bg-card/30">
                <div className="flex gap-4 mb-4">
                  {[
                    { key: "note" as const, icon: FileText, label: "Nota", activeColor: "text-primary", activeBg: "bg-primary/10" },
                    { key: "activity" as const, icon: Calendar, label: "Atividade", activeColor: "text-amber-600", activeBg: "bg-amber-500/10" },
                    { key: "email" as const, icon: Mail, label: "Email", activeColor: "text-violet-600", activeBg: "bg-violet-500/10" },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === tab.key ? tab.activeColor : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <div className={`p-2 rounded-full ${activeTab === tab.key ? tab.activeBg : "bg-muted"}`}>
                        <tab.icon className="w-4 h-4" />
                      </div>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner">
                  <input
                    type="text"
                    className="w-full bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border-b border-border"
                    placeholder="Título da atividade"
                    value={newActivityTitle}
                    onChange={(e) => setNewActivityTitle(e.target.value)}
                  />
                  <textarea
                    className="w-full bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px]"
                    placeholder={activeTab === "note" ? "Escreva uma nota..." : activeTab === "activity" ? "Descreva a atividade..." : "Escreva o corpo do email..."}
                    value={newActivityDescription}
                    onChange={(e) => setNewActivityDescription(e.target.value)}
                  />
                  <div className="px-3 py-2 bg-muted/50 border-t border-border flex justify-between items-center">
                    <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"><Paperclip className="w-4 h-4" /></button>
                    <Button size="sm" className="h-8" onClick={handleCreateActivity} disabled={!newActivityTitle.trim()}>Salvar</Button>
                  </div>
                </div>
              </div>

              {/* Activities Timeline */}
              <div className="p-6">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Atividades ({activities.length})
                </h4>

                {loadingActivities ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade registrada</div>
                ) : (
                  <div className="space-y-3">
                    {activities.map(activity => {
                      const activityIcon = activity.type === "call" ? Phone : activity.type === "email" ? Mail : activity.type === "meeting" ? Calendar : FileText;
                      const activityColor = activity.type === "call" ? "text-amber-500 bg-amber-500/10"
                        : activity.type === "email" ? "text-violet-500 bg-violet-500/10"
                        : activity.type === "meeting" ? "text-primary bg-primary/10"
                        : "text-muted-foreground bg-muted";
                      const ActivityIcon = activityIcon;

                      return (
                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-border/80 transition-all group">
                          <button
                            onClick={() => updateActivity.mutate({ id: activity.id, is_completed: !activity.is_completed })}
                            className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors"
                          >
                            {activity.is_completed ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                          </button>
                          <div className={`p-1.5 rounded ${activityColor}`}>
                            <ActivityIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${activity.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {activity.title}
                            </p>
                            {activity.description && <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>}
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {new Date(activity.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteActivity.mutate(activity.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreateDealModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
      {selectedDeal && (
        <LostReasonModal
          open={isLostModalOpen}
          onOpenChange={setIsLostModalOpen}
          onConfirm={handleMarkLost}
          dealTitle={selectedDeal.title}
        />
      )}
      <PipelineSettingsModal open={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </div>
  );
}
