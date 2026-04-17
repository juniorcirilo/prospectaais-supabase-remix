import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Wifi, WifiOff, QrCode, Trash2, Star, MoreVertical, Smartphone, Cloud, Server, Webhook, Settings2, PhoneOff, Users, Radio, BookOpen, Power } from 'lucide-react';
import { useWhatsAppInstances, WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import { AddInstanceDialog } from './AddInstanceDialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

const providerLabels: Record<string, string> = {
  official: 'API Oficial (Meta)',
  evolution_self_hosted: 'Evolution Self-Hosted',
  evolution_cloud: 'Evolution Cloud',
};

const providerIcons: Record<string, React.ReactNode> = {
  official: <Cloud className="w-4 h-4" />,
  evolution_self_hosted: <Server className="w-4 h-4" />,
  evolution_cloud: <Cloud className="w-4 h-4" />,
};

interface InstanceSettings {
  reply_to_groups: boolean;
  reject_call: boolean;
  msg_call: string;
  always_online: boolean;
  read_messages: boolean;
  webhook_enabled: boolean;
}

export function WhatsAppInstancesManager() {
  const { instances, isLoading, refetch, deleteInstance, setDefaultInstance } = useWhatsAppInstances();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogInstance, setDeleteDialogInstance] = useState<WhatsAppInstance | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewQrInstance, setViewQrInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reconfiguringWebhook, setReconfiguringWebhook] = useState<string | null>(null);

  // Settings modal state
  const [settingsInstance, setSettingsInstance] = useState<WhatsAppInstance | null>(null);
  const [settingsValues, setSettingsValues] = useState<InstanceSettings>({
    reply_to_groups: false,
    reject_call: false,
    msg_call: '',
    always_online: false,
    read_messages: false,
    webhook_enabled: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const stopQrPolling = useCallback(() => {
    if (qrPollingRef.current) { clearInterval(qrPollingRef.current); qrPollingRef.current = null; }
  }, []);

  const fetchQrCode = useCallback(async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-evolution-qrcode', { body: { instance_id: instanceId } });
      if (error) throw error;
      if (data?.connected) { setQrConnected(true); setQrCode(null); stopQrPolling(); await refetch(); }
      else if (data?.qr_code) setQrCode(data.qr_code);
    } catch (err) { console.warn('[QR polling] error:', err); }
  }, [refetch, stopQrPolling]);

  const openQrModal = useCallback(async (instance: WhatsAppInstance) => {
    setViewQrInstance(instance); setQrCode(null); setQrConnected(false); setQrLoading(true); stopQrPolling();
    await fetchQrCode(instance.id); setQrLoading(false);
    qrPollingRef.current = setInterval(() => fetchQrCode(instance.id), 20000);
  }, [fetchQrCode, stopQrPolling]);

  const closeQrModal = useCallback(() => { stopQrPolling(); setViewQrInstance(null); setQrCode(null); setQrConnected(false); }, [stopQrPolling]);

  useEffect(() => { return () => stopQrPolling(); }, [stopQrPolling]);

  const openSettingsModal = (instance: WhatsAppInstance) => {
    const meta = (instance.metadata as Record<string, unknown>) ?? {};
    setSettingsInstance(instance);
    setSettingsValues({
      reply_to_groups: instance.reply_to_groups ?? false,
      reject_call: meta.reject_call as boolean ?? false,
      msg_call: meta.msg_call as string ?? '',
      always_online: meta.always_online as boolean ?? false,
      read_messages: meta.read_messages as boolean ?? false,
      webhook_enabled: meta.webhook_enabled !== false,
    });
  };

  const handleSaveSettings = async () => {
    if (!settingsInstance) return;
    setIsSavingSettings(true);
    try {
      const groupsIgnore = !settingsValues.reply_to_groups;

      // 1. Atualizar banco de dados
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          reply_to_groups: settingsValues.reply_to_groups,
          metadata: {
            ...((settingsInstance.metadata as Record<string, unknown>) ?? {}),
            reject_call: settingsValues.reject_call,
            msg_call: settingsValues.msg_call,
            always_online: settingsValues.always_online,
            read_messages: settingsValues.read_messages,
            webhook_enabled: settingsValues.webhook_enabled,
          },
        })
        .eq('id', settingsInstance.id);

      if (error) throw error;

      // 2. Sincronizar com Evolution API
      if (settingsInstance.provider_type !== 'official') {
        const { error: fnError } = await supabase.functions.invoke('update-evolution-settings', {
          body: {
            instance_id: settingsInstance.id,
            groups_ignore: groupsIgnore,
            reject_call: settingsValues.reject_call,
            msg_call: settingsValues.reject_call ? settingsValues.msg_call : '',
            always_online: settingsValues.always_online,
            read_messages: settingsValues.read_messages,
            webhook_enabled: settingsValues.webhook_enabled,
          },
        });
        if (fnError) {
          console.warn('[handleSaveSettings] Evolution API sync failed:', fnError);
          toast.warning('Configurações salvas localmente, mas falhou ao sincronizar com a API');
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Configurações salvas com sucesso');
      setSettingsInstance(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao salvar configurações: ${msg}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleReconfigureWebhook = async (instance: WhatsAppInstance) => {
    setReconfiguringWebhook(instance.id);
    try {
      const { error: fnError } = await supabase.functions.invoke('update-evolution-settings', {
        body: {
          instance_id: instance.id,
          groups_ignore: !instance.reply_to_groups,
          webhook_enabled: true,
        },
      });
      if (fnError) throw fnError;
      toast.success(`Webhook reconfigurado para ${instance.name} ✅`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao reconfigurar webhook: ${msg}`);
    } finally {
      setReconfiguringWebhook(null);
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await supabase.functions.invoke('check-instances-status');
      await refetch();
      toast.success('Status atualizado');
    } catch { toast.error('Erro ao atualizar status'); }
    finally { setIsRefreshing(false); }
  };

  const handleDelete = async () => {
    if (deleteDialogInstance) { await deleteInstance.mutateAsync(deleteDialogInstance.id); setDeleteDialogInstance(null); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20"><Wifi className="w-3 h-3" />Conectado</span>;
      case 'connecting': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"><RefreshCw className="w-3 h-3 animate-spin" />Conectando</span>;
      case 'qr_required': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"><QrCode className="w-3 h-3" />QR Code</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"><WifiOff className="w-3 h-3" />Desconectado</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instâncias WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas conexões via Evolution API</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />Atualizar Status
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova Instância</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : instances.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-border rounded-lg glass-card">
          <Smartphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">Nenhuma instância configurada</p>
          <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Adicionar Instância</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => (
            <div key={instance.id} className="glass-card p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">{providerIcons[instance.provider_type]}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{instance.name}</span>
                      {instance.is_default && <Star className="w-4 h-4 text-warning fill-warning" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{providerLabels[instance.provider_type]}</span>
                      {instance.phone_number && <><span>•</span><span>{instance.phone_number}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(instance.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openSettingsModal(instance)}>
                        <Settings2 className="w-4 h-4 mr-2" />Configurações
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {instance.status !== 'connected' && (
                        <DropdownMenuItem onClick={() => openQrModal(instance)}>
                          <QrCode className="w-4 h-4 mr-2" />Conectar via QR Code
                        </DropdownMenuItem>
                      )}
                      {!instance.is_default && (
                        <DropdownMenuItem onClick={() => setDefaultInstance.mutate(instance.id)}>
                          <Star className="w-4 h-4 mr-2" />Definir como Padrão
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleReconfigureWebhook(instance)}
                        disabled={reconfiguringWebhook === instance.id}
                      >
                        <Webhook className="w-4 h-4 mr-2" />
                        {reconfiguringWebhook === instance.id ? 'Reconfigurando...' : 'Reconfigurar Webhook'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialogInstance(instance)}>
                        <Trash2 className="w-4 h-4 mr-2" />Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddInstanceDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

      {/* Settings Modal */}
      <Dialog open={!!settingsInstance} onOpenChange={(open) => !open && setSettingsInstance(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurações — {settingsInstance?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="divide-y divide-border">
            {/* Reject Calls */}
            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted"><PhoneOff className="w-4 h-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Rejeitar Chamadas</p>
                    <p className="text-xs text-muted-foreground">Rejeita automaticamente chamadas recebidas</p>
                  </div>
                </div>
                <Switch
                  checked={settingsValues.reject_call}
                  onCheckedChange={(val) => setSettingsValues((prev) => ({ ...prev, reject_call: val }))}
                />
              </div>
              {settingsValues.reject_call && (
                <div className="ml-11 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mensagem automática de rejeição</label>
                  <Textarea
                    placeholder="Ex: Desculpe, não recebemos ligações. Envie sua mensagem por texto!"
                    value={settingsValues.msg_call}
                    onChange={(e) => setSettingsValues((prev) => ({ ...prev, msg_call: e.target.value }))}
                    className="resize-none text-sm"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Ignore Groups */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Users className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium text-foreground">Ignorar Grupos</p>
                  <p className="text-xs text-muted-foreground">Não processa mensagens de grupos do WhatsApp</p>
                </div>
              </div>
              <Switch
                checked={!settingsValues.reply_to_groups}
                onCheckedChange={(val) => setSettingsValues((prev) => ({ ...prev, reply_to_groups: !val }))}
              />
            </div>

            {/* Always Online */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Radio className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium text-foreground">Sempre Online</p>
                  <p className="text-xs text-muted-foreground">Mantém o WhatsApp sempre com status online</p>
                </div>
              </div>
              <Switch
                checked={settingsValues.always_online}
                onCheckedChange={(val) => setSettingsValues((prev) => ({ ...prev, always_online: val }))}
              />
            </div>

            {/* Read Messages */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><BookOpen className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium text-foreground">Marcar como Lido</p>
                  <p className="text-xs text-muted-foreground">Marca automaticamente todas as mensagens como lidas</p>
                </div>
              </div>
              <Switch
                checked={settingsValues.read_messages}
                onCheckedChange={(val) => setSettingsValues((prev) => ({ ...prev, read_messages: val }))}
              />
            </div>

            {/* Webhook Enabled */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Power className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium text-foreground">Webhook Ativo</p>
                  <p className="text-xs text-muted-foreground">Desative para pausar o recebimento de mensagens desta instância</p>
                </div>
              </div>
              <Switch
                checked={settingsValues.webhook_enabled}
                onCheckedChange={(val) => setSettingsValues((prev) => ({ ...prev, webhook_enabled: val }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsInstance(null)} disabled={isSavingSettings}>Cancelar</Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? (<><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : 'Salvar Configurações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!viewQrInstance} onOpenChange={(open) => !open && closeQrModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code — {viewQrInstance?.name}</DialogTitle></DialogHeader>
          {qrConnected ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle className="w-12 h-12 text-success" />
              <p className="font-semibold text-foreground">Conectado!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-48 h-48 rounded-xl border-2 border-primary/20 bg-card flex items-center justify-center overflow-hidden">
                {qrLoading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> :
                  qrCode ? <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR" className="w-full h-full object-contain p-2" /> :
                  <QrCode className="w-10 h-10 text-muted-foreground" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="w-3 h-3 animate-spin" />Aguardando conexão...</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialogInstance} onOpenChange={(open) => !open && setDeleteDialogInstance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação irá desconectar e remover a instância "{deleteDialogInstance?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
