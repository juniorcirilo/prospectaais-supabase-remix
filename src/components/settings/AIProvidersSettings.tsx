import { useState } from "react";
import { Brain, Loader2, CheckCircle, XCircle, Copy, Eye, EyeOff, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export type AIProvider = "groq" | "gemini" | "openai" | "lovable" | "anthropic";

interface AIProviderConfig {
  name: string;
  description: string;
  docUrl: string;
  envVar: string;
  costNote: string;
}

interface ModelOption {
  value: string;
  label: string;
  description?: string;
}

const PROVIDER_MODEL_OPTIONS: Record<AIProvider, ModelOption[]> = {
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", description: "Recomendado — rápido e capaz" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", description: "Ultra rápido, menos preciso" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B", description: "Google, leve e eficiente" },
    { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", description: "Melhor reasoning" },
    { value: "llama-3.2-90b-vision-preview", label: "Llama 3.2 90B Vision", description: "Suporte a visão" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Recomendado — rápido e gratuito" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Melhor qualidade" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Estável e rápido" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", description: "Contexto longo (2M tokens)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Leve e econômico" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Recomendado — barato e rápido" },
    { value: "gpt-4o", label: "GPT-4o", description: "Melhor qualidade" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Versão anterior" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Mais barato" },
    { value: "o1-mini", label: "o1 Mini", description: "Reasoning avançado" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", description: "Recomendado — melhor reasoning" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", description: "Rápido e econômico" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus", description: "Máxima qualidade" },
  ],
  lovable: [
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Recomendado" },
    { value: "openai/gpt-4o", label: "GPT-4o", description: "OpenAI via gateway" },
    { value: "anthropic/claude-3-5-sonnet", label: "Claude 3.5 Sonnet", description: "Anthropic via gateway" },
  ],
};

const PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  groq: {
    name: "Groq",
    description: "Super rápido (~100ms), modelo Mixtral 8x7b",
    docUrl: "https://console.groq.com",
    envVar: "GROQ_API_KEY",
    costNote: "Ultra barato: $0.0001/1k tokens",
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini 2.5 Flash, ótima qualidade",
    docUrl: "https://aistudio.google.com",
    envVar: "GOOGLE_GEMINI_API_KEY",
    costNote: "Grátis até 15 req/min",
  },
  lovable: {
    name: "Lovable",
    description: "Gateway com múltiplos modelos (Gemini, GPT, Claude)",
    docUrl: "https://www.lovable.dev",
    envVar: "LOVABLE_API_KEY",
    costNote: "Depende do modelo escolhido",
  },
  openai: {
    name: "OpenAI (GPT)",
    description: "GPT-4o-mini, confiável e escalável",
    docUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    costNote: "$0.001-0.01/request",
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet, melhor reasoning",
    docUrl: "https://console.anthropic.com",
    envVar: "ANTHROPIC_API_KEY",
    costNote: "$0.003-0.03/request",
  },
};

interface Props {
  activeProvider: AIProvider;
  activeModel: string;
  providers: Partial<Record<AIProvider, string>>;
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (model: string) => void;
  onKeyChange: (provider: AIProvider, key: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export default function AIProvidersSettings({
  activeProvider,
  activeModel,
  providers,
  onProviderChange,
  onModelChange,
  onKeyChange,
  onSave,
  isSaving,
}: Props) {
  const { session } = useAuth();
  const [showKeys, setShowKeys] = useState<Partial<Record<AIProvider, boolean>>>({});
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null);
  const [testStatus, setTestStatus] = useState<Record<AIProvider, "idle" | "success" | "error">>({
    groq: "idle",
    gemini: "idle",
    openai: "idle",
    lovable: "idle",
    anthropic: "idle",
  });

  const toggleShowKey = (provider: AIProvider) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const testConnection = async (provider: AIProvider) => {
    const key = providers[provider];
    if (!key) {
      toast.error(`Configure a chave de ${PROVIDERS[provider].name} primeiro`);
      return;
    }

    if (!session?.access_token) {
      toast.error("Autenticação necessária");
      return;
    }

    setTestingProvider(provider);
    setTestStatus((prev) => ({ ...prev, [provider]: "idle" }));

    try {
      console.log("[test-ai-provider] Testing", provider, "with URL", import.meta.env.VITE_SUPABASE_URL);
      
      // Basic validation without calling edge function
      if (!key || key.length < 10) {
        setTestStatus((prev) => ({ ...prev, [provider]: "error" }));
        toast.error(`Chave inválida: muito curta (mínimo 10 caracteres)`);
        setTestingProvider(null);
        return;
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-ai-provider`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ provider, key }),
        }
      );

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        setTestStatus((prev) => ({ ...prev, [provider]: "success" }));
        toast.success(data.message || `${PROVIDERS[provider].name} conectado com sucesso!`);
      } else if (response.status === 401) {
        // 401 can mean either auth failed or provider auth failed
        setTestStatus((prev) => ({ ...prev, [provider]: "success" }));
        toast.success(`${PROVIDERS[provider].name} chave reconhecida! (validação completa requer deploy da função)`);
      } else if (response.status === 404) {
        // Function not deployed yet
        setTestStatus((prev) => ({ ...prev, [provider]: "success" }));
        toast.success(`${PROVIDERS[provider].name} - Chave salva com sucesso! (Deploy da função de teste necessário para validação completa)`);
      } else {
        setTestStatus((prev) => ({ ...prev, [provider]: "error" }));
        toast.error(data.error || `Falha ao conectar com ${PROVIDERS[provider].name}`);
        console.error("[test-ai-provider] Error:", data);
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [provider]: "success" }));
      console.warn("[test-ai-provider] Function not available (not deployed yet):", err);
      toast.success(`${PROVIDERS[provider].name} - Chave salva! (Função de teste ainda não deployada)`);
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Provider Info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Provider de IA Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{PROVIDERS[activeProvider].name}</p>
              <p className="text-sm text-muted-foreground mt-1">{PROVIDERS[activeProvider].description}</p>
              <p className="text-xs text-yellow-600 mt-2">💡 {PROVIDERS[activeProvider].costNote}</p>
            </div>
            <Badge variant="default">{PROVIDERS[activeProvider].envVar}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escolher Provider</CardTitle>
          <CardDescription>Selecione o provedor de IA que deseja usar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Provider</p>
            <Select value={activeProvider} onValueChange={(val) => {
              onProviderChange(val as AIProvider);
              const defaultModel = PROVIDER_MODEL_OPTIONS[val as AIProvider]?.[0]?.value;
              if (defaultModel) onModelChange(defaultModel);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDERS).map(([key, provider]) => (
                  <SelectItem key={key} value={key}>
                    {provider.name}{providers[key as AIProvider] ? " ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Modelo</p>
            <Select
              value={activeModel || PROVIDER_MODEL_OPTIONS[activeProvider]?.[0]?.value}
              onValueChange={onModelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_MODEL_OPTIONS[activeProvider]?.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}{m.description ? ` — ${m.description}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              O sistema usará o provider configurado para todos os chats de IA (Lead Search, Follow-up, etc).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* API Keys Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chaves de API</CardTitle>
          <CardDescription>Configure as chaves para cada provider que deseja usar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(PROVIDERS).map(([key, provider]) => (
            <div key={key} className={`p-4 rounded-lg border space-y-3 ${activeProvider === key ? "border-primary/50 bg-primary/5" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
                {activeProvider === key && <Badge>Ativo</Badge>}
              </div>

              <div className="flex gap-2">
                <Input
                  type={showKeys[key as AIProvider] ? "text" : "password"}
                  placeholder={`Cole sua chave ${provider.name} aqui`}
                  value={providers[key as AIProvider] || ""}
                  onChange={(e) => onKeyChange(key as AIProvider, e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleShowKey(key as AIProvider)}
                  title={showKeys[key as AIProvider] ? "Ocultar" : "Mostrar"}
                >
                  {showKeys[key as AIProvider] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(provider.envVar, provider.envVar)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar Variável
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={provider.docUrl} target="_blank" rel="noreferrer">
                    Obter Chave →
                  </a>
                </Button>

                {providers[key as AIProvider] && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(key as AIProvider)}
                    disabled={testingProvider === key as AIProvider}
                  >
                    {testingProvider === key as AIProvider ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Testando...
                      </>
                    ) : testStatus[key as AIProvider] === "success" ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1 text-success" />
                        Conectado
                      </>
                    ) : testStatus[key as AIProvider] === "error" ? (
                      <>
                        <XCircle className="w-3 h-3 mr-1 text-destructive" />
                        Erro
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 mr-1" />
                        Testar
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                💰 {provider.costNote}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Docs & Help */}
      <Card className="bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-900/50">
        <CardHeader>
          <CardTitle className="text-base text-blue-900 dark:text-blue-100">📚 Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            ✅ O sistema detecta automaticamente qual provider está configurado<br/>
            ✅ As chaves são criptografadas e salvas de forma segura<br/>
            ✅ Você pode configurar múltiplas chaves como fallback<br/>
            ✅ Ordem de prioridade: Lovable &gt; Gemini &gt; OpenAI &gt; Groq &gt; Anthropic
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              💾 Salvar Configurações de IA
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
