import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface BroadcastCampaign {
  id: string;
  user_id: string;
  name: string;
  message_template: string;
  message_type: string;
  media_url: string | null;
  instance_id: string;
  instance_ids: string[];
  delay_min_ms: number;
  delay_max_ms: number;
  batch_size: number;
  delay_between_batches: number;
  delay_between_batches_max: number;
  rotation_strategy: string;
  next_batch_at: string | null;
  column_mapping: Record<string, string>;
  custom_fields: string[];
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  voice_profile_id: string | null;
  flow_id: string | null;
}

export interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  phone_number: string;
  variables: Record<string, any>;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface CreateCampaignInput {
  name: string;
  message_template: string;
  message_type?: string;
  media_url?: string;
  media_urls?: string[];
  media_rotation_mode?: string;
  instance_id?: string;
  delay_min_ms: number;
  delay_max_ms: number;
  batch_size: number;
  delay_between_batches: number;
  delay_between_batches_max?: number;
  column_mapping: Record<string, string>;
  custom_fields: string[];
  rotation_strategy?: string;
  instance_ids?: string[];
  voice_profile_id?: string;
  flow_id?: string;
  recipients: Array<{
    phone_number: string;
    variables: Record<string, any>;
  }>;
}

export function useBroadcasts() {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['broadcast-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as BroadcastCampaign[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('broadcast-campaigns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createCampaign = useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const { recipients, rotation_strategy, instance_ids, voice_profile_id, media_urls, media_rotation_mode, flow_id, ...campaignData } = input;

      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .insert({
          ...campaignData,
          user_id: '00000000-0000-0000-0000-000000000000', // placeholder until auth
          total_recipients: recipients.length,
          status: 'draft',
          rotation_strategy: rotation_strategy || 'single',
          instance_ids: instance_ids || [],
          voice_profile_id: voice_profile_id || null,
          media_urls: media_urls || [],
          media_rotation_mode: media_rotation_mode || 'random',
          flow_id: flow_id || null,
        } as any)
        .select()
        .single();

      if (campaignError) throw campaignError;

      const BATCH = 500;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const batch = recipients.slice(i, i + BATCH).map(r => ({
          campaign_id: campaign.id,
          phone_number: r.phone_number,
          variables: r.variables,
        }));
        const { error: recipientsError } = await supabase.from('broadcast_recipients').insert(batch);
        if (recipientsError) throw recipientsError;
      }

      return campaign as unknown as BroadcastCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar campanha: ${error.message}`);
    },
  });

  const startCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('broadcast-processor', {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Disparo iniciado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao iniciar disparo: ${error.message}`);
    },
  });

  const pauseCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.from('broadcast_campaigns')
        .update({ status: 'paused' }).eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha pausada');
    },
  });

  const resumeCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      await supabase.from('broadcast_campaigns').update({ status: 'processing' }).eq('id', campaignId);
      const { data, error } = await supabase.functions.invoke('broadcast-processor', {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha retomada!');
    },
  });

  const cancelCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.from('broadcast_campaigns')
        .update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha cancelada');
    },
  });

  const resetCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      // Reset all recipients to pending
      const { error: recipientsError } = await supabase
        .from('broadcast_recipients')
        .update({ status: 'pending', error_message: null, sent_at: null })
        .eq('campaign_id', campaignId);
      if (recipientsError) throw recipientsError;

      // Reset campaign counters
      const { error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .update({
          status: 'draft',
          sent_count: 0,
          failed_count: 0,
          started_at: null,
          completed_at: null,
          next_batch_at: null,
        })
        .eq('id', campaignId);
      if (campaignError) throw campaignError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-recipients'] });
      toast.success('Campanha resetada! Pronta para disparar novamente.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao resetar campanha: ${error.message}`);
    },
  });

  return {
    campaigns: campaignsQuery.data ?? [],
    isLoading: campaignsQuery.isLoading,
    createCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    resetCampaign,
  };
}