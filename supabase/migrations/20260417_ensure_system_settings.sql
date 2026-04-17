-- Ensure system_settings table exists with correct structure
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can insert system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can update system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Anon can read system_settings" ON public.system_settings;

-- Create policies
CREATE POLICY "Authenticated users can read system_settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert system_settings"
  ON public.system_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update system_settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read system_settings"
  ON public.system_settings FOR SELECT
  TO anon
  USING (true);

-- Ensure at least one row exists
INSERT INTO public.system_settings (registration_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
