
-- WhatsApp Instances
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'evolution_self_hosted' CHECK (provider_type IN ('official', 'evolution_self_hosted', 'evolution_cloud')),
  instance_id_external TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'connecting', 'disconnected', 'qr_required')),
  qr_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reply_to_groups BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instances" ON public.whatsapp_instances FOR SELECT USING (true);
CREATE POLICY "Users can insert instances" ON public.whatsapp_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update instances" ON public.whatsapp_instances FOR UPDATE USING (true);
CREATE POLICY "Users can delete instances" ON public.whatsapp_instances FOR DELETE USING (true);

-- WhatsApp Instance Secrets
CREATE TABLE public.whatsapp_instance_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  verify_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instance_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage secrets" ON public.whatsapp_instance_secrets FOR ALL USING (true);

-- Broadcast Campaigns
CREATE TABLE public.broadcast_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  instance_id UUID REFERENCES public.whatsapp_instances(id),
  delay_min_ms INTEGER NOT NULL DEFAULT 5000,
  delay_max_ms INTEGER NOT NULL DEFAULT 15000,
  batch_size INTEGER NOT NULL DEFAULT 10,
  delay_between_batches INTEGER NOT NULL DEFAULT 300,
  next_batch_at TIMESTAMPTZ,
  column_mapping JSONB DEFAULT '{}',
  custom_fields TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'paused', 'completed', 'failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their campaigns" ON public.broadcast_campaigns FOR SELECT USING (true);
CREATE POLICY "Users can insert campaigns" ON public.broadcast_campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update campaigns" ON public.broadcast_campaigns FOR UPDATE USING (true);
CREATE POLICY "Users can delete campaigns" ON public.broadcast_campaigns FOR DELETE USING (true);

-- Broadcast Recipients
CREATE TABLE public.broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients" ON public.broadcast_recipients FOR SELECT USING (true);
CREATE POLICY "Users can insert recipients" ON public.broadcast_recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update recipients" ON public.broadcast_recipients FOR UPDATE USING (true);

-- Enable realtime for broadcast_campaigns
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_campaigns;

-- Indexes
CREATE INDEX idx_whatsapp_instances_active ON public.whatsapp_instances(is_active);
CREATE INDEX idx_broadcast_recipients_campaign_status ON public.broadcast_recipients(campaign_id, status);
CREATE INDEX idx_broadcast_campaigns_status ON public.broadcast_campaigns(status);
