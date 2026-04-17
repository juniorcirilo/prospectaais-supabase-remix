
-- Flows table
CREATE TABLE public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  trigger_type text NOT NULL DEFAULT 'manual',
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flows" ON public.flows FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flows" ON public.flows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update flows" ON public.flows FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete flows" ON public.flows FOR DELETE USING (true);

-- Flow nodes table
CREATE TABLE public.flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'message',
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flow_nodes" ON public.flow_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flow_nodes" ON public.flow_nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update flow_nodes" ON public.flow_nodes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete flow_nodes" ON public.flow_nodes FOR DELETE USING (true);

-- Flow edges table
CREATE TABLE public.flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  source_handle text DEFAULT 'default',
  target_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flow_edges" ON public.flow_edges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flow_edges" ON public.flow_edges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update flow_edges" ON public.flow_edges FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete flow_edges" ON public.flow_edges FOR DELETE USING (true);

-- Flow executions table
CREATE TABLE public.flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  current_node_id uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flow_executions" ON public.flow_executions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flow_executions" ON public.flow_executions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update flow_executions" ON public.flow_executions FOR UPDATE USING (true);

-- Flow execution logs table
CREATE TABLE public.flow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.flow_executions(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flow_execution_logs" ON public.flow_execution_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert flow_execution_logs" ON public.flow_execution_logs FOR INSERT WITH CHECK (true);
