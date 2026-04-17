import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  elevenlabs_voice_id: string;
  elevenlabs_model: string;
  stability: number;
  similarity_boost: number;
  speed: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateVoiceProfileInput = Omit<VoiceProfile, 'id' | 'created_at' | 'updated_at' | 'is_default'>;

export function useVoiceProfiles() {
  const qc = useQueryClient();
  const key = ['voice-profiles'];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as VoiceProfile[];
    },
  });

  const createProfile = useMutation({
    mutationFn: async (input: CreateVoiceProfileInput) => {
      const { data, error } = await supabase.from('voice_profiles').insert(input).select().single();
      if (error) throw error;
      return data as unknown as VoiceProfile;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Perfil de voz criado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...input }: Partial<VoiceProfile> & { id: string }) => {
      const { error } = await supabase.from('voice_profiles').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Perfil atualizado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('voice_profiles').delete().eq('id', id);
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
