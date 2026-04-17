import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ProviderType = 'official' | 'evolution_self_hosted' | 'evolution_cloud';
export type InstanceStatus = 'connected' | 'connecting' | 'disconnected' | 'qr_required';

export interface WhatsAppInstance {
  id: string;
  user_id: string | null;
  name: string;
  instance_name: string;
  provider_type: ProviderType;
  instance_id_external: string | null;
  phone_number: string | null;
  status: InstanceStatus;
  qr_code: string | null;
  is_default: boolean;
  is_active: boolean;
  reply_to_groups: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppInstances() {
  const queryClient = useQueryClient();

  const instancesQuery = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as WhatsAppInstance[];
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('delete-evolution-instance', {
        body: { instance_id: id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao remover instância');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância removida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const setDefaultInstance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância padrão definida');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    instances: instancesQuery.data ?? [],
    isLoading: instancesQuery.isLoading,
    error: instancesQuery.error,
    refetch: instancesQuery.refetch,
    deleteInstance,
    setDefaultInstance,
  };
}