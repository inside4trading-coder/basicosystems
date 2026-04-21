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
          payment_proof_url: string | null
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
          payment_proof_url?: string | null
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
          payment_proof_url?: string | null
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
          id: string
          item_cost: number | null
          line_item_id: number | null
          line_total: number | null
          order_id: number
          parent_category: string | null
          parent_sku: string | null
          product_category: string | null
          product_name: string | null
          quantity: number | null
          size: string | null
          sku: string | null
          unit_price: number | null
        }
        Insert: {
          analytic_category?: string | null
          color?: string | null
          id?: string
          item_cost?: number | null
          line_item_id?: number | null
          line_total?: number | null
          order_id: number
          parent_category?: string | null
          parent_sku?: string | null
          product_category?: string | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          sku?: string | null
          unit_price?: number | null
        }
        Update: {
          analytic_category?: string | null
          color?: string | null
          id?: string
          item_cost?: number | null
          line_item_id?: number | null
          line_total?: number | null
          order_id?: number
          parent_category?: string | null
          parent_sku?: string | null
          product_category?: string | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          sku?: string | null
          unit_price?: number | null
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
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
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
          employee_id: string
          frequency: string
          id: string
          name: string
          priority: string
          responsible: string | null
          time: string | null
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string
          day?: string | null
          employee_id: string
          frequency?: string
          id?: string
          name: string
          priority?: string
          responsible?: string | null
          time?: string | null
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string
          day?: string | null
          employee_id?: string
          frequency?: string
          id?: string
          name?: string
          priority?: string
          responsible?: string | null
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
          post_date: string | null
          post_observation: string | null
          products: string | null
          received: boolean
          send_date: string | null
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
          post_date?: string | null
          post_observation?: string | null
          products?: string | null
          received?: boolean
          send_date?: string | null
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
          post_date?: string | null
          post_observation?: string | null
          products?: string | null
          received?: boolean
          send_date?: string | null
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
    }
    Functions: {
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
