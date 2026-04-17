import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  company: string;
  city: string;
  status: string;
  score: number;
  tags: string[];
  list_id: string | null;
  is_blacklisted: boolean;
  whatsapp_valid: boolean | null;
  custom_fields: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface ContactList {
  id: string;
  name: string;
  source: string;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export function useContacts(listId?: string | null) {
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ['contacts', listId],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (listId) query = query.eq('list_id', listId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Contact[];
    },
  });

  const listsQuery = useQuery({
    queryKey: ['contact-lists'],
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from('contact_lists')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get counts per list
      const { data: contacts } = await supabase
        .from('contacts')
        .select('list_id');

      const counts: Record<string, number> = {};
      (contacts || []).forEach((c: any) => {
        if (c.list_id) counts[c.list_id] = (counts[c.list_id] || 0) + 1;
      });

      return (lists || []).map((l: any) => ({
        ...l,
        contact_count: counts[l.id] || 0,
      })) as ContactList[];
    },
  });

  // Realtime for contacts and contact_lists
  useEffect(() => {
    const channel = supabase
      .channel("contacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_lists" }, () => {
        queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addContact = useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'is_blacklisted' | 'whatsapp_valid' | 'custom_fields'> & { custom_fields?: Record<string, string> | null }) => {
      const { data, error } = await supabase.from('contacts').insert(contact).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
      toast.success('Contato adicionado');
    },
    onError: (err: Error) => {
      if (err.message.includes('idx_contacts_phone')) {
        toast.error('Esse telefone já está cadastrado');
      } else {
        toast.error(`Erro: ${err.message}`);
      }
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { error } = await supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato atualizado');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
      toast.success('Contato removido');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const addList = useMutation({
    mutationFn: async (list: { name: string; source: string }) => {
      const { data, error } = await supabase.from('contact_lists').insert(list).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
      toast.success('Lista criada');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      // Unlink contacts from this list first
      await supabase.from('contacts').update({ list_id: null }).eq('list_id', id);
      const { error } = await supabase.from('contact_lists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Lista excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const importContacts = useMutation({
    mutationFn: async (contacts: Array<{ name: string; phone: string; company?: string; city?: string; tags?: string[]; list_id?: string; status?: string; custom_fields?: Record<string, string> }>) => {
      const rows = contacts.map(c => ({
        name: c.name || "Sem nome",
        phone: c.phone,
        company: c.company || "",
        city: c.city || "",
        status: c.status || "novo",
        score: 0,
        tags: c.tags || [],
        list_id: c.list_id || null,
        custom_fields: c.custom_fields || {},
      }));

      // Batch insert in chunks of 500
      const BATCH = 500;
      let total = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error } = await supabase.from('contacts').upsert(batch, { onConflict: 'phone' }).select();
        if (error) throw error;
        total += data?.length || 0;
      }
      return total;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-lists'] });
      toast.success(`${count} contatos importados`);
    },
    onError: (err: Error) => toast.error(`Erro na importação: ${err.message}`),
  });

  return {
    contacts: contactsQuery.data ?? [],
    lists: listsQuery.data ?? [],
    isLoading: contactsQuery.isLoading,
    listsLoading: listsQuery.isLoading,
    addContact,
    updateContact,
    deleteContact,
    addList,
    deleteList,
    importContacts,
    refetch: contactsQuery.refetch,
  };
}
