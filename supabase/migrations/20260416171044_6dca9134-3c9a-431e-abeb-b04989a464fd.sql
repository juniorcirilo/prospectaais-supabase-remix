
-- =========================================================
-- P0 SECURITY FIX: Scope all data access to authenticated users
-- =========================================================

-- Helper: drop & recreate authenticated-only policies
-- We keep service_role implicit (bypasses RLS), so edge functions continue working.

-- ---------- contacts ----------
DROP POLICY IF EXISTS "Anyone can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can delete contacts" ON public.contacts;
CREATE POLICY "Authenticated read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);

-- ---------- contact_lists ----------
DROP POLICY IF EXISTS "Anyone can read lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Anyone can insert lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Anyone can update lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Anyone can delete lists" ON public.contact_lists;
CREATE POLICY "Authenticated read lists" ON public.contact_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert lists" ON public.contact_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update lists" ON public.contact_lists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete lists" ON public.contact_lists FOR DELETE TO authenticated USING (true);

-- ---------- conversation_messages ----------
DROP POLICY IF EXISTS "Anyone can read conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Anyone can insert conversation_messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Anyone can delete conversation_messages" ON public.conversation_messages;
CREATE POLICY "Authenticated read conversation_messages" ON public.conversation_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert conversation_messages" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete conversation_messages" ON public.conversation_messages FOR DELETE TO authenticated USING (true);

-- ---------- broadcast_campaigns ----------
DROP POLICY IF EXISTS "Users can view their campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can update campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Authenticated read campaigns" ON public.broadcast_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert campaigns" ON public.broadcast_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update campaigns" ON public.broadcast_campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete campaigns" ON public.broadcast_campaigns FOR DELETE TO authenticated USING (true);

-- ---------- broadcast_recipients ----------
DROP POLICY IF EXISTS "Users can view recipients" ON public.broadcast_recipients;
DROP POLICY IF EXISTS "Users can insert recipients" ON public.broadcast_recipients;
DROP POLICY IF EXISTS "Users can update recipients" ON public.broadcast_recipients;
CREATE POLICY "Authenticated read recipients" ON public.broadcast_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert recipients" ON public.broadcast_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update recipients" ON public.broadcast_recipients FOR UPDATE TO authenticated USING (true);

-- ---------- deals ----------
DROP POLICY IF EXISTS "Anyone can read deals" ON public.deals;
DROP POLICY IF EXISTS "Anyone can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Anyone can update deals" ON public.deals;
DROP POLICY IF EXISTS "Anyone can delete deals" ON public.deals;
CREATE POLICY "Authenticated read deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deals" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete deals" ON public.deals FOR DELETE TO authenticated USING (true);

-- ---------- deal_activities ----------
DROP POLICY IF EXISTS "Anyone can read deal activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Anyone can insert deal activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Anyone can update deal activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Anyone can delete deal activities" ON public.deal_activities;
CREATE POLICY "Authenticated read deal_activities" ON public.deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deal_activities" ON public.deal_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update deal_activities" ON public.deal_activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete deal_activities" ON public.deal_activities FOR DELETE TO authenticated USING (true);

-- ---------- pipeline_stages ----------
DROP POLICY IF EXISTS "Anyone can read pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Anyone can insert pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Anyone can update pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Anyone can delete pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Authenticated read pipeline_stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_stages" ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_stages" ON public.pipeline_stages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipeline_stages" ON public.pipeline_stages FOR DELETE TO authenticated USING (true);

