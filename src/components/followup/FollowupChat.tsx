import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  CheckCircle2,
  MessageSquareText,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useFollowupSequences, useFollowupSteps, FollowupSequence } from "@/hooks/useFollowup";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
  editingSequence?: FollowupSequence | null;
}

type Msg = { role: "user" | "assistant"; content: string };

interface SequenceConfig {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_delay_hours?: number;
  trigger_keywords?: string[];
  campaign_id?: string;
  flow_id?: string;
  max_attempts?: number;
  ttl_days?: number;
  min_interval_hours?: number;
  on_reply_behavior?: string;
  include_tags?: string[];
  exclude_tags?: string[];
  send_days?: boolean[];
  send_start?: string;
  send_end?: string;
  post_convert_action?: string;
  post_no_reply_action?: string;
  steps: Array<{
    delay_value: number;
    delay_unit: string;
    delay_type?: string;
    content_type: string;
    content: string;
  }>;
}

const CHAT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/followup-ai-chat`;

const TRIGGER_LABELS: Record<string, string> = {
  no_reply: "Sem resposta",
  delivered_not_read: "Entregue, não lido",
  read_no_reply: "Lido, sem resposta",
  pipeline_inactivity: "Inatividade no pipeline",
  deal_created: "Deal criado",
  deal_stage_change: "Mudança de etapa",
  deal_lost: "Deal perdido",
  keyword_reply: "Palavra-chave",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  spintax: "Spintax",
  ai_rewrite: "IA Rewrite",
  media: "Mídia",
  audio_tts: "Áudio TTS",
  ai_prompt: "IA Contextual",
};

const QUICK_TEMPLATES = [
  {
    label: "Sem Resposta",
    emoji: "🔄",
    description: "3 etapas para quem não respondeu",
    message:
      "Crie um follow-up de 3 etapas para leads que não responderam. Primeira mensagem após 24h, segunda após 48h e terceira após 72h. Mensagens progressivamente mais diretas. Apenas dias úteis das 9h às 18h.",
  },
  {
    label: "Leu sem Responder",
    emoji: "👀",
    description: "2 etapas para quem visualizou",
    message:
      "Crie um follow-up de 2 etapas para quem leu a mensagem mas não respondeu. Primeira após 6h com abordagem casual, segunda após 24h com uma pergunta direta. Dias úteis das 8h às 19h.",
  },
  {
    label: "Pós-campanha",
    emoji: "📢",
    description: "Reengajar após broadcast",
    message:
      "Crie um follow-up pós-campanha de 3 etapas para quem não respondeu ao broadcast. Primeira após 24h reforçando o valor, segunda após 3 dias com abordagem diferente, terceira após 7 dias com última tentativa. Dias úteis das 9h às 18h.",
  },
  {
    label: "IA Contextual",
    emoji: "🤖",
    description: "Mensagens geradas por IA com contexto",
    message:
      "Crie um follow-up de 2 etapas usando ai_prompt (IA Contextual). Na primeira etapa após 24h, use um system prompt para gerar uma mensagem de acompanhamento amigável baseada no histórico da conversa. Na segunda etapa após 48h, use um system prompt para ser mais direto e objetivo. Dias úteis das 9h às 18h.",
  },
];

const GUIDED_MESSAGE =
  "Quero configurar no modo guiado. Me faça as perguntas uma a uma para eu montar minha sequência de follow-up do zero. Comece perguntando qual o gatilho.";

export default function FollowupChat({ onBack, editingSequence }: Props) {
  const { session } = useAuth();
  const { createSequence, updateSequence } = useFollowupSequences();
  const { data: editSteps = [] } = useFollowupSteps(editingSequence?.id || null);

  const isEditing = !!editingSequence;

  const { data: flows = [] } = useQuery({
    queryKey: ["flows-list"],
    queryFn: async () => {
      const { data } = await supabase.from("flows").select("id, name, status").order("name");
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcast_campaigns")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const getInitialMsg = (): Msg => {
    if (isEditing) {
      return {
        role: "assistant",
        content: `Olá! 👋 Estou pronta para editar a sequência **"${editingSequence.name}"**.\n\nMe diga o que quer alterar: steps, gatilho, janela de envio, comportamento ao responder, ou qualquer outra configuração.`,
      };
    }
    return {
      role: "assistant",
      content:
        "Olá! 👋 Vou te ajudar a configurar sua sequência de follow-up.\n\nEscolha um **template pronto** abaixo, use o modo **guiado** onde eu pergunto passo a passo, ou simplesmente **descreva** o que precisa.",
    };
  };

  const [messages, setMessages] = useState<Msg[]>([getInitialMsg()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<SequenceConfig | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "edit">("create");
  const [saved, setSaved] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(!isEditing);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Build editing context for the AI
  const buildEditingContext = () => {
    if (!editingSequence) return null;
    const sw = editingSequence.send_window as any;
    const pa = editingSequence.post_actions as any;
    const tc = editingSequence.trigger_config as any;
    const f = editingSequence.filters as any;
    return {
      name: editingSequence.name,
      description: editingSequence.description,
      trigger_type: editingSequence.trigger_type,
      trigger_delay_hours: tc?.delay_hours,
      trigger_keywords: tc?.keywords,
      campaign_id: editingSequence.campaign_id,
      max_attempts: editingSequence.max_attempts,
      ttl_days: editingSequence.ttl_days,
      min_interval_hours: editingSequence.min_interval_hours,
      on_reply_behavior: editingSequence.on_reply_behavior,
      include_tags: f?.include_tags,
      exclude_tags: f?.exclude_tags,
      send_days: sw?.days,
      send_start: sw?.start,
      send_end: sw?.end,
      post_convert_action: pa?.on_convert,
      post_no_reply_action: pa?.on_no_reply,
      steps: editSteps.map((s) => ({
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        delay_type: s.delay_type,
        content_type: s.content_type,
        content: s.content,
      })),
    };
  };

  /* ── send helpers ── */
  const sendWithText = (text: string) => {
    if (isLoading) return;
    setShowQuickStart(false);
    const userMsg: Msg = { role: "user", content: text };
    const all = [...messages, userMsg];
    setMessages(all);
    setInput("");
    processStream(all);
  };

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    sendWithText(input.trim());
  };

  /* ── streaming ── */
  const processStream = async (allMessages: Msg[]) => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setIsLoading(true);
    let assistantContent = "";
    let toolCallArgs = "";
    let toolCallName = "";
    let toolCallActive = false;

    try {
      const body: any = {
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        flows: flows.map((f) => ({ id: f.id, name: f.name, status: f.status })),
        campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
      };

      if (isEditing) {
        body.editingSequence = buildEditingContext();
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;

          try {
            const delta = JSON.parse(json).choices?.[0]?.delta;
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) {
                  toolCallName = tc.function.name;
                  toolCallActive = true;
                }
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
              }
            }
            if (delta?.content) {
              assistantContent += delta.content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > allMessages.length)
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (toolCallActive && toolCallArgs) {
        try {
          const config = JSON.parse(toolCallArgs) as SequenceConfig;
          setPendingConfig(config);
          const action = toolCallName === "edit_followup_sequence" ? "edit" : "create";
          setPendingAction(action);

          const flowName = config.flow_id ? flows.find((f) => f.id === config.flow_id)?.name : null;
          const campaignName = config.campaign_id ? campaigns.find((c) => c.id === config.campaign_id)?.name : null;

          const actionLabel = action === "edit" ? "✏️ **Alterações prontas!**" : "✅ **Sequência configurada!**";
          const steps = config.steps || [];

          const summary = `${actionLabel}\n\n**${config.name || editingSequence?.name || "Sequência"}**\n${config.trigger_type ? `- **Gatilho:** ${TRIGGER_LABELS[config.trigger_type] || config.trigger_type}` : ""}${flowName ? `\n- **Fluxo:** ${flowName}` : ""}${campaignName ? `\n- **Campanha:** ${campaignName}` : ""}${steps.length > 0 ? `\n- **Etapas:** ${steps.length}` : ""}${config.ttl_days ? `\n- **Validade:** ${config.ttl_days} dias` : ""}${config.send_start ? `\n- **Janela:** ${config.send_start} — ${config.send_end || "18:00"}` : ""}${config.on_reply_behavior ? `\n- **Ao responder:** ${config.on_reply_behavior}` : ""}${steps.length > 0 ? `\n\n**Etapas:**\n${steps.map((s, i) => `${i + 1}. Após ${s.delay_value} ${s.delay_unit === "hours" ? "h" : s.delay_unit === "minutes" ? "min" : "d"} → ${CONTENT_TYPE_LABELS[s.content_type] || s.content_type}: _"${s.content.substring(0, 60)}${s.content.length > 60 ? "..." : ""}"_`).join("\n")}` : ""}\n\nClique em **Salvar** para ${action === "edit" ? "aplicar as alterações" : "criar"}, ou me peça para ajustar algo.`;

          setMessages((prev) => [
            ...prev.filter(
              (m) => !(m.role === "assistant" && prev.indexOf(m) === prev.length - 1 && !m.content)
            ),
            { role: "assistant", content: summary },
          ]);
        } catch (e) {
          console.error("Failed to parse tool call:", e);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar mensagem");
      setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── save (create or edit) ── */
  const handleSave = async () => {
    if (!pendingConfig) return;
    setIsLoading(true);
    try {
      if (pendingAction === "edit" && editingSequence) {
        await handleEdit();
      } else {
        await handleCreate();
      }
      setSaved(true);
      const verb = pendingAction === "edit" ? "atualizada" : "criada";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `🎉 Sequência ${verb} com sucesso! Você pode voltar à lista ou continuar editando.` },
      ]);
      setPendingConfig(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!pendingConfig) return;
    const triggerConfig: any = { delay_hours: pendingConfig.trigger_delay_hours || 24 };
    if (pendingConfig.trigger_keywords?.length) triggerConfig.keywords = pendingConfig.trigger_keywords;
    const filters: any = {};
    if (pendingConfig.include_tags?.length) filters.include_tags = pendingConfig.include_tags;
    if (pendingConfig.exclude_tags?.length) filters.exclude_tags = pendingConfig.exclude_tags;

    const seqData: any = {
      name: pendingConfig.name,
      description: pendingConfig.description || "",
      trigger_type: pendingConfig.trigger_type,
      trigger_config: triggerConfig,
      filters,
      send_window: {
        days: pendingConfig.send_days || [true, true, true, true, true, false, false],
        start: pendingConfig.send_start || "08:00",
        end: pendingConfig.send_end || "18:00",
      },
      max_attempts: pendingConfig.max_attempts || pendingConfig.steps.length,
      ttl_days: pendingConfig.ttl_days || 30,
      min_interval_hours: pendingConfig.min_interval_hours ?? 0,
      post_actions: {
        on_convert: pendingConfig.post_convert_action || "move_pipeline",
        on_no_reply: pendingConfig.post_no_reply_action || "tag_cold",
      },
    };
    if (pendingConfig.campaign_id) seqData.campaign_id = pendingConfig.campaign_id;
    if (pendingConfig.flow_id) seqData.flow_id = pendingConfig.flow_id;

    const created = await createSequence.mutateAsync(seqData);
    if (created?.id) {
      const stepsToSave = pendingConfig.steps.map((s, i) => ({
        sequence_id: created.id,
        position: i,
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        delay_type: s.delay_type || "fixed",
        content_type: s.content_type,
        content: s.content,
      }));
      await supabase.from("followup_steps" as any).insert(stepsToSave as any);
    }
  };

  const handleEdit = async () => {
    if (!pendingConfig || !editingSequence) return;

    // Build update payload — only include fields that were provided
    const updates: any = {};
    if (pendingConfig.name) updates.name = pendingConfig.name;
    if (pendingConfig.description !== undefined) updates.description = pendingConfig.description;
    if (pendingConfig.trigger_type) updates.trigger_type = pendingConfig.trigger_type;
    if (pendingConfig.on_reply_behavior) updates.on_reply_behavior = pendingConfig.on_reply_behavior;
    if (pendingConfig.max_attempts) updates.max_attempts = pendingConfig.max_attempts;
    if (pendingConfig.ttl_days) updates.ttl_days = pendingConfig.ttl_days;
    if (pendingConfig.min_interval_hours !== undefined) updates.min_interval_hours = pendingConfig.min_interval_hours;

    if (pendingConfig.trigger_delay_hours || pendingConfig.trigger_keywords) {
      const tc: any = { ...(editingSequence.trigger_config as any) };
      if (pendingConfig.trigger_delay_hours) tc.delay_hours = pendingConfig.trigger_delay_hours;
      if (pendingConfig.trigger_keywords) tc.keywords = pendingConfig.trigger_keywords;
      updates.trigger_config = tc;
    }

    if (pendingConfig.send_days || pendingConfig.send_start || pendingConfig.send_end) {
      const sw = { ...(editingSequence.send_window as any) };
      if (pendingConfig.send_days) sw.days = pendingConfig.send_days;
      if (pendingConfig.send_start) sw.start = pendingConfig.send_start;
      if (pendingConfig.send_end) sw.end = pendingConfig.send_end;
      updates.send_window = sw;
    }

    if (pendingConfig.post_convert_action || pendingConfig.post_no_reply_action) {
      const pa = { ...(editingSequence.post_actions as any) };
      if (pendingConfig.post_convert_action) pa.on_convert = pendingConfig.post_convert_action;
      if (pendingConfig.post_no_reply_action) pa.on_no_reply = pendingConfig.post_no_reply_action;
      updates.post_actions = pa;
    }

    if (pendingConfig.include_tags || pendingConfig.exclude_tags) {
      const f = { ...(editingSequence.filters as any) };
      if (pendingConfig.include_tags) f.include_tags = pendingConfig.include_tags;
      if (pendingConfig.exclude_tags) f.exclude_tags = pendingConfig.exclude_tags;
      updates.filters = f;
    }

    if (pendingConfig.campaign_id) updates.campaign_id = pendingConfig.campaign_id;
    if (pendingConfig.flow_id) updates.flow_id = pendingConfig.flow_id;

    // Update sequence
    if (Object.keys(updates).length > 0) {
      await updateSequence.mutateAsync({ id: editingSequence.id, ...updates });
    }

    // Update steps if provided
    if (pendingConfig.steps?.length > 0) {
      // Delete existing steps, insert new
      await supabase.from("followup_steps" as any).delete().eq("sequence_id", editingSequence.id);
      const stepsToSave = pendingConfig.steps.map((s, i) => ({
        sequence_id: editingSequence.id,
        position: i,
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        delay_type: s.delay_type || "fixed",
        content_type: s.content_type,
        content: s.content,
      }));
      await supabase.from("followup_steps" as any).insert(stepsToSave as any);
    }
  };

  /* ── render ── */
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {isEditing ? <Pencil className="w-4 h-4 text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              {isEditing ? `Editar: ${editingSequence.name}` : "Nova Sequência com IA"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditing ? "Descreva as alterações que deseja fazer" : "Descreva em linguagem natural ou use um template"}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <ScrollArea className="flex-1 -mx-1 px-1" ref={scrollRef}>
        <div className="max-w-2xl mx-auto py-6 space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "assistant"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:space-y-1 [&_li]:text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Quick-start cards (only for new sequences) */}
          {showQuickStart && !isLoading && (
            <div className="space-y-3 pl-11">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => sendWithText(t.message)}
                    className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card/60 p-3.5 text-left text-sm hover:border-primary/40 hover:bg-card transition-all duration-200"
                  >
                    <span className="text-lg leading-none">{t.emoji}</span>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {t.label}
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug">{t.description}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => sendWithText(GUIDED_MESSAGE)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <MessageSquareText className="w-4 h-4" />
                Modo guiado — a IA pergunta passo a passo
              </button>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Save bar */}
      {pendingConfig && !saved && (
        <div className="border-t border-border bg-primary/5 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {pendingAction === "edit" ? "Alterações prontas" : "Sequência pronta"}
              </span>
              {pendingConfig.steps?.length > 0 && (
                <Badge variant="secondary">{pendingConfig.steps.length} etapas</Badge>
              )}
            </div>
            <Button onClick={handleSave} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {pendingAction === "edit" ? "Salvar Alterações" : "Salvar Sequência"}
            </Button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border pt-4 mt-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="max-w-2xl mx-auto flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isEditing ? "Descreva o que quer alterar..." : "Descreva o follow-up que você quer criar..."}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl bg-card border-border"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-11 w-11 rounded-xl shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
