-- Table to track scraping jobs
CREATE TABLE public.scraping_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  fields TEXT[] NOT NULL DEFAULT ARRAY['name','phone'],
  contacts_found INTEGER NOT NULL DEFAULT 0,
  contacts_valid INTEGER NOT NULL DEFAULT 0,
  target_list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  error_message TEXT,
  result_data JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Public access (no auth in this project)
CREATE POLICY "Allow all access to scraping_jobs" ON public.scraping_jobs FOR ALL USING (true) WITH CHECK (true);

-- Index on status for polling
CREATE INDEX idx_scraping_jobs_status ON public.scraping_jobs(status);

-- Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_jobs;