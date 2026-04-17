import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useCallback } from "react";

export interface LeadSearch {
  id: string;
  name: string;
  source: string;
  config: any;
  status: string;
  target_list_id: string | null;
  contacts_found: number;
  contacts_new: number;
  contacts_enriched: number;
  result_data: any;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  enrich_step: string | null;
  enrich_cursor: number | null;
  enrich_run_id: string | null;
  enrich_heartbeat: string | null;
}

export function useLeadSearches() {
  const queryClient = useQueryClient();

  const searchesQuery = useQuery({
    queryKey: ["lead-searches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_searches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LeadSearch[];
    },
  });

  // Realtime — invalidate on any change to lead_searches
  useEffect(() => {
    const channel = supabase
      .channel("lead-searches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_searches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Also subscribe to lead_companies changes for enrichment detail updates
  useEffect(() => {
    const channel = supabase
      .channel("lead-companies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_companies" }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createSearch = useMutation({
    mutationFn: async (params: {
      name: string;
      source: string;
      config: any;
      target_list_id?: string | null;
      autoExecute?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("lead_searches")
        .insert({
          name: params.name,
          source: params.source,
          config: params.config,
          target_list_id: params.target_list_id || null,
          status: params.autoExecute ? "pending" : "draft",
        } as any)
        .select()
        .single();
      if (error) throw error;

      const search = data as unknown as LeadSearch;

      if (params.autoExecute) {
        supabase.functions
          .invoke("lead-search-execute", { body: { searchId: search.id } })
          .then((res) => {
            if (res.error) console.error("Lead search execution error:", res.error);
          });
      }

      return search;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Busca criada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const executeSearch = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("lead_searches").update({ status: "pending" } as any).eq("id", id);
      const { error } = await supabase.functions.invoke("lead-search-execute", { body: { searchId: id } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Busca iniciada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const updateSearch = useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      source: string;
      config: any;
      target_list_id?: string | null;
      autoExecute?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("lead_searches")
        .update({
          name: params.name,
          source: params.source,
          config: params.config,
          target_list_id: params.target_list_id || null,
          status: params.autoExecute ? "pending" : "draft",
        } as any)
        .eq("id", params.id)
        .select()
        .single();
      if (error) throw error;

      const search = data as unknown as LeadSearch;

      if (params.autoExecute) {
        supabase.functions
          .invoke("lead-search-execute", { body: { searchId: search.id } })
          .then((res) => {
            if (res.error) console.error("Lead search execution error:", res.error);
          });
      }

      return search;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Busca atualizada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const cloneSearch = useMutation({
    mutationFn: async (id: string) => {
      const original = searches.find((s) => s.id === id);
      if (!original) throw new Error("Busca não encontrada");
      const { data, error } = await supabase
        .from("lead_searches")
        .insert({
          name: `${original.name} (cópia)`,
          source: original.source,
          config: original.config,
          target_list_id: original.target_list_id,
          status: "draft",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LeadSearch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Busca clonada com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao clonar: ${err.message}`),
  });

  const deleteSearch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_searches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Busca removida");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const enrichSearch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("lead-enrich-ai", { body: { searchId: id } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Enriquecimento iniciado!");
    },
    onError: (err: Error) => toast.error(`Erro ao enriquecer: ${err.message}`),
  });

  // Resume enrichment from last checkpoint (same as enrich but explicitly for stale/stuck searches)
  const resumeEnrichment = useMutation({
    mutationFn: async (id: string) => {
      // Reset heartbeat to signal a fresh attempt, keep cursor/step intact
      await supabase.from("lead_searches").update({
        enrich_heartbeat: new Date().toISOString(),
      } as any).eq("id", id);
      const { error } = await supabase.functions.invoke("lead-enrich-ai", { body: { searchId: id } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-searches"] });
      toast.success("Enriquecimento retomado do último checkpoint!");
    },
    onError: (err: Error) => toast.error(`Erro ao retomar: ${err.message}`),
  });

  const searches = searchesQuery.data ?? [];
  const stats = {
    totalFound: searches.reduce((s, j) => s + j.contacts_found, 0),
    totalNew: searches.reduce((s, j) => s + j.contacts_new, 0),
    activeSearches: searches.filter((j) => j.status === "running" || j.status === "pending" || j.status === "enriching").length,
    totalSearches: searches.length,
  };

  // Helper to check if a search is stuck
  const isSearchStuck = useCallback((search: LeadSearch): boolean => {
    if (search.status !== "enriching") return false;
    if (!search.enrich_heartbeat) return true;
    return (Date.now() - new Date(search.enrich_heartbeat).getTime()) > 3 * 60 * 1000;
  }, []);

  return {
    searches, stats, isLoading: searchesQuery.isLoading,
    createSearch, updateSearch, executeSearch, cloneSearch, deleteSearch, enrichSearch, resumeEnrichment,
    isSearchStuck,
  };
}
