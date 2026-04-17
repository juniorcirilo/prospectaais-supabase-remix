import { useState, useRef } from "react";
import { MessageSquare, Plus, Copy, Sparkles, Trash2, Save, Loader2, Type, Image, Mic, Link, Upload, X, Shuffle, ArrowRight, Pin, Play, Volume2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { useMessageTemplates, MessageTemplate, CreateTemplateInput } from "@/hooks/useMessageTemplates";
import { useVoiceProfiles, VoiceProfile, CreateVoiceProfileInput } from "@/hooks/useVoiceProfiles";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveSpintaxFirst } from "@/lib/spintax";
import TemplateVariationEditor from "@/components/messages/TemplateVariationEditor";
import WhatsAppPhonePreview from "@/components/messages/WhatsAppPhonePreview";

const MESSAGE_TYPES = [
  { value: "text", label: "Texto puro", icon: Type },
  { value: "image", label: "Texto + Imagem", icon: Image },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "link", label: "Texto + Link", icon: Link },
];

type ViewMode = "list" | "editor";

export default function Messages() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useMessageTemplates();
  const { profiles: voiceProfiles, updateProfile, createProfile } = useVoiceProfiles();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [transitioning, setTransitioning] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<CreateTemplateInput>({ name: "", content: "", category: "geral", message_type: "text" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<string>("");
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Voice profile edit modal state
  const [voiceEditOpen, setVoiceEditOpen] = useState(false);
  const [voiceEditForm, setVoiceEditForm] = useState<CreateVoiceProfileInput>({ name: '', description: '', elevenlabs_voice_id: '', elevenlabs_model: '', stability: 0.75, similarity_boost: 0.8, speed: 1.0 });
  const [voiceEditOriginalId, setVoiceEditOriginalId] = useState<string>('');
  const [voiceSaveMode, setVoiceSaveMode] = useState<'choose' | 'update' | 'new'>('choose');

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

  const openVoiceEdit = () => {
    const profile = voiceProfiles.find(p => p.id === selectedVoiceProfileId);
    if (!profile) return;
    setVoiceEditOriginalId(profile.id);
    setVoiceEditForm({
      name: profile.name,
      description: profile.description || '',
      elevenlabs_voice_id: profile.elevenlabs_voice_id,
      elevenlabs_model: profile.elevenlabs_model,
      stability: Number(profile.stability),
      similarity_boost: Number(profile.similarity_boost),
      speed: Number(profile.speed),
    });
    setVoiceSaveMode('choose');
    setVoiceEditOpen(true);
  };

  const handleVoiceSave = async () => {
    if (voiceSaveMode === 'choose') {
      // do nothing, user must pick
      return;
    }
    if (voiceSaveMode === 'update') {
      await updateProfile.mutateAsync({ id: voiceEditOriginalId, ...voiceEditForm });
    } else {
      if (!voiceEditForm.name.trim()) { toast.error('Digite o nome do novo perfil'); return; }
      const result = await createProfile.mutateAsync(voiceEditForm);
      if (result?.id) setSelectedVoiceProfileId(result.id);
    }
    setVoiceEditOpen(false);
  };

  // AI state
  const [aiBaseText, setAiBaseText] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiVariations, setAiVariations] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const transitionTo = (mode: ViewMode, cb?: () => void) => {
    setTransitioning(true);
    setTimeout(() => {
      cb?.();
      setViewMode(mode);
      requestAnimationFrame(() => setTransitioning(false));
    }, 200);
  };

  const openCreate = () => {
    transitionTo("editor", () => {
      setEditing(null);
      setForm({ name: "", content: "", category: "geral", message_type: "text" });
    });
  };

  const openEdit = (t: MessageTemplate) => {
    transitionTo("editor", () => {
      setEditing(t);
      setForm({ name: t.name, content: t.content, category: t.category, message_type: t.message_type, media_urls: t.media_urls, media_rotation_enabled: t.media_rotation_enabled, media_rotation_mode: (t as any).media_rotation_mode || 'random', tags: t.tags });
    });
  };

  const goBack = () => {
    transitionTo("list", () => {
      setEditing(null);
      setShowAiPanel(false);
      setAiVariations([]);
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return;
    if (editing) {
      await updateTemplate.mutateAsync({ id: editing.id, ...form });
    } else {
      await createTemplate.mutateAsync(form);
    }
    goBack();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync(id);
    setDeleteConfirm(null);
    if (editing?.id === id) goBack();
  };

  const handleAiGenerate = async () => {
    if (!aiBaseText.trim()) return;
    setAiLoading(true);
    setAiVariations([]);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message-variations', {
        body: { base_text: aiBaseText, instruction: aiInstruction, count: aiCount },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar');
      setAiVariations(data.variations || []);
      toast.success(`${data.variations?.length || 0} variações geradas!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar variações');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiVariation = async (text: string) => {
    await createTemplate.mutateAsync({ name: `IA - ${text.slice(0, 30)}...`, content: text, is_ai_generated: true });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const fileList = Array.from(files);
    const BATCH_SIZE = 3;
    const newUrls: string[] = [];
    let failCount = 0;

    try {
      for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
        const batch = fileList.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (file) => {
            const ext = file.name.split('.').pop();
            const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from('message-media').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('message-media').getPublicUrl(path);
            return urlData.publicUrl;
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled') newUrls.push(r.value);
          else failCount++;
        }
        // Yield to UI between batches
        if (i + BATCH_SIZE < fileList.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      if (newUrls.length > 0) {
        setForm(prev => ({ ...prev, media_urls: [...(prev.media_urls || []), ...newUrls] }));
      }
      if (failCount > 0) {
        toast.warning(`${newUrls.length} enviado(s), ${failCount} falharam`);
      } else {
        toast.success(`${newUrls.length} arquivo(s) enviado(s)!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar arquivos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const contentClass = `transition-all duration-300 ease-out ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`;

  return (
    <div className="space-y-6">
      {/* Shared header — always visible */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewMode === "list" ? "Gerencie seus templates de mensagem" : editing ? `Editando: ${editing.name}` : "Novo template"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "editor" && (
            <>
              <Button variant="ghost" size="sm" className="gap-2 animate-fade-in" onClick={goBack}>
                Cancelar
              </Button>
              <Button variant="outline" size="sm" className="gap-2 animate-fade-in" onClick={() => setShowAiPanel(!showAiPanel)}>
                <Sparkles className="w-4 h-4" />{showAiPanel ? 'Fechar IA' : 'Gerar com IA'}
              </Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || !form.content.trim() || createTemplate.isPending || updateTemplate.isPending} size="sm" className="gap-2 animate-fade-in">
                <Save className="w-4 h-4" />{editing ? 'Salvar' : 'Criar'}
              </Button>
            </>
          )}
          {viewMode === "list" && (
            <Button className="gap-2 animate-fade-in" onClick={openCreate}>
              <Plus className="w-4 h-4" />Novo Template
            </Button>
          )}
        </div>
      </div>

      {/* Content area with transition */}
      <div className={contentClass}>
        {viewMode === "list" ? (
          <>
            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum template criado ainda</p>
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" />Criar primeiro template
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {templates.map((t, i) => (
                  <div
                    key={t.id}
                    onClick={() => openEdit(t)}
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                    className="group relative rounded-xl border border-border bg-card p-5 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 animate-fade-in"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-foreground text-sm truncate pr-16">{t.name}</span>
                      <div className="flex items-center gap-1.5">
                        {t.is_ai_generated && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
                        <Badge variant="outline" className="text-[10px]">
                          {MESSAGE_TYPES.find(m => m.value === t.message_type)?.label || t.message_type}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 font-mono leading-relaxed">{t.content.slice(0, 150)}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <span className="text-[11px] text-muted-foreground">{t.usage_count} usos</span>
                      <span className="text-[11px] text-muted-foreground">{t.category}</span>
                    </div>
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); setDeleteConfirm(t.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nome</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Prospecção Fria v1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Categoria</label>
                  <Input value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: prospecção, follow-up" />
                </div>
              </div>

              <TemplateVariationEditor
                content={form.content}
                onChange={(content) => setForm({ ...form, content })}
                variableValues={variableValues}
                onVariableChange={(name, value) => setVariableValues(prev => ({ ...prev, [name]: value }))}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tipo de mídia</label>
                <Select value={form.message_type || 'text'} onValueChange={v => setForm({ ...form, message_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Profile selector for Audio */}
              {form.message_type === 'audio' && (
                <div className="space-y-3 animate-fade-in">
                  <label className="text-sm font-medium text-foreground">Perfil de Voz</label>
                  {voiceProfiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum perfil de voz criado. <a href="/voice-profiles" className="text-primary hover:underline">Criar perfil</a></p>
                  ) : (
                    <div className="flex gap-2">
                      <Select value={selectedVoiceProfileId} onValueChange={setSelectedVoiceProfileId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um perfil de voz" />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceProfiles.map(vp => (
                            <SelectItem key={vp.id} value={vp.id}>
                              <div className="flex items-center gap-2">
                                <Volume2 className="w-3 h-3 text-primary" />
                                <span>{vp.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" className="shrink-0" disabled={!selectedVoiceProfileId} onClick={openVoiceEdit} title="Editar perfil de voz">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Media upload — only for non-audio types */}
              {form.message_type && form.message_type !== 'text' && form.message_type !== 'audio' && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      {form.message_type === 'image' ? 'Imagens' : 'Mídias'}
                    </label>
                  </div>

                  {(form.media_urls && form.media_urls.length > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {form.media_urls.map((url, idx) => (
                        <div key={idx} className="relative group rounded-lg border border-border overflow-hidden bg-muted/30 animate-fade-in">
                          {form.message_type === 'image' ? (
                            <img src={url} alt={`Mídia ${idx + 1}`} className="w-full h-24 object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground font-mono truncate px-2">
                              {url.split('/').pop()}
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setForm({ ...form, media_urls: (form.media_urls || []).filter((_, i) => i !== idx) })}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={form.message_type === 'image' ? 'image/*' : '*/*'}
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Enviando...</span></>
                    ) : (
                      <><Upload className="w-6 h-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Clique ou arraste arquivos aqui</span></>
                    )}
                  </label>

                  {(form.media_urls || []).length > 1 && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-sm font-medium text-foreground">Estratégia de rotação</label>
                      <RadioGroup
                        value={form.media_rotation_mode || 'random'}
                        onValueChange={v => setForm({ ...form, media_rotation_mode: v, media_rotation_enabled: v !== 'single' })}
                        className="grid grid-cols-3 gap-2"
                      >
                        {[
                          { value: 'random', label: 'Aleatório', desc: 'Seleciona uma mídia aleatória', icon: Shuffle },
                          { value: 'sequential', label: 'Sequencial', desc: 'Envia na ordem da lista', icon: ArrowRight },
                          { value: 'single', label: 'Fixo', desc: 'Sempre a primeira mídia', icon: Pin },
                        ].map(opt => (
                          <label
                            key={opt.value}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                              (form.media_rotation_mode || 'random') === opt.value
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <RadioGroupItem value={opt.value} className="sr-only" />
                            <opt.icon className={`w-4 h-4 ${(form.media_rotation_mode || 'random') === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="text-xs font-medium text-foreground">{opt.label}</span>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">{opt.desc}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                </div>
              )}

              {/* AI Panel */}
              <div className={`grid transition-all duration-300 ease-out ${showAiPanel ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <Separator className="mb-4" />
                  <div className="space-y-4 pb-1">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />Geração por IA
                    </h3>
                    <Textarea value={aiBaseText} onChange={e => setAiBaseText(e.target.value)} placeholder="Cole aqui a mensagem que deseja variar..." className="min-h-[100px]" />
                    <Textarea value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} placeholder="Instrução para a IA (opcional)" className="min-h-[60px]" />
                    <div className="flex items-center gap-3">
                      <Button onClick={handleAiGenerate} disabled={!aiBaseText.trim() || aiLoading} size="sm" className="gap-2">
                        {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</> : <><Sparkles className="w-4 h-4" />Gerar</>}
                      </Button>
                      <Select value={String(aiCount)} onValueChange={v => setAiCount(Number(v))}>
                        <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[5, 10, 15, 20].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {aiVariations.length > 0 && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {aiVariations.map((v, i) => (
                          <div key={i} className="p-3 rounded-lg border border-border bg-muted/30 text-sm animate-fade-in" style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => { navigator.clipboard.writeText(v); toast.success('Copiado!'); }}>
                                  <Copy className="w-3 h-3 mr-1" />Copiar
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => saveAiVariation(v)} disabled={createTemplate.isPending}>
                                  <Save className="w-3 h-3 mr-1" />Salvar
                                </Button>
                              </div>
                            </div>
                            <p className="text-foreground leading-relaxed">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2">
              <WhatsAppPhonePreview
                content={form.content || "Comece a escrever para visualizar..."}
                messageType={form.message_type || "text"}
                mediaUrls={form.media_urls || []}
                isLoadingAudio={isTestingAudio}
                variableValues={variableValues}
                onVariableChange={(name, value) => setVariableValues(prev => ({ ...prev, [name]: value }))}
                onPlayAudio={form.message_type === 'audio' && selectedVoiceProfileId && form.content.trim() ? async () => {
                  const profile = voiceProfiles.find(p => p.id === selectedVoiceProfileId);
                  if (!profile) return null;
                  setIsTestingAudio(true);
                  try {
                    const { data: settings } = await supabase
                      .from('app_settings')
                      .select('value')
                      .eq('key', 'elevenlabs_api_key')
                      .single();
                    const apiKey = settings?.value;
                    if (!apiKey) { toast.error('Configure a API Key do ElevenLabs em Configurações'); return null; }
                    // Resolve spintax first, then replace variables
                    let resolvedText = resolveSpintaxFirst(form.content);
                    Object.entries(variableValues).forEach(([key, val]) => {
                      if (val) resolvedText = resolvedText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
                    });
                    const { data, error } = await supabase.functions.invoke('test-elevenlabs-tts', {
                      body: {
                        text: resolvedText.slice(0, 500),
                        apiKey,
                        voiceId: profile.elevenlabs_voice_id,
                        model: profile.elevenlabs_model,
                        stability: Number(profile.stability),
                        similarityBoost: Number(profile.similarity_boost),
                        speed: Number(profile.speed),
                      },
                    });
                    if (error) throw error;
                    if (data?.success && data?.audioBase64) {
                      toast.success(`Áudio gerado! (${(data.duration_ms / 1000).toFixed(1)}s)`);
                      return { audioBase64: data.audioBase64, duration_ms: data.duration_ms };
                    } else if (data?.error) throw new Error(data.error);
                    return null;
                  } catch (err: any) {
                    toast.error(err.message || 'Erro ao gerar áudio');
                    return null;
                  } finally {
                    setIsTestingAudio(false);
                  }
                } : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir template?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Essa ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteTemplate.isPending}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice profile edit modal */}
      <Dialog open={voiceEditOpen} onOpenChange={open => { if (!open) { setVoiceEditOpen(false); setVoiceSaveMode('choose'); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Editar Perfil de Voz</DialogTitle>
          </DialogHeader>

          {voiceSaveMode !== 'new' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Voz</Label>
                <Select value={voiceEditForm.elevenlabs_voice_id} onValueChange={v => setVoiceEditForm(f => ({ ...f, elevenlabs_voice_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={voiceEditForm.elevenlabs_model} onValueChange={v => setVoiceEditForm(f => ({ ...f, elevenlabs_model: v }))}>
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
                      <span className="text-muted-foreground">{(voiceEditForm.stability * 100).toFixed(0)}%</span>
                    </div>
                    <Slider value={[voiceEditForm.stability]} onValueChange={([v]) => setVoiceEditForm(f => ({ ...f, stability: v }))} min={0} max={1} step={0.05} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Similaridade</span>
                      <span className="text-muted-foreground">{(voiceEditForm.similarity_boost * 100).toFixed(0)}%</span>
                    </div>
                    <Slider value={[voiceEditForm.similarity_boost]} onValueChange={([v]) => setVoiceEditForm(f => ({ ...f, similarity_boost: v }))} min={0} max={1} step={0.05} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Velocidade</span>
                      <span className="text-muted-foreground">{voiceEditForm.speed.toFixed(1)}x</span>
                    </div>
                    <Slider value={[voiceEditForm.speed]} onValueChange={([v]) => setVoiceEditForm(f => ({ ...f, speed: v }))} min={0.7} max={1.2} step={0.05} />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setVoiceEditOpen(false)}>Cancelar</Button>
                <Button variant="outline" className="gap-2" onClick={() => setVoiceSaveMode('new')}>
                  <Plus className="w-4 h-4" /> Salvar como Novo
                </Button>
                <Button className="gap-2" onClick={async () => { await updateProfile.mutateAsync({ id: voiceEditOriginalId, ...voiceEditForm }); setVoiceEditOpen(false); }} disabled={updateProfile.isPending}>
                  <Save className="w-4 h-4" /> Atualizar Perfil
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5 animate-fade-in">
              <p className="text-sm text-muted-foreground">Crie um novo perfil com as configurações atuais.</p>
              <div className="space-y-2">
                <Label>Nome do novo perfil</Label>
                <Input value={voiceEditForm.name} onChange={e => setVoiceEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Voz feminina suave" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={voiceEditForm.description} onChange={e => setVoiceEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição breve..." />
              </div>
              <DialogFooter className="flex gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setVoiceSaveMode('choose')}>Voltar</Button>
                <Button className="gap-2" onClick={handleVoiceSave} disabled={!voiceEditForm.name.trim() || createProfile.isPending}>
                  <Save className="w-4 h-4" /> Criar Perfil
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
