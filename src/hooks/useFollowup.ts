import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FollowupSequence {
  id: string;
  name: string;
  description: string;
  status: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  filters: Record<string, any>;
  send_window: Record<string, any>;
  on_reply_behavior: string;
  max_attempts: number;
  ttl_days: number;
  min_interval_hours: number;
  post_actions: Record<string, any>;
  campaign_id: string | null;
  flow_id: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupStep {
  id: string;
  sequence_id: string;
  position: number;
  delay_value: number;
  delay_unit: string;
  delay_type: string;
  content_type: string;
  content: string;
  media_urls: string[];
  voice_profile_id: string | null;
  instance_id: string | null;
  ab_variants: any[];
  created_at: string;
  updated_at: string;
}

export interface FollowupEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  next_send_at: string | null;
  completed_at: string | null;
  trigger_data: Record<string, any>;
  variables: Record<string, any>;
}

export interface FollowupLog {
  id: string;
  enrollment_id: string;
  step_position: number;
  action: string;
  reason: string;
  sent_at: string;
  message_id: string | null;
}

export function useFollowupSequences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["followup_sequences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followup_sequences" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FollowupSequence[];
    },
  });

  const createSequence = useMutation({
    mutationFn: async (seq: Partial<FollowupSequence>) => {
      const { data, error } = await supabase
        .from("followup_sequences" as any)
        .insert(seq as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FollowupSequence;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup_sequences"] });
      toast.success("Sequência criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSequence = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FollowupSequence> & { id: string }) => {
      const { error } = await supabase
        .from("followup_sequences" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup_sequences"] });
      toast.success("Sequência atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSequence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("followup_sequences" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup_sequences"] });
      toast.success("Sequência removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, createSequence, updateSequence, deleteSequence };
}

export function useFollowupSteps(sequenceId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["followup_steps", sequenceId],
    enabled: !!sequenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followup_steps" as any)
        .select("*")
        .eq("sequence_id", sequenceId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FollowupStep[];
    },
  });

  const upsertSteps = useMutation({
    mutationFn: async (steps: Partial<FollowupStep>[]) => {
      // delete existing then insert fresh
      if (sequenceId) {
        await supabase.from("followup_steps" as any).delete().eq("sequence_id", sequenceId);
      }
      if (steps.length > 0) {
        const { error } = await supabase.from("followup_steps" as any).insert(steps as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup_steps", sequenceId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, upsertSteps };
}

export function useFollowupEnrollments(sequenceId?: string) {
  return useQuery({
    queryKey: ["followup_enrollments", sequenceId],
    queryFn: async () => {
      let q = supabase.from("followup_enrollments" as any).select("*").order("enrolled_at", { ascending: false });
      if (sequenceId) q = q.eq("sequence_id", sequenceId);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data || []) as unknown as FollowupEnrollment[];
    },
  });
}

export function useFollowupLogs(filters?: { sequenceId?: string; action?: string }) {
  return useQuery({
    queryKey: ["followup_logs", filters],
    queryFn: async () => {
      let q = supabase.from("followup_logs" as any).select("*, followup_enrollments!inner(sequence_id, contact_id)").order("sent_at", { ascending: false });
      if (filters?.sequenceId) {
        q = q.eq("followup_enrollments.sequence_id", filters.sequenceId);
      }
      if (filters?.action) {
        q = q.eq("action", filters.action);
      }
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data || []) as unknown as (FollowupLog & { followup_enrollments: { sequence_id: string; contact_id: string } })[];
    },
  });
}
