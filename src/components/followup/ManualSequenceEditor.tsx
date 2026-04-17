import { useState, useEffect } from "react";
import { FollowupSequence, FollowupStep, useFollowupSequences, useFollowupSteps } from "@/hooks/useFollowup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface Props {
  sequence: FollowupSequence;
  onBack: () => void;
}

const triggerOptions = [
  { value: "no_reply", label: "Sem resposta" },
  { value: "delivered_not_read", label: "Entregue, não lido" },
  { value: "read_no_reply", label: "Lido, sem resposta" },
  { value: "pipeline_inactivity", label: "Inatividade no pipeline" },
  { value: "deal_created", label: "Deal criado" },
  { value: "deal_stage_change", label: "Mudança de etapa" },
  { value: "deal_lost", label: "Deal perdido" },
  { value: "keyword_reply", label: "Palavra-chave" },
];

const contentTypeOptions = [
  { value: "text", label: "Texto" },
  { value: "spintax", label: "Spintax" },
  { value: "ai_rewrite", label: "IA Rewrite" },
  { value: "ai_prompt", label: "IA Contextual" },
  { value: "media", label: "Mídia" },
  { value: "audio_tts", label: "Áudio TTS" },
];

const delayUnitOptions = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
];

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface StepDraft {
  id?: string;
  position: number;
  delay_value: number;
  delay_unit: string;
  delay_type: string;
  content_type: string;
  content: string;
  media_urls: string[];
  instance_id: string | null;
  voice_profile_id: string | null;
}

