import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, QrCode, RefreshCw, ArrowRight, Smartphone, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AddInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'credentials' | 'creating' | 'qrcode' | 'connected';

export function AddInstanceDialog({ open, onOpenChange }: AddInstanceDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('credentials');
  const [name, setName] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load credentials from app_settings
  const [evolutionApiUrl, setEvolutionApiUrl] = useState<string | null>(null);
  const [evolutionApiKey, setEvolutionApiKey] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoadingCreds(true);
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key']);
      if (data) {
        for (const row of data) {
          if (row.key === 'evolution_api_url' && row.value) setEvolutionApiUrl(row.value);
          if (row.key === 'evolution_api_key' && row.value) setEvolutionApiKey(row.value);
        }
      }
      setLoadingCreds(false);
    })();
  }, [open]);

  const credentialsConfigured = !!(evolutionApiUrl && evolutionApiKey);

  const handleNameChange = (val: string) => {
    setName(val);
    setInstanceName(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, ''));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (!instanceName.trim()) errs.instanceName = 'Nome da instância obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    if (!credentialsConfigured) {
      toast.error('Configure a URL e API Key da Evolution nas Configurações antes de continuar');
      return;
    }

    setIsCreating(true);
    setStep('creating');

    try {
      const { data, error } = await supabase.functions.invoke('create-evolution-instance', {
        body: { instance_name: instanceName, name, is_default: isDefault },
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao criar instância');

      setInstanceId(data.instance_id);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });

      if (data.qr_code) {
        setQrCode(data.qr_code);
        setStep('qrcode');
        startPolling(data.instance_id);
      } else {
        setStep('qrcode');
        await fetchQr(data.instance_id);
        startPolling(data.instance_id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido');
      setStep('credentials');
    } finally {
      setIsCreating(false);
    }
  };

  const fetchQr = async (id: string) => {
    setIsFetchingQr(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-evolution-qrcode', { body: { instance_id: id } });
      if (error) throw error;
      if (data?.connected) { setQrCode(null); setStep('connected'); stopPolling(); queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] }); return; }
      if (data?.qr_code) setQrCode(data.qr_code);
    } catch (err) { console.error('Error fetching QR:', err); }
    finally { setIsFetchingQr(false); }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase.functions.invoke('get-evolution-qrcode', { body: { instance_id: id } });
      if (data?.connected) { setQrCode(null); setStep('connected'); stopPolling(); queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] }); }
      else if (data?.qr_code) setQrCode(data.qr_code);
    }, 5000);
  };

  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  const handleClose = () => {
    stopPolling(); setStep('credentials'); setName(''); setInstanceName(''); setIsDefault(false);
    setErrors({}); setInstanceId(null); setQrCode(null);
    setEvolutionApiUrl(null); setEvolutionApiKey(null);
    onOpenChange(false);
  };

  useEffect(() => { if (!open) stopPolling(); return () => stopPolling(); }, [open]);

  const stepLabels = ['Configurar', 'Criando', 'QR Code'];
  const stepIndex = step === 'credentials' ? 0 : step === 'creating' ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Instância WhatsApp</DialogTitle>
          <DialogDescription>Conecte um número via Evolution API</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {stepLabels.map((label, i) => (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= stepIndex ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
                  ${i < stepIndex ? 'bg-primary border-primary text-primary-foreground' :
                    i === stepIndex ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                {label}
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`flex-1 h-px ${i < stepIndex ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 'credentials' && (
          <div className="space-y-4 mt-2">
            {loadingCreds ? (
              <div className="flex items-center justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !credentialsConfigured ? (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-foreground">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs">Configure e salve a <strong>URL da Evolution API</strong> e a <strong>API Key</strong> na página de <strong>Configurações</strong> antes de criar uma instância.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/40">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Evolution API configurada</span><br />{evolutionApiUrl}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da Conexão</Label>
              <Input id="name" placeholder="Ex: WhatsApp Vendas" value={name} onChange={e => handleNameChange(e.target.value)} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instanceName">Nome da Instância <span className="text-muted-foreground font-normal ml-1 text-xs">(gerado automaticamente)</span></Label>
              <Input id="instanceName" placeholder="gerado-automaticamente" value={instanceName} disabled className="bg-muted/50" />
              {errors.instanceName && <p className="text-xs text-destructive">{errors.instanceName}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 accent-primary" />
              <Label htmlFor="isDefault" className="font-normal cursor-pointer">Definir como instância padrão</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!credentialsConfigured || !name.trim()} className="gap-2">
                Criar Instância<ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'creating' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            <div className="text-center"><p className="font-medium text-foreground">Criando instância...</p><p className="text-sm text-muted-foreground mt-1">Conectando ao Evolution API e gerando QR Code</p></div>
          </div>
        )}

        {step === 'qrcode' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="text-center"><p className="font-medium text-foreground">Escaneie o QR Code</p><p className="text-sm text-muted-foreground">Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar</p></div>
            <div className="w-56 h-56 rounded-xl border-2 border-primary/20 bg-card flex items-center justify-center overflow-hidden">
              {isFetchingQr && !qrCode ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" /><span className="text-xs">Gerando QR...</span></div>
              ) : qrCode ? (
                <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><QrCode className="w-10 h-10" /><span className="text-xs">QR não disponível</span></div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="w-3 h-3 animate-spin" />Aguardando conexão automaticamente...</div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => instanceId && fetchQr(instanceId)} disabled={isFetchingQr}>
                <RefreshCw className={`w-4 h-4 ${isFetchingQr ? 'animate-spin' : ''}`} />Atualizar QR
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}

        {step === 'connected' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20"><CheckCircle className="w-10 h-10 text-primary" /></div>
            <div className="text-center"><p className="font-semibold text-foreground text-lg">WhatsApp Conectado!</p><p className="text-sm text-muted-foreground mt-1">A instância <strong>{name}</strong> está ativa e pronta para uso.</p></div>
            <Button onClick={handleClose} className="gap-2 mt-2"><Smartphone className="w-4 h-4" />Concluir</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
