
-- Add enrichment progress tracking columns to lead_searches
ALTER TABLE public.lead_searches 
  ADD COLUMN IF NOT EXISTS enrich_step text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrich_cursor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_run_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enrich_heartbeat timestamp with time zone DEFAULT NULL;
