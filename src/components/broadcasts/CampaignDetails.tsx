import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Pause, Play, XCircle, CheckCircle, Clock, Send, Rocket, AlertCircle, RotateCcw, Volume2 } from 'lucide-react';
import { BroadcastCampaign, BroadcastRecipient, useBroadcasts } from '@/hooks/useBroadcasts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import WhatsAppPhonePreview from '@/components/messages/WhatsAppPhonePreview';
import CampaignDispatchSettings from '@/components/broadcasts/CampaignDispatchSettings';
import { resolveSpintaxByIndices } from '@/lib/spintax';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', color: 'text-muted-foreground', icon: Clock },
  processing: { label: 'Enviando', color: 'text-primary', icon: Send },
  paused: { label: 'Pausada', color: 'text-warning', icon: Pause },
  completed: { label: 'Concluída', color: 'text-success', icon: CheckCircle },
  failed: { label: 'Cancelada', color: 'text-destructive', icon: XCircle },
};

const recipientStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-secondary text-muted-foreground', icon: Clock },
  sent: { label: 'Enviado', color: 'bg-success/10 text-success', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  skipped: { label: 'Ignorado', color: 'bg-warning/10 text-warning', icon: AlertCircle },
};

function resolveRecipientMessage(template: string, recipient: BroadcastRecipient): string {
  const indices = (recipient as any).variation_indices as number[] | null;
  const variables = (recipient.variables || {}) as Record<string, any>;
  let resolved = template;
  if (indices && indices.length > 0) {
    resolved = resolveSpintaxByIndices(template, indices);
  }
  return resolved.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

const RecipientRow: React.FC<{
  recipient: BroadcastRecipient;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ recipient, isSelected, onSelect }) => {
  const rs = recipientStatusConfig[recipient.status] || recipientStatusConfig.pending;
  const StatusIcon = rs.icon;
  const hasVariation = (recipient as any).variation_indices?.length > 0;
  const variables = (recipient.variables || {}) as Record<string, any>;
  const hasAudio = !!(recipient as any).sent_media_url;

  return (
    <div
      className={`flex items-center gap-3 px-4 md:px-6 py-3 transition-colors cursor-pointer border-b border-border/50 last:border-b-0 ${
        isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/20'
      }`}
      onClick={onSelect}
    >
      <StatusIcon className={`w-4 h-4 shrink-0 ${rs.color.includes('success') ? 'text-success' : rs.color.includes('destructive') ? 'text-destructive' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{recipient.phone_number}</p>
          {hasVariation && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              V{((recipient as any).variation_indices as number[]).map((v: number) => v + 1).join('·')}
            </span>
          )}
          {hasAudio && (
            <Volume2 className="w-3 h-3 text-primary/60" />
          )}
        </div>
        {Object.keys(variables).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {Object.entries(variables).slice(0, 3).map(([k, v]) => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {k}: {String(v).slice(0, 20)}
              </span>
            ))}
            {Object.keys(variables).length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                +{Object.keys(variables).length - 3}
              </span>
            )}
          </div>
        )}
        {recipient.error_message && (
          <p className="text-[10px] text-destructive mt-0.5 truncate">{recipient.error_message}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {recipient.sent_at && (
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {new Date(recipient.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${rs.color}`}>{rs.label}</span>
      </div>
    </div>
  );
};

