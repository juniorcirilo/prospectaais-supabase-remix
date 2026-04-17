
-- Pipeline stages table
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'border-slate-500',
  position INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_ai_managed BOOLEAN NOT NULL DEFAULT false,
  ai_trigger_criteria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline stages" ON public.pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pipeline stages" ON public.pipeline_stages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pipeline stages" ON public.pipeline_stages FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pipeline stages" ON public.pipeline_stages FOR DELETE USING (true);

-- Insert default stages
INSERT INTO public.pipeline_stages (title, color, position, is_system) VALUES
  ('Novo', 'border-slate-500', 0, true),
  ('Contato Feito', 'border-cyan-500', 1, false),
  ('Qualificado', 'border-violet-500', 2, false),
  ('Proposta Enviada', 'border-orange-500', 3, false),
  ('Negociação', 'border-blue-500', 4, false),
  ('Ganho', 'border-emerald-500', 5, true),
  ('Perdido', 'border-red-500', 6, true);

-- Deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  value NUMERIC NOT NULL DEFAULT 0,
  stage_id UUID REFERENCES public.pipeline_stages(id),
  priority TEXT NOT NULL DEFAULT 'medium',
  tags TEXT[] NOT NULL DEFAULT '{}',
  due_date DATE,
  owner_name TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  lost_reason TEXT,
  won_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deals" ON public.deals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deals" ON public.deals FOR DELETE USING (true);

-- Deal activities table
CREATE TABLE public.deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read deal activities" ON public.deal_activities FOR SELECT USING (true);
CREATE POLICY "Anyone can insert deal activities" ON public.deal_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update deal activities" ON public.deal_activities FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete deal activities" ON public.deal_activities FOR DELETE USING (true);

-- Enable realtime for deals and pipeline_stages
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
