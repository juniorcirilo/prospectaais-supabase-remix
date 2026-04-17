import { useState } from "react";
import { FollowupSequence, FollowupStep, useFollowupSteps, useFollowupSequences } from "@/hooks/useFollowup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Target,
  Zap,
  Pencil,
  Timer,
  Shield,
  ChevronRight,
  Play,
  Pause,
  RotateCw,
  Reply,
  Link2,
  Megaphone,
  Workflow,
  Sparkles,
} from "lucide-react";

interface Props {
  sequence: FollowupSequence;
  onBack: () => void;
  onEdit?: (seq: FollowupSequence) => void;
  onManualEdit?: (seq: FollowupSequence) => void;
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

const contentTypeLabels: Record<string, string> = {
  text: "Texto",
  spintax: "Spintax",
  ai_rewrite: "IA Rewrite",
  media: "Mídia",
  audio_tts: "Áudio TTS",
  ai_prompt: "IA Contextual",
};

const delayUnitLabels: Record<string, string> = {
  minutes: "minutos",
  hours: "horas",
  days: "dias",
};

const postActionLabels: Record<string, string> = {
  move_pipeline: "Mover no pipeline",
  add_tag: "Adicionar tag",
  notify: "Notificar",
  create_task: "Criar tarefa",
  tag_cold: "Marcar como frio",
  winback_list: "Lista de winback",
  nothing: "Nenhuma ação",
};

const replyBehaviorLabels: Record<string, { label: string; description: string }> = {
  pause_resume: { label: "Pausar e retomar", description: "Pausa ao responder, retoma de onde parou se parar de responder" },
  restart: { label: "Pausar e reiniciar", description: "Pausa ao responder, reinicia do zero se parar de responder" },
  cancel: { label: "Cancelar", description: "Cancela a sequência definitivamente quando responder" },
};

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function SequenceDetail({ sequence, onBack, onEdit, onManualEdit }: Props) {
  const { data: steps = [], isLoading: stepsLoading } = useFollowupSteps(sequence.id);
  const { updateSequence } = useFollowupSequences();
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const sc = statusConfig[sequence.status] || statusConfig.draft;

  // Fetch linked campaign name
  const { data: linkedCampaign } = useQuery({
    queryKey: ["campaign_name", sequence.campaign_id],
    enabled: !!sequence.campaign_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcast_campaigns")
        .select("name, status")
        .eq("id", sequence.campaign_id!)
        .single();
      return data;
    },
  });