const CampaignDetails: React.FC<{ campaign: BroadcastCampaign; onBack: () => void }> = ({ campaign: initialCampaign, onBack }) => {
  const { pauseCampaign, resumeCampaign, cancelCampaign, startCampaign, resetCampaign } = useBroadcasts();
  const queryClient = useQueryClient();
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [headerFieldKey, setHeaderFieldKey] = useState<string>('phone_number');

  const { data: liveCampaign } = useQuery({
    queryKey: ['broadcast-campaign', initialCampaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns').select('*').eq('id', initialCampaign.id).single();
      if (error) throw error;
      return data as unknown as BroadcastCampaign;
    },
    initialData: initialCampaign,
  });

  const campaign = liveCampaign ?? initialCampaign;

  useEffect(() => {
    const channel = supabase
      .channel(`campaign-detail-${initialCampaign.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_campaigns', filter: `id=eq.${initialCampaign.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['broadcast-campaign', initialCampaign.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [initialCampaign.id, queryClient]);

  const { data: recipients = [] } = useQuery({
    queryKey: ['broadcast-recipients', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('broadcast_recipients').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as BroadcastRecipient[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`recipients-${campaign.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_recipients', filter: `campaign_id=eq.${campaign.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['broadcast-recipients', campaign.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaign.id, queryClient]);

  const progress = campaign.total_recipients > 0 ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100) : 0;
  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const selectedRecipient = useMemo(() => {
    if (!selectedRecipientId) return null;
    return recipients.find(r => r.id === selectedRecipientId) ?? null;
  }, [recipients, selectedRecipientId]);

  // Preview content: selected recipient's resolved message or template
  const previewContent = useMemo(() => {
    if (!selectedRecipient) return campaign.message_template;
    return resolveRecipientMessage(campaign.message_template, selectedRecipient);
  }, [campaign.message_template, selectedRecipient]);

  const previewVarValues = useMemo(() => {
    if (!selectedRecipient) {
      if (recipients.length === 0) return {};
      const firstVars = (recipients[0].variables || {}) as Record<string, any>;
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(firstVars)) result[k] = String(v ?? '');
      return result;
    }
    return {}; // Variables are already resolved in previewContent
  }, [recipients, selectedRecipient]);

  // Determine the media URL for the preview: use recipient's sent_media_url if available
  const previewMediaUrl = useMemo(() => {
    if (selectedRecipient) {
      return (selectedRecipient as any).sent_media_url || campaign.media_url || undefined;
    }
    return campaign.media_url || undefined;
  }, [selectedRecipient, campaign.media_url]);

  const sentAudioUrl = useMemo(() => {
    if (!selectedRecipient) return null;
    return (selectedRecipient as any).sent_media_url as string | null;
  }, [selectedRecipient]);

  // Build header fields from selected recipient's variables + phone
  const headerFields = useMemo(() => {
    if (!selectedRecipient) return [];
    const variables = (selectedRecipient.variables || {}) as Record<string, any>;
    const fields: Array<{ key: string; label: string; value: string }> = [
      { key: 'phone_number', label: 'Telefone', value: selectedRecipient.phone_number },
    ];
    for (const [k, v] of Object.entries(variables)) {
      fields.push({ key: k, label: k, value: String(v ?? '') });
    }
    return fields;
  }, [selectedRecipient]);

  const headerLabel = useMemo(() => {
    if (!selectedRecipient) return 'Empresa';
    if (headerFieldKey === 'phone_number') return selectedRecipient.phone_number;
    const variables = (selectedRecipient.variables || {}) as Record<string, any>;
    return String(variables[headerFieldKey] ?? selectedRecipient.phone_number);
  }, [selectedRecipient, headerFieldKey]);

  const statusCounts = useMemo(() => {
    const counts = { sent: 0, failed: 0, pending: 0 };
    recipients.forEach(r => {
      if (r.status === 'sent') counts.sent++;
      else if (r.status === 'failed') counts.failed++;
      else counts.pending++;
    });
    return counts;
  }, [recipients]);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const filteredRecipients = useMemo(() => {
    if (filterStatus === 'all') return recipients;
    return recipients.filter(r => r.status === filterStatus);
  }, [recipients, filterStatus]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">{campaign.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
              <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {campaign.status === 'draft' && (
            <button onClick={() => startCampaign.mutate(campaign.id)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Rocket className="w-4 h-4" />Iniciar
            </button>
          )}
          {campaign.status === 'processing' && (
            <button onClick={() => pauseCampaign.mutate(campaign.id)} className="flex items-center gap-1.5 px-3 py-2 bg-warning/10 text-warning rounded-lg text-sm font-medium">
              <Pause className="w-4 h-4" />Pausar
            </button>
          )}
          {campaign.status === 'paused' && (
            <button onClick={() => resumeCampaign.mutate(campaign.id)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Play className="w-4 h-4" />Retomar
            </button>
          )}
          {['completed', 'failed', 'paused'].includes(campaign.status) && (
            <button onClick={() => resetCampaign.mutate(campaign.id)} className="flex items-center gap-1.5 px-3 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
              <RotateCcw className="w-4 h-4" />Resetar
            </button>
          )}
          {['processing', 'paused'].includes(campaign.status) && (
            <button onClick={() => cancelCampaign.mutate(campaign.id)} className="flex items-center gap-1.5 px-3 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium">
              <XCircle className="w-4 h-4" />Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row">
        {/* Left column */}
        <div className="flex-1 min-w-0">
          {/* Progress */}
          <div className="p-4 md:p-6 border-b border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Progresso</span>
              <span className="text-sm font-semibold text-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2 md:gap-3">
              <div className="p-2 md:p-3 bg-secondary/50 rounded-xl text-center">
                <p className="text-base md:text-lg font-bold text-foreground">{campaign.total_recipients}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-2 md:p-3 bg-success/5 rounded-xl text-center">
                <p className="text-base md:text-lg font-bold text-success">{campaign.sent_count}</p>
                <p className="text-[10px] md:text-xs text-success">Enviados</p>
              </div>
              <div className="p-2 md:p-3 bg-destructive/5 rounded-xl text-center">
                <p className="text-base md:text-lg font-bold text-destructive">{campaign.failed_count}</p>
                <p className="text-[10px] md:text-xs text-destructive">Falhas</p>
              </div>
              <div className="p-2 md:p-3 bg-secondary/50 rounded-xl text-center">
                <p className="text-base md:text-lg font-bold text-muted-foreground">{campaign.total_recipients - campaign.sent_count - campaign.failed_count}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </div>

          <CampaignDispatchSettings campaign={campaign} />

          {/* Recipients */}
          <div>
            <div className="px-4 md:px-6 py-3 bg-secondary/30 border-b border-border flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Destinatários ({filteredRecipients.length})</p>
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'Todos', count: recipients.length },
                  { key: 'sent', label: 'Enviados', count: statusCounts.sent },
                  { key: 'failed', label: 'Falhas', count: statusCounts.failed },
                  { key: 'pending', label: 'Pendentes', count: statusCounts.pending },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                      filterStatus === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>
            <div>
              {filteredRecipients.map(r => (
                <RecipientRow
                  key={r.id}
                  recipient={r}
                  isSelected={selectedRecipientId === r.id}
                  onSelect={() => setSelectedRecipientId(prev => prev === r.id ? null : r.id)}
                />
              ))}
              {filteredRecipients.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum destinatário neste filtro
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Preview — sticky */}
        <div className="lg:w-[340px] lg:shrink-0 lg:border-l border-t lg:border-t-0 border-border">
          <div className="p-4 md:p-6 lg:sticky lg:top-4 lg:self-start space-y-4">
            <WhatsAppPhonePreview
              content={selectedRecipient ? previewContent : campaign.message_template}
              messageType={campaign.message_type || 'text'}
              mediaUrl={previewMediaUrl}
              variableValues={selectedRecipient ? {} : previewVarValues}
              audioSrc={sentAudioUrl || undefined}
              headerLabel={headerLabel}
              headerFields={headerFields}
              onHeaderFieldChange={setHeaderFieldKey}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetails;
