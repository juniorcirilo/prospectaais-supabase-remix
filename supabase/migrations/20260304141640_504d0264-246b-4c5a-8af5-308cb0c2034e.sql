
CREATE POLICY "Anyone can delete flow_executions" ON public.flow_executions FOR DELETE USING (true);
CREATE POLICY "Anyone can delete flow_execution_logs" ON public.flow_execution_logs FOR DELETE USING (true);