export default function ManualSequenceEditor({ sequence, onBack }: Props) {
  const { updateSequence } = useFollowupSequences();
  const { data: existingSteps = [], upsertSteps } = useFollowupSteps(sequence.id);
  const [saving, setSaving] = useState(false);

  // Sequence fields
  const [name, setName] = useState(sequence.name);
  const [description, setDescription] = useState(sequence.description || "");
  const [triggerType, setTriggerType] = useState(sequence.trigger_type);
  const [triggerDelayHours, setTriggerDelayHours] = useState(
    (sequence.trigger_config as any)?.delay_hours ?? 24
  );
  const [maxAttempts, setMaxAttempts] = useState(sequence.max_attempts);
  const [ttlDays, setTtlDays] = useState(sequence.ttl_days);
  const [minIntervalHours, setMinIntervalHours] = useState(sequence.min_interval_hours);
  const [onReplyBehavior, setOnReplyBehavior] = useState(sequence.on_reply_behavior || "pause_resume");

  // Send window
  const sw = sequence.send_window as any;
  const [sendDays, setSendDays] = useState<boolean[]>(
    sw?.days || [true, true, true, true, true, false, false]
  );
  const [sendStart, setSendStart] = useState(sw?.start || "08:00");
  const [sendEnd, setSendEnd] = useState(sw?.end || "18:00");
  const [timezone, setTimezone] = useState(sequence.timezone || "America/Sao_Paulo");

  // Associations
  const [campaignId, setCampaignId] = useState(sequence.campaign_id || "");
  const [flowId, setFlowId] = useState(sequence.flow_id || "");

  // Filters
  const filters = sequence.filters as any;
  const [includeTags, setIncludeTags] = useState((filters?.include_tags || []).join(", "));
  const [excludeTags, setExcludeTags] = useState((filters?.exclude_tags || []).join(", "));

  // Post actions
  const pa = sequence.post_actions as any;
  const [postConvert, setPostConvert] = useState(pa?.on_convert || "nothing");
  const [postNoReply, setPostNoReply] = useState(pa?.on_no_reply || "nothing");

  // Steps
  const [steps, setSteps] = useState<StepDraft[]>([]);

  useEffect(() => {
    if (existingSteps.length > 0) {
      setSteps(
        existingSteps.map((s) => ({
          id: s.id,
          position: s.position,
          delay_value: s.delay_value,
          delay_unit: s.delay_unit,
          delay_type: s.delay_type,
          content_type: s.content_type,
          content: s.content,
          media_urls: s.media_urls || [],
          instance_id: s.instance_id,
          voice_profile_id: s.voice_profile_id,
        }))
      );
    }
  }, [existingSteps]);

  // Fetch campaigns and flows for selects
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns_list_editor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcast_campaigns")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["flows_list_editor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("flows")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: instances = [] } = useQuery({
    queryKey: ["instances_list_editor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, name, phone_number")
        .eq("is_active", true);
      return data || [];
    },
  });

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        position: prev.length,
        delay_value: 1,
        delay_unit: "hours",
        delay_type: "fixed",
        content_type: "text",
        content: "",
        media_urls: [],
        instance_id: null,
        voice_profile_id: null,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })));
  };

  const updateStep = (index: number, field: keyof StepDraft, value: any) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    setSteps((prev) => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr.map((s, i) => ({ ...s, position: i }));
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      // Update sequence
      await updateSequence.mutateAsync({
        id: sequence.id,
        name,
        description,
        trigger_type: triggerType,
        trigger_config: { delay_hours: triggerDelayHours },
        max_attempts: maxAttempts,
        ttl_days: ttlDays,
        min_interval_hours: minIntervalHours,
        on_reply_behavior: onReplyBehavior,
        send_window: { days: sendDays, start: sendStart, end: sendEnd },
        timezone,
        campaign_id: campaignId || null,
        flow_id: flowId || null,
        filters: {
          include_tags: includeTags ? includeTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          exclude_tags: excludeTags ? excludeTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        },
        post_actions: { on_convert: postConvert, on_no_reply: postNoReply },
      } as any);

      // Update steps
      const stepsToSave = steps.map((s, i) => ({
        sequence_id: sequence.id,
        position: i,
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        delay_type: s.delay_type,
        content_type: s.content_type,
        content: s.content,
        media_urls: s.media_urls,
        instance_id: s.instance_id || null,
        voice_profile_id: s.voice_profile_id || null,
      }));

      await upsertSteps.mutateAsync(stepsToSave);
      toast.success("Sequência salva com sucesso!");
      onBack();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Editar Sequência</h2>
            <p className="text-sm text-muted-foreground">Modo manual</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: General Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Gatilho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de gatilho</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delay após gatilho (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={triggerDelayHours}
                  onChange={(e) => setTriggerDelayHours(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Associações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campanha vinculada</Label>
                <Select value={campaignId || "_none"} onValueChange={(v) => setCampaignId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {campaigns.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} <span className="text-muted-foreground ml-1">({c.status})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Com gatilho 'Sem resposta', monitora destinatários da campanha que não responderam.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fluxo vinculado</Label>
                <Select value={flowId || "_none"} onValueChange={(v) => setFlowId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {flows.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} <span className="text-muted-foreground ml-1">({f.status})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {triggerType === "no_reply" && !campaignId
                    ? "Com gatilho 'Sem resposta', o enroller monitora execuções do fluxo em espera (waiting) e enrolla contatos que não responderam."
                    : "Referência de fluxo para contexto da sequência."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Janela de Envio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {dayLabels.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const newDays = [...sendDays];
                      newDays[i] = !newDays[i];
                      setSendDays(newDays);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                      sendDays[i]
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={sendStart} onChange={(e) => setSendStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={sendEnd} onChange={(e) => setSendEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fuso Horário</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                    <SelectItem value="America/Cuiaba">Cuiabá (GMT-4)</SelectItem>
                    <SelectItem value="America/Belem">Belém (GMT-3)</SelectItem>
                    <SelectItem value="America/Fortaleza">Fortaleza (GMT-3)</SelectItem>
                    <SelectItem value="America/Recife">Recife (GMT-3)</SelectItem>
                    <SelectItem value="America/Noronha">Noronha (GMT-2)</SelectItem>
                    <SelectItem value="America/Rio_Branco">Rio Branco (GMT-5)</SelectItem>
                    <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Limites e Comportamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Máx. tentativas</Label>
                  <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TTL (dias)</Label>
                  <Input type="number" min={1} value={ttlDays} onChange={(e) => setTtlDays(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Intervalo mín. (h)</Label>
                  <Input type="number" min={0} step={0.5} value={minIntervalHours} onChange={(e) => setMinIntervalHours(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ao receber resposta</Label>
                <Select value={onReplyBehavior} onValueChange={setOnReplyBehavior}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pause_resume">Pausar e retomar</SelectItem>
                    <SelectItem value="restart">Pausar e reiniciar</SelectItem>
                    <SelectItem value="cancel">Cancelar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filtros e Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Tags de inclusão (separadas por vírgula)</Label>
                <Input value={includeTags} onChange={(e) => setIncludeTags(e.target.value)} placeholder="tag1, tag2" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tags de exclusão (separadas por vírgula)</Label>
                <Input value={excludeTags} onChange={(e) => setExcludeTags(e.target.value)} placeholder="tag1, tag2" />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ao converter</Label>
                  <Select value={postConvert} onValueChange={setPostConvert}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nothing">Nenhuma</SelectItem>
                      <SelectItem value="move_pipeline">Mover no pipeline</SelectItem>
                      <SelectItem value="add_tag">Adicionar tag</SelectItem>
                      <SelectItem value="notify">Notificar</SelectItem>
                      <SelectItem value="create_task">Criar tarefa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sem resposta</Label>
                  <Select value={postNoReply} onValueChange={setPostNoReply}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nothing">Nenhuma</SelectItem>
                      <SelectItem value="tag_cold">Marcar como frio</SelectItem>
                      <SelectItem value="winback_list">Lista winback</SelectItem>
                      <SelectItem value="notify">Notificar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Steps */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Etapas ({steps.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma etapa. Clique em "Adicionar" para começar.
                </p>
              ) : (
                steps.map((step, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-bold">#{i + 1}</Badge>
                        {i === 0 && (
                          <span className="text-[10px] text-muted-foreground">envia logo após matrícula</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, "up")} disabled={i === 0}>
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, "down")} disabled={i === steps.length - 1}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStep(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Delay (not for first step) */}
                    {i > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Delay</Label>
                          <Input
                            type="number"
                            min={0}
                            value={step.delay_value}
                            onChange={(e) => updateStep(i, "delay_value", Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Unidade</Label>
                          <Select value={step.delay_unit} onValueChange={(v) => updateStep(i, "delay_unit", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {delayUnitOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Content type */}
                    <div className="space-y-1">
                      <Label className="text-[11px]">Tipo de conteúdo</Label>
                      <Select value={step.content_type} onValueChange={(v) => updateStep(i, "content_type", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {contentTypeOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                      <Label className="text-[11px]">
                        {step.content_type === "ai_prompt" ? "System Prompt" : "Conteúdo da mensagem"}
                      </Label>
                      <Textarea
                        value={step.content}
                        onChange={(e) => updateStep(i, "content", e.target.value)}
                        rows={3}
                        className="text-sm"
                        placeholder={
                          step.content_type === "ai_prompt"
                            ? "Instrução para a IA gerar a mensagem baseada no histórico..."
                            : "Texto da mensagem..."
                        }
                      />
                    </div>

                    {/* Instance selector */}
                    <div className="space-y-1">
                      <Label className="text-[11px]">Instância WhatsApp</Label>
                      <Select
                        value={step.instance_id || "_default"}
                        onValueChange={(v) => updateStep(i, "instance_id", v === "_default" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Padrão" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_default">Padrão da sequência</SelectItem>
                          {instances.map((inst: any) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name} {inst.phone_number && `(${inst.phone_number})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
