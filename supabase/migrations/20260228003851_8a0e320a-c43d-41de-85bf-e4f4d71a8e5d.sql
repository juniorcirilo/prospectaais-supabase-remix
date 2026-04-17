
-- Contact lists
CREATE TABLE public.contact_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read lists" ON public.contact_lists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert lists" ON public.contact_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lists" ON public.contact_lists FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete lists" ON public.contact_lists FOR DELETE USING (true);

-- Contacts
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  company text DEFAULT '',
  city text DEFAULT '',
  status text NOT NULL DEFAULT 'novo',
  score integer NOT NULL DEFAULT 0,
  tags text[] DEFAULT '{}',
  list_id uuid REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  is_blacklisted boolean NOT NULL DEFAULT false,
  whatsapp_valid boolean DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert contacts" ON public.contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update contacts" ON public.contacts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete contacts" ON public.contacts FOR DELETE USING (true);

-- Index for phone deduplication
CREATE UNIQUE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_list ON public.contacts(list_id);
CREATE INDEX idx_contacts_status ON public.contacts(status);
