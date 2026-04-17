-- Table to track processed webhook message IDs to prevent duplicates
CREATE TABLE IF NOT EXISTS webhook_message_dedup (
  message_id text PRIMARY KEY,
  phone text NOT NULL,
  flow_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-cleanup old entries (older than 24h) 
CREATE INDEX idx_webhook_dedup_created ON webhook_message_dedup (created_at);

-- RLS - only service role needs access (edge functions use service role key)
ALTER TABLE webhook_message_dedup ENABLE ROW LEVEL SECURITY;