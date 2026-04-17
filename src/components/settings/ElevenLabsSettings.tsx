import { useState } from "react";
import { Mic, Eye, EyeOff, Play, Loader2, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VOICES = [
  { id: '33B4UnXyTNbgLmdEDh5P', name: 'Keren', description: 'Feminina, brasileira (Padrão)' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Feminina, natural' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Masculina, profissional' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Feminina, amigável' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Feminina, suave' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Masculina, casual' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Masculina, britânica' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Masculina, jovem' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Feminina, elegante' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Feminina, expressiva' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Masculina, clara' },
];

const MODELS = [
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Rápido, 32 idiomas' },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Alta qualidade, 29 idiomas' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'Rápido, apenas inglês' },
];

interface ElevenLabsSettingsProps {
  apiKey: string;
  voiceId: string;
  model: string;
  stability: number;
  similarityBoost: number;
  speed: number;
  onApiKeyChange: (v: string) => void;
  onVoiceIdChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onStabilityChange: (v: number) => void;
  onSimilarityBoostChange: (v: number) => void;
  onSpeedChange: (v: number) => void;
}

export default function ElevenLabsSettings({
  apiKey, voiceId, model, stability, similarityBoost, speed,
  onApiKeyChange, onVoiceIdChange, onModelChange,
  onStabilityChange, onSimilarityBoostChange, onSpeedChange,
}: ElevenLabsSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestVoice = async () => {
    if (!apiKey) { toast.error('Digite a API Key primeiro'); return; }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-elevenlabs-tts', {
        body: {
          text: 'Olá! Esta é uma mensagem de teste do sistema de voz.',
          apiKey, voiceId, model, stability, similarityBoost, speed,
        },
      });
      if (error) throw error;
      if (data?.success && data?.audioBase64) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
        const audio = new Audio(audioUrl);
        audio.play();
        toast.success(`Áudio reproduzido com sucesso! (${(data.duration_ms / 1000).toFixed(1)}s)`);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar voz');
    } finally {
      setIsTesting(false);
    }
  };

  const selectedVoice = VOICES.find(v => v.id === voiceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Mic className="w-4 h-4" /> ElevenLabs TTS</CardTitle>
        <CardDescription>Configure a voz para envio de mensagens de áudio via text-to-speech</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* API Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">API Key do ElevenLabs</Label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenha em{' '}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              elevenlabs.io
            </a>
          </p>
        </div>

        {/* Voice */}
        <div className="space-y-2">
          <Label>Voz</Label>
          <Select value={voiceId} onValueChange={onVoiceIdChange}>
            <SelectTrigger>
              <SelectValue>
                {selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : 'Selecione uma voz'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="font-medium">{v.name}</span>
                  <span className="text-muted-foreground ml-2">- {v.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground ml-2">- {m.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Sliders */}
        <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
          <h4 className="text-sm font-medium text-foreground">Ajustes da Voz</h4>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Estabilidade</span>
                <span className="text-muted-foreground">{(stability * 100).toFixed(0)}%</span>
              </div>
              <Slider value={[stability]} onValueChange={([v]) => onStabilityChange(v)} min={0} max={1} step={0.05} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Similaridade</span>
                <span className="text-muted-foreground">{(similarityBoost * 100).toFixed(0)}%</span>
              </div>
              <Slider value={[similarityBoost]} onValueChange={([v]) => onSimilarityBoostChange(v)} min={0} max={1} step={0.05} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Velocidade</span>
                <span className="text-muted-foreground">{speed.toFixed(1)}x</span>
              </div>
              <Slider value={[speed]} onValueChange={([v]) => onSpeedChange(v)} min={0.7} max={1.2} step={0.05} />
            </div>
          </div>
        </div>

        {/* Test Button */}
        <Button variant="outline" className="w-full gap-2" onClick={handleTestVoice} disabled={!apiKey || isTesting}>
          {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</> : <><Play className="w-4 h-4" /> Testar Voz</>}
        </Button>
      </CardContent>
    </Card>
  );
}
