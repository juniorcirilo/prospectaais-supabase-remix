import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DispatchProfile {
  id: string;
  name: string;
  description: string;
  delay_min_s: number;
  delay_max_s: number;
  batch_size: number;
  pause_between_batches_min: number;
  pause_between_batches_max: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateProfileInput = Omit<DispatchProfile, 'id' | 'created_at' | 'updated_at' | 'is_default'>;

export function useDispatchProfiles() {
  const qc = useQueryClient();
  const key = ['dispatch-profiles'];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatch_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as DispatchProfile[];
    },
  });

  const createProfile = useMutation({
    mutationFn: async (input: CreateProfileInput) => {
      const { data, error } = await supabase.from('dispatch_profiles').insert(input).select().single();
      if (error) throw error;
      return data as unknown as DispatchProfile;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Perfil criado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DispatchProfile> & { id: string }) => {
      const { error } = await supabase.from('dispatch_profiles').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Perfil atualizado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dispatch_profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Perfil excluído!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return {
    profiles: query.data ?? [],
    isLoading: query.isLoading,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
