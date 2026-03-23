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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          recipient_count: number | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
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
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "partner"
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
      app_role: ["admin", "manager", "partner"],
    },
  },
} as const
