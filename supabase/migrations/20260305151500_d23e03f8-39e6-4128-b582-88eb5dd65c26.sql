
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  content text NOT NULL DEFAULT '',
  media_url text,
  source text NOT NULL DEFAULT 'webhook',
  source_id text,
  instance_id uuid,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_msg_contact_dir_created ON public.conversation_messages (contact_id, direction, created_at DESC);
CREATE INDEX idx_conv_msg_message_id ON public.conversation_messages (message_id) WHERE message_id IS NOT NULL;

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversation_messages" ON public.conversation_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversation_messages" ON public.conversation_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete conversation_messages" ON public.conversation_messages FOR DELETE USING (true);
