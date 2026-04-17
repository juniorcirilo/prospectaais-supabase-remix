import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Flow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  type: string;
  position_x: number;
  position_y: number;
  config: Record<string, any>;
  created_at: string;
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  source_handle: string;
  target_node_id: string;
  created_at: string;
}

export function useFlows() {
  return useQuery({
    queryKey: ["flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flows")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Flow[];
    },
  });
}

export function useFlow(id: string | undefined) {
  return useQuery({
    queryKey: ["flows", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flows")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Flow;
    },
  });
}

export function useFlowNodes(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow_nodes", flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_nodes")
        .select("*")
        .eq("flow_id", flowId!);
      if (error) throw error;
      return data as FlowNode[];
    },
  });
}

export function useFlowEdges(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow_edges", flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_edges")
        .select("*")
        .eq("flow_id", flowId!);
      if (error) throw error;
      return data as FlowEdge[];
    },
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flow: { name: string; description?: string; trigger_type?: string }) => {
      const { data, error } = await supabase
        .from("flows")
        .insert(flow)
        .select()
        .single();
      if (error) throw error;
      return data as Flow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Fluxo criado com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Flow> & { id: string }) => {
      const { error } = await supabase
        .from("flows")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Fluxo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetFlowExecutions() {
  return useMutation({
    mutationFn: async (flowId: string) => {
      // Delete execution logs first (FK dependency)
      const { data: execs } = await supabase
        .from("flow_executions")
        .select("id")
        .eq("flow_id", flowId);
      
      if (execs && execs.length > 0) {
        const execIds = execs.map((e) => e.id);
        await supabase.from("flow_execution_logs").delete().in("execution_id", execIds);
        await supabase.from("flow_executions").delete().eq("flow_id", flowId);
      }

      // Also clean dedup entries for this flow
      await supabase.from("webhook_message_dedup").delete().eq("flow_id", flowId);
    },
    onSuccess: () => toast.success("Execuções resetadas! O fluxo pode ser testado novamente."),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveFlowCanvas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flowId,
      nodes,
      edges,
    }: {
      flowId: string;
      nodes: { id: string; type: string; position_x: number; position_y: number; config: Record<string, any> }[];
      edges: { id: string; source_node_id: string; source_handle: string; target_node_id: string }[];
    }) => {
      // Delete old nodes and edges then re-insert
      await supabase.from("flow_edges").delete().eq("flow_id", flowId);
      await supabase.from("flow_nodes").delete().eq("flow_id", flowId);

      if (nodes.length > 0) {
        const nodesToInsert = nodes.map((n) => ({ ...n, flow_id: flowId }));
        console.log("[useSaveFlowCanvas] Saving nodes configs:", nodesToInsert.map(n => ({ id: n.id, type: n.type, config: n.config })));
        const { error: nErr } = await supabase
          .from("flow_nodes")
          .insert(nodesToInsert);
        if (nErr) throw nErr;
      }

      if (edges.length > 0) {
        const { error: eErr } = await supabase
          .from("flow_edges")
          .insert(edges.map((e) => ({ ...e, flow_id: flowId })));
        if (eErr) throw eErr;
      }

      await supabase
        .from("flows")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", flowId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["flow_nodes", vars.flowId] });
      qc.invalidateQueries({ queryKey: ["flow_edges", vars.flowId] });
      toast.success("Fluxo salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
