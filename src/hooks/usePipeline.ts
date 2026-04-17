import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PipelineStage {
  id: string;
  title: string;
  color: string;
  position: number;
  is_system: boolean;
  is_active: boolean;
  is_ai_managed: boolean;
  ai_trigger_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stage_id: string | null;
  priority: string;
  tags: string[];
  due_date: string | null;
  owner_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  type: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline_stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as PipelineStage[];
    },
  });
}

export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });
}

export function useDealActivities(dealId: string | null) {
  return useQuery({
    queryKey: ["deal_activities", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from("deal_activities")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealActivity[];
    },
    enabled: !!dealId,
  });
}

export function usePipelineMutations() {
  const qc = useQueryClient();

  const createDeal = useMutation({
    mutationFn: async (deal: Partial<Deal>) => {
      const { data, error } = await supabase.from("deals").insert(deal as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar deal"),
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Deal>) => {
      const { error } = await supabase.from("deals").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal removido");
    },
  });

  const createStage = useMutation({
    mutationFn: async (stage: Partial<PipelineStage>) => {
      // Get max position
      const { data: existing } = await supabase
        .from("pipeline_stages")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      const maxPos = existing?.[0]?.position ?? -1;
      const { error } = await supabase
        .from("pipeline_stages")
        .insert({ ...stage, position: maxPos + 1 } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
      toast.success("Etapa criada");
    },
    onError: () => toast.error("Erro ao criar etapa"),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PipelineStage>) => {
      const { error } = await supabase.from("pipeline_stages").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
      toast.success("Etapa atualizada");
    },
  });

  const deleteStage = useMutation({
    mutationFn: async ({ stageId, moveToStageId }: { stageId: string; moveToStageId?: string }) => {
      if (moveToStageId) {
        await supabase.from("deals").update({ stage_id: moveToStageId }).eq("stage_id", stageId);
      }
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Etapa removida");
    },
  });

  const reorderStages = useMutation({
    mutationFn: async (stageIds: string[]) => {
      const updates = stageIds.map((id, index) =>
        supabase.from("pipeline_stages").update({ position: index }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_stages"] }),
  });

  const createActivity = useMutation({
    mutationFn: async (activity: Partial<DealActivity>) => {
      const { error } = await supabase.from("deal_activities").insert(activity as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_activities"] });
      toast.success("Atividade criada");
    },
  });

  const updateActivity = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DealActivity>) => {
      const { error } = await supabase.from("deal_activities").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal_activities"] }),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal_activities"] });
      toast.success("Atividade excluída");
    },
  });

  return {
    createDeal, updateDeal, deleteDeal,
    createStage, updateStage, deleteStage, reorderStages,
    createActivity, updateActivity, deleteActivity,
  };
}
