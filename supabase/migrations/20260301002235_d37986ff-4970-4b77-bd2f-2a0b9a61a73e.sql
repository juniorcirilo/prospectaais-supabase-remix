
ALTER TABLE public.broadcast_campaigns
ADD COLUMN voice_profile_id UUID REFERENCES public.voice_profiles(id) ON DELETE SET NULL;
