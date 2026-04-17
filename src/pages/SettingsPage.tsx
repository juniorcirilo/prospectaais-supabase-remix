import { useState, useEffect } from "react";
import { Settings, Key, Globe, Bell, Shield, Database, Webhook, Save, Loader2, CheckCircle, XCircle, Zap, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ElevenLabsSettings from "@/components/settings/ElevenLabsSettings";
import AIProvidersSettings, { AIProvider } from "@/components/settings/AIProvidersSettings";
import StepApollo from "@/components/onboarding/StepApollo";
import { useAuth } from "@/hooks/useAuth";
import { testEvolutionConnection } from "@/lib/testEvolutionConnection";

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apolloApiKey, setApolloApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // AI Providers state
  const [aiActiveProvider, setAiActiveProvider] = useState<AIProvider>("groq");
  const [aiProviders, setAiProviders] = useState<Partial<Record<AIProvider, string>>>({});

  // Registration lock
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const [registrationSettingsId, setRegistrationSettingsId] = useState<string | null>(null);

  // ElevenLabs state
  const [elApiKey, setElApiKey] = useState("");
  const [elVoiceId, setElVoiceId] = useState("33B4UnXyTNbgLmdEDh5P");
  const [elModel, setElModel] = useState("eleven_turbo_v2_5");
  const [elStability, setElStability] = useState(0.75);
  const [elSimilarityBoost, setElSimilarityBoost] = useState(0.8);
  const [elSpeed, setElSpeed] = useState(1.0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "apollo_api_key",
          "evolution_api_url",
          "evolution_api_key",
          "elevenlabs_api_key",
          "elevenlabs_voice_id",
          "elevenlabs_model",
          "elevenlabs_stability",
          "elevenlabs_similarity_boost",
          "elevenlabs_speed",
          "ai_active_provider",
          "ai_provider_key_groq",
          "ai_provider_key_gemini",
          "ai_provider_key_openai",
          "ai_provider_key_lovable",
          "ai_provider_key_anthropic",
        ]);
      if (data) {
        for (const row of data) {
          if (row.key === "apollo_api_key") setApolloApiKey(row.value || "");
          if (row.key === "evolution_api_url" && row.value) setApiUrl(row.value);
          if (row.key === "evolution_api_key" && row.value) setApiKey(row.value);
          if (row.key === "elevenlabs_api_key" && row.value) setElApiKey(row.value);
          if (row.key === "elevenlabs_voice_id" && row.value) setElVoiceId(row.value);
          if (row.key === "ai_active_provider" && row.value) setAiActiveProvider(row.value as AIProvider);
          if (row.key === "ai_provider_key_groq" && row.value) setAiProviders((p) => ({ ...p, groq: row.value }));
          if (row.key === "ai_provider_key_gemini" && row.value) setAiProviders((p) => ({ ...p, gemini: row.value }));
          if (row.key === "ai_provider_key_openai" && row.value) setAiProviders((p) => ({ ...p, openai: row.value }));
          if (row.key === "ai_provider_key_lovable" && row.value) setAiProviders((p) => ({ ...p, lovable: row.value }));
          if (row.key === "ai_provider_key_anthropic" && row.value) setAiProviders((p) => ({ ...p, anthropic: row.value }));
          if (row.key === "elevenlabs_model" && row.value) setElModel(row.value);
          if (row.key === "elevenlabs_stability" && row.value) setElStability(parseFloat(row.value));
          if (row.key === "elevenlabs_similarity_boost" && row.value) setElSimilarityBoost(parseFloat(row.value));
          if (row.key === "elevenlabs_speed" && row.value) setElSpeed(parseFloat(row.value));
        }
      }

      const { data: settingsData } = await supabase
        .from("system_settings" as any)
        .select("id, registration_enabled")
        .limit(1)
        .single();
      if (settingsData) {
        setRegistrationSettingsId((settingsData as any).id);
        setRegistrationEnabled((settingsData as any).registration_enabled);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates = [
        { key: "apollo_api_key", value: apolloApiKey },
        { key: "evolution_api_url", value: apiUrl },
        { key: "evolution_api_key", value: apiKey },
        { key: "elevenlabs_api_key", value: elApiKey },
        { key: "elevenlabs_voice_id", value: elVoiceId },
        { key: "elevenlabs_model", value: elModel },
        { key: "elevenlabs_stability", value: String(elStability) },
        { key: "elevenlabs_similarity_boost", value: String(elSimilarityBoost) },
        { key: "elevenlabs_speed", value: String(elSpeed) },
        { key: "ai_active_provider", value: aiActiveProvider },
        { key: "ai_provider_key_groq", value: aiProviders.groq || "" },
        { key: "ai_provider_key_gemini", value: aiProviders.gemini || "" },
        { key: "ai_provider_key_openai", value: aiProviders.openai || "" },
        { key: "ai_provider_key_lovable", value: aiProviders.lovable || "" },
        { key: "ai_provider_key_anthropic", value: aiProviders.anthropic || "" },
      ];
      const results = await Promise.all(
        updates.map((u) => supabase.from("app_settings").upsert({ key: u.key, value: u.value, updated_at: now }, { onConflict: "key" }))
      );
      if (results.some((r) => r.error)) throw new Error("Erro ao salvar");
      toast.success("Configurações salvas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl || !apiKey) {
      toast.error("Preencha a URL e a API Key antes de testar");
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const data = await testEvolutionConnection(apiUrl, apiKey);
      setTestStatus("success");
      setTestMessage(data.message);
      toast.success("Conexão com Evolution API bem-sucedida!");
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err.message || "Falha na conexão");
      toast.error("Falha ao conectar com a Evolution API");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Apollo, Evolution API, ElevenLabs, IA & Chat, preferências e integrações</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Tudo
          </Button>
        )}
      </div>

      <Tabs defaultValue={isAdmin ? "apollo" : "general"} className="space-y-4">
        <TabsList>
          {isAdmin && <TabsTrigger value="apollo">Apollo</TabsTrigger>}
          {isAdmin && <TabsTrigger value="ai">IA & Chat</TabsTrigger>}
          {isAdmin && <TabsTrigger value="api">Evolution API</TabsTrigger>}
          {isAdmin && <TabsTrigger value="elevenlabs">ElevenLabs</TabsTrigger>}
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <>
            <TabsContent value="apollo" className="space-y-4">
              <StepApollo apiKey={apolloApiKey} onApiKeyChange={setApolloApiKey} />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <AIProvidersSettings
                activeProvider={aiActiveProvider}
                providers={aiProviders}
                onProviderChange={setAiActiveProvider}
                onKeyChange={(provider, key) => setAiProviders((p) => ({ ...p, [provider]: key }))}
                onSave={handleSave}
                isSaving={saving}
              />
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4" /> Evolution API</CardTitle>
                  <CardDescription>Configure a conexão com a Evolution API para envio de mensagens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">URL da API</label>
                    <Input
                      placeholder="https://api.evolution.com.br"
                      value={apiUrl}
                      onChange={(e) => {
                        setApiUrl(e.target.value);
                        setTestStatus("idle");
                        setTestMessage("");
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">API Key</label>
                    <Input
                      type="password"
                      placeholder="Sua API Key"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestStatus("idle");
                        setTestMessage("");
                      }}
                    />
                  </div>

                  {testStatus !== "idle" && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                      testStatus === "loading" ? "bg-muted/50 border-border" :
                      testStatus === "success" ? "bg-success/10 border-success/20" :
                      "bg-destructive/10 border-destructive/20"
                    }`}>
                      {testStatus === "loading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {testStatus === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                      {testStatus === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                      <span className={`text-sm ${
                        testStatus === "success" ? "text-success" : testStatus === "error" ? "text-destructive" : "text-muted-foreground"
                      }`}>{testStatus === "loading" ? "Testando conexão..." : testMessage}</span>
                    </div>
                  )}

                  <Button variant="outline" className="gap-2" onClick={handleTestConnection} disabled={testStatus === "loading"}>
                    {testStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Testar Conexão
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="elevenlabs" className="space-y-4">
              <ElevenLabsSettings
                apiKey={elApiKey}
                voiceId={elVoiceId}
                model={elModel}
                stability={elStability}
                similarityBoost={elSimilarityBoost}
                speed={elSpeed}
                onApiKeyChange={setElApiKey}
                onVoiceIdChange={setElVoiceId}
                onModelChange={setElModel}
                onStabilityChange={setElStability}
                onSimilarityBoostChange={setElSimilarityBoost}
                onSpeedChange={setElSpeed}
              />
            </TabsContent>
          </>
        )}

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> Preferências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Fuso horário</label>
                <Select defaultValue="america-sp"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="america-sp">América/São Paulo (BRT)</SelectItem><SelectItem value="america-manaus">América/Manaus (AMT)</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Formato de telefone padrão</label>
                <Select defaultValue="br"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="br">Brasil (+55)</SelectItem><SelectItem value="pt">Portugal (+351)</SelectItem></SelectContent></Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-sm font-medium text-foreground">Modo escuro</p>
                  <p className="text-xs text-muted-foreground">Tema dark permanente</p>
                </div>
                <Switch defaultChecked />
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Permitir novos registros</p>
                    <p className="text-xs text-muted-foreground">Quando desativado, novos usuários não poderão se cadastrar</p>
                  </div>
                  <Switch
                    checked={registrationEnabled}
                    onCheckedChange={async (checked) => {
                      try {
                        let error;
                        if (registrationSettingsId) {
                          const result = await supabase
                            .from("system_settings" as any)
                            .update({ registration_enabled: checked, updated_at: new Date().toISOString() })
                            .eq("id", registrationSettingsId);
                          error = result.error;
                        } else {
                          const result = await supabase
                            .from("system_settings" as any)
                            .insert({ registration_enabled: checked })
                            .select("id")
                            .single();
                          error = result.error;
                          if (!error && result.data) {
                            setRegistrationSettingsId((result.data as any).id);
                          }
                        }
                        if (error) throw error;
                        setRegistrationEnabled(checked);
                        toast.success(checked ? "Registros habilitados" : "Registros desabilitados");
                      } catch (err: any) {
                        toast.error("Erro ao atualizar configuração");
                      }
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}