  // Fetch linked flow name
  const { data: linkedFlow } = useQuery({
    queryKey: ["flow_name", sequence.flow_id],
    enabled: !!sequence.flow_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("flows")
        .select("name, status")
        .eq("id", sequence.flow_id!)
        .single();
      return data;
    },
  });

  const sendWindow = sequence.send_window as any;
  const postActions = sequence.post_actions as any;
  const triggerConfig = sequence.trigger_config as any;
  const filters = sequence.filters as any;

  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const activeDays = (sendWindow?.days as boolean[])
    ?.map((active: boolean, i: number) => (active ? dayNames[i] : null))
    .filter(Boolean);

  const toggleStatus = async () => {
    setToggling(true);
    try {
      const newStatus = sequence.status === "active" ? "paused" : "active";
      await updateSequence.mutateAsync({ id: sequence.id, status: newStatus });
      toast.success(newStatus === "active" ? "Sequência ativada!" : "Sequência pausada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setToggling(false);
    }
  };

  const runEnrollerAndProcessor = async () => {
    setRunning(true);
    try {
      const { data: d1, error: e1 } = await supabase.functions.invoke("followup-enroller");
      console.log("[followup] Enroller result:", d1, e1);
      const { data: d2, error: e2 } = await supabase.functions.invoke("followup-processor");
      console.log("[followup] Processor result:", d2, e2);
      toast.success(`Enroller: ${d1?.enrolled || 0} matriculados${d1?.reactivated ? ` · ${d1.reactivated} reativados` : ""} · Processor: ${d2?.processed || 0} processados`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const [resetting, setResetting] = useState(false);
  const resetFollowupData = async () => {
    if (!confirm("Tem certeza? Isso vai apagar todos os enrollments e logs desta sequência. Essa ação é irreversível.")) return;
    setResetting(true);
    try {
      // Delete logs first (they reference enrollments)
      const { data: enrollments } = await supabase
        .from("followup_enrollments" as any)
        .select("id")
        .eq("sequence_id", sequence.id);
      
      const enrollmentIds = (enrollments || []).map((e: any) => e.id);
      
      if (enrollmentIds.length > 0) {
        await supabase
          .from("followup_logs" as any)
          .delete()
          .in("enrollment_id", enrollmentIds);
      }
      
      await supabase
        .from("followup_enrollments" as any)
        .delete()
        .eq("sequence_id", sequence.id);
      
      toast.success(`${enrollmentIds.length} enrollments e logs removidos`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground truncate">{sequence.name}</h2>
            <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
          </div>
          {sequence.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{sequence.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onManualEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManualEdit(sequence)}
            >
              <Pencil className="w-4 h-4 mr-1" /> Editar manual
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(sequence)}
            >
              <Sparkles className="w-4 h-4 mr-1" /> Editar com IA
            </Button>
          )}
          <Button
            variant={sequence.status === "active" ? "outline" : "default"}
            size="sm"
            onClick={toggleStatus}
            disabled={toggling}
          >
            {sequence.status === "active" ? (
              <><Pause className="w-4 h-4 mr-1" /> Pausar</>
            ) : (
              <><Play className="w-4 h-4 mr-1" /> Ativar</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runEnrollerAndProcessor}
            disabled={running}
          >
            <RotateCw className={`w-4 h-4 mr-1 ${running ? "animate-spin" : ""}`} />
            Executar agora
          </Button>
           <Button
            variant="ghost"
            size="sm"
            onClick={resetFollowupData}
            disabled={resetting}
            className="text-destructive hover:text-destructive"
          >
            <RotateCw className={`w-4 h-4 mr-1 ${resetting ? "animate-spin" : ""}`} />
            Resetar dados
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Config */}
        <Card>
          <CardContent className="p-5 space-y-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">Configuração</h3>

            <InfoRow
              icon={Zap}
              label="Gatilho"
              value={
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {triggerLabels[sequence.trigger_type] || sequence.trigger_type}
                  </Badge>
                  {triggerConfig?.delay_hours && (
                    <span className="text-xs text-muted-foreground">após {triggerConfig.delay_hours}h</span>
                  )}
                </div>
              }
            />

            {/* Associations */}
            {sequence.campaign_id && (
              <InfoRow
                icon={Megaphone}
                label="Campanha vinculada"
                value={
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{linkedCampaign?.name || sequence.campaign_id.slice(0, 8)}</span>
                    {linkedCampaign?.status && (
                      <Badge variant="outline" className="text-[10px]">{linkedCampaign.status}</Badge>
                    )}
                  </div>
                }
              />
            )}
            {sequence.flow_id && (
              <InfoRow
                icon={Workflow}
                label="Fluxo vinculado"
                value={
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{linkedFlow?.name || sequence.flow_id.slice(0, 8)}</span>
                    {linkedFlow?.status && (
                      <Badge variant="outline" className="text-[10px]">{linkedFlow.status}</Badge>
                    )}
                  </div>
                }
              />
            )}

            <InfoRow
              icon={Calendar}
              label="Janela de envio"
              value={
                <span>
                  {activeDays?.join(", ") || "Todos os dias"} · {sendWindow?.start || "08:00"} — {sendWindow?.end || "18:00"}
                </span>
              }
            />

            <InfoRow icon={Timer} label="Validade" value={`${sequence.ttl_days} dias`} />

            <InfoRow icon={Clock} label="Intervalo mínimo" value={`${sequence.min_interval_hours}h entre mensagens`} />

            <InfoRow icon={Target} label="Máx. tentativas" value={String(sequence.max_attempts)} />

            <InfoRow
              icon={Reply}
              label="Ao responder"
              value={
                <Select
                  value={sequence.on_reply_behavior || "pause_resume"}
                  onValueChange={(val) => {
                    updateSequence.mutateAsync({ id: sequence.id, on_reply_behavior: val } as any);
                  }}
                >
                  <SelectTrigger className="h-8 w-full max-w-[220px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(replyBehaviorLabels).map(([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <span className="font-medium">{label}</span>
                          <p className="text-[10px] text-muted-foreground">{description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            {(filters?.include_tags?.length > 0 || filters?.exclude_tags?.length > 0) && (
              <InfoRow
                icon={Shield}
                label="Filtros"
                value={
                  <div className="flex flex-wrap gap-1">
                    {filters.include_tags?.map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">+{t}</Badge>
                    ))}
                    {filters.exclude_tags?.map((t: string) => (
                      <Badge key={t} variant="outline" className="text-xs text-destructive">−{t}</Badge>
                    ))}
                  </div>
                }
              />
            )}

            <Separator className="my-3" />

            <h3 className="text-sm font-semibold text-foreground mb-2">Ações pós-sequência</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Ao converter</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {postActionLabels[postActions?.on_convert] || postActions?.on_convert || "—"}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Sem resposta</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {postActionLabels[postActions?.on_no_reply] || postActions?.on_no_reply || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Steps */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Etapas ({steps.length})
            </h3>

            {stepsLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : steps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma etapa configurada</p>
            ) : (
              <div className="space-y-0">
                {steps.map((step, i) => (
                  <div key={step.id}>
                    {/* Connector line */}
                    {i > 0 && (
                      <div className="flex items-center gap-3 py-1.5 pl-[15px]">
                        <div className="w-px h-6 bg-border" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {step.delay_value} {delayUnitLabels[step.delay_unit] || step.delay_unit}
                        </div>
                      </div>
                    )}

                    {/* Step card */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {contentTypeLabels[step.content_type] || step.content_type}
                          </Badge>
                          {i === 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              envia imediatamente após matrícula
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                          {step.content_type === "ai_prompt" && (
                            <span className="font-medium text-primary mr-1">Prompt:</span>
                          )}
                          {step.content || <span className="italic text-muted-foreground">Sem conteúdo</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
