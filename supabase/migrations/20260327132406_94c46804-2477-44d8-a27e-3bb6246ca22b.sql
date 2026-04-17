
CREATE OR REPLACE FUNCTION public.get_campaign_response_stats(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total integer;
  v_sent integer;
  v_failed integer;
  v_replied integer;
  v_result jsonb;
BEGIN
  -- Get total, sent, failed counts
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'sent'),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_sent, v_failed
  FROM broadcast_recipients
  WHERE campaign_id = p_campaign_id;

  -- Count recipients who got a reply (inbound message after sent_at)
  SELECT count(DISTINCT br.id)
  INTO v_replied
  FROM broadcast_recipients br
  JOIN contacts c ON c.phone = br.phone_number
  JOIN conversation_messages cm ON cm.contact_id = c.id
    AND cm.direction = 'inbound'
    AND cm.created_at > br.sent_at
  WHERE br.campaign_id = p_campaign_id
    AND br.status = 'sent'
    AND br.sent_at IS NOT NULL;

  v_result := jsonb_build_object(
    'total', v_total,
    'sent', v_sent,
    'failed', v_failed,
    'replied', v_replied
  );
  RETURN v_result;
END;
$$;
