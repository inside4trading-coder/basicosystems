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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string | null
          field_changed: string | null
          id: string
          instance_id: string | null
          new_value: string | null
          obligation_id: string | null
          old_value: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          instance_id?: string | null
          new_value?: string | null
          obligation_id?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          instance_id?: string | null
          new_value?: string | null
          obligation_id?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "admin_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "admin_instances_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_config: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          id: string
          sort_order: number | null
          value: string
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          value: string
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      admin_instances: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          due_date: string
          id: string
          notes: string | null
          obligation_id: string | null
          paid_at: string | null
          paid_by: string | null
          payment_proof_url: string[] | null
          payment_reference: string | null
          period_label: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          due_date: string
          id?: string
          notes?: string | null
          obligation_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_proof_url?: string[] | null
          payment_reference?: string | null
          period_label: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          obligation_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_proof_url?: string[] | null
          payment_reference?: string | null
          period_label?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_instances_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_obligations: {
        Row: {
          amount: number | null
          category: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_day: number | null
          frequency: string
          id: string
          importance: string
          name: string
          notes: string | null
          payment_method: string | null
          provider: string | null
          responsible: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_day?: number | null
          frequency: string
          id?: string
          importance?: string
          name: string
          notes?: string | null
          payment_method?: string | null
          provider?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_day?: number | null
          frequency?: string
          id?: string
          importance?: string
          name?: string
          notes?: string | null
          payment_method?: string | null
          provider?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calls_cache: {
        Row: {
          agent_name: string | null
          call_end: string | null
          call_id: string | null
          call_start: string | null
          caller: string | null
          cost: number | null
          destination: string | null
          direction: string | null
          duration: number | null
          id: string
          is_recorded: boolean | null
          pbx_call_id: string | null
          raw_data: Json | null
          recording_url: string | null
          sip: string | null
          status: string | null
          synced_at: string | null
          talk_duration: number | null
        }
        Insert: {
          agent_name?: string | null
          call_end?: string | null
          call_id?: string | null
          call_start?: string | null
          caller?: string | null
          cost?: number | null
          destination?: string | null
          direction?: string | null
          duration?: number | null
          id?: string
          is_recorded?: boolean | null
          pbx_call_id?: string | null
          raw_data?: Json | null
          recording_url?: string | null
          sip?: string | null
          status?: string | null
          synced_at?: string | null
          talk_duration?: number | null
        }
        Update: {
          agent_name?: string | null
          call_end?: string | null
          call_id?: string | null
          call_start?: string | null
          caller?: string | null
          cost?: number | null
          destination?: string | null
          direction?: string | null
          duration?: number | null
          id?: string
          is_recorded?: boolean | null
          pbx_call_id?: string | null
          raw_data?: Json | null
          recording_url?: string | null
          sip?: string | null
          status?: string | null
          synced_at?: string | null
          talk_duration?: number | null
        }
        Relationships: []
      }
      campaign_stats: {
        Row: {
          campaign_id: string
          click_rate: number | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_sent: number | null
          emails_unsubscribed: number | null
          id: string
          open_rate: number | null
          recorded_at: string | null
        }
        Insert: {
          campaign_id: string
          click_rate?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          id?: string
          open_rate?: number | null
          recorded_at?: string | null
        }
        Update: {
          campaign_id?: string
          click_rate?: number | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          id?: string
          open_rate?: number | null
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brevo_campaign_id: number | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          recipient_count: number | null
          scheduled_at: string | null
          segment_filter: Json | null
          segment_id: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          stats_json: Json | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          brevo_campaign_id?: number | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_filter?: Json | null
          segment_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          stats_json?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          brevo_campaign_id?: number | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_filter?: Json | null
          segment_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          stats_json?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      core_audit_logs: {
        Row: {
          action: string
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      core_cost_structure_items: {
        Row: {
          adds_to_payroll: boolean
          cost_snapshot: Json | null
          cost_structure_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          item_type: string | null
          name: string
          notes: string | null
          process_name: string | null
          process_order: number | null
          quantity: number
          raw_material_id: string | null
          section: string
          sort_order: number
          subtotal: number
          suggested_role: string | null
          supplier: string | null
          unit_cost: number
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          adds_to_payroll?: boolean
          cost_snapshot?: Json | null
          cost_structure_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          item_type?: string | null
          name: string
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          quantity?: number
          raw_material_id?: string | null
          section: string
          sort_order?: number
          subtotal?: number
          suggested_role?: string | null
          supplier?: string | null
          unit_cost?: number
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          adds_to_payroll?: boolean
          cost_snapshot?: Json | null
          cost_structure_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          item_type?: string | null
          name?: string
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          quantity?: number
          raw_material_id?: string | null
          section?: string
          sort_order?: number
          subtotal?: number
          suggested_role?: string | null
          supplier?: string | null
          unit_cost?: number
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_cost_structure_items_cost_structure_id_fkey"
            columns: ["cost_structure_id"]
            isOneToOne: false
            referencedRelation: "core_cost_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_cost_structure_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "core_raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      core_cost_structures: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_gross_margin: number | null
          estimated_gross_margin_percent: number | null
          estimated_sale_price: number | null
          id: string
          name: string
          notes: string | null
          product_type: string | null
          sku: string | null
          status: string
          suggested_fabrication_fund: number
          total_labor: number
          total_logistics: number
          total_other_costs: number
          total_packaging: number
          total_raw_materials: number
          total_technical_processes: number
          total_unit_cost: number
          total_variable_costs: number
          updated_at: string
          updated_by: string | null
          woo_permalink: string | null
          woo_product_id: number | null
          woo_product_name: string | null
          woo_variation_id: number | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_gross_margin?: number | null
          estimated_gross_margin_percent?: number | null
          estimated_sale_price?: number | null
          id?: string
          name: string
          notes?: string | null
          product_type?: string | null
          sku?: string | null
          status?: string
          suggested_fabrication_fund?: number
          total_labor?: number
          total_logistics?: number
          total_other_costs?: number
          total_packaging?: number
          total_raw_materials?: number
          total_technical_processes?: number
          total_unit_cost?: number
          total_variable_costs?: number
          updated_at?: string
          updated_by?: string | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_product_name?: string | null
          woo_variation_id?: number | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_gross_margin?: number | null
          estimated_gross_margin_percent?: number | null
          estimated_sale_price?: number | null
          id?: string
          name?: string
          notes?: string | null
          product_type?: string | null
          sku?: string | null
          status?: string
          suggested_fabrication_fund?: number
          total_labor?: number
          total_logistics?: number
          total_other_costs?: number
          total_packaging?: number
          total_raw_materials?: number
          total_technical_processes?: number
          total_unit_cost?: number
          total_variable_costs?: number
          updated_at?: string
          updated_by?: string | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_product_name?: string | null
          woo_variation_id?: number | null
        }
        Relationships: []
      }
      core_cost_template_items: {
        Row: {
          adds_to_payroll: boolean
          cost_template_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          item_type: string | null
          name: string
          notes: string | null
          process_name: string | null
          process_order: number | null
          quantity: number
          raw_material_id: string | null
          section: string
          sort_order: number
          subtotal: number
          suggested_role: string | null
          supplier: string | null
          unit_cost: number
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          adds_to_payroll?: boolean
          cost_template_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          item_type?: string | null
          name: string
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          quantity?: number
          raw_material_id?: string | null
          section: string
          sort_order?: number
          subtotal?: number
          suggested_role?: string | null
          supplier?: string | null
          unit_cost?: number
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          adds_to_payroll?: boolean
          cost_template_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          item_type?: string | null
          name?: string
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          quantity?: number
          raw_material_id?: string | null
          section?: string
          sort_order?: number
          subtotal?: number
          suggested_role?: string | null
          supplier?: string | null
          unit_cost?: number
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_cost_template_items_cost_template_id_fkey"
            columns: ["cost_template_id"]
            isOneToOne: false
            referencedRelation: "core_cost_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      core_cost_templates: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          product_type: string | null
          source_cost_structure_id: string | null
          status: string
          total_estimated_cost: number
          total_labor: number
          total_logistics: number
          total_other_costs: number
          total_raw_materials: number
          total_technical_processes: number
          total_variable_costs: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          product_type?: string | null
          source_cost_structure_id?: string | null
          status?: string
          total_estimated_cost?: number
          total_labor?: number
          total_logistics?: number
          total_other_costs?: number
          total_raw_materials?: number
          total_technical_processes?: number
          total_variable_costs?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_type?: string | null
          source_cost_structure_id?: string | null
          status?: string
          total_estimated_cost?: number
          total_labor?: number
          total_logistics?: number
          total_other_costs?: number
          total_raw_materials?: number
          total_technical_processes?: number
          total_variable_costs?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_fabrication_fund_movements: {
        Row: {
          amount: number
          core_product_id: string | null
          core_variant_id: string | null
          cost_snapshot_data: Json | null
          created_at: string
          created_by: string | null
          currency: string
          fabrication_fund_run_id: string | null
          fund_id: string
          id: string
          movement_type: string
          notes: string | null
          product_name: string | null
          quantity: number | null
          reason: string | null
          related_movement_id: string | null
          sku: string | null
          source: string
          source_order_id: number | null
          source_order_item_id: number | null
          status: string
          unit_cost_snapshot: number | null
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          amount: number
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_snapshot_data?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fabrication_fund_run_id?: string | null
          fund_id: string
          id?: string
          movement_type: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          reason?: string | null
          related_movement_id?: string | null
          sku?: string | null
          source?: string
          source_order_id?: number | null
          source_order_item_id?: number | null
          status?: string
          unit_cost_snapshot?: number | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          amount?: number
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_snapshot_data?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fabrication_fund_run_id?: string | null
          fund_id?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          reason?: string | null
          related_movement_id?: string | null
          sku?: string | null
          source?: string
          source_order_id?: number | null
          source_order_item_id?: number | null
          status?: string
          unit_cost_snapshot?: number | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_fabrication_fund_movements_fabrication_fund_run_id_fkey"
            columns: ["fabrication_fund_run_id"]
            isOneToOne: false
            referencedRelation: "core_fabrication_fund_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_fabrication_fund_movements_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "core_fabrication_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_fabrication_fund_movements_related_movement_id_fkey"
            columns: ["related_movement_id"]
            isOneToOne: false
            referencedRelation: "core_fabrication_fund_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      core_fabrication_fund_pending_items: {
        Row: {
          created_at: string
          fabrication_fund_run_id: string | null
          id: string
          ignored_at: string | null
          ignored_by: string | null
          ignored_reason: string | null
          last_action_at: string | null
          last_action_by: string | null
          linked_core_product_id: string | null
          linked_core_variant_id: string | null
          marked_non_restockable: boolean
          notes: string | null
          order_status: string | null
          product_name: string | null
          quantity: number | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          revenue: number | null
          source_order_id: number
          source_order_item_id: number | null
          status: string
          suggested_action: string | null
          updated_at: string
          woo_product_id: number | null
          woo_sku: string | null
          woo_variation_id: number | null
        }
        Insert: {
          created_at?: string
          fabrication_fund_run_id?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          last_action_at?: string | null
          last_action_by?: string | null
          linked_core_product_id?: string | null
          linked_core_variant_id?: string | null
          marked_non_restockable?: boolean
          notes?: string | null
          order_status?: string | null
          product_name?: string | null
          quantity?: number | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          revenue?: number | null
          source_order_id: number
          source_order_item_id?: number | null
          status?: string
          suggested_action?: string | null
          updated_at?: string
          woo_product_id?: number | null
          woo_sku?: string | null
          woo_variation_id?: number | null
        }
        Update: {
          created_at?: string
          fabrication_fund_run_id?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          last_action_at?: string | null
          last_action_by?: string | null
          linked_core_product_id?: string | null
          linked_core_variant_id?: string | null
          marked_non_restockable?: boolean
          notes?: string | null
          order_status?: string | null
          product_name?: string | null
          quantity?: number | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          revenue?: number | null
          source_order_id?: number
          source_order_item_id?: number | null
          status?: string
          suggested_action?: string | null
          updated_at?: string
          woo_product_id?: number | null
          woo_sku?: string | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_fabrication_fund_pending_item_fabrication_fund_run_id_fkey"
            columns: ["fabrication_fund_run_id"]
            isOneToOne: false
            referencedRelation: "core_fabrication_fund_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_fabrication_fund_runs: {
        Row: {
          created_at: string
          created_by: string | null
          errors_count: number
          id: string
          items_checked: number
          movements_created: number
          orders_checked: number
          pending_items_created: number
          period_end: string | null
          period_start: string | null
          reversals_created: number
          run_type: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          errors_count?: number
          id?: string
          items_checked?: number
          movements_created?: number
          orders_checked?: number
          pending_items_created?: number
          period_end?: string | null
          period_start?: string | null
          reversals_created?: number
          run_type?: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          errors_count?: number
          id?: string
          items_checked?: number
          movements_created?: number
          orders_checked?: number
          pending_items_created?: number
          period_end?: string | null
          period_start?: string | null
          reversals_created?: number
          run_type?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      core_fabrication_funds: {
        Row: {
          available_amount: number
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          fund_type: string
          id: string
          name: string
          notes: string | null
          sku: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available_amount?: number
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fund_type: string
          id?: string
          name: string
          notes?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available_amount?: number
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fund_type?: string
          id?: string
          name?: string
          notes?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_import_batch_rows: {
        Row: {
          action: string | null
          batch_id: string
          created_at: string
          errors: Json
          id: string
          parsed_data: Json
          raw_data: Json
          row_number: number
          target_record_id: string | null
          validation_status: string
        }
        Insert: {
          action?: string | null
          batch_id: string
          created_at?: string
          errors?: Json
          id?: string
          parsed_data?: Json
          raw_data?: Json
          row_number: number
          target_record_id?: string | null
          validation_status?: string
        }
        Update: {
          action?: string | null
          batch_id?: string
          created_at?: string
          errors?: Json
          id?: string
          parsed_data?: Json
          raw_data?: Json
          row_number?: number
          target_record_id?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_import_batch_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "core_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      core_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_rows: number
          data_type: string
          error_rows: number
          file_name: string | null
          file_url: string | null
          id: string
          status: string
          summary: Json
          template_id: string | null
          total_rows: number
          updated_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_rows?: number
          data_type: string
          error_rows?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          status?: string
          summary?: Json
          template_id?: string | null
          total_rows?: number
          updated_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_rows?: number
          data_type?: string
          error_rows?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          status?: string
          summary?: Json
          template_id?: string | null
          total_rows?: number
          updated_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_import_batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "core_import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      core_import_template_fields: {
        Row: {
          column_name: string
          created_at: string
          data_type: string
          default_value: string | null
          display_name: string
          id: string
          internal_field: string
          is_active: boolean
          is_required: boolean
          notes: string | null
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          column_name: string
          created_at?: string
          data_type?: string
          default_value?: string | null
          display_name: string
          id?: string
          internal_field: string
          is_active?: boolean
          is_required?: boolean
          notes?: string | null
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          column_name?: string
          created_at?: string
          data_type?: string
          default_value?: string | null
          display_name?: string
          id?: string
          internal_field?: string
          is_active?: boolean
          is_required?: boolean
          notes?: string | null
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_import_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "core_import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      core_import_templates: {
        Row: {
          created_at: string
          created_by: string | null
          data_type: string
          description: string | null
          direction: string
          id: string
          name: string
          notes: string | null
          settings: Json
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_type: string
          description?: string | null
          direction?: string
          id?: string
          name: string
          notes?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_type?: string
          description?: string | null
          direction?: string
          id?: string
          name?: string
          notes?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_locations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_main: boolean
          name: string
          notes: string | null
          status: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_main?: boolean
          name: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_main?: boolean
          name?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_product_cost_snapshots: {
        Row: {
          core_product_id: string
          cost_structure_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          snapshot_data: Json
          unit_cost: number
        }
        Insert: {
          core_product_id: string
          cost_structure_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          snapshot_data?: Json
          unit_cost?: number
        }
        Update: {
          core_product_id?: string
          cost_structure_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          snapshot_data?: Json
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_product_cost_snapshots_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
        ]
      }
      core_product_variants: {
        Row: {
          core_product_id: string
          created_at: string
          id: string
          notes: string | null
          size: string
          sort_order: number
          status: string
          updated_at: string
          variant_label: string | null
          variant_sku: string | null
          woo_last_sync_at: string | null
          woo_regular_price: number | null
          woo_sale_price: number | null
          woo_sku: string | null
          woo_stock_quantity: number | null
          woo_variation_id: number | null
        }
        Insert: {
          core_product_id: string
          created_at?: string
          id?: string
          notes?: string | null
          size: string
          sort_order?: number
          status?: string
          updated_at?: string
          variant_label?: string | null
          variant_sku?: string | null
          woo_last_sync_at?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_stock_quantity?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          core_product_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          size?: string
          sort_order?: number
          status?: string
          updated_at?: string
          variant_label?: string | null
          variant_sku?: string | null
          woo_last_sync_at?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_stock_quantity?: number | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_product_variants_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
        ]
      }
      core_production_need_runs: {
        Row: {
          blocked_count: number
          created_at: string
          created_by: string | null
          id: string
          movements_checked: number
          movements_linked: number
          needs_created: number
          needs_updated: number
          non_restockable_skipped: number
          reversals_detected: number
          run_type: string
          skipped_existing: number
          status: string
          summary: Json
        }
        Insert: {
          blocked_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movements_checked?: number
          movements_linked?: number
          needs_created?: number
          needs_updated?: number
          non_restockable_skipped?: number
          reversals_detected?: number
          run_type?: string
          skipped_existing?: number
          status?: string
          summary?: Json
        }
        Update: {
          blocked_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movements_checked?: number
          movements_linked?: number
          needs_created?: number
          needs_updated?: number
          non_restockable_skipped?: number
          reversals_detected?: number
          run_type?: string
          skipped_existing?: number
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      core_production_need_sources: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          fabrication_fund_movement_id: string | null
          id: string
          production_need_id: string
          quantity: number
          source_order_id: number | null
          source_order_item_id: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          fabrication_fund_movement_id?: string | null
          id?: string
          production_need_id: string
          quantity?: number
          source_order_id?: number | null
          source_order_item_id?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          fabrication_fund_movement_id?: string | null
          id?: string
          production_need_id?: string
          quantity?: number
          source_order_id?: number | null
          source_order_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_production_need_sources_production_need_id_fkey"
            columns: ["production_need_id"]
            isOneToOne: false
            referencedRelation: "core_production_needs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_production_needs: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          created_by: string | null
          desired_date: string | null
          generation_run_id: string | null
          id: string
          is_overproduction: boolean
          last_sale_at: string | null
          need_type: string
          notes: string | null
          priority: string
          product_name: string | null
          quantity_approved: number
          quantity_converted_to_order: number
          quantity_needed: number
          quantity_pending: number
          reason: string | null
          size: string | null
          sku: string | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          desired_date?: string | null
          generation_run_id?: string | null
          id?: string
          is_overproduction?: boolean
          last_sale_at?: string | null
          need_type?: string
          notes?: string | null
          priority?: string
          product_name?: string | null
          quantity_approved?: number
          quantity_converted_to_order?: number
          quantity_needed?: number
          quantity_pending?: number
          reason?: string | null
          size?: string | null
          sku?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          desired_date?: string | null
          generation_run_id?: string | null
          id?: string
          is_overproduction?: boolean
          last_sale_at?: string | null
          need_type?: string
          notes?: string | null
          priority?: string
          product_name?: string | null
          quantity_approved?: number
          quantity_converted_to_order?: number
          quantity_needed?: number
          quantity_pending?: number
          reason?: string | null
          size?: string | null
          sku?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Relationships: []
      }
      core_production_order_lines: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          id: string
          notes: string | null
          production_order_id: string
          quantity_completed: number
          quantity_ordered: number
          quantity_pending: number
          size: string | null
          sku: string | null
          status: string
          updated_at: string
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          production_order_id: string
          quantity_completed?: number
          quantity_ordered?: number
          quantity_pending?: number
          size?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          production_order_id?: string
          quantity_completed?: number
          quantity_ordered?: number
          quantity_pending?: number
          size?: string | null
          sku?: string | null
          status?: string
          updated_at?: string
          variant_label?: string | null
          variant_sku?: string | null
        }
        Relationships: []
      }
      core_production_order_need_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          production_need_id: string
          production_order_id: string
          quantity_taken: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          production_need_id: string
          production_order_id: string
          quantity_taken?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          production_need_id?: string
          production_order_id?: string
          quantity_taken?: number
        }
        Relationships: []
      }
      core_production_order_processes: {
        Row: {
          adds_to_payroll: boolean
          created_at: string
          id: string
          notes: string | null
          process_name: string
          process_order: number
          process_type: string | null
          production_order_id: string
          rate_snapshot: Json | null
          status: string
          suggested_role: string | null
          updated_at: string
        }
        Insert: {
          adds_to_payroll?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          process_name: string
          process_order?: number
          process_type?: string | null
          production_order_id: string
          rate_snapshot?: Json | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Update: {
          adds_to_payroll?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          process_name?: string
          process_order?: number
          process_type?: string | null
          production_order_id?: string
          rate_snapshot?: Json | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      core_production_orders: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          completed_quantity: number
          core_product_id: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          is_overproduction: boolean
          manual_close_notes: string | null
          manual_close_reason: string | null
          manually_closed_at: string | null
          manually_closed_by: string | null
          notes: string | null
          order_code: string
          order_type: string
          pending_quantity: number
          priority: string
          product_name: string | null
          reason: string | null
          responsible_user_id: string | null
          sku: string | null
          source: string
          status: string
          total_quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_quantity?: number
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          is_overproduction?: boolean
          manual_close_notes?: string | null
          manual_close_reason?: string | null
          manually_closed_at?: string | null
          manually_closed_by?: string | null
          notes?: string | null
          order_code: string
          order_type?: string
          pending_quantity?: number
          priority?: string
          product_name?: string | null
          reason?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          source?: string
          status?: string
          total_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_quantity?: number
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          is_overproduction?: boolean
          manual_close_notes?: string | null
          manual_close_reason?: string | null
          manually_closed_at?: string | null
          manually_closed_by?: string | null
          notes?: string | null
          order_code?: string
          order_type?: string
          pending_quantity?: number
          priority?: string
          product_name?: string | null
          reason?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          source?: string
          status?: string
          total_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_production_unit_print_logs: {
        Row: {
          id: string
          notes: string | null
          print_type: string
          printed_at: string
          printed_by: string | null
          production_order_id: string | null
          production_unit_id: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          print_type: string
          printed_at?: string
          printed_by?: string | null
          production_order_id?: string | null
          production_unit_id?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          print_type?: string
          printed_at?: string
          printed_by?: string | null
          production_order_id?: string | null
          production_unit_id?: string | null
        }
        Relationships: []
      }
      core_production_unit_processes: {
        Row: {
          adds_to_payroll: boolean
          created_at: string
          id: string
          notes: string | null
          process_name: string
          process_order: number
          process_type: string | null
          production_order_process_id: string | null
          production_unit_id: string
          rate_snapshot: Json | null
          status: string
          suggested_role: string | null
          updated_at: string
        }
        Insert: {
          adds_to_payroll?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          process_name: string
          process_order?: number
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id: string
          rate_snapshot?: Json | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Update: {
          adds_to_payroll?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          process_name?: string
          process_order?: number
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id?: string
          rate_snapshot?: Json | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      core_production_units: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          print_count: number
          printed_at: string | null
          printed_by: string | null
          production_order_id: string
          production_order_line_id: string | null
          qr_generated_at: string | null
          qr_generated_by: string | null
          qr_payload: string | null
          qr_token: string | null
          size: string | null
          sku: string | null
          status: string
          unit_code: string
          updated_at: string
          updated_by: string | null
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          print_count?: number
          printed_at?: string | null
          printed_by?: string | null
          production_order_id: string
          production_order_line_id?: string | null
          qr_generated_at?: string | null
          qr_generated_by?: string | null
          qr_payload?: string | null
          qr_token?: string | null
          size?: string | null
          sku?: string | null
          status?: string
          unit_code: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          print_count?: number
          printed_at?: string | null
          printed_by?: string | null
          production_order_id?: string
          production_order_line_id?: string | null
          qr_generated_at?: string | null
          qr_generated_by?: string | null
          qr_payload?: string | null
          qr_token?: string | null
          size?: string | null
          sku?: string | null
          status?: string
          unit_code?: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Relationships: []
      }
      core_products: {
        Row: {
          color: string | null
          commercial_status: string
          core_sku: string
          cost_snapshot: Json | null
          cost_structure_id: string | null
          cost_template_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          estimated_sale_price: number | null
          gross_margin: number | null
          gross_margin_percent: number | null
          id: string
          image_url: string | null
          is_restockable: boolean
          name: string
          notes: string | null
          product_priority: string
          product_type: string | null
          replenishment_mode: string
          sku_source: string
          suggested_fabrication_fund: number
          sync_status: string
          unit_cost: number
          updated_at: string
          updated_by: string | null
          woo_last_sync_at: string | null
          woo_permalink: string | null
          woo_product_id: number | null
          woo_product_name: string | null
          woo_regular_price: number | null
          woo_sale_price: number | null
          woo_sku: string | null
          woo_status: string | null
          woo_stock_quantity: number | null
        }
        Insert: {
          color?: string | null
          commercial_status?: string
          core_sku: string
          cost_snapshot?: Json | null
          cost_structure_id?: string | null
          cost_template_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          estimated_sale_price?: number | null
          gross_margin?: number | null
          gross_margin_percent?: number | null
          id?: string
          image_url?: string | null
          is_restockable?: boolean
          name: string
          notes?: string | null
          product_priority?: string
          product_type?: string | null
          replenishment_mode?: string
          sku_source?: string
          suggested_fabrication_fund?: number
          sync_status?: string
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          woo_last_sync_at?: string | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_product_name?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
        }
        Update: {
          color?: string | null
          commercial_status?: string
          core_sku?: string
          cost_snapshot?: Json | null
          cost_structure_id?: string | null
          cost_template_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          estimated_sale_price?: number | null
          gross_margin?: number | null
          gross_margin_percent?: number | null
          id?: string
          image_url?: string | null
          is_restockable?: boolean
          name?: string
          notes?: string | null
          product_priority?: string
          product_type?: string | null
          replenishment_mode?: string
          sku_source?: string
          suggested_fabrication_fund?: number
          sync_status?: string
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          woo_last_sync_at?: string | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_product_name?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
        }
        Relationships: []
      }
      core_raw_material_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_raw_materials: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          notes: string | null
          status: string
          supplier: string | null
          unit_cost: number
          unit_of_measure_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          supplier?: string | null
          unit_cost?: number
          unit_of_measure_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          supplier?: string | null
          unit_cost?: number
          unit_of_measure_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "core_raw_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "core_raw_material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_raw_materials_unit_of_measure_id_fkey"
            columns: ["unit_of_measure_id"]
            isOneToOne: false
            referencedRelation: "core_units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      core_restock_control: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          created_by: string | null
          custom_reason: string | null
          end_date: string | null
          id: string
          notes: string | null
          product_name: string | null
          reason: string
          reference_type: string
          replacement_core_product_id: string | null
          replacement_core_variant_id: string | null
          replacement_sku: string | null
          replacement_variant_label: string | null
          responsible_user_id: string | null
          sku: string | null
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
          variant_label: string | null
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_reason?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          reason: string
          reference_type: string
          replacement_core_product_id?: string | null
          replacement_core_variant_id?: string | null
          replacement_sku?: string | null
          replacement_variant_label?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_reason?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          reason?: string
          reference_type?: string
          replacement_core_product_id?: string | null
          replacement_core_variant_id?: string | null
          replacement_sku?: string | null
          replacement_variant_label?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_label?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Relationships: []
      }
      core_role_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          display_name: string
          id: string
          key: string
          permissions: Json
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          display_name: string
          id?: string
          key: string
          permissions?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          display_name?: string
          id?: string
          key?: string
          permissions?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_settings: {
        Row: {
          allow_stock_in_transit: boolean
          created_at: string
          created_by: string | null
          description: string
          id: string
          main_location_id: string | null
          module_name: string
          multi_location_mode: string
          qr_height_mm: number
          qr_include_human_code: boolean
          qr_include_production_order: boolean
          qr_include_qr: boolean
          qr_include_size: boolean
          qr_include_sku: boolean
          qr_include_unit_number: boolean
          qr_width_mm: number
          sku_digits: number
          sku_last_number: number
          sku_prefix: string
          status: string
          update_woocommerce_inventory: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_stock_in_transit?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          main_location_id?: string | null
          module_name?: string
          multi_location_mode?: string
          qr_height_mm?: number
          qr_include_human_code?: boolean
          qr_include_production_order?: boolean
          qr_include_qr?: boolean
          qr_include_size?: boolean
          qr_include_sku?: boolean
          qr_include_unit_number?: boolean
          qr_width_mm?: number
          sku_digits?: number
          sku_last_number?: number
          sku_prefix?: string
          status?: string
          update_woocommerce_inventory?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_stock_in_transit?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          main_location_id?: string | null
          module_name?: string
          multi_location_mode?: string
          qr_height_mm?: number
          qr_include_human_code?: boolean
          qr_include_production_order?: boolean
          qr_include_qr?: boolean
          qr_include_size?: boolean
          qr_include_sku?: boolean
          qr_include_unit_number?: boolean
          qr_width_mm?: number
          sku_digits?: number
          sku_last_number?: number
          sku_prefix?: string
          status?: string
          update_woocommerce_inventory?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "core_settings_main_location_id_fkey"
            columns: ["main_location_id"]
            isOneToOne: false
            referencedRelation: "core_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      core_units_of_measure: {
        Row: {
          abbreviation: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abbreviation: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abbreviation?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_woo_product_candidates: {
        Row: {
          created_at: string
          detected_from: string
          id: string
          matched_core_product_id: string | null
          matched_core_variant_id: string | null
          notes: string | null
          source_order_id: number | null
          source_order_item_id: number | null
          status: string
          updated_at: string
          woo_permalink: string | null
          woo_product_id: number
          woo_product_name: string | null
          woo_regular_price: number | null
          woo_sale_price: number | null
          woo_sku: string | null
          woo_status: string | null
          woo_stock_quantity: number | null
          woo_variation_id: number | null
          woo_variations: Json | null
        }
        Insert: {
          created_at?: string
          detected_from?: string
          id?: string
          matched_core_product_id?: string | null
          matched_core_variant_id?: string | null
          notes?: string | null
          source_order_id?: number | null
          source_order_item_id?: number | null
          status?: string
          updated_at?: string
          woo_permalink?: string | null
          woo_product_id: number
          woo_product_name?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_variation_id?: number | null
          woo_variations?: Json | null
        }
        Update: {
          created_at?: string
          detected_from?: string
          id?: string
          matched_core_product_id?: string | null
          matched_core_variant_id?: string | null
          notes?: string | null
          source_order_id?: number | null
          source_order_item_id?: number | null
          status?: string
          updated_at?: string
          woo_permalink?: string | null
          woo_product_id?: number
          woo_product_name?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_variation_id?: number | null
          woo_variations?: Json | null
        }
        Relationships: []
      }
      core_woocommerce_status_rules: {
        Row: {
          active: boolean
          canonical_name: string
          created_at: string
          created_by: string | null
          enters_production: boolean
          excluded: boolean
          id: string
          monitored: boolean
          slug: string
          status_group: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          canonical_name: string
          created_at?: string
          created_by?: string | null
          enters_production?: boolean
          excluded?: boolean
          id?: string
          monitored?: boolean
          slug: string
          status_group: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          canonical_name?: string
          created_at?: string
          created_by?: string | null
          enters_production?: boolean
          excluded?: boolean
          id?: string
          monitored?: boolean
          slug?: string
          status_group?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crew_audit_log: {
        Row: {
          action: string
          created_at: string | null
          employee_id: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          employee_id: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          employee_id?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      crew_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      customers_cache: {
        Row: {
          avatar_url: string | null
          billing_city: string | null
          billing_company: string | null
          billing_country: string | null
          billing_phone: string | null
          billing_state: string | null
          date_created: string | null
          date_modified: string | null
          email: string | null
          first_name: string | null
          id: number
          last_name: string | null
          last_order_date: string | null
          last_order_id: number | null
          meta_data: Json | null
          orders_count: number | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          synced_at: string | null
          total_spent: number | null
          username: string | null
          woo_orders_count: number | null
          woo_total_spent: number | null
        }
        Insert: {
          avatar_url?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_phone?: string | null
          billing_state?: string | null
          date_created?: string | null
          date_modified?: string | null
          email?: string | null
          first_name?: string | null
          id: number
          last_name?: string | null
          last_order_date?: string | null
          last_order_id?: number | null
          meta_data?: Json | null
          orders_count?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          synced_at?: string | null
          total_spent?: number | null
          username?: string | null
          woo_orders_count?: number | null
          woo_total_spent?: number | null
        }
        Update: {
          avatar_url?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_phone?: string | null
          billing_state?: string | null
          date_created?: string | null
          date_modified?: string | null
          email?: string | null
          first_name?: string | null
          id?: number
          last_name?: string | null
          last_order_date?: string | null
          last_order_id?: number | null
          meta_data?: Json | null
          orders_count?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          synced_at?: string | null
          total_spent?: number | null
          username?: string | null
          woo_orders_count?: number | null
          woo_total_spent?: number | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string | null
          doc_type: string
          employee_id: string
          expiry_date: string | null
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type?: string
          employee_id: string
          expiry_date?: string | null
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          birth_date: string | null
          cedula: string | null
          created_at: string
          current_salary: number | null
          first_name: string
          id: string
          internal_id: string
          last_name: string
          location: string | null
          observations: string | null
          phone: string | null
          photo_url: string | null
          position: string
          skills: string[] | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cedula?: string | null
          created_at?: string
          current_salary?: number | null
          first_name: string
          id?: string
          internal_id: string
          last_name: string
          location?: string | null
          observations?: string | null
          phone?: string | null
          photo_url?: string | null
          position: string
          skills?: string[] | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cedula?: string | null
          created_at?: string
          current_salary?: number | null
          first_name?: string
          id?: string
          internal_id?: string
          last_name?: string
          location?: string | null
          observations?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string
          skills?: string[] | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          category: string
          created_at: string | null
          employee_id: string
          employee_name: string
          id: string
          incident_date: string
          observation: string | null
          reason: string
          registered_by: string | null
          type: string
        }
        Insert: {
          category: string
          created_at?: string | null
          employee_id: string
          employee_name: string
          id?: string
          incident_date?: string
          observation?: string | null
          reason: string
          registered_by?: string | null
          type: string
        }
        Update: {
          category?: string
          created_at?: string | null
          employee_id?: string
          employee_name?: string
          id?: string
          incident_date?: string
          observation?: string | null
          reason?: string
          registered_by?: string | null
          type?: string
        }
        Relationships: []
      }
      landing_leads: {
        Row: {
          brand: string | null
          created_at: string
          email: string
          id: string
          interest: string
          message: string | null
          name: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          email: string
          id?: string
          interest?: string
          message?: string | null
          name: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          email?: string
          id?: string
          interest?: string
          message?: string | null
          name?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          analytic_category: string | null
          color: string | null
          exchange_rate: number | null
          id: string
          item_cost: number | null
          line_item_id: number | null
          line_total: number | null
          line_total_currency: string | null
          line_total_original: number | null
          line_total_usd: number | null
          order_id: number
          parent_category: string | null
          parent_sku: string | null
          product_category: string | null
          product_id: number | null
          product_name: string | null
          quantity: number | null
          size: string | null
          sku: string | null
          unit_price: number | null
          variation_id: number | null
        }
        Insert: {
          analytic_category?: string | null
          color?: string | null
          exchange_rate?: number | null
          id?: string
          item_cost?: number | null
          line_item_id?: number | null
          line_total?: number | null
          line_total_currency?: string | null
          line_total_original?: number | null
          line_total_usd?: number | null
          order_id: number
          parent_category?: string | null
          parent_sku?: string | null
          product_category?: string | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          sku?: string | null
          unit_price?: number | null
          variation_id?: number | null
        }
        Update: {
          analytic_category?: string | null
          color?: string | null
          exchange_rate?: number | null
          id?: string
          item_cost?: number | null
          line_item_id?: number | null
          line_total?: number | null
          line_total_currency?: string | null
          line_total_original?: number | null
          line_total_usd?: number | null
          order_id?: number
          parent_category?: string | null
          parent_sku?: string | null
          product_category?: string | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          sku?: string | null
          unit_price?: number | null
          variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_state: string | null
          customer_email: string | null
          customer_note: string | null
          customer_phone: string | null
          discount_amount: number | null
          exchange_rate: number | null
          order_currency: string | null
          order_date: string | null
          order_datetime: string | null
          order_id: number
          order_number: string | null
          order_status: string | null
          pago_metodo_1: string | null
          pago_metodo_2: string | null
          pago_metodo_3: string | null
          pago_metodo_4: string | null
          payment_method: string | null
          refunded_amount: number | null
          sale_channel: string | null
          shipping_address: string | null
          shipping_amount: number | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_method: string | null
          shipping_name: string | null
          subtotal_amount: number | null
          synced_at: string | null
          tax_amount: number | null
          total_amount: number | null
          total_amount_usd: number | null
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_state?: string | null
          customer_email?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          exchange_rate?: number | null
          order_currency?: string | null
          order_date?: string | null
          order_datetime?: string | null
          order_id: number
          order_number?: string | null
          order_status?: string | null
          pago_metodo_1?: string | null
          pago_metodo_2?: string | null
          pago_metodo_3?: string | null
          pago_metodo_4?: string | null
          payment_method?: string | null
          refunded_amount?: number | null
          sale_channel?: string | null
          shipping_address?: string | null
          shipping_amount?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_name?: string | null
          subtotal_amount?: number | null
          synced_at?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          total_amount_usd?: number | null
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_state?: string | null
          customer_email?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          exchange_rate?: number | null
          order_currency?: string | null
          order_date?: string | null
          order_datetime?: string | null
          order_id?: number
          order_number?: string | null
          order_status?: string | null
          pago_metodo_1?: string | null
          pago_metodo_2?: string | null
          pago_metodo_3?: string | null
          pago_metodo_4?: string | null
          payment_method?: string | null
          refunded_amount?: number | null
          sale_channel?: string | null
          shipping_address?: string | null
          shipping_amount?: number | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_method?: string | null
          shipping_name?: string | null
          subtotal_amount?: number | null
          synced_at?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          total_amount_usd?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          order_id: number
          payment_amount: number | null
          payment_bank: string | null
          payment_currency: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_slot: number | null
        }
        Insert: {
          id?: string
          order_id: number
          payment_amount?: number | null
          payment_bank?: string | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_slot?: number | null
        }
        Update: {
          id?: string
          order_id?: number
          payment_amount?: number | null
          payment_bank?: string | null
          payment_currency?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_slot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
      private_notes: {
        Row: {
          author: string | null
          content: string
          created_at: string | null
          employee_id: string
          id: string
          note_type: string
          privacy_level: string
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string | null
          employee_id: string
          id?: string
          note_type?: string
          privacy_level?: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          note_type?: string
          privacy_level?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          analytic_category: string | null
          collection: string | null
          product_name: string | null
          sku: string
          suggested_price: number | null
          unit_cost_total: number | null
          updated_at: string | null
        }
        Insert: {
          analytic_category?: string | null
          collection?: string | null
          product_name?: string | null
          sku: string
          suggested_price?: number | null
          unit_cost_total?: number | null
          updated_at?: string | null
        }
        Update: {
          analytic_category?: string | null
          collection?: string | null
          product_name?: string | null
          sku?: string
          suggested_price?: number | null
          unit_cost_total?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recurring_tasks: {
        Row: {
          active: boolean
          area: string | null
          created_at: string
          day: string | null
          description: string
          employee_id: string
          frequency: string
          id: string
          name: string
          priority: string
          responsible: string | null
          sort_order: number
          time: string | null
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string
          day?: string | null
          description?: string
          employee_id: string
          frequency?: string
          id?: string
          name: string
          priority?: string
          responsible?: string | null
          sort_order?: number
          time?: string | null
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string
          day?: string | null
          description?: string
          employee_id?: string
          frequency?: string
          id?: string
          name?: string
          priority?: string
          responsible?: string | null
          sort_order?: number
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_routes: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          routes: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          routes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          routes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rrpp_audit_log: {
        Row: {
          action: string
          contact_id: string | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          contact_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          contact_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      rrpp_brand_goals: {
        Row: {
          activaciones: number
          brand: string
          captaciones: number
          colaboraciones: number
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          activaciones?: number
          brand: string
          captaciones?: number
          colaboraciones?: number
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          activaciones?: number
          brand?: string
          captaciones?: number
          colaboraciones?: number
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      rrpp_collaborations: {
        Row: {
          collab_done: boolean
          contact_id: string
          coupon_code: string | null
          coupon_revenue: number
          created_at: string
          has_coupon: boolean
          id: string
          network_posted: string | null
          observations: string | null
          order_details: string | null
          post_date: string | null
          post_observation: string | null
          post_url: string | null
          products: string | null
          published_at: string | null
          received: boolean
          send_date: string | null
          shipped_at: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_email: string | null
          shipping_id_number: string | null
          shipping_last_name: string | null
          shipping_name: string | null
          shipping_phone: string | null
          shipping_postal_code: string | null
          tracking_number: string | null
        }
        Insert: {
          collab_done?: boolean
          contact_id: string
          coupon_code?: string | null
          coupon_revenue?: number
          created_at?: string
          has_coupon?: boolean
          id?: string
          network_posted?: string | null
          observations?: string | null
          order_details?: string | null
          post_date?: string | null
          post_observation?: string | null
          post_url?: string | null
          products?: string | null
          published_at?: string | null
          received?: boolean
          send_date?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_id_number?: string | null
          shipping_last_name?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          tracking_number?: string | null
        }
        Update: {
          collab_done?: boolean
          contact_id?: string
          coupon_code?: string | null
          coupon_revenue?: number
          created_at?: string
          has_coupon?: boolean
          id?: string
          network_posted?: string | null
          observations?: string | null
          order_details?: string | null
          post_date?: string | null
          post_observation?: string | null
          post_url?: string | null
          products?: string | null
          published_at?: string | null
          received?: boolean
          send_date?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_email?: string | null
          shipping_id_number?: string | null
          shipping_last_name?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shipping_postal_code?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rrpp_collaborations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rrpp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      rrpp_config: {
        Row: {
          category: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          category: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      rrpp_contacts: {
        Row: {
          alias: string | null
          brand: string
          city: string | null
          contact_type: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          main_channel: string | null
          main_tag: string | null
          name: string
          observations: string | null
          phone: string | null
          photo_url: string | null
          relationship_status: string
          responsible: string | null
          skills: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          alias?: string | null
          brand?: string
          city?: string | null
          contact_type?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          main_channel?: string | null
          main_tag?: string | null
          name: string
          observations?: string | null
          phone?: string | null
          photo_url?: string | null
          relationship_status?: string
          responsible?: string | null
          skills?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          alias?: string | null
          brand?: string
          city?: string | null
          contact_type?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          main_channel?: string | null
          main_tag?: string | null
          name?: string
          observations?: string | null
          phone?: string | null
          photo_url?: string | null
          relationship_status?: string
          responsible?: string | null
          skills?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rrpp_interactions: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          date: string
          id: string
          next_action: string | null
          observation: string | null
          responsible: string | null
          result: string | null
          summary: string | null
          type: string
        }
        Insert: {
          channel?: string
          contact_id: string
          created_at?: string
          date?: string
          id?: string
          next_action?: string | null
          observation?: string | null
          responsible?: string | null
          result?: string | null
          summary?: string | null
          type?: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          date?: string
          id?: string
          next_action?: string | null
          observation?: string | null
          responsible?: string | null
          result?: string | null
          summary?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rrpp_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rrpp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      rrpp_private_notes: {
        Row: {
          author: string | null
          contact_id: string
          content: string
          created_at: string
          date: string
          id: string
          note_type: string
          privacy_level: string
        }
        Insert: {
          author?: string | null
          contact_id: string
          content: string
          created_at?: string
          date?: string
          id?: string
          note_type?: string
          privacy_level?: string
        }
        Update: {
          author?: string | null
          contact_id?: string
          content?: string
          created_at?: string
          date?: string
          id?: string
          note_type?: string
          privacy_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "rrpp_private_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rrpp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      rrpp_social_media: {
        Row: {
          contact_id: string
          created_at: string
          followers: number
          handle: string
          id: string
          measured_at: string
          network: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          followers?: number
          handle?: string
          id?: string
          measured_at?: string
          network: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          followers?: number
          handle?: string
          id?: string
          measured_at?: string
          network?: string
        }
        Relationships: [
          {
            foreignKeyName: "rrpp_social_media_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rrpp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_history: {
        Row: {
          approved_by: string | null
          base_salary: number
          bonus: number | null
          commission: number | null
          created_at: string | null
          effective_date: string
          employee_id: string
          id: string
          observations: string | null
          reason: string
        }
        Insert: {
          approved_by?: string | null
          base_salary?: number
          bonus?: number | null
          commission?: number | null
          created_at?: string | null
          effective_date?: string
          employee_id: string
          id?: string
          observations?: string | null
          reason: string
        }
        Update: {
          approved_by?: string | null
          base_salary?: number
          bonus?: number | null
          commission?: number | null
          created_at?: string | null
          effective_date?: string
          employee_id?: string
          id?: string
          observations?: string | null
          reason?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_count: number | null
          description: string | null
          filters: Json
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sip_agents: {
        Row: {
          agent_name: string
          created_at: string | null
          id: string
          sip_id: string
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          id?: string
          sip_id: string
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          id?: string
          sip_id?: string
        }
        Relationships: []
      }
      sublime_admin_audit_log: {
        Row: {
          action: string
          created_at: string | null
          field_changed: string | null
          id: string
          instance_id: string | null
          new_value: string | null
          obligation_id: string | null
          old_value: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          instance_id?: string | null
          new_value?: string | null
          obligation_id?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          instance_id?: string | null
          new_value?: string | null
          obligation_id?: string | null
          old_value?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sublime_admin_audit_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "sublime_admin_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sublime_admin_audit_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "sublime_admin_instances_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sublime_admin_audit_log_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "sublime_admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_admin_config: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          id: string
          sort_order: number | null
          value: string
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          value: string
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      sublime_admin_instances: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          due_date: string
          id: string
          notes: string | null
          obligation_id: string | null
          paid_at: string | null
          paid_by: string | null
          payment_proof_url: string[] | null
          payment_reference: string | null
          period_label: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          due_date: string
          id?: string
          notes?: string | null
          obligation_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_proof_url?: string[] | null
          payment_reference?: string | null
          period_label: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          obligation_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_proof_url?: string[] | null
          payment_reference?: string | null
          period_label?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sublime_admin_instances_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "sublime_admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_admin_obligations: {
        Row: {
          amount: number | null
          category: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_day: number | null
          frequency: string
          id: string
          importance: string
          name: string
          notes: string | null
          payment_method: string | null
          provider: string | null
          responsible: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_day?: number | null
          frequency: string
          id?: string
          importance?: string
          name: string
          notes?: string | null
          payment_method?: string | null
          provider?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_day?: number | null
          frequency?: string
          id?: string
          importance?: string
          name?: string
          notes?: string | null
          payment_method?: string | null
          provider?: string | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sublime_clock_config: {
        Row: {
          id: boolean
          test_mode: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          test_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          test_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sublime_clock_events: {
        Row: {
          allowed_radius_meters: number | null
          approved_at: string | null
          approved_by: string | null
          clock_state: string
          created_at: string
          device_user_agent: string | null
          distance_meters: number | null
          edited_at: string | null
          edited_by: string | null
          employee_id: string
          event_at: string
          event_date: string
          event_type: string
          id: string
          is_automatic: boolean
          latitude: number | null
          location_state: string
          longitude: number | null
          notes: string | null
          observations: string | null
          punctuality_state: string | null
          source: string
          store_id: string | null
        }
        Insert: {
          allowed_radius_meters?: number | null
          approved_at?: string | null
          approved_by?: string | null
          clock_state?: string
          created_at?: string
          device_user_agent?: string | null
          distance_meters?: number | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id: string
          event_at?: string
          event_date?: string
          event_type: string
          id?: string
          is_automatic?: boolean
          latitude?: number | null
          location_state?: string
          longitude?: number | null
          notes?: string | null
          observations?: string | null
          punctuality_state?: string | null
          source?: string
          store_id?: string | null
        }
        Update: {
          allowed_radius_meters?: number | null
          approved_at?: string | null
          approved_by?: string | null
          clock_state?: string
          created_at?: string
          device_user_agent?: string | null
          distance_meters?: number | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id?: string
          event_at?: string
          event_date?: string
          event_type?: string
          id?: string
          is_automatic?: boolean
          latitude?: number | null
          location_state?: string
          longitude?: number | null
          notes?: string | null
          observations?: string | null
          punctuality_state?: string | null
          source?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sublime_clock_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sublime_clock_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "sublime_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_clock_settings: {
        Row: {
          blocked: boolean
          break_end: string | null
          break_minutes: number
          break_start: string | null
          created_at: string
          employee_id: string
          enabled: boolean
          entry_time: string | null
          exit_time: string | null
          extra_store_ids: string[]
          failed_attempts: number
          hybrid_mode: boolean
          last_pin_attempt_at: string | null
          late_tolerance_minutes: number
          locked_until: string | null
          pin_hash: string | null
          pin_set_at: string | null
          pin_status: string
          store_id: string | null
          temp_pin_expires_at: string | null
          temp_pin_hash: string | null
          updated_at: string
          weekly_hours_target: number | null
          weekly_schedule: Json
        }
        Insert: {
          blocked?: boolean
          break_end?: string | null
          break_minutes?: number
          break_start?: string | null
          created_at?: string
          employee_id: string
          enabled?: boolean
          entry_time?: string | null
          exit_time?: string | null
          extra_store_ids?: string[]
          failed_attempts?: number
          hybrid_mode?: boolean
          last_pin_attempt_at?: string | null
          late_tolerance_minutes?: number
          locked_until?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          pin_status?: string
          store_id?: string | null
          temp_pin_expires_at?: string | null
          temp_pin_hash?: string | null
          updated_at?: string
          weekly_hours_target?: number | null
          weekly_schedule?: Json
        }
        Update: {
          blocked?: boolean
          break_end?: string | null
          break_minutes?: number
          break_start?: string | null
          created_at?: string
          employee_id?: string
          enabled?: boolean
          entry_time?: string | null
          exit_time?: string | null
          extra_store_ids?: string[]
          failed_attempts?: number
          hybrid_mode?: boolean
          last_pin_attempt_at?: string | null
          late_tolerance_minutes?: number
          locked_until?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          pin_status?: string
          store_id?: string | null
          temp_pin_expires_at?: string | null
          temp_pin_hash?: string | null
          updated_at?: string
          weekly_hours_target?: number | null
          weekly_schedule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sublime_clock_settings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sublime_clock_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "sublime_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_daily_shifts: {
        Row: {
          break_minutes: number
          computed_at: string
          created_at: string
          early_exit_minutes: number
          employee_id: string
          final_state: string
          gross_hours: number
          id: string
          late_minutes: number
          net_hours: number
          observations: string | null
          overtime_minutes: number
          real_entry_at: string | null
          real_exit_at: string | null
          shift_date: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          computed_at?: string
          created_at?: string
          early_exit_minutes?: number
          employee_id: string
          final_state?: string
          gross_hours?: number
          id?: string
          late_minutes?: number
          net_hours?: number
          observations?: string | null
          overtime_minutes?: number
          real_entry_at?: string | null
          real_exit_at?: string | null
          shift_date: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          computed_at?: string
          created_at?: string
          early_exit_minutes?: number
          employee_id?: string
          final_state?: string
          gross_hours?: number
          id?: string
          late_minutes?: number
          net_hours?: number
          observations?: string | null
          overtime_minutes?: number
          real_entry_at?: string | null
          real_exit_at?: string | null
          shift_date?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sublime_pin_audit: {
        Row: {
          action: string
          created_at: string
          employee_id: string
          id: string
          metadata: Json
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          employee_id: string
          id?: string
          metadata?: Json
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          employee_id?: string
          id?: string
          metadata?: Json
          performed_by?: string | null
        }
        Relationships: []
      }
      sublime_stores: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          radius_meters: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          radius_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_instances_view: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          frequency: string | null
          id: string | null
          importance: string | null
          notes: string | null
          obligation_id: string | null
          obligation_name: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_proof_url: string[] | null
          payment_reference: string | null
          period_label: string | null
          provider: string | null
          responsible: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_instances_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_admin_instances_view: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          frequency: string | null
          id: string | null
          importance: string | null
          notes: string | null
          obligation_id: string | null
          obligation_name: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_proof_url: string[] | null
          payment_reference: string | null
          period_label: string | null
          provider: string | null
          responsible: string | null
          status: string | null
          updated_at: string | null
          urgency: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sublime_admin_instances_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "sublime_admin_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      compute_sublime_daily_shift: {
        Args: { p_date: string; p_employee_id: string }
        Returns: undefined
      }
      get_crew_employees: {
        Args: never
        Returns: {
          birth_date: string
          cedula: string
          created_at: string
          current_salary: number
          first_name: string
          id: string
          internal_id: string
          last_name: string
          location: string
          observations: string
          phone: string
          photo_url: string
          position: string
          skills: string[]
          start_date: string
          status: string
          updated_at: string
        }[]
      }
      get_urgency: { Args: { due: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_customers_order_stats: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "manager" | "partner" | "rrpp" | "marketing"
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
      app_role: ["admin", "manager", "partner", "rrpp", "marketing"],
    },
  },
} as const
