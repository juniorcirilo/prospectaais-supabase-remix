
-- followup_sequences
CREATE TABLE public.followup_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  trigger_type text NOT NULL DEFAULT 'no_reply',
  trigger_config jsonb NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}',
  send_window jsonb NOT NULL DEFAULT '{}',
  max_attempts integer NOT NULL DEFAULT 5,
  ttl_days integer NOT NULL DEFAULT 30,
  min_interval_hours integer NOT NULL DEFAULT 6,
  post_actions jsonb NOT NULL DEFAULT '{}',
  campaign_id uuid REFERENCES public.broadcast_campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read followup_sequences" ON public.followup_sequences FOR SELECT USING (true);
CREATE POLICY "Anyone can insert followup_sequences" ON public.followup_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update followup_sequences" ON public.followup_sequences FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete followup_sequences" ON public.followup_sequences FOR DELETE USING (true);

-- followup_steps
CREATE TABLE public.followup_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  delay_value integer NOT NULL DEFAULT 1,
  delay_unit text NOT NULL DEFAULT 'hours',
  delay_type text NOT NULL DEFAULT 'fixed',
  content_type text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  media_urls text[] NOT NULL DEFAULT '{}',
  voice_profile_id uuid REFERENCES public.voice_profiles(id) ON DELETE SET NULL,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ab_variants jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read followup_steps" ON public.followup_steps FOR SELECT USING (true);
CREATE POLICY "Anyone can insert followup_steps" ON public.followup_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update followup_steps" ON public.followup_steps FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete followup_steps" ON public.followup_steps FOR DELETE USING (true);

-- followup_enrollments
CREATE TABLE public.followup_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_send_at timestamptz,
  completed_at timestamptz,
  trigger_data jsonb NOT NULL DEFAULT '{}',
  variables jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.followup_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read followup_enrollments" ON public.followup_enrollments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert followup_enrollments" ON public.followup_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update followup_enrollments" ON public.followup_enrollments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete followup_enrollments" ON public.followup_enrollments FOR DELETE USING (true);

-- followup_logs
CREATE TABLE public.followup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.followup_enrollments(id) ON DELETE CASCADE,
  step_position integer NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'sent',
  reason text DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  message_id text
);

ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read followup_logs" ON public.followup_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert followup_logs" ON public.followup_logs FOR INSERT WITH CHECK (true);
