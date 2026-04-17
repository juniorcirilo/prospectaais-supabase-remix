import { useState } from "react";
import { Zap, Clock, Shield, TrendingUp, Pause, Play, Activity, Loader2, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StatCard from "@/components/StatCard";
import { useBroadcasts, BroadcastCampaign } from "@/hooks/useBroadcasts";
import { useDispatchProfiles, DispatchProfile, CreateProfileInput } from "@/hooks/useDispatchProfiles";
import { cn } from "@/lib/utils";

const ROTATION_LABELS: Record<string, string> = {
  single: "Única instância",
  roundrobin: "Round-robin (intercalar)",
  proportional: "Divisão proporcional",
  random: "Aleatória",
};

function getProfileColor(delayMinS: number) {
  if (delayMinS >= 40) return "text-green-500";
  if (delayMinS >= 20) return "text-yellow-500";
  return "text-red-500";
}

const emptyForm: CreateProfileInput = {
  name: "", description: "", delay_min_s: 30, delay_max_s: 50, batch_size: 20, pause_between_batches_min: 10, pause_between_batches_max: 15,
};

export default function Dispatch() {
  const { campaigns, isLoading: loadingCampaigns, pauseCampaign, resumeCampaign } = useBroadcasts();
  const { profiles, isLoading: loadingProfiles, createProfile, updateProfile, deleteProfile } = useDispatchProfiles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<DispatchProfile | null>(null);
  const [form, setForm] = useState<CreateProfileInput>({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter(c => ['processing', 'sending', 'paused'].includes(c.status));
  const todaySent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const todayTotal = campaigns.reduce((sum, c) => sum + c.total_recipients, 0);
  const deliveryRate = todayTotal > 0 ? ((todaySent / todayTotal) * 100).toFixed(1) : "0.0";
  const processingCount = campaigns.filter(c => ['processing', 'sending'].includes(c.status)).length;

  const openCreate = () => { setEditingProfile(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (p: DispatchProfile) => {
    setEditingProfile(p);
    setForm({ name: p.name, description: p.description, delay_min_s: p.delay_min_s, delay_max_s: p.delay_max_s, batch_size: p.batch_size, pause_between_batches_min: p.pause_between_batches_min, pause_between_batches_max: p.pause_between_batches_max });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingProfile) {
      await updateProfile.mutateAsync({ id: editingProfile.id, ...form });
    } else {
      await createProfile.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteProfile.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const msgsPerDay = (p: CreateProfileInput) => {
    const avgDelay = (p.delay_min_s + p.delay_max_s) / 2;
    const batchTime = avgDelay * p.batch_size;
    const avgPause = ((p.pause_between_batches_min + p.pause_between_batches_max) / 2) * 60;
    const cycleTime = batchTime + avgPause;
    const hoursPerDay = 10;
    const cycles = (hoursPerDay * 3600) / cycleTime;
    return Math.round(cycles * p.batch_size);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Motor de Disparo</h1>
          <p className="text-sm text-muted-foreground mt-1">Perfis de velocidade, rotação de instâncias e monitoramento</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Enviadas Total" value={String(todaySent)} subtitle={`de ${todayTotal} destinatários`} icon={<Zap className="w-5 h-5 text-primary" />} />
        <StatCard title="Taxa de Entrega" value={`${deliveryRate}%`} subtitle={`${todaySent} entregues`} icon={<TrendingUp className="w-5 h-5 text-green-500" />} />
        <StatCard title="Em Processamento" value={String(processingCount)} subtitle={`${activeCampaigns.length} campanhas ativas`} icon={<Activity className="w-5 h-5 text-blue-500" />} />
        <StatCard title="Perfis Criados" value={String(profiles.length)} subtitle="Disponíveis no wizard" icon={<Shield className="w-5 h-5 text-yellow-500" />} />
      </div>

      {/* Profiles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Perfis de Velocidade</CardTitle>
              <CardDescription>Crie e gerencie perfis — ficam disponíveis no wizard de campanha</CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" />Novo Perfil</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProfiles ? (
            <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum perfil criado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map(p => (
                <div key={p.id} className="glass-card p-4 rounded-xl group relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("font-semibold", getProfileColor(p.delay_min_s))}>{p.name}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">~{msgsPerDay(p)}/dia</Badge>
                      {p.is_default && <Badge variant="outline" className="text-[10px]">padrão</Badge>}
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mb-3">{p.description}</p>}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Intervalo</span><span className="text-foreground">{p.delay_min_s}-{p.delay_max_s}s</span></div>
                    <div className="flex justify-between"><span>Bloco</span><span className="text-foreground">{p.batch_size} msgs</span></div>
                    <div className="flex justify-between"><span>Pausa</span><span className="text-foreground">{p.pause_between_batches_min}-{p.pause_between_batches_max} min</span></div>
                  </div>
                  {!p.is_default && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rotation strategies info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estratégias de Rotação</CardTitle>
          <CardDescription>Selecione a estratégia e instâncias ao criar uma campanha no wizard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "single", desc: "Envia todas as mensagens por uma única instância", icon: "1️⃣" },
              { key: "roundrobin", desc: "Alterna entre instâncias a cada mensagem ou bloco", icon: "🔄" },
              { key: "proportional", desc: "Divide contatos igualmente entre instâncias selecionadas", icon: "⚖️" },
              { key: "random", desc: "Escolhe aleatoriamente a instância para cada envio", icon: "🎲" },
            ].map(s => (
              <div key={s.key} className="p-4 rounded-xl bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-sm font-medium text-foreground">{ROTATION_LABELS[s.key]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active dispatches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disparos Ativos</CardTitle>
          <CardDescription>{activeCampaigns.length} campanhas em andamento ou pausadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCampaigns ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : activeCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum disparo ativo</p>
          ) : (
            activeCampaigns.map((c) => {
              const progress = c.total_recipients > 0 ? (c.sent_count / c.total_recipients) * 100 : 0;
              const isRunning = ['processing', 'sending'].includes(c.status);
              const rotation = (c as any).rotation_strategy || 'single';
              return (
                <div key={c.id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {isRunning ? <Activity className="w-4 h-4 text-primary animate-pulse" /> : <Pause className="w-4 h-4 text-yellow-500" />}
                      <span className="font-medium text-foreground">{c.name}</span>
                      <Badge variant="secondary" className="text-xs">{ROTATION_LABELS[rotation] || rotation}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {c.delay_min_ms / 1000}-{c.delay_max_ms / 1000}s · Lote: {c.batch_size}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pauseCampaign.isPending || resumeCampaign.isPending}
                        onClick={() => isRunning ? pauseCampaign.mutate(c.id) : resumeCampaign.mutate(c.id)}>
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Progress value={progress} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.sent_count} de {c.total_recipients} enviadas{c.failed_count > 0 && ` · ${c.failed_count} falhas`}</span>
                    <span>{progress.toFixed(1)}% concluído</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil de Velocidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Super Conservador" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Para números recém-criados" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Intervalo entre mensagens: {form.delay_min_s}-{form.delay_max_s}s</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Mín: {form.delay_min_s}s</span>
                  <Slider value={[form.delay_min_s]} onValueChange={([v]) => setForm({ ...form, delay_min_s: v, delay_max_s: Math.max(v, form.delay_max_s) })} min={3} max={120} step={1} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Máx: {form.delay_max_s}s</span>
                  <Slider value={[form.delay_max_s]} onValueChange={([v]) => setForm({ ...form, delay_max_s: v, delay_min_s: Math.min(v, form.delay_min_s) })} min={3} max={180} step={1} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tamanho do bloco: {form.batch_size} msgs</label>
              <Slider value={[form.batch_size]} onValueChange={([v]) => setForm({ ...form, batch_size: v })} min={1} max={50} step={1} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Pausa entre blocos: {form.pause_between_batches_min}-{form.pause_between_batches_max} min</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Mín: {form.pause_between_batches_min} min</span>
                  <Slider value={[form.pause_between_batches_min]} onValueChange={([v]) => setForm({ ...form, pause_between_batches_min: v, pause_between_batches_max: Math.max(v, form.pause_between_batches_max) })} min={1} max={60} step={1} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Máx: {form.pause_between_batches_max} min</span>
                  <Slider value={[form.pause_between_batches_max]} onValueChange={([v]) => setForm({ ...form, pause_between_batches_max: v, pause_between_batches_min: Math.min(v, form.pause_between_batches_min) })} min={1} max={90} step={1} />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <span className="text-sm text-muted-foreground">Estimativa: </span>
              <span className="text-sm font-semibold text-foreground">~{msgsPerDay(form)} msgs/dia</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || createProfile.isPending || updateProfile.isPending} className="gap-2">
              <Save className="w-4 h-4" />{editingProfile ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir perfil?</DialogTitle></DialogHeader>
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