-- ---------- flows / flow_nodes / flow_edges / flow_executions / flow_execution_logs ----------
DROP POLICY IF EXISTS "Anyone can read flows" ON public.flows;
DROP POLICY IF EXISTS "Anyone can insert flows" ON public.flows;
DROP POLICY IF EXISTS "Anyone can update flows" ON public.flows;
DROP POLICY IF EXISTS "Anyone can delete flows" ON public.flows;
CREATE POLICY "Authenticated read flows" ON public.flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flows" ON public.flows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flows" ON public.flows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flows" ON public.flows FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read flow_nodes" ON public.flow_nodes;
DROP POLICY IF EXISTS "Anyone can insert flow_nodes" ON public.flow_nodes;
DROP POLICY IF EXISTS "Anyone can update flow_nodes" ON public.flow_nodes;
DROP POLICY IF EXISTS "Anyone can delete flow_nodes" ON public.flow_nodes;
CREATE POLICY "Authenticated read flow_nodes" ON public.flow_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow_nodes" ON public.flow_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flow_nodes" ON public.flow_nodes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flow_nodes" ON public.flow_nodes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read flow_edges" ON public.flow_edges;
DROP POLICY IF EXISTS "Anyone can insert flow_edges" ON public.flow_edges;
DROP POLICY IF EXISTS "Anyone can update flow_edges" ON public.flow_edges;
DROP POLICY IF EXISTS "Anyone can delete flow_edges" ON public.flow_edges;
CREATE POLICY "Authenticated read flow_edges" ON public.flow_edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow_edges" ON public.flow_edges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flow_edges" ON public.flow_edges FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flow_edges" ON public.flow_edges FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read flow_executions" ON public.flow_executions;
DROP POLICY IF EXISTS "Anyone can insert flow_executions" ON public.flow_executions;
DROP POLICY IF EXISTS "Anyone can update flow_executions" ON public.flow_executions;
DROP POLICY IF EXISTS "Anyone can delete flow_executions" ON public.flow_executions;
CREATE POLICY "Authenticated read flow_executions" ON public.flow_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow_executions" ON public.flow_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update flow_executions" ON public.flow_executions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete flow_executions" ON public.flow_executions FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read flow_execution_logs" ON public.flow_execution_logs;
DROP POLICY IF EXISTS "Anyone can insert flow_execution_logs" ON public.flow_execution_logs;
DROP POLICY IF EXISTS "Anyone can delete flow_execution_logs" ON public.flow_execution_logs;
CREATE POLICY "Authenticated read flow_execution_logs" ON public.flow_execution_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert flow_execution_logs" ON public.flow_execution_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete flow_execution_logs" ON public.flow_execution_logs FOR DELETE TO authenticated USING (true);

-- ---------- followup_sequences / followup_steps / followup_enrollments / followup_logs ----------
DROP POLICY IF EXISTS "Anyone can read followup_sequences" ON public.followup_sequences;
DROP POLICY IF EXISTS "Anyone can insert followup_sequences" ON public.followup_sequences;
DROP POLICY IF EXISTS "Anyone can update followup_sequences" ON public.followup_sequences;
DROP POLICY IF EXISTS "Anyone can delete followup_sequences" ON public.followup_sequences;
CREATE POLICY "Authenticated read followup_sequences" ON public.followup_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert followup_sequences" ON public.followup_sequences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update followup_sequences" ON public.followup_sequences FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete followup_sequences" ON public.followup_sequences FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read followup_steps" ON public.followup_steps;
DROP POLICY IF EXISTS "Anyone can insert followup_steps" ON public.followup_steps;
DROP POLICY IF EXISTS "Anyone can update followup_steps" ON public.followup_steps;
DROP POLICY IF EXISTS "Anyone can delete followup_steps" ON public.followup_steps;
CREATE POLICY "Authenticated read followup_steps" ON public.followup_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert followup_steps" ON public.followup_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update followup_steps" ON public.followup_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete followup_steps" ON public.followup_steps FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read followup_enrollments" ON public.followup_enrollments;
DROP POLICY IF EXISTS "Anyone can insert followup_enrollments" ON public.followup_enrollments;
DROP POLICY IF EXISTS "Anyone can update followup_enrollments" ON public.followup_enrollments;
DROP POLICY IF EXISTS "Anyone can delete followup_enrollments" ON public.followup_enrollments;
CREATE POLICY "Authenticated read followup_enrollments" ON public.followup_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert followup_enrollments" ON public.followup_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update followup_enrollments" ON public.followup_enrollments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete followup_enrollments" ON public.followup_enrollments FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read followup_logs" ON public.followup_logs;
DROP POLICY IF EXISTS "Anyone can insert followup_logs" ON public.followup_logs;
CREATE POLICY "Authenticated read followup_logs" ON public.followup_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert followup_logs" ON public.followup_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ---------- lead_companies / lead_searches / scraping_jobs ----------
DROP POLICY IF EXISTS "Allow all access to lead_companies" ON public.lead_companies;
CREATE POLICY "Authenticated manage lead_companies" ON public.lead_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to lead_searches" ON public.lead_searches;
CREATE POLICY "Authenticated manage lead_searches" ON public.lead_searches FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to scraping_jobs" ON public.scraping_jobs;
CREATE POLICY "Authenticated manage scraping_jobs" ON public.scraping_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- message_templates ----------
DROP POLICY IF EXISTS "Anyone can read templates" ON public.message_templates;
DROP POLICY IF EXISTS "Anyone can insert templates" ON public.message_templates;
DROP POLICY IF EXISTS "Anyone can update templates" ON public.message_templates;
DROP POLICY IF EXISTS "Anyone can delete templates" ON public.message_templates;
CREATE POLICY "Authenticated read templates" ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert templates" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update templates" ON public.message_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete templates" ON public.message_templates FOR DELETE TO authenticated USING (true);

