import React, { useState } from 'react';
import { Settings2, Pencil, Save, X, AlertTriangle } from 'lucide-react';
import { BroadcastCampaign } from '@/hooks/useBroadcasts';
import { useDispatchProfiles } from '@/hooks/useDispatchProfiles';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface Props {
  campaign: BroadcastCampaign;
}

const CampaignDispatchSettings: React.FC<Props> = ({ campaign }) => {
  const queryClient = useQueryClient();
  const { profiles } = useDispatchProfiles();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speedProfile, setSpeedProfile] = useState<string>('');

  // Convert stored ms → seconds for slider UI
  const [delayMin, setDelayMin] = useState(campaign.delay_min_ms / 1000);
  const [delayMax, setDelayMax] = useState(campaign.delay_max_ms / 1000);
  const [batchSize, setBatchSize] = useState(campaign.batch_size);
  // Stored in seconds → convert to minutes for UI
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(Math.round(campaign.delay_between_batches / 60));
  const [delayBetweenBatchesMax, setDelayBetweenBatchesMax] = useState(Math.round(campaign.delay_between_batches_max / 60));

  const canEdit = ['draft', 'paused'].includes(campaign.status);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({
          delay_min_ms: delayMin * 1000,
          delay_max_ms: delayMax * 1000,
          batch_size: batchSize,
          delay_between_batches: delayBetweenBatches * 60,
          delay_between_batches_max: delayBetweenBatchesMax * 60,
        })
        .eq('id', campaign.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Configurações de disparo atualizadas!');
      setEditing(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDelayMin(campaign.delay_min_ms / 1000);
    setDelayMax(campaign.delay_max_ms / 1000);
    setBatchSize(campaign.batch_size);
    setDelayBetweenBatches(Math.round(campaign.delay_between_batches / 60));
    setDelayBetweenBatchesMax(Math.round(campaign.delay_between_batches_max / 60));
    setSpeedProfile('');
    setEditing(false);
  };

  const getProfileColor = (delayMinS: number) => {
    if (delayMinS >= 40) return "text-green-500";
    if (delayMinS >= 20) return "text-yellow-500";
    return "text-red-500";
  };

  const rotationLabel = campaign.rotation_strategy === 'roundrobin' ? 'Intercalar' :
    campaign.rotation_strategy === 'random' ? 'Aleatória' :
    campaign.rotation_strategy === 'proportional' ? 'Proporcional' : 'Instância Única';

  // Read-only view
  if (!editing) {
    return (
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase">Motor de Disparo</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-secondary/30 rounded-xl">
            <span className="text-[11px] text-muted-foreground font-medium">Delay entre msgs</span>
            <p className="text-sm font-semibold text-foreground mt-1">{campaign.delay_min_ms / 1000}s — {campaign.delay_max_ms / 1000}s</p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl">
            <span className="text-[11px] text-muted-foreground font-medium">Tamanho do lote</span>
            <p className="text-sm font-semibold text-foreground mt-1">{campaign.batch_size} msgs</p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl">
            <span className="text-[11px] text-muted-foreground font-medium">Pausa entre lotes</span>
            <p className="text-sm font-semibold text-foreground mt-1">{Math.round(campaign.delay_between_batches / 60)}—{Math.round(campaign.delay_between_batches_max / 60)} min</p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl">
            <span className="text-[11px] text-muted-foreground font-medium">Rotação</span>
            <p className="text-sm font-semibold text-foreground mt-1">{rotationLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  // Editing view — same sliders as CampaignWizard
  return (
    <div className="p-4 md:p-6 border-b border-border space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase">Motor de Disparo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 text-xs text-primary-foreground bg-primary hover:bg-primary/90 px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Speed profile selector */}
      {profiles.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">Perfil de velocidade</label>
          <div className="grid grid-cols-3 gap-3">
            {profiles.map(p => (
              <button key={p.id} type="button"
                onClick={() => {
                  setSpeedProfile(p.id);
                  setDelayMin(p.delay_min_s);
                  setDelayMax(p.delay_max_s);
                  setBatchSize(p.batch_size);
                  setDelayBetweenBatches(p.pause_between_batches_min);
                  setDelayBetweenBatchesMax(p.pause_between_batches_max);
                }}
                className={cn(
                  "p-3 rounded-xl border-2 transition-all text-left",
                  speedProfile === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                )}
              >
                <p className={cn("text-sm font-semibold", getProfileColor(p.delay_min_s))}>{p.name}</p>
                {p.description && <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>}
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Delay: {p.delay_min_s}-{p.delay_max_s}s</p>
                  <p>Lote: {p.batch_size} msgs</p>
                  <p>Pausa: {p.pause_between_batches_min}-{p.pause_between_batches_max} min</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delay sliders */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">Personalizar</label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Min: {delayMin}s</span>
          <span className="text-xs text-muted-foreground">Max: {delayMax}s</span>
        </div>
        <Slider value={[delayMin]} onValueChange={([v]) => { setDelayMin(v); setSpeedProfile('custom'); if (v > delayMax) setDelayMax(v); }} min={1} max={120} step={1} />
        <Slider value={[delayMax]} onValueChange={([v]) => { setDelayMax(v); setSpeedProfile('custom'); if (v < delayMin) setDelayMin(v); }} min={1} max={120} step={1} />
        {delayMin < 3 && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive">Delay abaixo de 3s aumenta risco de bloqueio</span>
          </div>
        )}
      </div>

      {/* Batch sliders */}
      <div className="space-y-3 p-4 bg-secondary/30 border border-border rounded-xl">
        <label className="text-sm font-semibold text-foreground">Lotes</label>
        <div>
          <span className="text-xs text-muted-foreground">Mensagens por lote: <strong className="text-foreground">{batchSize}</strong></span>
        </div>
        <Slider value={[batchSize]} onValueChange={([v]) => { setBatchSize(v); setSpeedProfile('custom'); }} min={1} max={50} step={1} />
        <div>
          <span className="text-xs text-muted-foreground">Pausa entre lotes: <strong className="text-foreground">{delayBetweenBatches}-{delayBetweenBatchesMax} min</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Mín: {delayBetweenBatches} min</span>
            <Slider value={[delayBetweenBatches]} onValueChange={([v]) => { setDelayBetweenBatches(v); setSpeedProfile('custom'); if (v > delayBetweenBatchesMax) setDelayBetweenBatchesMax(v); }} min={1} max={60} step={1} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Máx: {delayBetweenBatchesMax} min</span>
            <Slider value={[delayBetweenBatchesMax]} onValueChange={([v]) => { setDelayBetweenBatchesMax(v); setSpeedProfile('custom'); if (v < delayBetweenBatches) setDelayBetweenBatches(v); }} min={1} max={90} step={1} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDispatchSettings;
