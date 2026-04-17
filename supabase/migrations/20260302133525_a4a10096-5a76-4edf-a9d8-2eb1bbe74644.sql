
ALTER TABLE public.broadcast_campaigns
ADD COLUMN media_urls text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN media_rotation_mode text NOT NULL DEFAULT 'random';
