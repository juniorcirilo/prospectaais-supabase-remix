import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  message_type: string;
  media_urls: string[];
  media_rotation_enabled: boolean;
  media_rotation_mode: string;
  is_ai_generated: boolean;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export type CreateTemplateInput = Pick<MessageTemplate, 'name' | 'content'> & Partial<Pick<MessageTemplate, 'category' | 'message_type' | 'media_urls' | 'media_rotation_enabled' | 'media_rotation_mode' | 'is_ai_generated' | 'tags'>>;

const KEY = ['message-templates'];

export function useMessageTemplates() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MessageTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data, error } = await supabase.from('message_templates').insert(input).select().single();
      if (error) throw error;
      return data as unknown as MessageTemplate;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Template criado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<MessageTemplate> & { id: string }) => {
      const { error } = await supabase.from('message_templates').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Template atualizado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Template excluído!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
