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
          variant_id: string | null
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
          variant_id?: string | null
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
          variant_id?: string | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_product_name?: string | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_cost_structures_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "core_product_variants"
            referencedColumns: ["id"]
          },
        ]
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
          total_packaging: number
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
          total_packaging?: number
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
          total_packaging?: number
          total_raw_materials?: number
          total_technical_processes?: number
          total_variable_costs?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      core_dispatch_units: {
        Row: {
          created_at: string
          difference_note: string | null
          dispatch_id: string
          id: string
          product_name: string | null
          production_order_id: string | null
          received_at: string | null
          size: string | null
          sku: string | null
          status: string
          unit_code: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          difference_note?: string | null
          dispatch_id: string
          id?: string
          product_name?: string | null
          production_order_id?: string | null
          received_at?: string | null
          size?: string | null
          sku?: string | null
          status?: string
          unit_code: string
          unit_id: string
        }
        Update: {
          created_at?: string
          difference_note?: string | null
          dispatch_id?: string
          id?: string
          product_name?: string | null
          production_order_id?: string | null
          received_at?: string | null
          size?: string | null
          sku?: string | null
          status?: string
          unit_code?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_dispatch_units_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "core_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      core_dispatches: {
        Row: {
          carrier_name: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          destination_location_id: string | null
          destination_location_name: string | null
          difference_note: string | null
          dispatch_number: string | null
          expected_departure_date: string | null
          factory_responsible: string | null
          id: string
          notes: string | null
          production_order_id: string | null
          received_at: string | null
          received_by_name: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_location_id?: string | null
          destination_location_name?: string | null
          difference_note?: string | null
          dispatch_number?: string | null
          expected_departure_date?: string | null
          factory_responsible?: string | null
          id?: string
          notes?: string | null
          production_order_id?: string | null
          received_at?: string | null
          received_by_name?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_location_id?: string | null
          destination_location_name?: string | null
          difference_note?: string | null
          dispatch_number?: string | null
          expected_departure_date?: string | null
          factory_responsible?: string | null
          id?: string
          notes?: string | null
          production_order_id?: string | null
          received_at?: string | null
          received_by_name?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      core_external_purchase_order_lines: {
        Row: {
          cancellation_notes: string | null
          core_product_id: string | null
          core_variant_id: string | null
          cost_source: string | null
          created_at: string
          id: string
          line_subtotal: number
          notes: string | null
          order_id: string
          policy_event_id: string | null
          policy_id: string | null
          product_name_snapshot: string | null
          quantity_ordered: number
          quantity_received: number
          sku_snapshot: string | null
          status: string
          unit_cost: number
          updated_at: string
          variant_label_snapshot: string | null
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          cancellation_notes?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string
          id?: string
          line_subtotal?: number
          notes?: string | null
          order_id: string
          policy_event_id?: string | null
          policy_id?: string | null
          product_name_snapshot?: string | null
          quantity_ordered: number
          quantity_received?: number
          sku_snapshot?: string | null
          status?: string
          unit_cost: number
          updated_at?: string
          variant_label_snapshot?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          cancellation_notes?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string
          id?: string
          line_subtotal?: number
          notes?: string | null
          order_id?: string
          policy_event_id?: string | null
          policy_id?: string | null
          product_name_snapshot?: string | null
          quantity_ordered?: number
          quantity_received?: number
          sku_snapshot?: string | null
          status?: string
          unit_cost?: number
          updated_at?: string
          variant_label_snapshot?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_external_purchase_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "core_external_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_external_purchase_order_lines_policy_event_id_fkey"
            columns: ["policy_event_id"]
            isOneToOne: false
            referencedRelation: "core_replenishment_policy_events"
            referencedColumns: ["id"]
          },
        ]
      }
      core_external_purchase_orders: {
        Row: {
          amount_paid: number
          approved_at: string | null
          approved_by: string | null
          balance_due: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          ordered_at: string | null
          ordered_by: string | null
          other_cost: number
          payment_status: string
          received_at: string | null
          received_by: string | null
          shipping_cost: number
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name_normalized: string
          supplier_name_snapshot: string
          supplier_order_reference: string | null
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          ordered_at?: string | null
          ordered_by?: string | null
          other_cost?: number
          payment_status?: string
          received_at?: string | null
          received_by?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name_normalized: string
          supplier_name_snapshot: string
          supplier_order_reference?: string | null
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          ordered_at?: string | null
          ordered_by?: string | null
          other_cost?: number
          payment_status?: string
          received_at?: string | null
          received_by?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name_normalized?: string
          supplier_name_snapshot?: string
          supplier_order_reference?: string | null
          total?: number
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
          fund_bucket: string | null
          fund_id: string
          id: string
          metadata: Json | null
          movement_type: string
          notes: string | null
          product_name: string | null
          production_order_id: string | null
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
          fund_bucket?: string | null
          fund_id: string
          id?: string
          metadata?: Json | null
          movement_type: string
          notes?: string | null
          product_name?: string | null
          production_order_id?: string | null
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
          fund_bucket?: string | null
          fund_id?: string
          id?: string
          metadata?: Json | null
          movement_type?: string
          notes?: string | null
          product_name?: string | null
          production_order_id?: string | null
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
            foreignKeyName: "cffm_production_order_fk"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "core_production_orders"
            referencedColumns: ["id"]
          },
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
      core_factory_operator_documents: {
        Row: {
          created_at: string
          doc_type: string
          expiry_date: string | null
          file_url: string
          id: string
          name: string
          operator_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          file_url: string
          id?: string
          name: string
          operator_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          file_url?: string
          id?: string
          name?: string
          operator_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "core_factory_operator_documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "core_factory_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      core_factory_operator_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          operator_id: string
          role_label: string | null
          role_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          operator_id: string
          role_label?: string | null
          role_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          operator_id?: string
          role_label?: string | null
          role_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_factory_operator_roles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "core_factory_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      core_factory_operators: {
        Row: {
          alias: string | null
          allowed_processes: string[] | null
          base_rate: number | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          payroll_multiplier: number
          phone: string | null
          photo_url: string | null
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked_until: string | null
          pin_set_at: string | null
          portal_active: boolean
          portal_last_login_at: string | null
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alias?: string | null
          allowed_processes?: string[] | null
          base_rate?: number | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          payroll_multiplier?: number
          phone?: string | null
          photo_url?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          pin_set_at?: string | null
          portal_active?: boolean
          portal_last_login_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alias?: string | null
          allowed_processes?: string[] | null
          base_rate?: number | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          payroll_multiplier?: number
          phone?: string | null
          photo_url?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          pin_set_at?: string | null
          portal_active?: boolean
          portal_last_login_at?: string | null
          start_date?: string | null
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
      core_import_value_aliases: {
        Row: {
          action: string
          alias_type: string
          created_at: string
          created_by: string | null
          id: string
          normalized_source_value: string
          source_value: string
          target_id: string | null
          target_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          alias_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_source_value: string
          source_value: string
          target_id?: string | null
          target_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          alias_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_source_value?: string
          source_value?: string
          target_id?: string | null
          target_value?: string | null
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
      core_operator_portal_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          expires_at: string
          id: string
          operator_id: string
          revoked_at: string | null
          session_token_hash: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          expires_at: string
          id?: string
          operator_id: string
          revoked_at?: string | null
          session_token_hash: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          operator_id?: string
          revoked_at?: string | null
          session_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_operator_portal_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "core_factory_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          operator_id: string
          payroll_operator_line_id: string
          payroll_run_id: string
          reason: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          operator_id: string
          payroll_operator_line_id: string
          payroll_run_id: string
          reason: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          operator_id?: string
          payroll_operator_line_id?: string
          payroll_run_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_adjustments_payroll_operator_line_id_fkey"
            columns: ["payroll_operator_line_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_operator_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_payroll_adjustments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_auto_close_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          lock_expires_at: string | null
          message: string | null
          operators_count: number
          payment_date: string | null
          payroll_run_id: string | null
          period_end: string
          period_start: string
          status: string
          total_amount: number
          work_entries_count: number
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          lock_expires_at?: string | null
          message?: string | null
          operators_count?: number
          payment_date?: string | null
          payroll_run_id?: string | null
          period_end: string
          period_start: string
          status?: string
          total_amount?: number
          work_entries_count?: number
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          lock_expires_at?: string | null
          message?: string | null
          operators_count?: number
          payment_date?: string | null
          payroll_run_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_amount?: number
          work_entries_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_auto_close_runs_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_operator_lines: {
        Row: {
          adjustments_amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          operator_id: string
          operator_name_snapshot: string | null
          payroll_run_id: string
          status: string
          subtotal_amount: number
          total_amount: number
          total_processes: number
          updated_at: string
        }
        Insert: {
          adjustments_amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          operator_id: string
          operator_name_snapshot?: string | null
          payroll_run_id: string
          status?: string
          subtotal_amount?: number
          total_amount?: number
          total_processes?: number
          updated_at?: string
        }
        Update: {
          adjustments_amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          operator_id?: string
          operator_name_snapshot?: string | null
          payroll_run_id?: string
          status?: string
          subtotal_amount?: number
          total_amount?: number
          total_processes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_operator_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_payment_proofs: {
        Row: {
          amount_paid: number | null
          bcv_rate: number | null
          currency: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          operator_id: string | null
          payment_reference: string | null
          payroll_operator_line_id: string | null
          payroll_run_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          amount_paid?: number | null
          bcv_rate?: number | null
          currency?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          payment_reference?: string | null
          payroll_operator_line_id?: string | null
          payroll_run_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          amount_paid?: number | null
          bcv_rate?: number | null
          currency?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          payment_reference?: string | null
          payroll_operator_line_id?: string | null
          payroll_run_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_payment_proofs_payroll_operator_line_id_fkey"
            columns: ["payroll_operator_line_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_operator_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_payroll_payment_proofs_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_runs: {
        Row: {
          adjustments_total: number
          approved_at: string | null
          approved_by: string | null
          bcv_rate: number | null
          created_at: string
          created_by: string | null
          currency: string
          generated_by_system: boolean
          generation_source: string | null
          id: string
          is_merged_period: boolean
          merge_metadata: Json | null
          merged_at: string | null
          merged_by: string | null
          merged_into_payroll_id: string | null
          merged_reason: string | null
          operators_count: number
          paid_at: string | null
          paid_by: string | null
          payment_date: string | null
          payment_notes: string | null
          payroll_code: string | null
          period_end: string
          period_start: string
          status: string
          total_amount: number
          total_paid_amount: number | null
          updated_at: string
          updated_by: string | null
          work_entries_count: number
        }
        Insert: {
          adjustments_total?: number
          approved_at?: string | null
          approved_by?: string | null
          bcv_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          generated_by_system?: boolean
          generation_source?: string | null
          id?: string
          is_merged_period?: boolean
          merge_metadata?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_payroll_id?: string | null
          merged_reason?: string | null
          operators_count?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_notes?: string | null
          payroll_code?: string | null
          period_end: string
          period_start: string
          status?: string
          total_amount?: number
          total_paid_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          work_entries_count?: number
        }
        Update: {
          adjustments_total?: number
          approved_at?: string | null
          approved_by?: string | null
          bcv_rate?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          generated_by_system?: boolean
          generation_source?: string | null
          id?: string
          is_merged_period?: boolean
          merge_metadata?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_payroll_id?: string | null
          merged_reason?: string | null
          operators_count?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_notes?: string | null
          payroll_code?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_amount?: number
          total_paid_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          work_entries_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_runs_merged_into_payroll_id_fkey"
            columns: ["merged_into_payroll_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_payroll_work_entry_links: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          operator_id: string
          payroll_operator_line_id: string
          payroll_run_id: string
          work_entry_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          operator_id: string
          payroll_operator_line_id: string
          payroll_run_id: string
          work_entry_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          operator_id?: string
          payroll_operator_line_id?: string
          payroll_run_id?: string
          work_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_payroll_work_entry_links_payroll_operator_line_id_fkey"
            columns: ["payroll_operator_line_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_operator_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_payroll_work_entry_links_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "core_payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_payroll_work_entry_links_work_entry_id_fkey"
            columns: ["work_entry_id"]
            isOneToOne: true
            referencedRelation: "core_production_work_entries"
            referencedColumns: ["id"]
          },
        ]
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
      core_product_import_job_rows: {
        Row: {
          action: string | null
          core_sku: string | null
          created_at: string
          created_product_id: string | null
          created_variant_id: string | null
          errors: Json | null
          id: string
          job_id: string
          product_name: string | null
          raw_payload: Json | null
          result: string | null
          row_number: number
          updated_product_id: string | null
          updated_variant_id: string | null
          variant_label: string | null
          warnings: Json | null
        }
        Insert: {
          action?: string | null
          core_sku?: string | null
          created_at?: string
          created_product_id?: string | null
          created_variant_id?: string | null
          errors?: Json | null
          id?: string
          job_id: string
          product_name?: string | null
          raw_payload?: Json | null
          result?: string | null
          row_number: number
          updated_product_id?: string | null
          updated_variant_id?: string | null
          variant_label?: string | null
          warnings?: Json | null
        }
        Update: {
          action?: string | null
          core_sku?: string | null
          created_at?: string
          created_product_id?: string | null
          created_variant_id?: string | null
          errors?: Json | null
          id?: string
          job_id?: string
          product_name?: string | null
          raw_payload?: Json | null
          result?: string | null
          row_number?: number
          updated_product_id?: string | null
          updated_variant_id?: string | null
          variant_label?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "core_product_import_job_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "core_product_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      core_product_import_jobs: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string | null
          errors_count: number
          file_name: string | null
          id: string
          notes: string | null
          products_created: number
          products_updated: number
          status: string
          total_rows: number
          variants_created: number
          variants_updated: number
          warnings_count: number
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          errors_count?: number
          file_name?: string | null
          id?: string
          notes?: string | null
          products_created?: number
          products_updated?: number
          status?: string
          total_rows?: number
          variants_created?: number
          variants_updated?: number
          warnings_count?: number
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string | null
          errors_count?: number
          file_name?: string | null
          id?: string
          notes?: string | null
          products_created?: number
          products_updated?: number
          status?: string
          total_rows?: number
          variants_created?: number
          variants_updated?: number
          warnings_count?: number
        }
        Relationships: []
      }
      core_product_strategy_decisions: {
        Row: {
          core_product_id: string | null
          created_at: string
          created_by: string | null
          decision_type: string
          id: string
          new_values: Json | null
          policy_id: string | null
          previous_values: Json | null
          reason: string | null
          woo_product_id: number | null
        }
        Insert: {
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_type: string
          id?: string
          new_values?: Json | null
          policy_id?: string | null
          previous_values?: Json | null
          reason?: string | null
          woo_product_id?: number | null
        }
        Update: {
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_type?: string
          id?: string
          new_values?: Json | null
          policy_id?: string | null
          previous_values?: Json | null
          reason?: string | null
          woo_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_product_strategy_decisions_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_product_strategy_decisions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "core_replenishment_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      core_product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          core_product_id: string
          cost_override_enabled: boolean
          cost_structure_id: string | null
          cost_updated_at: string | null
          created_at: string
          id: string
          normalized_color: string | null
          normalized_size: string | null
          notes: string | null
          qr_code: string | null
          size: string
          sort_order: number
          status: string
          updated_at: string
          uses_parent_cost_structure: boolean
          variant_label: string | null
          variant_sku: string | null
          variant_unit_cost_usd: number | null
          woo_attributes: Json | null
          woo_last_sync_at: string | null
          woo_regular_price: number | null
          woo_sale_price: number | null
          woo_sku: string | null
          woo_stock_quantity: number | null
          woo_variation_id: number | null
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          core_product_id: string
          cost_override_enabled?: boolean
          cost_structure_id?: string | null
          cost_updated_at?: string | null
          created_at?: string
          id?: string
          normalized_color?: string | null
          normalized_size?: string | null
          notes?: string | null
          qr_code?: string | null
          size: string
          sort_order?: number
          status?: string
          updated_at?: string
          uses_parent_cost_structure?: boolean
          variant_label?: string | null
          variant_sku?: string | null
          variant_unit_cost_usd?: number | null
          woo_attributes?: Json | null
          woo_last_sync_at?: string | null
          woo_regular_price?: number | null
          woo_sale_price?: number | null
          woo_sku?: string | null
          woo_stock_quantity?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          barcode?: string | null
          color?: string | null
          core_product_id?: string
          cost_override_enabled?: boolean
          cost_structure_id?: string | null
          cost_updated_at?: string | null
          created_at?: string
          id?: string
          normalized_color?: string | null
          normalized_size?: string | null
          notes?: string | null
          qr_code?: string | null
          size?: string
          sort_order?: number
          status?: string
          updated_at?: string
          uses_parent_cost_structure?: boolean
          variant_label?: string | null
          variant_sku?: string | null
          variant_unit_cost_usd?: number | null
          woo_attributes?: Json | null
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
          {
            foreignKeyName: "core_product_variants_cost_structure_id_fkey"
            columns: ["cost_structure_id"]
            isOneToOne: false
            referencedRelation: "core_cost_structures"
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
          cost_source: string | null
          created_at: string
          estimated_unit_cost: number | null
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
          cost_source?: string | null
          created_at?: string
          estimated_unit_cost?: number | null
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
          cost_source?: string | null
          created_at?: string
          estimated_unit_cost?: number | null
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
      core_production_order_lines_backup_reset_op000008_20260731: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          cost_source: string | null
          created_at: string | null
          estimated_unit_cost: number | null
          id: string | null
          notes: string | null
          production_order_id: string | null
          quantity_completed: number | null
          quantity_ordered: number | null
          quantity_pending: number | null
          size: string | null
          sku: string | null
          status: string | null
          updated_at: string | null
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string | null
          estimated_unit_cost?: number | null
          id?: string | null
          notes?: string | null
          production_order_id?: string | null
          quantity_completed?: number | null
          quantity_ordered?: number | null
          quantity_pending?: number | null
          size?: string | null
          sku?: string | null
          status?: string | null
          updated_at?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string | null
          estimated_unit_cost?: number | null
          id?: string | null
          notes?: string | null
          production_order_id?: string | null
          quantity_completed?: number | null
          quantity_ordered?: number | null
          quantity_pending?: number | null
          size?: string | null
          sku?: string | null
          status?: string | null
          updated_at?: string | null
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
      core_production_orders_backup_reset_op000008_20260731: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          completed_quantity: number | null
          core_product_id: string | null
          created_at: string | null
          created_by: string | null
          expected_date: string | null
          id: string | null
          is_overproduction: boolean | null
          manual_close_notes: string | null
          manual_close_reason: string | null
          manually_closed_at: string | null
          manually_closed_by: string | null
          notes: string | null
          order_code: string | null
          order_type: string | null
          pending_quantity: number | null
          priority: string | null
          product_name: string | null
          reason: string | null
          responsible_user_id: string | null
          sku: string | null
          source: string | null
          status: string | null
          total_quantity: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_quantity?: number | null
          core_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string | null
          is_overproduction?: boolean | null
          manual_close_notes?: string | null
          manual_close_reason?: string | null
          manually_closed_at?: string | null
          manually_closed_by?: string | null
          notes?: string | null
          order_code?: string | null
          order_type?: string | null
          pending_quantity?: number | null
          priority?: string | null
          product_name?: string | null
          reason?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          source?: string | null
          status?: string | null
          total_quantity?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_quantity?: number | null
          core_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          id?: string | null
          is_overproduction?: boolean | null
          manual_close_notes?: string | null
          manual_close_reason?: string | null
          manually_closed_at?: string | null
          manually_closed_by?: string | null
          notes?: string | null
          order_code?: string | null
          order_type?: string | null
          pending_quantity?: number | null
          priority?: string | null
          product_name?: string | null
          reason?: string | null
          responsible_user_id?: string | null
          sku?: string | null
          source?: string | null
          status?: string | null
          total_quantity?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      core_production_scan_events: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          event_type: string
          id: string
          notes: string | null
          operator_id: string | null
          operator_name_snapshot: string | null
          process_name: string | null
          process_order: number | null
          process_type: string | null
          production_order_id: string | null
          production_order_line_id: string | null
          production_unit_id: string
          production_unit_process_id: string | null
          scanned_by_user_id: string | null
          size: string | null
          sku: string | null
          source: string
          status: string
          unit_code: string | null
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          production_unit_id: string
          production_unit_process_id?: string | null
          scanned_by_user_id?: string | null
          size?: string | null
          sku?: string | null
          source?: string
          status?: string
          unit_code?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          production_unit_id?: string
          production_unit_process_id?: string | null
          scanned_by_user_id?: string | null
          size?: string | null
          sku?: string | null
          source?: string
          status?: string
          unit_code?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Relationships: []
      }
      core_production_scan_events_backup_reset_op000008_20260731: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          notes: string | null
          operator_id: string | null
          operator_name_snapshot: string | null
          process_name: string | null
          process_order: number | null
          process_type: string | null
          production_order_id: string | null
          production_order_line_id: string | null
          production_unit_id: string | null
          production_unit_process_id: string | null
          scanned_by_user_id: string | null
          size: string | null
          sku: string | null
          status: string | null
          unit_code: string | null
          variant_label: string | null
          variant_sku: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          production_unit_id?: string | null
          production_unit_process_id?: string | null
          scanned_by_user_id?: string | null
          size?: string | null
          sku?: string | null
          status?: string | null
          unit_code?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          production_unit_id?: string | null
          production_unit_process_id?: string | null
          scanned_by_user_id?: string | null
          size?: string | null
          sku?: string | null
          status?: string | null
          unit_code?: string | null
          variant_label?: string | null
          variant_sku?: string | null
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
          completed_at: string | null
          completed_by_operator_id: string | null
          created_at: string
          id: string
          notes: string | null
          process_name: string
          process_order: number
          process_type: string | null
          production_order_process_id: string | null
          production_unit_id: string
          rate_snapshot: Json | null
          scanned_by_user_id: string | null
          status: string
          suggested_role: string | null
          updated_at: string
        }
        Insert: {
          adds_to_payroll?: boolean
          completed_at?: string | null
          completed_by_operator_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          process_name: string
          process_order?: number
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id: string
          rate_snapshot?: Json | null
          scanned_by_user_id?: string | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Update: {
          adds_to_payroll?: boolean
          completed_at?: string | null
          completed_by_operator_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          process_name?: string
          process_order?: number
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id?: string
          rate_snapshot?: Json | null
          scanned_by_user_id?: string | null
          status?: string
          suggested_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      core_production_unit_processes_backup_reset_op000008_20260731: {
        Row: {
          adds_to_payroll: boolean | null
          completed_at: string | null
          completed_by_operator_id: string | null
          created_at: string | null
          id: string | null
          notes: string | null
          process_name: string | null
          process_order: number | null
          process_type: string | null
          production_order_process_id: string | null
          production_unit_id: string | null
          rate_snapshot: Json | null
          scanned_by_user_id: string | null
          status: string | null
          suggested_role: string | null
          updated_at: string | null
        }
        Insert: {
          adds_to_payroll?: boolean | null
          completed_at?: string | null
          completed_by_operator_id?: string | null
          created_at?: string | null
          id?: string | null
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id?: string | null
          rate_snapshot?: Json | null
          scanned_by_user_id?: string | null
          status?: string | null
          suggested_role?: string | null
          updated_at?: string | null
        }
        Update: {
          adds_to_payroll?: boolean | null
          completed_at?: string | null
          completed_by_operator_id?: string | null
          created_at?: string | null
          id?: string | null
          notes?: string | null
          process_name?: string | null
          process_order?: number | null
          process_type?: string | null
          production_order_process_id?: string | null
          production_unit_id?: string | null
          rate_snapshot?: Json | null
          scanned_by_user_id?: string | null
          status?: string | null
          suggested_role?: string | null
          updated_at?: string | null
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
          entered_inventory_at: string | null
          entered_inventory_by: string | null
          id: string
          inventory_entry_source: string | null
          inventory_override_at: string | null
          inventory_override_by: string | null
          inventory_override_color: string | null
          inventory_override_reason: string | null
          inventory_override_size: string | null
          inventory_override_variant_id: string | null
          inventory_override_variant_sku: string | null
          inventory_override_woo_variation_id: number | null
          inventory_variant_override_enabled: boolean
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
          entered_inventory_at?: string | null
          entered_inventory_by?: string | null
          id?: string
          inventory_entry_source?: string | null
          inventory_override_at?: string | null
          inventory_override_by?: string | null
          inventory_override_color?: string | null
          inventory_override_reason?: string | null
          inventory_override_size?: string | null
          inventory_override_variant_id?: string | null
          inventory_override_variant_sku?: string | null
          inventory_override_woo_variation_id?: number | null
          inventory_variant_override_enabled?: boolean
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
          entered_inventory_at?: string | null
          entered_inventory_by?: string | null
          id?: string
          inventory_entry_source?: string | null
          inventory_override_at?: string | null
          inventory_override_by?: string | null
          inventory_override_color?: string | null
          inventory_override_reason?: string | null
          inventory_override_size?: string | null
          inventory_override_variant_id?: string | null
          inventory_override_variant_sku?: string | null
          inventory_override_woo_variation_id?: number | null
          inventory_variant_override_enabled?: boolean
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
        Relationships: [
          {
            foreignKeyName: "core_production_units_inventory_override_variant_id_fkey"
            columns: ["inventory_override_variant_id"]
            isOneToOne: false
            referencedRelation: "core_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      core_production_units_backup_reset_op000008_20260731: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string | null
          created_by: string | null
          entered_inventory_at: string | null
          entered_inventory_by: string | null
          id: string | null
          inventory_entry_source: string | null
          notes: string | null
          print_count: number | null
          printed_at: string | null
          printed_by: string | null
          production_order_id: string | null
          production_order_line_id: string | null
          qr_generated_at: string | null
          qr_generated_by: string | null
          qr_payload: string | null
          qr_token: string | null
          size: string | null
          sku: string | null
          status: string | null
          unit_code: string | null
          updated_at: string | null
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
          created_at?: string | null
          created_by?: string | null
          entered_inventory_at?: string | null
          entered_inventory_by?: string | null
          id?: string | null
          inventory_entry_source?: string | null
          notes?: string | null
          print_count?: number | null
          printed_at?: string | null
          printed_by?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          qr_generated_at?: string | null
          qr_generated_by?: string | null
          qr_payload?: string | null
          qr_token?: string | null
          size?: string | null
          sku?: string | null
          status?: string | null
          unit_code?: string | null
          updated_at?: string | null
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
          created_at?: string | null
          created_by?: string | null
          entered_inventory_at?: string | null
          entered_inventory_by?: string | null
          id?: string | null
          inventory_entry_source?: string | null
          notes?: string | null
          print_count?: number | null
          printed_at?: string | null
          printed_by?: string | null
          production_order_id?: string | null
          production_order_line_id?: string | null
          qr_generated_at?: string | null
          qr_generated_by?: string | null
          qr_payload?: string | null
          qr_token?: string | null
          size?: string | null
          sku?: string | null
          status?: string | null
          unit_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variant_label?: string | null
          variant_sku?: string | null
        }
        Relationships: []
      }
      core_production_work_entries: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          operator_id: string | null
          operator_name_snapshot: string | null
          payroll_amount: number | null
          payroll_multiplier_snapshot: number | null
          payroll_status: string
          payroll_week_end: string | null
          payroll_week_start: string | null
          process_name: string | null
          process_type: string | null
          production_order_id: string | null
          production_unit_id: string
          production_unit_process_id: string
          rate_snapshot: number | null
          scan_event_id: string | null
          scanned_by_user_id: string | null
          source: string
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          payroll_amount?: number | null
          payroll_multiplier_snapshot?: number | null
          payroll_status?: string
          payroll_week_end?: string | null
          payroll_week_start?: string | null
          process_name?: string | null
          process_type?: string | null
          production_order_id?: string | null
          production_unit_id: string
          production_unit_process_id: string
          rate_snapshot?: number | null
          scan_event_id?: string | null
          scanned_by_user_id?: string | null
          source?: string
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          payroll_amount?: number | null
          payroll_multiplier_snapshot?: number | null
          payroll_status?: string
          payroll_week_end?: string | null
          payroll_week_start?: string | null
          process_name?: string | null
          process_type?: string | null
          production_order_id?: string | null
          production_unit_id?: string
          production_unit_process_id?: string
          rate_snapshot?: number | null
          scan_event_id?: string | null
          scanned_by_user_id?: string | null
          source?: string
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      core_production_work_entries_backup_reset_op000008_20260731: {
        Row: {
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string | null
          currency: string | null
          id: string | null
          notes: string | null
          operator_id: string | null
          operator_name_snapshot: string | null
          payroll_amount: number | null
          payroll_multiplier_snapshot: number | null
          payroll_status: string | null
          payroll_week_end: string | null
          payroll_week_start: string | null
          process_name: string | null
          process_type: string | null
          production_order_id: string | null
          production_unit_id: string | null
          production_unit_process_id: string | null
          rate_snapshot: number | null
          scan_event_id: string | null
          scanned_by_user_id: string | null
          unit_code: string | null
          updated_at: string | null
        }
        Insert: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          payroll_amount?: number | null
          payroll_multiplier_snapshot?: number | null
          payroll_status?: string | null
          payroll_week_end?: string | null
          payroll_week_start?: string | null
          process_name?: string | null
          process_type?: string | null
          production_order_id?: string | null
          production_unit_id?: string | null
          production_unit_process_id?: string | null
          rate_snapshot?: number | null
          scan_event_id?: string | null
          scanned_by_user_id?: string | null
          unit_code?: string | null
          updated_at?: string | null
        }
        Update: {
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name_snapshot?: string | null
          payroll_amount?: number | null
          payroll_multiplier_snapshot?: number | null
          payroll_status?: string | null
          payroll_week_end?: string | null
          payroll_week_start?: string | null
          process_name?: string | null
          process_type?: string | null
          production_order_id?: string | null
          production_unit_id?: string | null
          production_unit_process_id?: string | null
          rate_snapshot?: number | null
          scan_event_id?: string | null
          scanned_by_user_id?: string | null
          unit_code?: string | null
          updated_at?: string | null
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
          manual_cost_reason: string | null
          manual_unit_cost_usd: number | null
          name: string
          notes: string | null
          product_priority: string
          product_type: string | null
          replenishment_mode: string
          replenishment_policy_id: string | null
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
          manual_cost_reason?: string | null
          manual_unit_cost_usd?: number | null
          name: string
          notes?: string | null
          product_priority?: string
          product_type?: string | null
          replenishment_mode?: string
          replenishment_policy_id?: string | null
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
          manual_cost_reason?: string | null
          manual_unit_cost_usd?: number | null
          name?: string
          notes?: string | null
          product_priority?: string
          product_type?: string | null
          replenishment_mode?: string
          replenishment_policy_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "core_products_replenishment_policy_id_fkey"
            columns: ["replenishment_policy_id"]
            isOneToOne: false
            referencedRelation: "core_replenishment_policies"
            referencedColumns: ["id"]
          },
        ]
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
      core_replenishment_policies: {
        Row: {
          brand_role: string
          core_product_id: string | null
          created_at: string
          created_by: string | null
          decision_reason: string | null
          external_supplier_id: string | null
          external_supplier_lead_time_days: number | null
          external_supplier_min_qty: number | null
          external_supplier_name: string | null
          external_supplier_notes: string | null
          external_supplier_unit_cost_usd: number | null
          id: string
          last_reviewed_at: string | null
          lifecycle_status: string
          manual_cost_reason: string | null
          manual_cost_updated_at: string | null
          manual_cost_updated_by: string | null
          manual_unit_cost_usd: number | null
          product_name_snapshot: string | null
          replacement_behavior: string
          replacement_product_id: string | null
          replacement_woo_product_id: number | null
          replenishment_route: string
          restock_enabled: boolean
          reviewed_by: string | null
          sku_snapshot: string | null
          updated_at: string
          updated_by: string | null
          woo_product_id: number | null
        }
        Insert: {
          brand_role?: string
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          external_supplier_id?: string | null
          external_supplier_lead_time_days?: number | null
          external_supplier_min_qty?: number | null
          external_supplier_name?: string | null
          external_supplier_notes?: string | null
          external_supplier_unit_cost_usd?: number | null
          id?: string
          last_reviewed_at?: string | null
          lifecycle_status?: string
          manual_cost_reason?: string | null
          manual_cost_updated_at?: string | null
          manual_cost_updated_by?: string | null
          manual_unit_cost_usd?: number | null
          product_name_snapshot?: string | null
          replacement_behavior?: string
          replacement_product_id?: string | null
          replacement_woo_product_id?: number | null
          replenishment_route?: string
          restock_enabled?: boolean
          reviewed_by?: string | null
          sku_snapshot?: string | null
          updated_at?: string
          updated_by?: string | null
          woo_product_id?: number | null
        }
        Update: {
          brand_role?: string
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          external_supplier_id?: string | null
          external_supplier_lead_time_days?: number | null
          external_supplier_min_qty?: number | null
          external_supplier_name?: string | null
          external_supplier_notes?: string | null
          external_supplier_unit_cost_usd?: number | null
          id?: string
          last_reviewed_at?: string | null
          lifecycle_status?: string
          manual_cost_reason?: string | null
          manual_cost_updated_at?: string | null
          manual_cost_updated_by?: string | null
          manual_unit_cost_usd?: number | null
          product_name_snapshot?: string | null
          replacement_behavior?: string
          replacement_product_id?: string | null
          replacement_woo_product_id?: number | null
          replenishment_route?: string
          restock_enabled?: boolean
          reviewed_by?: string | null
          sku_snapshot?: string | null
          updated_at?: string
          updated_by?: string | null
          woo_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "core_replenishment_policies_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_replenishment_policies_replacement_product_id_fkey"
            columns: ["replacement_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
        ]
      }
      core_replenishment_policy_events: {
        Row: {
          action: string
          amount: number | null
          core_product_id: string | null
          core_variant_id: string | null
          cost_source: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          external_supplier_name: string | null
          external_supplier_unit_cost_usd: number | null
          id: string
          message: string | null
          policy_id: string | null
          quantity: number | null
          replacement_behavior: string | null
          replacement_product_id: string | null
          replacement_woo_product_id: number | null
          resolution_data: Json
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_id: string | null
          source_type: string
          status: string
          unit_cost: number | null
          warning: string | null
          woo_order_id: number | null
          woo_order_item_id: number | null
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          action: string
          amount?: number | null
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          external_supplier_name?: string | null
          external_supplier_unit_cost_usd?: number | null
          id?: string
          message?: string | null
          policy_id?: string | null
          quantity?: number | null
          replacement_behavior?: string | null
          replacement_product_id?: string | null
          replacement_woo_product_id?: number | null
          resolution_data?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source_id?: string | null
          source_type: string
          status?: string
          unit_cost?: number | null
          warning?: string | null
          woo_order_id?: number | null
          woo_order_item_id?: number | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          action?: string
          amount?: number | null
          core_product_id?: string | null
          core_variant_id?: string | null
          cost_source?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          external_supplier_name?: string | null
          external_supplier_unit_cost_usd?: number | null
          id?: string
          message?: string | null
          policy_id?: string | null
          quantity?: number | null
          replacement_behavior?: string | null
          replacement_product_id?: string | null
          replacement_woo_product_id?: number | null
          resolution_data?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id?: string | null
          source_type?: string
          status?: string
          unit_cost?: number | null
          warning?: string | null
          woo_order_id?: number | null
          woo_order_item_id?: number | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Relationships: []
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
          woo_write_mode: string
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
          woo_write_mode?: string
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
          woo_write_mode?: string
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
      core_woo_product_map: {
        Row: {
          core_product_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_synced_at: string | null
          mapping_status: string
          updated_at: string
          updated_by: string | null
          variants_sync_status: string
          woo_parent_id: number | null
          woo_permalink: string | null
          woo_product_id: number
          woo_product_name: string | null
          woo_product_sku: string | null
          woo_product_type: string | null
          woo_raw_payload: Json | null
          woo_status: string | null
          woo_variations_count: number
        }
        Insert: {
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          mapping_status?: string
          updated_at?: string
          updated_by?: string | null
          variants_sync_status?: string
          woo_parent_id?: number | null
          woo_permalink?: string | null
          woo_product_id: number
          woo_product_name?: string | null
          woo_product_sku?: string | null
          woo_product_type?: string | null
          woo_raw_payload?: Json | null
          woo_status?: string | null
          woo_variations_count?: number
        }
        Update: {
          core_product_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_synced_at?: string | null
          mapping_status?: string
          updated_at?: string
          updated_by?: string | null
          variants_sync_status?: string
          woo_parent_id?: number | null
          woo_permalink?: string | null
          woo_product_id?: number
          woo_product_name?: string | null
          woo_product_sku?: string | null
          woo_product_type?: string | null
          woo_raw_payload?: Json | null
          woo_status?: string | null
          woo_variations_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_woo_product_map_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
        ]
      }
      core_woo_variant_map: {
        Row: {
          color_label: string | null
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          id: string
          mapping_status: string
          normalized_color: string | null
          normalized_size: string | null
          size_label: string | null
          updated_at: string
          woo_attributes: Json | null
          woo_price: number | null
          woo_product_id: number
          woo_raw_payload: Json | null
          woo_stock_quantity: number | null
          woo_variant_sku: string | null
          woo_variation_id: number
        }
        Insert: {
          color_label?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          normalized_color?: string | null
          normalized_size?: string | null
          size_label?: string | null
          updated_at?: string
          woo_attributes?: Json | null
          woo_price?: number | null
          woo_product_id: number
          woo_raw_payload?: Json | null
          woo_stock_quantity?: number | null
          woo_variant_sku?: string | null
          woo_variation_id: number
        }
        Update: {
          color_label?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          normalized_color?: string | null
          normalized_size?: string | null
          size_label?: string | null
          updated_at?: string
          woo_attributes?: Json | null
          woo_price?: number | null
          woo_product_id?: number
          woo_raw_payload?: Json | null
          woo_stock_quantity?: number | null
          woo_variant_sku?: string | null
          woo_variation_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "core_woo_variant_map_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "core_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_woo_variant_map_core_variant_id_fkey"
            columns: ["core_variant_id"]
            isOneToOne: false
            referencedRelation: "core_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      core_woo_write_logs: {
        Row: {
          action_type: string
          confirmed_at: string | null
          confirmed_by: string | null
          core_product_id: string | null
          core_variant_id: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          inventory_entry_id: string | null
          mode: string
          production_order_id: string | null
          production_unit_id: string | null
          quantity_delta: number | null
          request_payload: Json | null
          response_payload: Json | null
          sku: string | null
          source_id: string | null
          source_type: string | null
          status: string
          stock_after_confirmed: number | null
          stock_after_expected: number | null
          stock_before: number | null
          variant_sku: string | null
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          action_type: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_entry_id?: string | null
          mode: string
          production_order_id?: string | null
          production_unit_id?: string | null
          quantity_delta?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          sku?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          stock_after_confirmed?: number | null
          stock_after_expected?: number | null
          stock_before?: number | null
          variant_sku?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          action_type?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          core_product_id?: string | null
          core_variant_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_entry_id?: string | null
          mode?: string
          production_order_id?: string | null
          production_unit_id?: string | null
          quantity_delta?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          sku?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          stock_after_confirmed?: number | null
          stock_after_expected?: number | null
          stock_before?: number | null
          variant_sku?: string | null
          woo_product_id?: number | null
          woo_variation_id?: number | null
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
      esp_fabrication_material_consumptions: {
        Row: {
          actual_material_id: string | null
          consumed_quantity: number
          created_at: string
          created_by: string | null
          expected_material_id: string | null
          expected_variant_id: string | null
          fabrication_request_id: string
          id: string
          location_id: string | null
          material_id: string
          material_movement_id: string | null
          notes: string | null
          override_reason: string | null
          planned_quantity: number
          recipe_id: string | null
          recipe_item_id: string | null
          size_strategy: string | null
          was_overridden: boolean
        }
        Insert: {
          actual_material_id?: string | null
          consumed_quantity: number
          created_at?: string
          created_by?: string | null
          expected_material_id?: string | null
          expected_variant_id?: string | null
          fabrication_request_id: string
          id?: string
          location_id?: string | null
          material_id: string
          material_movement_id?: string | null
          notes?: string | null
          override_reason?: string | null
          planned_quantity: number
          recipe_id?: string | null
          recipe_item_id?: string | null
          size_strategy?: string | null
          was_overridden?: boolean
        }
        Update: {
          actual_material_id?: string | null
          consumed_quantity?: number
          created_at?: string
          created_by?: string | null
          expected_material_id?: string | null
          expected_variant_id?: string | null
          fabrication_request_id?: string
          id?: string
          location_id?: string | null
          material_id?: string
          material_movement_id?: string | null
          notes?: string | null
          override_reason?: string | null
          planned_quantity?: number
          recipe_id?: string | null
          recipe_item_id?: string | null
          size_strategy?: string | null
          was_overridden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "esp_fabrication_material_consumptio_fabrication_request_id_fkey"
            columns: ["fabrication_request_id"]
            isOneToOne: false
            referencedRelation: "esp_fabrication_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_material_consumptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_material_consumptions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "esp_material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_material_consumptions_material_movement_id_fkey"
            columns: ["material_movement_id"]
            isOneToOne: false
            referencedRelation: "esp_material_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_material_consumptions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "esp_product_material_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_material_consumptions_recipe_item_id_fkey"
            columns: ["recipe_item_id"]
            isOneToOne: false
            referencedRelation: "esp_product_material_recipe_items"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_fabrication_requests: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          is_legacy: boolean
          is_test: boolean
          legacy_reason: string | null
          manual_reason: string | null
          manual_reason_detail: string | null
          notes: string | null
          pos_location_id: string | null
          pos_location_name: string | null
          pos_sale_id: string | null
          pos_sale_item_id: string | null
          pos_sale_number: string | null
          priority: string
          product_id: string | null
          product_name: string | null
          production_note_id: string | null
          quantity: number
          requires_shipping: boolean
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_country: string | null
          ship_to_name: string | null
          ship_to_phone: string | null
          ship_to_postal_code: string | null
          ship_to_province: string | null
          sku: string | null
          source_order_id: string | null
          source_order_item_id: string | null
          source_type: string
          status: string
          test_reason: string | null
          updated_at: string
          updated_by: string | null
          variant_id: string | null
          variant_label: string | null
          woo_order_id: number | null
          woo_order_item_id: number | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_legacy?: boolean
          is_test?: boolean
          legacy_reason?: string | null
          manual_reason?: string | null
          manual_reason_detail?: string | null
          notes?: string | null
          pos_location_id?: string | null
          pos_location_name?: string | null
          pos_sale_id?: string | null
          pos_sale_item_id?: string | null
          pos_sale_number?: string | null
          priority?: string
          product_id?: string | null
          product_name?: string | null
          production_note_id?: string | null
          quantity?: number
          requires_shipping?: boolean
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_name?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_province?: string | null
          sku?: string | null
          source_order_id?: string | null
          source_order_item_id?: string | null
          source_type?: string
          status?: string
          test_reason?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          variant_label?: string | null
          woo_order_id?: number | null
          woo_order_item_id?: number | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_legacy?: boolean
          is_test?: boolean
          legacy_reason?: string | null
          manual_reason?: string | null
          manual_reason_detail?: string | null
          notes?: string | null
          pos_location_id?: string | null
          pos_location_name?: string | null
          pos_sale_id?: string | null
          pos_sale_item_id?: string | null
          pos_sale_number?: string | null
          priority?: string
          product_id?: string | null
          product_name?: string | null
          production_note_id?: string | null
          quantity?: number
          requires_shipping?: boolean
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_name?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_province?: string | null
          sku?: string | null
          source_order_id?: string | null
          source_order_item_id?: string | null
          source_type?: string
          status?: string
          test_reason?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          variant_label?: string | null
          woo_order_id?: number | null
          woo_order_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_fabrication_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_requests_production_note_id_fkey"
            columns: ["production_note_id"]
            isOneToOne: false
            referencedRelation: "esp_production_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_requests_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "esp_woo_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_requests_source_order_item_id_fkey"
            columns: ["source_order_item_id"]
            isOneToOne: true
            referencedRelation: "esp_woo_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_fabrication_requests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          location_id: string | null
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          to_location_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_inventory_stock: {
        Row: {
          id: string
          location_id: string
          low_stock_threshold: number
          product_id: string
          quantity_on_hand: number
          quantity_reserved: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          id?: string
          location_id: string
          low_stock_threshold?: number
          product_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          id?: string
          location_id?: string
          low_stock_threshold?: number
          product_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_inventory_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_locations: {
        Row: {
          city: string | null
          code: string
          connects_to_woo: boolean
          country: string
          created_at: string
          currency: string
          id: string
          inventory_mode: string
          is_active: boolean
          linked_location_id: string | null
          name: string
          notes: string | null
          public_pos_created_at: string | null
          public_pos_enabled: boolean
          public_pos_last_used_at: string | null
          public_pos_pin: string | null
          public_pos_slug: string | null
          public_pos_token: string | null
          type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          connects_to_woo?: boolean
          country?: string
          created_at?: string
          currency?: string
          id?: string
          inventory_mode?: string
          is_active?: boolean
          linked_location_id?: string | null
          name: string
          notes?: string | null
          public_pos_created_at?: string | null
          public_pos_enabled?: boolean
          public_pos_last_used_at?: string | null
          public_pos_pin?: string | null
          public_pos_slug?: string | null
          public_pos_token?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          connects_to_woo?: boolean
          country?: string
          created_at?: string
          currency?: string
          id?: string
          inventory_mode?: string
          is_active?: boolean
          linked_location_id?: string | null
          name?: string
          notes?: string | null
          public_pos_created_at?: string | null
          public_pos_enabled?: boolean
          public_pos_last_used_at?: string | null
          public_pos_pin?: string | null
          public_pos_slug?: string | null
          public_pos_token?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_locations_linked_location_id_fkey"
            columns: ["linked_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_material_items: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          low_stock_threshold: number
          material_type: string
          name: string
          normalized_size: string | null
          notes: string | null
          replenishment_priority: string
          size: string | null
          sku: string | null
          status: string
          unit: string
          unit_cost_eur: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          material_type: string
          name: string
          normalized_size?: string | null
          notes?: string | null
          replenishment_priority?: string
          size?: string | null
          sku?: string | null
          status?: string
          unit?: string
          unit_cost_eur?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          material_type?: string
          name?: string
          normalized_size?: string | null
          notes?: string | null
          replenishment_priority?: string
          size?: string | null
          sku?: string | null
          status?: string
          unit?: string
          unit_cost_eur?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      esp_material_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          location_id: string | null
          material_id: string
          movement_type: string
          notes: string | null
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          to_location_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          material_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          material_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_material_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_material_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_material_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "esp_material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_material_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_material_stock: {
        Row: {
          id: string
          location_id: string | null
          low_stock_threshold: number | null
          material_id: string
          quantity_on_hand: number
          quantity_reserved: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          location_id?: string | null
          low_stock_threshold?: number | null
          material_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          location_id?: string | null
          low_stock_threshold?: number | null
          material_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_material_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_material_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "esp_material_items"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_payment_methods: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          key: string
          location_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          location_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          location_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_payment_methods_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_product_material_recipe_items: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          quantity_per_unit: number
          recipe_id: string
          required: boolean
          size_strategy: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          quantity_per_unit?: number
          recipe_id: string
          required?: boolean
          size_strategy?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          quantity_per_unit?: number
          recipe_id?: string
          required?: boolean
          size_strategy?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_product_material_recipe_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "esp_material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_product_material_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "esp_product_material_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_product_material_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          product_id: string
          status: string
          updated_at: string
          updated_by: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          product_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_product_material_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_product_material_recipes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          cost_eur: number | null
          created_at: string
          created_by: string | null
          fulfillment_mode: string | null
          id: string
          price_eur: number | null
          product_id: string
          qr_code: string | null
          requires_fabrication: boolean | null
          scan_code: string | null
          size: string | null
          sort_order: number | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          variant_sku: string
          woo_manage_stock: boolean | null
          woo_product_id: number | null
          woo_status: string | null
          woo_stock_quantity: number | null
          woo_stock_status: string | null
          woo_synced_at: string | null
          woo_variation_id: number | null
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          fulfillment_mode?: string | null
          id?: string
          price_eur?: number | null
          product_id: string
          qr_code?: string | null
          requires_fabrication?: boolean | null
          scan_code?: string | null
          size?: string | null
          sort_order?: number | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_sku: string
          woo_manage_stock?: boolean | null
          woo_product_id?: number | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_stock_status?: string | null
          woo_synced_at?: string | null
          woo_variation_id?: number | null
        }
        Update: {
          barcode?: string | null
          color?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          fulfillment_mode?: string | null
          id?: string
          price_eur?: number | null
          product_id?: string
          qr_code?: string | null
          requires_fabrication?: boolean | null
          scan_code?: string | null
          size?: string | null
          sort_order?: number | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_sku?: string
          woo_manage_stock?: boolean | null
          woo_product_id?: number | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_stock_status?: string | null
          woo_synced_at?: string | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_production_note_materials: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          line_cost_eur: number | null
          location_id: string
          location_name: string | null
          material_color: string | null
          material_id: string
          material_movement_id: string | null
          material_name: string | null
          material_size: string | null
          material_sku: string | null
          material_type: string | null
          note_id: string
          quantity_per_unit: number
          total_quantity: number
          unit_cost_eur: number | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_cost_eur?: number | null
          location_id: string
          location_name?: string | null
          material_color?: string | null
          material_id: string
          material_movement_id?: string | null
          material_name?: string | null
          material_size?: string | null
          material_sku?: string | null
          material_type?: string | null
          note_id: string
          quantity_per_unit: number
          total_quantity: number
          unit_cost_eur?: number | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_cost_eur?: number | null
          location_id?: string
          location_name?: string | null
          material_color?: string | null
          material_id?: string
          material_movement_id?: string | null
          material_name?: string | null
          material_size?: string | null
          material_sku?: string | null
          material_type?: string | null
          note_id?: string
          quantity_per_unit?: number
          total_quantity?: number
          unit_cost_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_production_note_materials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_production_note_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "esp_material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_production_note_materials_material_movement_id_fkey"
            columns: ["material_movement_id"]
            isOneToOne: false
            referencedRelation: "esp_material_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_production_note_materials_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "esp_production_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_production_notes: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          status: string
          title: string
          total_cost_eur: number | null
          units: number
          updated_at: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string
          title: string
          total_cost_eur?: number | null
          units?: number
          updated_at?: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string
          title?: string
          total_cost_eur?: number | null
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_production_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_products: {
        Row: {
          category: string | null
          color: string | null
          cost_eur: number | null
          created_at: string
          created_by: string | null
          description: string | null
          fulfillment_mode: string
          has_variants: boolean
          id: string
          image_url: string | null
          is_made_to_order: boolean
          is_sellable: boolean
          name: string
          notes: string | null
          operation_policy_locked: boolean
          price_eur: number | null
          product_type: string | null
          requires_fabrication: boolean
          sku: string
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          web_stock_policy: string
          woo_image_url: string | null
          woo_manage_stock: boolean | null
          woo_permalink: string | null
          woo_product_id: number | null
          woo_status: string | null
          woo_stock_quantity: number | null
          woo_stock_status: string | null
          woo_synced_at: string | null
          woo_type: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fulfillment_mode?: string
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_made_to_order?: boolean
          is_sellable?: boolean
          name: string
          notes?: string | null
          operation_policy_locked?: boolean
          price_eur?: number | null
          product_type?: string | null
          requires_fabrication?: boolean
          sku: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          web_stock_policy?: string
          woo_image_url?: string | null
          woo_manage_stock?: boolean | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_stock_status?: string | null
          woo_synced_at?: string | null
          woo_type?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fulfillment_mode?: string
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_made_to_order?: boolean
          is_sellable?: boolean
          name?: string
          notes?: string | null
          operation_policy_locked?: boolean
          price_eur?: number | null
          product_type?: string | null
          requires_fabrication?: boolean
          sku?: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          web_stock_policy?: string
          woo_image_url?: string | null
          woo_manage_stock?: boolean | null
          woo_permalink?: string | null
          woo_product_id?: number | null
          woo_status?: string | null
          woo_stock_quantity?: number | null
          woo_stock_status?: string | null
          woo_synced_at?: string | null
          woo_type?: string | null
        }
        Relationships: []
      }
      esp_sale_items: {
        Row: {
          created_at: string
          id: string
          inventory_movement_id: string | null
          product_id: string | null
          product_name_snapshot: string | null
          quantity: number
          sale_id: string
          sku_snapshot: string | null
          source: string
          subtotal_eur: number
          unit_price_eur: number
          variant_id: string | null
          variant_label_snapshot: string | null
          woo_order_item_id: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity: number
          sale_id: string
          sku_snapshot?: string | null
          source?: string
          subtotal_eur: number
          unit_price_eur: number
          variant_id?: string | null
          variant_label_snapshot?: string | null
          woo_order_item_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          sale_id?: string
          sku_snapshot?: string | null
          source?: string
          subtotal_eur?: number
          unit_price_eur?: number
          variant_id?: string | null
          variant_label_snapshot?: string | null
          woo_order_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_sale_items_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "esp_inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "esp_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_sale_payments: {
        Row: {
          amount_eur: number
          created_at: string
          created_by: string | null
          id: string
          payment_method_id: string | null
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount_eur: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method_id?: string | null
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_method_id?: string | null
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_sale_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "esp_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "esp_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_sales: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          customer_email_snapshot: string | null
          customer_name_snapshot: string | null
          discount_eur: number
          external_order_number: string | null
          id: string
          inventory_location_id: string | null
          location_id: string | null
          notes: string | null
          payment_status: string
          reference_id: string | null
          reference_type: string | null
          sale_date: string
          sale_number: string
          shipping_total_eur: number
          source: string
          status: string
          subtotal_eur: number
          total_eur: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email_snapshot?: string | null
          customer_name_snapshot?: string | null
          discount_eur?: number
          external_order_number?: string | null
          id?: string
          inventory_location_id?: string | null
          location_id?: string | null
          notes?: string | null
          payment_status?: string
          reference_id?: string | null
          reference_type?: string | null
          sale_date?: string
          sale_number: string
          shipping_total_eur?: number
          source?: string
          status?: string
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email_snapshot?: string | null
          customer_name_snapshot?: string | null
          discount_eur?: number
          external_order_number?: string | null
          id?: string
          inventory_location_id?: string | null
          location_id?: string | null
          notes?: string | null
          payment_status?: string
          reference_id?: string | null
          reference_type?: string | null
          sale_date?: string
          sale_number?: string
          shipping_total_eur?: number
          source?: string
          status?: string
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_sales_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "esp_sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sales_inventory_location_id_fkey"
            columns: ["inventory_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_sales_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          location_id: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          location_id?: string | null
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          location_id?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_sales_channels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_settings: {
        Row: {
          auto_create_fabrication_for_mto: boolean
          auto_decrement_web_stock: boolean
          country: string
          created_at: string
          currency: string
          data_mode: string
          id: string
          interpret_woo_unmanaged_as_made_to_order: boolean
          main_city: string | null
          main_website: string | null
          module_active: boolean
          updated_at: string
          web_stock_location_id: string | null
          woo_connected: boolean
          woo_status: string
        }
        Insert: {
          auto_create_fabrication_for_mto?: boolean
          auto_decrement_web_stock?: boolean
          country?: string
          created_at?: string
          currency?: string
          data_mode?: string
          id?: string
          interpret_woo_unmanaged_as_made_to_order?: boolean
          main_city?: string | null
          main_website?: string | null
          module_active?: boolean
          updated_at?: string
          web_stock_location_id?: string | null
          woo_connected?: boolean
          woo_status?: string
        }
        Update: {
          auto_create_fabrication_for_mto?: boolean
          auto_decrement_web_stock?: boolean
          country?: string
          created_at?: string
          currency?: string
          data_mode?: string
          id?: string
          interpret_woo_unmanaged_as_made_to_order?: boolean
          main_city?: string | null
          main_website?: string | null
          module_active?: boolean
          updated_at?: string
          web_stock_location_id?: string | null
          woo_connected?: boolean
          woo_status?: string
        }
        Relationships: []
      }
      esp_user_location_access: {
        Row: {
          allowed_location_ids: string[]
          can_choose_location: boolean
          created_at: string
          default_location_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_location_ids?: string[]
          can_choose_location?: boolean
          created_at?: string
          default_location_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_location_ids?: string[]
          can_choose_location?: boolean
          created_at?: string
          default_location_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp_user_location_access_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "esp_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_woo_order_items: {
        Row: {
          created_at: string
          esp_woo_order_id: string
          fabrication_request_id: string | null
          id: string
          mapped_manually_at: string | null
          mapped_manually_by: string | null
          mapping_note: string | null
          mapping_status: string
          name: string
          needs_fabrication: boolean
          product_id: string | null
          quantity: number
          raw_payload: Json | null
          sku: string | null
          subtotal_eur: number
          total_eur: number
          unit_price_eur: number | null
          variant_id: string | null
          woo_order_id: number
          woo_order_item_id: number
          woo_product_id: number | null
          woo_variation_id: number | null
        }
        Insert: {
          created_at?: string
          esp_woo_order_id: string
          fabrication_request_id?: string | null
          id?: string
          mapped_manually_at?: string | null
          mapped_manually_by?: string | null
          mapping_note?: string | null
          mapping_status?: string
          name: string
          needs_fabrication?: boolean
          product_id?: string | null
          quantity?: number
          raw_payload?: Json | null
          sku?: string | null
          subtotal_eur?: number
          total_eur?: number
          unit_price_eur?: number | null
          variant_id?: string | null
          woo_order_id: number
          woo_order_item_id: number
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Update: {
          created_at?: string
          esp_woo_order_id?: string
          fabrication_request_id?: string | null
          id?: string
          mapped_manually_at?: string | null
          mapped_manually_by?: string | null
          mapping_note?: string | null
          mapping_status?: string
          name?: string
          needs_fabrication?: boolean
          product_id?: string | null
          quantity?: number
          raw_payload?: Json | null
          sku?: string | null
          subtotal_eur?: number
          total_eur?: number
          unit_price_eur?: number | null
          variant_id?: string | null
          woo_order_id?: number
          woo_order_item_id?: number
          woo_product_id?: number | null
          woo_variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp_woo_order_items_esp_woo_order_id_fkey"
            columns: ["esp_woo_order_id"]
            isOneToOne: false
            referencedRelation: "esp_woo_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_woo_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "esp_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esp_woo_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "esp_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_woo_order_sync_runs: {
        Row: {
          created_by: string | null
          errors_count: number
          fabrication_requests_created: number
          finished_at: string | null
          id: string
          items_checked: number
          items_created: number
          items_updated: number
          orders_checked: number
          orders_created: number
          orders_updated: number
          params: Json | null
          sales_created: number
          sales_updated: number
          started_at: string
          status: string
          summary: Json | null
          sync_type: string
          unmapped_items: number
        }
        Insert: {
          created_by?: string | null
          errors_count?: number
          fabrication_requests_created?: number
          finished_at?: string | null
          id?: string
          items_checked?: number
          items_created?: number
          items_updated?: number
          orders_checked?: number
          orders_created?: number
          orders_updated?: number
          params?: Json | null
          sales_created?: number
          sales_updated?: number
          started_at?: string
          status?: string
          summary?: Json | null
          sync_type?: string
          unmapped_items?: number
        }
        Update: {
          created_by?: string | null
          errors_count?: number
          fabrication_requests_created?: number
          finished_at?: string | null
          id?: string
          items_checked?: number
          items_created?: number
          items_updated?: number
          orders_checked?: number
          orders_created?: number
          orders_updated?: number
          params?: Json | null
          sales_created?: number
          sales_updated?: number
          started_at?: string
          status?: string
          summary?: Json | null
          sync_type?: string
          unmapped_items?: number
        }
        Relationships: []
      }
      esp_woo_orders: {
        Row: {
          billing_address_snapshot: Json | null
          billing_city: string | null
          billing_country: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: number | null
          customer_name: string | null
          customer_phone: string | null
          date_created: string | null
          date_modified: string | null
          date_paid: string | null
          discount_eur: number
          esp_sale_id: string | null
          id: string
          imported_at: string
          last_synced_at: string
          order_number: string | null
          payment_method: string | null
          payment_method_title: string | null
          raw_payload: Json | null
          shipping_address_snapshot: Json | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_total_eur: number
          source: string
          status: string
          subtotal_eur: number
          total_eur: number
          total_tax_eur: number
          updated_at: string
          woo_order_id: number
        }
        Insert: {
          billing_address_snapshot?: Json | null
          billing_city?: string | null
          billing_country?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          discount_eur?: number
          esp_sale_id?: string | null
          id?: string
          imported_at?: string
          last_synced_at?: string
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_payload?: Json | null
          shipping_address_snapshot?: Json | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_total_eur?: number
          source?: string
          status: string
          subtotal_eur?: number
          total_eur?: number
          total_tax_eur?: number
          updated_at?: string
          woo_order_id: number
        }
        Update: {
          billing_address_snapshot?: Json | null
          billing_city?: string | null
          billing_country?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          discount_eur?: number
          esp_sale_id?: string | null
          id?: string
          imported_at?: string
          last_synced_at?: string
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_payload?: Json | null
          shipping_address_snapshot?: Json | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_total_eur?: number
          source?: string
          status?: string
          subtotal_eur?: number
          total_eur?: number
          total_tax_eur?: number
          updated_at?: string
          woo_order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "esp_woo_orders_esp_sale_id_fkey"
            columns: ["esp_sale_id"]
            isOneToOne: false
            referencedRelation: "esp_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      esp_woo_sync_runs: {
        Row: {
          created_by: string | null
          errors_count: number
          finished_at: string | null
          id: string
          products_checked: number
          products_created: number
          products_updated: number
          skipped_no_sku: number
          started_at: string
          status: string
          summary: Json | null
          sync_type: string
          variants_checked: number
          variants_created: number
          variants_updated: number
        }
        Insert: {
          created_by?: string | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          products_checked?: number
          products_created?: number
          products_updated?: number
          skipped_no_sku?: number
          started_at?: string
          status?: string
          summary?: Json | null
          sync_type?: string
          variants_checked?: number
          variants_created?: number
          variants_updated?: number
        }
        Update: {
          created_by?: string | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          products_checked?: number
          products_created?: number
          products_updated?: number
          skipped_no_sku?: number
          started_at?: string
          status?: string
          summary?: Json | null
          sync_type?: string
          variants_checked?: number
          variants_created?: number
          variants_updated?: number
        }
        Relationships: []
      }
      estudio_background_prompts: {
        Row: {
          background_id: string
          created_at: string
          id: string
          model_id: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          background_id: string
          created_at?: string
          id?: string
          model_id: string
          prompt_text?: string
          updated_at?: string
        }
        Update: {
          background_id?: string
          created_at?: string
          id?: string
          model_id?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudio_background_prompts_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "estudio_backgrounds"
            referencedColumns: ["id"]
          },
        ]
      }
      estudio_backgrounds: {
        Row: {
          cover_path: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          reference_path: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reference_path?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reference_path?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      estudio_brand_template: {
        Row: {
          generate_story_variant: boolean
          id: string
          logo_position: string
          logo_storage_path: string | null
          primary_color: string
          secondary_color: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          generate_story_variant?: boolean
          id?: string
          logo_position?: string
          logo_storage_path?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          generate_story_variant?: boolean
          id?: string
          logo_position?: string
          logo_storage_path?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      estudio_enabled_models: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          kind: string
          label: string | null
          model_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          kind: string
          label?: string | null
          model_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          kind?: string
          label?: string | null
          model_id?: string
        }
        Relationships: []
      }
      estudio_image_jobs: {
        Row: {
          archived_at: string | null
          background_color_source: string | null
          background_reference_path: string | null
          catalog_background_color: string | null
          composition_mode: string
          composition_params: Json | null
          composition_path: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          cutout_path: string | null
          error_message: string | null
          fidelity_pipeline_version: number
          garment_notes: string | null
          generated_image_path: string | null
          id: string
          image_model: string
          instagram_feed_path: string | null
          instagram_story_path: string | null
          is_inferred: boolean
          mask_path: string | null
          model_photo_path: string | null
          output_size: string | null
          photo_type: string
          prompt_preset_id: string | null
          prompt_used: string
          session_id: string | null
          source_photo_path: string
          status: string
          uses_model_reference: boolean
          view_type: string
        }
        Insert: {
          archived_at?: string | null
          background_color_source?: string | null
          background_reference_path?: string | null
          catalog_background_color?: string | null
          composition_mode?: string
          composition_params?: Json | null
          composition_path?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          cutout_path?: string | null
          error_message?: string | null
          fidelity_pipeline_version?: number
          garment_notes?: string | null
          generated_image_path?: string | null
          id?: string
          image_model: string
          instagram_feed_path?: string | null
          instagram_story_path?: string | null
          is_inferred?: boolean
          mask_path?: string | null
          model_photo_path?: string | null
          output_size?: string | null
          photo_type: string
          prompt_preset_id?: string | null
          prompt_used: string
          session_id?: string | null
          source_photo_path: string
          status?: string
          uses_model_reference?: boolean
          view_type?: string
        }
        Update: {
          archived_at?: string | null
          background_color_source?: string | null
          background_reference_path?: string | null
          catalog_background_color?: string | null
          composition_mode?: string
          composition_params?: Json | null
          composition_path?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          cutout_path?: string | null
          error_message?: string | null
          fidelity_pipeline_version?: number
          garment_notes?: string | null
          generated_image_path?: string | null
          id?: string
          image_model?: string
          instagram_feed_path?: string | null
          instagram_story_path?: string | null
          is_inferred?: boolean
          mask_path?: string | null
          model_photo_path?: string | null
          output_size?: string | null
          photo_type?: string
          prompt_preset_id?: string | null
          prompt_used?: string
          session_id?: string | null
          source_photo_path?: string
          status?: string
          uses_model_reference?: boolean
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudio_image_jobs_prompt_preset_id_fkey"
            columns: ["prompt_preset_id"]
            isOneToOne: false
            referencedRelation: "estudio_prompt_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      estudio_motion_presets: {
        Row: {
          created_at: string
          default_duration_seconds: number
          id: string
          is_default: boolean
          name: string
          prompt_text: string
          updated_at: string
          video_model: string
        }
        Insert: {
          created_at?: string
          default_duration_seconds?: number
          id?: string
          is_default?: boolean
          name: string
          prompt_text: string
          updated_at?: string
          video_model?: string
        }
        Update: {
          created_at?: string
          default_duration_seconds?: number
          id?: string
          is_default?: boolean
          name?: string
          prompt_text?: string
          updated_at?: string
          video_model?: string
        }
        Relationships: []
      }
      estudio_prompt_presets: {
        Row: {
          created_at: string
          created_by: string | null
          garment_category: string | null
          id: string
          image_model: string
          is_default: boolean
          name: string
          output_size: string
          photo_type: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          garment_category?: string | null
          id?: string
          image_model?: string
          is_default?: boolean
          name: string
          output_size?: string
          photo_type: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          garment_category?: string | null
          id?: string
          image_model?: string
          is_default?: boolean
          name?: string
          output_size?: string
          photo_type?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      estudio_video_jobs: {
        Row: {
          aspect_ratio: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          duration_seconds: number
          error_message: string | null
          generate_audio: boolean
          id: string
          motion_preset_id: string | null
          openrouter_job_id: string | null
          prompt_used: string
          resolution: string | null
          source_image_path: string
          status: string
          updated_at: string
          video_model: string
          video_storage_path: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_seconds: number
          error_message?: string | null
          generate_audio?: boolean
          id?: string
          motion_preset_id?: string | null
          openrouter_job_id?: string | null
          prompt_used: string
          resolution?: string | null
          source_image_path: string
          status?: string
          updated_at?: string
          video_model: string
          video_storage_path?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          error_message?: string | null
          generate_audio?: boolean
          id?: string
          motion_preset_id?: string | null
          openrouter_job_id?: string | null
          prompt_used?: string
          resolution?: string | null
          source_image_path?: string
          status?: string
          updated_at?: string
          video_model?: string
          video_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estudio_video_jobs_motion_preset_id_fkey"
            columns: ["motion_preset_id"]
            isOneToOne: false
            referencedRelation: "estudio_motion_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      fondo_aportes: {
        Row: {
          comprobante_privado_url: string | null
          created_at: string
          created_by: string | null
          email_contacto: string | null
          equivalente_usd: number | null
          es_anonimo: boolean
          estado: Database["public"]["Enums"]["fondo_aporte_estado"]
          exchange_rate_id: string | null
          fecha_confirmada: string | null
          fecha_reportada: string | null
          fecha_verificacion: string | null
          id: string
          metodo: Database["public"]["Enums"]["fondo_metodo"]
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nombre_donante: string | null
          nombre_publico: string | null
          nota_interna: string | null
          nota_publica: string | null
          rate_source: string | null
          referencia_privada: string | null
          referencia_publica_enmascarada: string | null
          tasa_usada: number | null
          telefono_contacto: string | null
          updated_at: string
          verificado_por: string | null
        }
        Insert: {
          comprobante_privado_url?: string | null
          created_at?: string
          created_by?: string | null
          email_contacto?: string | null
          equivalente_usd?: number | null
          es_anonimo?: boolean
          estado?: Database["public"]["Enums"]["fondo_aporte_estado"]
          exchange_rate_id?: string | null
          fecha_confirmada?: string | null
          fecha_reportada?: string | null
          fecha_verificacion?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["fondo_metodo"]
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nombre_donante?: string | null
          nombre_publico?: string | null
          nota_interna?: string | null
          nota_publica?: string | null
          rate_source?: string | null
          referencia_privada?: string | null
          referencia_publica_enmascarada?: string | null
          tasa_usada?: number | null
          telefono_contacto?: string | null
          updated_at?: string
          verificado_por?: string | null
        }
        Update: {
          comprobante_privado_url?: string | null
          created_at?: string
          created_by?: string | null
          email_contacto?: string | null
          equivalente_usd?: number | null
          es_anonimo?: boolean
          estado?: Database["public"]["Enums"]["fondo_aporte_estado"]
          exchange_rate_id?: string | null
          fecha_confirmada?: string | null
          fecha_reportada?: string | null
          fecha_verificacion?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["fondo_metodo"]
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"]
          monto_original?: number
          nombre_donante?: string | null
          nombre_publico?: string | null
          nota_interna?: string | null
          nota_publica?: string | null
          rate_source?: string | null
          referencia_privada?: string | null
          referencia_publica_enmascarada?: string | null
          tasa_usada?: number | null
          telefono_contacto?: string | null
          updated_at?: string
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fondo_aportes_exchange_rate_id_fkey"
            columns: ["exchange_rate_id"]
            isOneToOne: false
            referencedRelation: "fondo_exchange_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      fondo_audit_log: {
        Row: {
          accion: string
          created_at: string
          id: string
          record_id: string | null
          tabla: string
          user_email: string | null
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          record_id?: string | null
          tabla: string
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          record_id?: string | null
          tabla?: string
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: []
      }
      fondo_configuracion: {
        Row: {
          disclaimer: string
          id: boolean
          subtitulo_publico: string
          tasa_actualizada_at: string | null
          tasa_actualizada_por: string | null
          tasa_fecha: string | null
          tasa_fuente: string | null
          tasa_sugerida: number | null
          tasa_ves_usd: number | null
          titulo_publico: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          disclaimer?: string
          id?: boolean
          subtitulo_publico?: string
          tasa_actualizada_at?: string | null
          tasa_actualizada_por?: string | null
          tasa_fecha?: string | null
          tasa_fuente?: string | null
          tasa_sugerida?: number | null
          tasa_ves_usd?: number | null
          titulo_publico?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          disclaimer?: string
          id?: boolean
          subtitulo_publico?: string
          tasa_actualizada_at?: string | null
          tasa_actualizada_por?: string | null
          tasa_fecha?: string | null
          tasa_fuente?: string | null
          tasa_sugerida?: number | null
          tasa_ves_usd?: number | null
          titulo_publico?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fondo_egresos: {
        Row: {
          aprobado_por: string | null
          categoria: Database["public"]["Enums"]["fondo_egreso_categoria"]
          comprobante_privado_url: string | null
          comprobante_publico_url: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          equivalente_usd: number | null
          estado: Database["public"]["Enums"]["fondo_egreso_estado"]
          fecha_ejecucion: string | null
          fecha_gasto: string | null
          id: string
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nota_interna: string | null
          nota_publica: string | null
          proveedor: string | null
          tasa_usada: number | null
          updated_at: string
        }
        Insert: {
          aprobado_por?: string | null
          categoria?: Database["public"]["Enums"]["fondo_egreso_categoria"]
          comprobante_privado_url?: string | null
          comprobante_publico_url?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_egreso_estado"]
          fecha_ejecucion?: string | null
          fecha_gasto?: string | null
          id?: string
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nota_interna?: string | null
          nota_publica?: string | null
          proveedor?: string | null
          tasa_usada?: number | null
          updated_at?: string
        }
        Update: {
          aprobado_por?: string | null
          categoria?: Database["public"]["Enums"]["fondo_egreso_categoria"]
          comprobante_privado_url?: string | null
          comprobante_publico_url?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_egreso_estado"]
          fecha_ejecucion?: string | null
          fecha_gasto?: string | null
          id?: string
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"]
          monto_original?: number
          nota_interna?: string | null
          nota_publica?: string | null
          proveedor?: string | null
          tasa_usada?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      fondo_exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          is_active: boolean
          provider_updated_at: string | null
          quote_currency: string
          rate: number
          raw_payload: Json | null
          source: string
          updated_by: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_active?: boolean
          provider_updated_at?: string | null
          quote_currency?: string
          rate: number
          raw_payload?: Json | null
          source?: string
          updated_by?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_active?: boolean
          provider_updated_at?: string | null
          quote_currency?: string
          rate?: number
          raw_payload?: Json | null
          source?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fondo_movimientos_cargados: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["fondo_movimiento_estado"]
          fecha: string
          id: string
          metodo: Database["public"]["Enums"]["fondo_metodo"]
          moneda: Database["public"]["Enums"]["fondo_moneda"]
          monto: number
          nota: string | null
          origen: string | null
          raw_data: Json | null
          referencia: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["fondo_movimiento_estado"]
          fecha: string
          id?: string
          metodo: Database["public"]["Enums"]["fondo_metodo"]
          moneda: Database["public"]["Enums"]["fondo_moneda"]
          monto: number
          nota?: string | null
          origen?: string | null
          raw_data?: Json | null
          referencia?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["fondo_movimiento_estado"]
          fecha?: string
          id?: string
          metodo?: Database["public"]["Enums"]["fondo_metodo"]
          moneda?: Database["public"]["Enums"]["fondo_moneda"]
          monto?: number
          nota?: string | null
          origen?: string | null
          raw_data?: Json | null
          referencia?: string | null
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
          no_shipping_method: string | null
          no_shipping_needed: boolean
          observations: string | null
          order_details: string | null
          packaged_at: string | null
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
          no_shipping_method?: string | null
          no_shipping_needed?: boolean
          observations?: string | null
          order_details?: string | null
          packaged_at?: string | null
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
          no_shipping_method?: string | null
          no_shipping_needed?: boolean
          observations?: string | null
          order_details?: string | null
          packaged_at?: string | null
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
      sublime_merch_boxes: {
        Row: {
          box_number: string
          brand: string
          created_at: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          shipment_id: string
          status: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          box_number: string
          brand?: string
          created_at?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          shipment_id: string
          status?: string
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          box_number?: string
          brand?: string
          created_at?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          shipment_id?: string
          status?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "sublime_merch_boxes_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "sublime_merch_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_merch_items: {
        Row: {
          box_id: string | null
          brand: string
          codigo_fabricante: string | null
          consignment_commission_amount: number
          consignment_commission_pct: number
          created_at: string
          created_by: string | null
          estado: string
          fotos_origen: string[]
          fotos_web: string[]
          id: string
          is_consignment: boolean
          name: string
          no_size: boolean
          notas: string | null
          peso_kg: number
          precio_compra: number
          product_type: string
          pvp: number | null
          pvp_manual: number | null
          received_at: string | null
          received_by: string | null
          shipment_id: string | null
          size_group: string
          size_quantities: Json
          sku_web: string | null
          subido_al_sistema: boolean
          tax_amount: number
          tax_enabled: boolean
          tax_note: string | null
          unit_count: number
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          use_manual_pvp: boolean
        }
        Insert: {
          box_id?: string | null
          brand?: string
          codigo_fabricante?: string | null
          consignment_commission_amount?: number
          consignment_commission_pct?: number
          created_at?: string
          created_by?: string | null
          estado?: string
          fotos_origen?: string[]
          fotos_web?: string[]
          id?: string
          is_consignment?: boolean
          name: string
          no_size?: boolean
          notas?: string | null
          peso_kg?: number
          precio_compra?: number
          product_type?: string
          pvp?: number | null
          pvp_manual?: number | null
          received_at?: string | null
          received_by?: string | null
          shipment_id?: string | null
          size_group?: string
          size_quantities?: Json
          sku_web?: string | null
          subido_al_sistema?: boolean
          tax_amount?: number
          tax_enabled?: boolean
          tax_note?: string | null
          unit_count?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          use_manual_pvp?: boolean
        }
        Update: {
          box_id?: string | null
          brand?: string
          codigo_fabricante?: string | null
          consignment_commission_amount?: number
          consignment_commission_pct?: number
          created_at?: string
          created_by?: string | null
          estado?: string
          fotos_origen?: string[]
          fotos_web?: string[]
          id?: string
          is_consignment?: boolean
          name?: string
          no_size?: boolean
          notas?: string | null
          peso_kg?: number
          precio_compra?: number
          product_type?: string
          pvp?: number | null
          pvp_manual?: number | null
          received_at?: string | null
          received_by?: string | null
          shipment_id?: string | null
          size_group?: string
          size_quantities?: Json
          sku_web?: string | null
          subido_al_sistema?: boolean
          tax_amount?: number
          tax_enabled?: boolean
          tax_note?: string | null
          unit_count?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          use_manual_pvp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sublime_merch_items_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "sublime_merch_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sublime_merch_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "sublime_merch_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      sublime_merch_pricing_rules: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          id: string
          label: string
          product_type: string
          profit_percentage: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string
          created_at?: string
          id?: string
          label: string
          product_type: string
          profit_percentage?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          id?: string
          label?: string
          product_type?: string
          profit_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      sublime_merch_shipments: {
        Row: {
          brand: string
          carrier: string | null
          cost_per_kg_eur: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          received_at: string | null
          sent_at: string | null
          shipment_number: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          brand?: string
          carrier?: string | null
          cost_per_kg_eur?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sent_at?: string | null
          shipment_number: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          carrier?: string | null
          cost_per_kg_eur?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sent_at?: string | null
          shipment_number?: string
          status?: string
          tracking_number?: string | null
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
      fondo_public_aportes: {
        Row: {
          donante_publico: string | null
          equivalente_usd: number | null
          estado: Database["public"]["Enums"]["fondo_aporte_estado"] | null
          fecha_confirmada: string | null
          fecha_reportada: string | null
          id: string | null
          metodo: Database["public"]["Enums"]["fondo_metodo"] | null
          moneda_original: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original: number | null
          nota_publica: string | null
          referencia_publica_enmascarada: string | null
        }
        Insert: {
          donante_publico?: never
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_aporte_estado"] | null
          fecha_confirmada?: string | null
          fecha_reportada?: string | null
          id?: string | null
          metodo?: Database["public"]["Enums"]["fondo_metodo"] | null
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original?: number | null
          nota_publica?: string | null
          referencia_publica_enmascarada?: string | null
        }
        Update: {
          donante_publico?: never
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_aporte_estado"] | null
          fecha_confirmada?: string | null
          fecha_reportada?: string | null
          id?: string | null
          metodo?: Database["public"]["Enums"]["fondo_metodo"] | null
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original?: number | null
          nota_publica?: string | null
          referencia_publica_enmascarada?: string | null
        }
        Relationships: []
      }
      fondo_public_egresos: {
        Row: {
          categoria:
            | Database["public"]["Enums"]["fondo_egreso_categoria"]
            | null
          comprobante_publico_url: string | null
          descripcion: string | null
          equivalente_usd: number | null
          estado: Database["public"]["Enums"]["fondo_egreso_estado"] | null
          fecha_ejecucion: string | null
          fecha_gasto: string | null
          id: string | null
          moneda_original: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original: number | null
          nota_publica: string | null
          proveedor: string | null
        }
        Insert: {
          categoria?:
            | Database["public"]["Enums"]["fondo_egreso_categoria"]
            | null
          comprobante_publico_url?: string | null
          descripcion?: string | null
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_egreso_estado"] | null
          fecha_ejecucion?: string | null
          fecha_gasto?: string | null
          id?: string | null
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original?: number | null
          nota_publica?: string | null
          proveedor?: string | null
        }
        Update: {
          categoria?:
            | Database["public"]["Enums"]["fondo_egreso_categoria"]
            | null
          comprobante_publico_url?: string | null
          descripcion?: string | null
          equivalente_usd?: number | null
          estado?: Database["public"]["Enums"]["fondo_egreso_estado"] | null
          fecha_ejecucion?: string | null
          fecha_gasto?: string | null
          id?: string | null
          moneda_original?: Database["public"]["Enums"]["fondo_moneda"] | null
          monto_original?: number | null
          nota_publica?: string | null
          proveedor?: string | null
        }
        Relationships: []
      }
      fondo_public_totales: {
        Row: {
          aportes_confirmados_count: number | null
          aportes_pendientes_count: number | null
          tasa_actualizada_at: string | null
          tasa_fecha: string | null
          tasa_fuente: string | null
          tasa_ves_usd: number | null
          ultima_actualizacion: string | null
          usd_confirmado: number | null
          usd_egresos: number | null
          usd_por_verificar: number | null
          usd_saldo: number | null
          usdt_confirmado: number | null
          usdt_egresos: number | null
          usdt_por_verificar: number | null
          usdt_saldo: number | null
          ves_confirmado: number | null
          ves_egresos: number | null
          ves_por_verificar: number | null
          ves_saldo: number | null
        }
        Relationships: []
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
      core_apply_replacement_event: {
        Args: {
          p_adjustment_reason?: string
          p_allocations: Json
          p_confirmed_quantity?: number
          p_dry_run?: boolean
          p_event_id: string
        }
        Returns: Json
      }
      core_approve_external_purchase_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      core_cancel_external_purchase_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      core_cancel_production_unit: {
        Args: { p_notes?: string; p_reason: string; p_unit_id: string }
        Returns: Json
      }
      core_close_dispatch: {
        Args: { _dispatch_id: string; _factory_responsible?: string }
        Returns: Json
      }
      core_close_missing_sku_pending_item: {
        Args: { p_pending_item_id: string; p_replacement_event_id: string }
        Returns: Json
      }
      core_create_external_purchase_orders_from_events: {
        Args: { p_dry_run?: boolean; p_event_ids: string[]; p_overrides?: Json }
        Returns: Json
      }
      core_ext_po_audit: {
        Args: {
          p_action: string
          p_new: Json
          p_old: Json
          p_order_id: string
          p_order_number: string
        }
        Returns: undefined
      }
      core_mark_external_purchase_order_ordered: {
        Args: {
          p_eta?: string
          p_notes?: string
          p_order_id: string
          p_reference?: string
        }
        Returns: Json
      }
      core_merge_payrolls: {
        Args: {
          p_confirm_unpaid?: boolean
          p_reason: string
          p_source_payroll_id: string
          p_target_payroll_id: string
        }
        Returns: Json
      }
      core_normalize_supplier_name: {
        Args: { p_name: string }
        Returns: string
      }
      core_propagate_raw_material_cost: {
        Args: { p_material_id: string }
        Returns: {
          items_updated: number
          structures_updated: number
        }[]
      }
      core_receive_dispatch: {
        Args: {
          _dispatch_id: string
          _note?: string
          _received_by?: string
          _received_unit_ids: string[]
        }
        Returns: Json
      }
      core_receive_external_purchase_order: {
        Args: { p_lines: Json; p_order_id: string }
        Returns: Json
      }
      core_reconcile_woo_core_map: { Args: never; Returns: Json }
      core_reopen_external_purchase_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      core_repair_unit_variant_links: {
        Args: { p_dry_run?: boolean }
        Returns: Json
      }
      core_resolve_missing_sku_pending_item: {
        Args: {
          p_action: string
          p_dry_run?: boolean
          p_pending_item_id: string
          p_unit_cost: number
        }
        Returns: Json
      }
      core_resolve_unlinked_core_movement: {
        Args: {
          p_action: string
          p_dry_run?: boolean
          p_movement_id: string
          p_replacement_event_id?: string
        }
        Returns: Json
      }
      core_sync_production_order_allocation: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      core_transfer_work_entry: {
        Args: {
          p_new_operator_id: string
          p_reason: string
          p_work_entry_id: string
        }
        Returns: Json
      }
      core_update_external_purchase_order_draft: {
        Args: { p_header?: Json; p_lines?: Json; p_order_id: string }
        Returns: Json
      }
      core_update_external_purchase_order_payment: {
        Args: { p_amount_paid: number; p_order_id: string }
        Returns: Json
      }
      esp_apply_material_movement: {
        Args: {
          p_allow_negative?: boolean
          p_from_location_id?: string
          p_location_id?: string
          p_material_id: string
          p_movement_type: string
          p_notes?: string
          p_quantity: number
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
          p_to_location_id?: string
        }
        Returns: Json
      }
      esp_apply_movement: {
        Args: {
          p_allow_negative?: boolean
          p_from_location_id?: string
          p_location_id?: string
          p_movement_type: string
          p_notes?: string
          p_quantity: number
          p_reason?: string
          p_to_location_id?: string
          p_variant_id: string
        }
        Returns: Json
      }
      esp_consume_materials_for_fabrication_request: {
        Args: {
          p_location_id?: string
          p_notes?: string
          p_overrides?: Json
          p_request_id: string
        }
        Returns: Json
      }
      esp_consume_production_note: {
        Args: { p_allow_negative?: boolean; p_note_id: string }
        Returns: Json
      }
      esp_fabrication_request_mark_ready: {
        Args: { p_request_id: string }
        Returns: Json
      }
      esp_normalize_size: { Args: { p_label: string }; Returns: string }
      esp_register_pos_sale: {
        Args: {
          p_allow_negative?: boolean
          p_channel_id: string
          p_items: Json
          p_location_id: string
          p_notes?: string
          p_payment_method_id: string
          p_payment_reference?: string
        }
        Returns: Json
      }
      esp_register_public_pos_sale: {
        Args: {
          p_allow_negative?: boolean
          p_channel_id: string
          p_items: Json
          p_location_id: string
          p_notes?: string
          p_payment_method_id: string
          p_payment_reference?: string
        }
        Returns: Json
      }
      esp_resolve_fabrication_materials: {
        Args: { p_location_id?: string; p_request_id: string }
        Returns: Json
      }
      fondo_cambiar_estado_aporte: {
        Args: {
          p_id: string
          p_nota_interna?: string
          p_nuevo_estado: Database["public"]["Enums"]["fondo_aporte_estado"]
        }
        Returns: Json
      }
      fondo_confirmar_aporte: {
        Args: {
          p_equivalente_usd?: number
          p_id: string
          p_nota_publica?: string
          p_tasa?: number
        }
        Returns: Json
      }
      fondo_get_active_bcv_rate: {
        Args: never
        Returns: {
          fetched_at: string
          id: string
          provider_updated_at: string
          rate: number
          source: string
        }[]
      }
      fondo_public_aportes_list: {
        Args: never
        Returns: {
          donante_publico: string
          equivalente_usd: number
          es_anonimo: boolean
          estado: Database["public"]["Enums"]["fondo_aporte_estado"]
          fecha_confirmada: string
          fecha_reportada: string
          id: string
          metodo: Database["public"]["Enums"]["fondo_metodo"]
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nota_publica: string
          referencia_publica_enmascarada: string
          telefono_publico: string
        }[]
      }
      fondo_public_egresos_list: {
        Args: never
        Returns: {
          categoria: Database["public"]["Enums"]["fondo_egreso_categoria"]
          comprobante_publico_url: string
          descripcion: string
          equivalente_usd: number
          estado: Database["public"]["Enums"]["fondo_egreso_estado"]
          fecha_ejecucion: string
          fecha_gasto: string
          id: string
          moneda_original: Database["public"]["Enums"]["fondo_moneda"]
          monto_original: number
          nota_publica: string
          proveedor: string
        }[]
      }
      fondo_registrar_aporte_publico:
        | {
            Args: {
              p_comprobante_path: string
              p_email: string
              p_es_anonimo?: boolean
              p_fecha_pago: string
              p_metodo: Database["public"]["Enums"]["fondo_metodo"]
              p_moneda: Database["public"]["Enums"]["fondo_moneda"]
              p_monto: number
              p_nombre: string
              p_referencia: string
              p_telefono: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_comprobante_path: string
              p_email: string
              p_es_anonimo?: boolean
              p_fecha_pago: string
              p_metodo: Database["public"]["Enums"]["fondo_metodo"]
              p_moneda: Database["public"]["Enums"]["fondo_moneda"]
              p_monto: number
              p_nombre: string
              p_referencia: string
              p_sender_name?: string
              p_telefono: string
            }
            Returns: Json
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
      has_module_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_customers_order_stats: { Args: never; Returns: undefined }
      resolve_core_operational_unit_cost: {
        Args: {
          p_core_product_id?: string
          p_core_variant_id?: string
          p_woo_product_id?: number
          p_woo_variation_id?: number
        }
        Returns: {
          core_product_id: string
          core_variant_id: string
          cost_source: string
          policy_id: string
          unit_cost: number
          warning: string
          woo_product_id: number
          woo_variation_id: number
        }[]
      }
      resolve_core_product_variant_cost_range: {
        Args: { p_product_id: string }
        Returns: {
          base_unit_cost: number
          has_overrides: boolean
          max_unit_cost: number
          min_unit_cost: number
          product_id: string
          variant_count: number
          variants_with_override: number
        }[]
      }
      resolve_core_replenishment_action: {
        Args: {
          p_core_product_id?: string
          p_core_variant_id?: string
          p_woo_product_id?: number
          p_woo_variation_id?: number
        }
        Returns: {
          action: string
          brand_role: string
          core_product_id: string
          core_variant_id: string
          external_supplier_name: string
          external_supplier_unit_cost_usd: number
          lifecycle_status: string
          message: string
          policy_id: string
          replacement_behavior: string
          replacement_product_id: string
          replacement_woo_product_id: number
          replenishment_route: string
          restock_enabled: boolean
          severity: string
          warning: string
          woo_product_id: number
          woo_variation_id: number
        }[]
      }
      resolve_core_variant_unit_cost: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: number
      }
      resolve_core_variant_unit_cost_with_source: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: {
          cost_source: string
          unit_cost: number
        }[]
      }
      route_core_replenishment_candidate: {
        Args: {
          p_amount?: number
          p_core_product_id?: string
          p_core_variant_id?: string
          p_cost_source?: string
          p_created_by?: string
          p_dry_run?: boolean
          p_quantity?: number
          p_source_id?: string
          p_source_key?: string
          p_source_type: string
          p_unit_cost?: number
          p_woo_order_id?: number
          p_woo_order_item_id?: number
          p_woo_product_id?: number
          p_woo_variation_id?: number
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager" | "partner" | "rrpp" | "marketing"
      fondo_aporte_estado:
        | "por_verificar"
        | "coincidencia_encontrada"
        | "confirmado"
        | "rechazado"
        | "duplicado"
        | "monto_incorrecto"
      fondo_egreso_categoria:
        | "comida"
        | "agua"
        | "medicina"
        | "transporte"
        | "logistica"
        | "refugio"
        | "otro"
      fondo_egreso_estado: "pendiente" | "aprobado" | "ejecutado" | "anulado"
      fondo_metodo:
        | "pago_movil"
        | "binance"
        | "zelle"
        | "efectivo_sublime"
        | "bizum"
      fondo_moneda: "VES" | "USD" | "USDT"
      fondo_movimiento_estado:
        | "sin_conciliar"
        | "conciliado"
        | "usado_en_confirmacion"
        | "duplicado"
        | "ignorado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      fondo_aporte_estado: [
        "por_verificar",
        "coincidencia_encontrada",
        "confirmado",
        "rechazado",
        "duplicado",
        "monto_incorrecto",
      ],
      fondo_egreso_categoria: [
        "comida",
        "agua",
        "medicina",
        "transporte",
        "logistica",
        "refugio",
        "otro",
      ],
      fondo_egreso_estado: ["pendiente", "aprobado", "ejecutado", "anulado"],
      fondo_metodo: [
        "pago_movil",
        "binance",
        "zelle",
        "efectivo_sublime",
        "bizum",
      ],
      fondo_moneda: ["VES", "USD", "USDT"],
      fondo_movimiento_estado: [
        "sin_conciliar",
        "conciliado",
        "usado_en_confirmacion",
        "duplicado",
        "ignorado",
      ],
    },
  },
} as const
