import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface ScrapingJob {
  id: string;
  url: string;
  status: string;
  fields: string[];
  contacts_found: number;
  contacts_valid: number;
  target_list_id: string | null;
  error_message: string | null;
  result_data: any;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export function useScrapingJobs() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["scraping-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraping_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ScrapingJob[];
    },
  });

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("scraping-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scraping_jobs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const startJob = useMutation({
    mutationFn: async (params: {
      url: string;
      fields: string[];
      target_list_id?: string | null;
    }) => {
      // 1. Create job record
      const { data: job, error: createErr } = await supabase
        .from("scraping_jobs")
        .insert({
          url: params.url,
          fields: params.fields,
          target_list_id: params.target_list_id || null,
          status: "pending",
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // 2. Invoke edge function (fire and forget)
      supabase.functions
        .invoke("scraping-execute", { body: { jobId: (job as any).id } })
        .then((res) => {
          if (res.error) {
            console.error("Scraping execution error:", res.error);
          }
        });

      return job as unknown as ScrapingJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] });
      toast.success("Coleta iniciada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scraping_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] });
      toast.success("Coleta removida");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const jobs = jobsQuery.data ?? [];
  const stats = {
    totalCollected: jobs.reduce((s, j) => s + j.contacts_found, 0),
    totalValid: jobs.reduce((s, j) => s + j.contacts_valid, 0),
    activeJobs: jobs.filter((j) => j.status === "running" || j.status === "pending").length,
    scheduledJobs: jobs.filter((j) => j.status === "scheduled").length,
  };

  return {
    jobs,
    stats,
    isLoading: jobsQuery.isLoading,
    startJob,
    deleteJob,
    refetch: jobsQuery.refetch,
  };
}
