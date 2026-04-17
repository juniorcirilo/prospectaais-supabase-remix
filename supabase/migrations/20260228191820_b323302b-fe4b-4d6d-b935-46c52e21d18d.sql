
CREATE TABLE public.voice_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  elevenlabs_voice_id TEXT NOT NULL DEFAULT '33B4UnXyTNbgLmdEDh5P',
  elevenlabs_model TEXT NOT NULL DEFAULT 'eleven_turbo_v2_5',
  stability NUMERIC NOT NULL DEFAULT 0.75,
  similarity_boost NUMERIC NOT NULL DEFAULT 0.8,
  speed NUMERIC NOT NULL DEFAULT 1.0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read voice profiles" ON public.voice_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert voice profiles" ON public.voice_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update voice profiles" ON public.voice_profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete voice profiles" ON public.voice_profiles FOR DELETE USING (true);
