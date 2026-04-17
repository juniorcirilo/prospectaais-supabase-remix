
-- Tabela de perfis de disparo
CREATE TABLE public.dispatch_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  delay_min_s INTEGER NOT NULL DEFAULT 25,
  delay_max_s INTEGER NOT NULL DEFAULT 45,
  batch_size INTEGER NOT NULL DEFAULT 20,
  pause_between_batches_min INTEGER NOT NULL DEFAULT 10,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles" ON public.dispatch_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON public.dispatch_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON public.dispatch_profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete profiles" ON public.dispatch_profiles FOR DELETE USING (true);

-- Seed default profiles
INSERT INTO public.dispatch_profiles (name, description, delay_min_s, delay_max_s, batch_size, pause_between_batches_min, is_default) VALUES
  ('Conservador', '~60 msgs/dia — ideal para números novos', 50, 80, 15, 20, true),
  ('Moderado', '~120 msgs/dia — equilíbrio entre velocidade e segurança', 25, 45, 20, 10, true),
  ('Agressivo', '~250 msgs/dia — para números já aquecidos', 12, 28, 30, 5, true);

-- Adicionar colunas de rotação à tabela de campanhas
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS rotation_strategy TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS instance_ids UUID[] DEFAULT '{}';
