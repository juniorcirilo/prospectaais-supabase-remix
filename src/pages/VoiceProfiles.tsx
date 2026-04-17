import { useState } from "react";
import { Mic, Plus, Trash2, Save, Loader2, Play, Edit2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useVoiceProfiles, VoiceProfile, CreateVoiceProfileInput } from "@/hooks/useVoiceProfiles";

const VOICES = [
  { id: '33B4UnXyTNbgLmdEDh5P', name: 'Keren', description: 'Feminina, brasileira' },
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

const emptyForm: CreateVoiceProfileInput = {
  name: '',
  description: '',
  elevenlabs_voice_id: '33B4UnXyTNbgLmdEDh5P',
  elevenlabs_model: 'eleven_turbo_v2_5',
  stability: 0.75,
  similarity_boost: 0.8,
  speed: 1.0,
};

export default function VoiceProfiles() {
  const { profiles, isLoading, createProfile, updateProfile, deleteProfile } = useVoiceProfiles();
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<VoiceProfile | null>(null);
  const [form, setForm] = useState<CreateVoiceProfileInput>({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste do perfil de voz.");

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowEditor(true);
  };

  const openEdit = (p: VoiceProfile) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      elevenlabs_voice_id: p.elevenlabs_voice_id,
      elevenlabs_model: p.elevenlabs_model,
      stability: Number(p.stability),
      similarity_boost: Number(p.similarity_boost),
      speed: Number(p.speed),
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (editing) {
      await updateProfile.mutateAsync({ id: editing.id, ...form });
    } else {
      await createProfile.mutateAsync(form);
    }
    setShowEditor(false);
  };

  const handleDelete = async (id: string) => {
    await deleteProfile.mutateAsync(id);
    setDeleteConfirm(null);
    if (editing?.id === id) setShowEditor(false);
  };

  const handleTestVoice = async () => {
    setIsTesting(true);
    try {
      // Get API key from app_settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'elevenlabs_api_key')
        .single();
      const apiKey = settings?.value;
      if (!apiKey) { toast.error('Configure a API Key do ElevenLabs em Configurações'); return; }

      const { data, error } = await supabase.functions.invoke('test-elevenlabs-tts', {
        body: {
          text: testMessage,
          apiKey,
          voiceId: form.elevenlabs_voice_id,
          model: form.elevenlabs_model,
          stability: form.stability,
          similarityBoost: form.similarity_boost,
          speed: form.speed,
        },
      });
      if (error) throw error;
      if (data?.success && data?.audioBase64) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
        audio.play();
        toast.success(`Áudio reproduzido! (${(data.duration_ms / 1000).toFixed(1)}s)`);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar voz');
    } finally {
      setIsTesting(false);
    }
  };

  const selectedVoice = VOICES.find(v => v.id === form.elevenlabs_voice_id);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfis de Voz</h1>
          <p className="text-sm text-muted-foreground mt-1">Presets de voz ElevenLabs para mensagens de áudio</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : profiles.length === 0 && !showEditor ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Mic className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum perfil de voz criado ainda</p>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Criar primeiro perfil</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile list */}
          <div className="lg:col-span-1 space-y-3">
            {profiles.map((p, i) => (
              <div
                key={p.id}
                onClick={() => openEdit(p)}
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                className={`group relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md animate-fade-in ${
                  editing?.id === p.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm truncate">{p.name}</span>
                      {p.is_default && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {VOICES.find(v => v.id === p.elevenlabs_voice_id)?.name || 'Custom'} · {MODELS.find(m => m.id === p.elevenlabs_model)?.name}
                    </p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); setDeleteConfirm(p.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Novo Perfil
            </Button>
          </div>

          {/* Editor */}
          {showEditor && (
            <div className="lg:col-span-2 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    {editing ? `Editando: ${editing.name}` : 'Novo Perfil de Voz'}
                  </CardTitle>
                  <CardDescription>Configure os parâmetros da voz ElevenLabs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Perfil</Label>
                      <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Voz feminina formal" />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição breve..." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Voz</Label>
                    <Select value={form.elevenlabs_voice_id} onValueChange={v => setForm({ ...form, elevenlabs_voice_id: v })}>
                      <SelectTrigger>
                        <SelectValue>
                          {selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : 'Selecione'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {VOICES.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            <span className="font-medium">{v.name}</span>
                            <span className="text-muted-foreground ml-2">- {v.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Select value={form.elevenlabs_model} onValueChange={v => setForm({ ...form, elevenlabs_model: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="font-medium">{m.name}</span>
                            <span className="text-muted-foreground ml-2">- {m.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
                    <h4 className="text-sm font-medium text-foreground">Ajustes da Voz</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Estabilidade</span>
                          <span className="text-muted-foreground">{(form.stability * 100).toFixed(0)}%</span>
                        </div>
                        <Slider value={[form.stability]} onValueChange={([v]) => setForm({ ...form, stability: v })} min={0} max={1} step={0.05} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Similaridade</span>
                          <span className="text-muted-foreground">{(form.similarity_boost * 100).toFixed(0)}%</span>
                        </div>
                        <Slider value={[form.similarity_boost]} onValueChange={([v]) => setForm({ ...form, similarity_boost: v })} min={0} max={1} step={0.05} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Velocidade</span>
                          <span className="text-muted-foreground">{form.speed.toFixed(1)}x</span>
                        </div>
                        <Slider value={[form.speed]} onValueChange={([v]) => setForm({ ...form, speed: v })} min={0.7} max={1.2} step={0.05} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem de teste</Label>
                    <Textarea
                      value={testMessage}
                      onChange={e => setTestMessage(e.target.value)}
                      placeholder="Digite a mensagem para testar a voz..."
                      className="min-h-[80px] text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={handleTestVoice} disabled={isTesting || !testMessage.trim()}>
                      {isTesting ? <><Loader2 className="w-4 h-4 animate-spin" />Testando...</> : <><Play className="w-4 h-4" />Testar Voz</>}
                    </Button>
                    <Button className="flex-1 gap-2" onClick={handleSave} disabled={!form.name.trim() || createProfile.isPending || updateProfile.isPending}>
                      <Save className="w-4 h-4" />{editing ? 'Salvar' : 'Criar Perfil'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir perfil de voz?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Essa ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteProfile.isPending}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
