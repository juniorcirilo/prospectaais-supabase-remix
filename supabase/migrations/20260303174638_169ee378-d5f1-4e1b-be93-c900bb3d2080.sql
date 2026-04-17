-- Add policy for service role access (belt and suspenders)
CREATE POLICY "Service can manage dedup" ON webhook_message_dedup FOR ALL USING (true) WITH CHECK (true);