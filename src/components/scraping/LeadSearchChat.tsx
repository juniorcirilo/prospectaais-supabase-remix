import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Send, Bot, User, Loader2, Sparkles, CheckCircle2, MessageSquareText, ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
// createSearch and lists are provided by the parent to avoid duplicate realtime subscriptions
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  onBack: () => void;
  createSearch: any;
  lists: any[];
}

type Msg = { role: "user" | "assistant"; content: string };

interface SearchConfig {
  name: string;
  source: string;
  target_list_id?: string;
  target_list_name?: string;
  config: any;
}

const CHAT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/lead-search-ai-chat`;

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo",
  firecrawl: "Firecrawl Web",
  firecrawl_site: "Firecrawl + Site",
  apollo_firecrawl: "Apollo + Firecrawl",
};

// ─── Industry inference for frontend safety net ───
const INDUSTRY_INFER_MAP: Record<string, string[]> = {
  advocacia: ["legal", "law practice", "advocacia", "advogado", "jurídico"],
  advogado: ["legal", "law practice", "advocacia", "advogado", "jurídico"],
  restaurante: ["restaurants", "food & beverages", "restaurante", "gastronomia"],
  hotel: ["hospitality", "hotels", "hotel", "hotelaria"],
  dentista: ["health", "dental", "odontologia", "dentista"],
  clínica: ["hospital & health care", "medical practice", "saúde", "clínica"],
  médico: ["hospital & health care", "medical practice", "saúde", "médico"],
  imobiliária: ["real estate", "imobiliária", "imóveis"],
  contabilidade: ["accounting", "contabilidade", "contador"],
  academia: ["health, wellness and fitness", "academia", "fitness"],
  beleza: ["cosmetics", "beauty", "estética", "salão"],
  pet: ["veterinary", "pet", "veterinária", "petshop"],
  farmácia: ["pharmaceuticals", "farmácia"],
};

function inferIndustriesFromQuery(query: string): string[] {
  if (!query) return [];
  const lower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const results: string[] = [];
  for (const [key, industries] of Object.entries(INDUSTRY_INFER_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(normalizedKey)) {
      results.push(...industries);
    }
  }
  return [...new Set(results)];
}

const QUICK_TEMPLATES = [
  {
    label: "Restaurantes em SP",
    emoji: "🍽️",
    description: "Donos de restaurante na capital",
    message: "Quero encontrar donos de restaurante em São Paulo. Busca via Apollo, 25 empresas. Pode criar!",
  },
  {
    label: "Startups SaaS",
    emoji: "🚀",
    description: "CTOs e founders de SaaS",
    message: "Buscar CTOs e founders de startups SaaS no Brasil, empresas de 11-50 funcionários. Apollo, 50 empresas.",
  },
  {
    label: "Profissionais de Saúde",
    emoji: "🏥",
    description: "Médicos e dentistas",
    message: "Encontrar dentistas e médicos no Rio de Janeiro. Firecrawl web, 20 empresas.",
  },
  {
    label: "E-commerce",
    emoji: "🛒",
    description: "Gestores de e-commerce",
    message: "Buscar gestores e diretores de e-commerce no Brasil, empresas de 51-200 funcionários. Apollo.",
  },
];

const GUIDED_MESSAGE =
  "Quero configurar no modo guiado. Me faça as perguntas uma a uma para montar minha busca de leads do zero.";

export default function LeadSearchChat({ onBack, createSearch, lists }: Props) {
  const { session } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: "Olá! 👋 Vou te ajudar a configurar uma busca de leads.\n\nEscolha um **template pronto**, use o modo **guiado**, ou simplesmente **descreva** o que precisa encontrar.",
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<SearchConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

  const processStream = async (allMessages: Msg[]) => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setIsLoading(true);
    let assistantContent = "";
    let toolCallArgs = "";
    let toolCallActive = false;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          lists: lists.map((l) => ({ id: l.id, name: l.name })),
        }),
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
                if (tc.function?.name) toolCallActive = true;
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
          const config = JSON.parse(toolCallArgs) as SearchConfig;
          config.config = config.config || {};
          config.config.volume = config.config.volume || {};
          config.config.volume.volume_unit = config.config.volume.volume_unit || "companies";
          config.config.volume.per_page = config.config.volume.per_page || 25;
          
          // Safety net: infer industries from query if missing
          if ((!config.config.company?.industries || config.config.company.industries.length === 0) && config.config.query) {
            const inferred = inferIndustriesFromQuery(config.config.query);
            if (inferred.length > 0) {
              if (!config.config.company) config.config.company = {};
              config.config.company.industries = inferred;
              console.log("[LeadSearchChat] Auto-inferred industries from query:", inferred);
            }
          }
          
          setPendingConfig(config);

          const volumeUnit = config.config.volume.volume_unit === "contacts" ? "contatos" : "empresas";
          const summary = `✅ **Busca configurada!**\n\n**${config.name}**\n- **Fonte:** ${SOURCE_LABELS[config.source] || config.source}${config.config?.persona?.titles?.length ? `\n- **Cargos:** ${config.config.persona.titles.join(", ")}` : ""}${config.config?.persona?.seniorities?.length ? `\n- **Senioridade:** ${config.config.persona.seniorities.join(", ")}` : ""}${config.config?.company?.industries?.length ? `\n- **Setor:** ${config.config.company.industries.slice(0, 3).join(", ")}` : ""}${config.config?.company?.names?.length ? `\n- **Empresas:** ${config.config.company.names.join(", ")}` : ""}${config.config?.location?.person_locations?.length ? `\n- **Localização:** ${config.config.location.person_locations.join(", ")}` : ""}${config.config?.volume?.per_page ? `\n- **Volume:** ${config.config.volume.per_page} ${volumeUnit}` : ""}\n\nClique em **Executar Busca** para iniciar, ou me peça para ajustar algo.`;

          setMessages((prev) => [
            ...prev.filter((m) => !(m.role === "assistant" && prev.indexOf(m) === prev.length - 1 && !m.content)),
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

  const handleSave = async () => {
    if (!pendingConfig) return;
    setIsLoading(true);
    try {
      await createSearch.mutateAsync({
        name: pendingConfig.name,
        source: pendingConfig.source,
        config: pendingConfig.config,
        target_list_id: pendingConfig.target_list_id || null,
        autoExecute: true,
      });
      setSaved(true);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "🎉 Busca iniciada com sucesso! Acompanhe o progresso na lista de buscas.",
      }]);
      setPendingConfig(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Nova Busca com IA</h2>
            <p className="text-xs text-muted-foreground">Descreva em linguagem natural ou use um template</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1" ref={scrollRef}>
        <div className="max-w-2xl mx-auto py-6 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "assistant" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : <p>{msg.content}</p>}
              </div>
            </div>
          ))}

          {showQuickStart && !isLoading && (
            <div className="space-y-3 pl-11">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => sendWithText(t.message)}
                    className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card/60 p-3.5 text-left text-sm hover:border-primary/40 hover:bg-card transition-all duration-200"
                  >
                    <span className="text-lg leading-none">{t.emoji}</span>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">{t.label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{t.description}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => sendWithText(GUIDED_MESSAGE)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <MessageSquareText className="w-4 h-4" />
                Modo guiado — a IA pergunta passo a passo
              </button>
            </div>
          )}

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
      </div>

      {/* Save bar */}
      {pendingConfig && !saved && (
        <div className="border-t border-border bg-primary/5 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Busca pronta</span>
              <Badge variant="secondary">{SOURCE_LABELS[pendingConfig.source] || pendingConfig.source}</Badge>
            </div>
            <Button onClick={handleSave} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Executar Busca
            </Button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border pt-4 mt-auto">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="max-w-2xl mx-auto flex gap-2">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva os leads que você quer encontrar..."
            disabled={isLoading} className="flex-1 h-11 rounded-xl bg-card border-border" />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-11 w-11 rounded-xl shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
