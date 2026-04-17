-- Clean up stuck executions
UPDATE flow_executions 
SET status = 'failed', completed_at = now() 
WHERE status IN ('waiting', 'in_progress') 
AND started_at < now() - interval '1 hour';