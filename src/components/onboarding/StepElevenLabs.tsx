import { useState } from "react";
import { Mic, Eye, EyeOff, Play, Loader2, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepElevenLabsProps {
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

const VOICES = [
  { id: "33B4UnXyTNbgLmdEDh5P", name: "Keren", description: "Feminina, brasileira (Padrão)" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Masculina, profissional" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Feminina, amigável" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Feminina, suave" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Masculina, casual" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Masculina, britânica" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Masculina, jovem" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Feminina, expressiva" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Masculina, clara" },
];

const MODELS = [
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5", description: "Rápido, 32 idiomas" },
  { id: "eleven_multilingual_v2", name: "Multilingual v2", description: "Alta qualidade, 29 idiomas" },
  { id: "eleven_turbo_v2", name: "Turbo v2", description: "Rápido, apenas inglês" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export default function StepElevenLabs({
  apiKey, voiceId, model, stability, similarityBoost, speed,
  onApiKeyChange, onVoiceIdChange, onModelChange,
  onStabilityChange, onSimilarityBoostChange, onSpeedChange,
}: StepElevenLabsProps) {
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestVoice = async () => {
    if (!apiKey) { toast.error("Digite a API Key primeiro"); return; }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-elevenlabs-tts", {
        body: { text: "Olá! Esta é uma mensagem de teste.", apiKey, voiceId, model, stability, similarityBoost, speed },
      });
      if (error) throw error;
      if (data?.success && data?.audioBase64) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
        new Audio(audioUrl).play();
        toast.success(`Áudio reproduzido! (${(data.duration_ms / 1000).toFixed(1)}s)`);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao testar voz");
    } finally {
      setIsTesting(false);
    }
  };

  const selectedVoice = VOICES.find((v) => v.id === voiceId);

  return (
    <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Mic className="w-8 h-8 text-violet-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">ElevenLabs TTS</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Configure o ElevenLabs para envio de mensagens de áudio.
        </p>
        <p className="text-xs text-amber-500/80 mt-2">⚡ Esta configuração é opcional</p>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-muted-foreground" /> API Key do ElevenLabs
          </Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="pr-10 font-mono"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Obtenha em{" "}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              elevenlabs.io
            </a>
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label>Voz</Label>
          <Select value={voiceId} onValueChange={onVoiceIdChange}>
            <SelectTrigger>
              <SelectValue>{selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : "Selecione"}</SelectValue>
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
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
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
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
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
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button variant="outline" className="w-full gap-2" onClick={handleTestVoice} disabled={!apiKey || isTesting}>
            {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</> : <><Play className="w-4 h-4" /> Testar Voz</>}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
