-- Delete duplicate edges, keeping only one (c66f8e20)
DELETE FROM flow_edges WHERE id IN (
  '76c1be57-9fbf-4f28-8adb-5ee4551fdca6',
  'f2dc82a6-71b3-4b0b-9ea0-d204e47d5e62',
  '744a2ae5-50c4-4be7-a07c-419a3220be67',
  '1e6bdc57-addf-4358-9ff2-c34de3936703'
);

-- Add unique constraint to prevent duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS flow_edges_unique_connection 
ON flow_edges (flow_id, source_node_id, COALESCE(source_handle, ''), target_node_id);