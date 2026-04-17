
-- Templates de mensagem com spintax e configuração de mídia
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  message_type TEXT NOT NULL DEFAULT 'text',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  media_rotation_enabled BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates" ON public.message_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert templates" ON public.message_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update templates" ON public.message_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete templates" ON public.message_templates FOR DELETE USING (true);
