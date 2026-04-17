
-- Table for company data (avoids duplication across contacts)
CREATE TABLE public.lead_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id UUID REFERENCES public.lead_searches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  city TEXT,
  industry TEXT,
  description TEXT,
  services TEXT,
  linkedin_url TEXT,
  instagram TEXT,
  facebook TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  address TEXT,
  revenue TEXT,
  employees_count TEXT,
  founding_year TEXT,
  apollo_org_id TEXT,
  ai_summary TEXT,
  ai_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS (lead data is internal, no user auth required)
ALTER TABLE public.lead_companies ENABLE ROW LEVEL SECURITY;

-- Allow full access (no auth required for internal tool)
CREATE POLICY "Allow all access to lead_companies" ON public.lead_companies FOR ALL USING (true) WITH CHECK (true);

-- Add lead_company_id to contacts for optional FK
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_company_id UUID REFERENCES public.lead_companies(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX idx_lead_companies_search_id ON public.lead_companies(search_id);
CREATE INDEX idx_lead_companies_domain ON public.lead_companies(domain);
CREATE INDEX idx_lead_companies_apollo_org_id ON public.lead_companies(apollo_org_id);
CREATE INDEX idx_contacts_lead_company_id ON public.contacts(lead_company_id);
