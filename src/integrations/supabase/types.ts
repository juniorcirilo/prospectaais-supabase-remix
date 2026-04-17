export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      broadcast_campaigns: {
        Row: {
          batch_size: number
          column_mapping: Json | null
          completed_at: string | null
          created_at: string
          custom_fields: string[] | null
          delay_between_batches: number
          delay_between_batches_max: number
          delay_max_ms: number
          delay_min_ms: number
          failed_count: number
          flow_id: string | null
          id: string
          instance_id: string | null
          instance_ids: string[] | null
          media_rotation_mode: string
          media_url: string | null
          media_urls: string[]
          message_template: string
          message_type: string
          name: string
          next_batch_at: string | null
          rotation_strategy: string
          sent_count: number
          started_at: string | null
          status: string
          total_recipients: number
          updated_at: string
          user_id: string
          voice_profile_id: string | null
        }
        Insert: {
          batch_size?: number
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          custom_fields?: string[] | null
          delay_between_batches?: number
          delay_between_batches_max?: number
          delay_max_ms?: number
          delay_min_ms?: number
          failed_count?: number
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          instance_ids?: string[] | null
          media_rotation_mode?: string
          media_url?: string | null
          media_urls?: string[]
          message_template: string
          message_type?: string
          name: string
          next_batch_at?: string | null
          rotation_strategy?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
          user_id: string
          voice_profile_id?: string | null
        }
        Update: {
          batch_size?: number
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          custom_fields?: string[] | null
          delay_between_batches?: number
          delay_between_batches_max?: number
          delay_max_ms?: number
          delay_min_ms?: number
          failed_count?: number
          flow_id?: string | null
          id?: string
          instance_id?: string | null
          instance_ids?: string[] | null
          media_rotation_mode?: string
          media_url?: string | null
          media_urls?: string[]
          message_template?: string
          message_type?: string
          name?: string
          next_batch_at?: string | null
          rotation_strategy?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
          user_id?: string
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          phone_number: string
          sent_at: string | null
          sent_media_url: string | null
          status: string
          variables: Json | null
          variation_indices: number[] | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number: string
          sent_at?: string | null
          sent_media_url?: string | null
          status?: string
          variables?: Json | null
          variation_indices?: number[] | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number?: string
          sent_at?: string | null
          sent_media_url?: string | null
          status?: string
          variables?: Json | null
          variation_indices?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          city: string | null
          company: string | null
          created_at: string
          custom_fields: Json
          id: string
          is_blacklisted: boolean
          lead_company_id: string | null
          list_id: string | null
          name: string
          phone: string
          score: number
          status: string
          tags: string[] | null
          updated_at: string
          whatsapp_valid: boolean | null
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          is_blacklisted?: boolean
          lead_company_id?: string | null
          list_id?: string | null
          name: string
          phone: string
          score?: number
          status?: string
          tags?: string[] | null
          updated_at?: string
          whatsapp_valid?: boolean | null
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          is_blacklisted?: boolean
          lead_company_id?: string | null
          list_id?: string | null
          name?: string
          phone?: string
          score?: number
          status?: string
          tags?: string[] | null
          updated_at?: string
          whatsapp_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "lead_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          direction: string
          id: string
          instance_id: string | null
          media_url: string | null
          message_id: string | null
          source: string
          source_id: string | null
        }
        Insert: {
          contact_id: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string | null
          media_url?: string | null
          message_id?: string | null
          source?: string
          source_id?: string | null
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string | null
          media_url?: string | null
          message_id?: string | null
          source?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          completed_at: string | null
          created_at: string
          deal_id: string
          description: string | null
          id: string
          is_completed: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          id?: string
          is_completed?: boolean
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          due_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          owner_name: string | null
          priority: string
          stage_id: string | null
          tags: string[]
          title: string
          updated_at: string
          value: number
          won_at: string | null
        }
        Insert: {
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_name?: string | null
          priority?: string
          stage_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          value?: number
          won_at?: string | null
        }
        Update: {
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_name?: string | null
          priority?: string
          stage_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          value?: number
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_profiles: {
        Row: {
          batch_size: number
          created_at: string
          delay_max_s: number
          delay_min_s: number
          description: string | null
          id: string
          is_default: boolean
          name: string
          pause_between_batches_max: number
          pause_between_batches_min: number
          updated_at: string
        }
        Insert: {
          batch_size?: number
          created_at?: string
          delay_max_s?: number
          delay_min_s?: number
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          pause_between_batches_max?: number
          pause_between_batches_min?: number
          updated_at?: string
        }
        Update: {
          batch_size?: number
          created_at?: string
          delay_max_s?: number
          delay_min_s?: number
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          pause_between_batches_max?: number
          pause_between_batches_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      flow_edges: {
        Row: {
          created_at: string
          flow_id: string
          id: string
          source_handle: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          id?: string
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          id?: string
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_execution_logs: {
        Row: {
          action: string
          created_at: string
          execution_id: string
          id: string
          node_id: string | null
          result: Json
        }
        Insert: {
          action?: string
          created_at?: string
          execution_id: string
          id?: string
          node_id?: string | null
          result?: Json
        }
        Update: {
          action?: string
          created_at?: string
          execution_id?: string
          id?: string
          node_id?: string | null
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "flow_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_execution_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          current_node_id: string | null
          flow_id: string
          id: string
          started_at: string
          status: string
          variables: Json
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          current_node_id?: string | null
          flow_id: string
          id?: string
          started_at?: string
          status?: string
          variables?: Json
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          current_node_id?: string | null
          flow_id?: string
          id?: string
          started_at?: string
          status?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          position_x: number
          position_y: number
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          position_x?: number
          position_y?: number
          type?: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          position_x?: number
          position_y?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          current_step: number
          enrolled_at: string
          id: string
          next_send_at: string | null
          sequence_id: string
          status: string
          trigger_data: Json
          variables: Json
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id: string
          status?: string
          trigger_data?: Json
          variables?: Json
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id?: string
          status?: string
          trigger_data?: Json
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "followup_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_logs: {
        Row: {
          action: string
          enrollment_id: string
          id: string
          message_id: string | null
          reason: string | null
          sent_at: string
          step_position: number
        }
        Insert: {
          action?: string
          enrollment_id: string
          id?: string
          message_id?: string | null
          reason?: string | null
          sent_at?: string
          step_position?: number
        }
        Update: {
          action?: string
          enrollment_id?: string
          id?: string
          message_id?: string | null
          reason?: string | null
          sent_at?: string
          step_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "followup_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "followup_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_sequences: {
        Row: {
          campaign_id: string | null
          created_at: string
          description: string | null
          filters: Json
          flow_id: string | null
          id: string
          max_attempts: number
          min_interval_hours: number
          name: string
          on_reply_behavior: string
          post_actions: Json
          send_window: Json
          status: string
          timezone: string
          trigger_config: Json
          trigger_type: string
          ttl_days: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          filters?: Json
          flow_id?: string | null
          id?: string
          max_attempts?: number
          min_interval_hours?: number
          name: string
          on_reply_behavior?: string
          post_actions?: Json
          send_window?: Json
          status?: string
          timezone?: string
          trigger_config?: Json
          trigger_type?: string
          ttl_days?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          filters?: Json
          flow_id?: string | null
          id?: string
          max_attempts?: number
          min_interval_hours?: number
          name?: string
          on_reply_behavior?: string
          post_actions?: Json
          send_window?: Json
          status?: string
          timezone?: string
          trigger_config?: Json
          trigger_type?: string
          ttl_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_sequences_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_steps: {
        Row: {
          ab_variants: Json
          content: string
          content_type: string
          created_at: string
          delay_type: string
          delay_unit: string
          delay_value: number
          id: string
          instance_id: string | null
          media_urls: string[]
          position: number
          sequence_id: string
          updated_at: string
          voice_profile_id: string | null
        }
        Insert: {
          ab_variants?: Json
          content?: string
          content_type?: string
          created_at?: string
          delay_type?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          instance_id?: string | null
          media_urls?: string[]
          position?: number
          sequence_id: string
          updated_at?: string
          voice_profile_id?: string | null
        }
        Update: {
          ab_variants?: Json
          content?: string
          content_type?: string
          created_at?: string
          delay_type?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          instance_id?: string | null
          media_urls?: string[]
          position?: number
          sequence_id?: string
          updated_at?: string
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_steps_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_steps_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_companies: {
        Row: {
          address: string | null
          ai_score: number | null
          ai_summary: string | null
          apollo_org_id: string | null
          city: string | null
          created_at: string
          description: string | null
          domain: string | null
          email: string | null
          employees_count: string | null
          facebook: string | null
          founding_year: string | null
          id: string
          industry: string | null
          instagram: string | null
          linkedin_url: string | null
          name: string
          phone: string | null
          revenue: string | null
          search_id: string | null
          services: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          apollo_org_id?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          email?: string | null
          employees_count?: string | null
          facebook?: string | null
          founding_year?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          linkedin_url?: string | null
          name: string
          phone?: string | null
          revenue?: string | null
          search_id?: string | null
          services?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          apollo_org_id?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          email?: string | null
          employees_count?: string | null
          facebook?: string | null
          founding_year?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          revenue?: string | null
          search_id?: string | null
          services?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_companies_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          completed_at: string | null
          config: Json
          contacts_enriched: number
          contacts_found: number
          contacts_new: number
          created_at: string
          duration_ms: number | null
          enrich_cursor: number | null
          enrich_heartbeat: string | null
          enrich_run_id: string | null
          enrich_step: string | null
          error_message: string | null
          id: string
          name: string
          result_data: Json | null
          source: string
          started_at: string | null
          status: string
          target_list_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          contacts_enriched?: number
          contacts_found?: number
          contacts_new?: number
          created_at?: string
          duration_ms?: number | null
          enrich_cursor?: number | null
          enrich_heartbeat?: string | null
          enrich_run_id?: string | null
          enrich_step?: string | null
          error_message?: string | null
          id?: string
          name?: string
          result_data?: Json | null
          source?: string
          started_at?: string | null
          status?: string
          target_list_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          contacts_enriched?: number
          contacts_found?: number
          contacts_new?: number
          created_at?: string
          duration_ms?: number | null
          enrich_cursor?: number | null
          enrich_heartbeat?: string | null
          enrich_run_id?: string | null
          enrich_step?: string | null
          error_message?: string | null
          id?: string
          name?: string
          result_data?: Json | null
          source?: string
          started_at?: string | null
          status?: string
          target_list_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_searches_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_ai_generated: boolean
          media_rotation_enabled: boolean
          media_rotation_mode: string
          media_urls: string[]
          message_type: string
          name: string
          tags: string[]
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          media_rotation_enabled?: boolean
          media_rotation_mode?: string
          media_urls?: string[]
          message_type?: string
          name: string
          tags?: string[]
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          media_rotation_enabled?: boolean
          media_rotation_mode?: string
          media_urls?: string[]
          message_type?: string
          name?: string
          tags?: string[]
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          ai_trigger_criteria: string | null
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_ai_managed: boolean
          is_system: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          ai_trigger_criteria?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_ai_managed?: boolean
          is_system?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          ai_trigger_criteria?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_ai_managed?: boolean
          is_system?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraping_jobs: {
        Row: {
          completed_at: string | null
          contacts_found: number
          contacts_valid: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          fields: string[]
          id: string
          result_data: Json | null
          started_at: string | null
          status: string
          target_list_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          completed_at?: string | null
          contacts_found?: number
          contacts_valid?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fields?: string[]
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          target_list_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          completed_at?: string | null
          contacts_found?: number
          contacts_valid?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fields?: string[]
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          target_list_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraping_jobs_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          registration_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_profiles: {
        Row: {
          created_at: string
          description: string | null
          elevenlabs_model: string
          elevenlabs_voice_id: string
          id: string
          is_default: boolean
          name: string
          similarity_boost: number
          speed: number
          stability: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          elevenlabs_model?: string
          elevenlabs_voice_id?: string
          id?: string
          is_default?: boolean
          name: string
          similarity_boost?: number
          speed?: number
          stability?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          elevenlabs_model?: string
          elevenlabs_voice_id?: string
          id?: string
          is_default?: boolean
          name?: string
          similarity_boost?: number
          speed?: number
          stability?: number
          updated_at?: string
        }
        Relationships: []
      }
      webhook_message_dedup: {
        Row: {
          created_at: string
          flow_id: string
          message_id: string
          phone: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          message_id: string
          phone: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          message_id?: string
          phone?: string
        }
        Relationships: []
      }
      whatsapp_instance_secrets: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_id: string
          updated_at: string
          verify_token: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_id: string
          updated_at?: string
          verify_token?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_id?: string
          updated_at?: string
          verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_secrets_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          instance_id_external: string | null
          instance_name: string
          is_active: boolean
          is_default: boolean
          metadata: Json | null
          name: string
          phone_number: string | null
          provider_type: string
          qr_code: string | null
          reply_to_groups: boolean
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id_external?: string | null
          instance_name: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json | null
          name: string
          phone_number?: string | null
          provider_type?: string
          qr_code?: string | null
          reply_to_groups?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id_external?: string | null
          instance_name?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          provider_type?: string
          qr_code?: string | null
          reply_to_groups?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_campaign_response_stats: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      upsert_lead_contact: {
        Args: {
          p_city?: string
          p_company?: string
          p_custom_fields?: Json
          p_list_id?: string
          p_name: string
          p_phone: string
          p_score?: number
          p_tags?: string[]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