-- ---------- voice_profiles ----------
DROP POLICY IF EXISTS "Anyone can read voice profiles" ON public.voice_profiles;
DROP POLICY IF EXISTS "Anyone can insert voice profiles" ON public.voice_profiles;
DROP POLICY IF EXISTS "Anyone can update voice profiles" ON public.voice_profiles;
DROP POLICY IF EXISTS "Anyone can delete voice profiles" ON public.voice_profiles;
CREATE POLICY "Authenticated read voice_profiles" ON public.voice_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert voice_profiles" ON public.voice_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update voice_profiles" ON public.voice_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete voice_profiles" ON public.voice_profiles FOR DELETE TO authenticated USING (true);

-- ---------- dispatch_profiles ----------
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.dispatch_profiles;
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.dispatch_profiles;
DROP POLICY IF EXISTS "Anyone can update profiles" ON public.dispatch_profiles;
DROP POLICY IF EXISTS "Anyone can delete profiles" ON public.dispatch_profiles;
CREATE POLICY "Authenticated read dispatch_profiles" ON public.dispatch_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert dispatch_profiles" ON public.dispatch_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update dispatch_profiles" ON public.dispatch_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete dispatch_profiles" ON public.dispatch_profiles FOR DELETE TO authenticated USING (true);

-- ---------- whatsapp_instances ----------
DROP POLICY IF EXISTS "Users can view their own instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can insert instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can update instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Users can delete instances" ON public.whatsapp_instances;
CREATE POLICY "Authenticated read whatsapp_instances" ON public.whatsapp_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert whatsapp_instances" ON public.whatsapp_instances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update whatsapp_instances" ON public.whatsapp_instances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete whatsapp_instances" ON public.whatsapp_instances FOR DELETE TO authenticated USING (true);

-- ---------- whatsapp_instance_secrets (ADMIN ONLY) ----------
DROP POLICY IF EXISTS "Users can manage secrets" ON public.whatsapp_instance_secrets;
CREATE POLICY "Admins manage instance secrets" ON public.whatsapp_instance_secrets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- app_settings (ADMIN ONLY for credentials) ----------
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.app_settings;
CREATE POLICY "Admins read app_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert app_settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete app_settings" ON public.app_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- system_settings (keep anon read for login screen) ----------
-- Existing policies already restrict writes to authenticated; anon read is intentional for /auth toggle.
-- No changes needed.

-- ---------- webhook_message_dedup (service-only) ----------
DROP POLICY IF EXISTS "Service can manage dedup" ON public.webhook_message_dedup;
-- No policies = no access for anon/authenticated. service_role bypasses RLS automatically.
