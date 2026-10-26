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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_action_logs: {
        Row: {
          actor_id: string | null
          confirmed_version: number | null
          created_at: string
          event_id: string | null
          id: string
          input: Json
          result: Json | null
          tool: string
        }
        Insert: {
          actor_id?: string | null
          confirmed_version?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          input?: Json
          result?: Json | null
          tool: string
        }
        Update: {
          actor_id?: string | null
          confirmed_version?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          input?: Json
          result?: Json | null
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          details: Json
          event_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          details?: Json
          event_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          details?: Json
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tables: {
        Row: {
          active: boolean
          booking_id: string
          capacity: number
          event_id: string
          id: string
          price_satang: number
          table_id: string
          table_number: number
        }
        Insert: {
          active?: boolean
          booking_id: string
          capacity: number
          event_id: string
          id?: string
          price_satang: number
          table_id: string
          table_number: number
        }
        Update: {
          active?: boolean
          booking_id?: string
          capacity?: number
          event_id?: string
          id?: string
          price_satang?: number
          table_id?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_tables_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tables_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          balance_due_at: string | null
          bank_snapshot: Json | null
          cancelled_at: string | null
          cancelled_by: string | null
          code: string
          contact: string | null
          created_at: string
          currency: string
          deposit_due_at: string | null
          deposit_due_satang: number
          event_id: string
          expires_at: string | null
          guest_count: number
          guest_name: string
          id: string
          idempotency_key: string
          manage_token_hash: string
          organization: string | null
          paid_satang: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          refund_policy_snapshot: string
          refunded_satang: number
          request_hash: string
          status: Database["public"]["Enums"]["booking_status"]
          total_satang: number
        }
        Insert: {
          balance_due_at?: string | null
          bank_snapshot?: Json | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code: string
          contact?: string | null
          created_at?: string
          currency?: string
          deposit_due_at?: string | null
          deposit_due_satang?: number
          event_id: string
          expires_at?: string | null
          guest_count: number
          guest_name: string
          id?: string
          idempotency_key: string
          manage_token_hash: string
          organization?: string | null
          paid_satang?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refund_policy_snapshot?: string
          refunded_satang?: number
          request_hash: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_satang?: number
        }
        Update: {
          balance_due_at?: string | null
          bank_snapshot?: Json | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          contact?: string | null
          created_at?: string
          currency?: string
          deposit_due_at?: string | null
          deposit_due_satang?: number
          event_id?: string
          expires_at?: string | null
          guest_count?: number
          guest_name?: string
          id?: string
          idempotency_key?: string
          manage_token_hash?: string
          organization?: string | null
          paid_satang?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refund_policy_snapshot?: string
          refunded_satang?: number
          request_hash?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_satang?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          booking_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          event_id: string
          id: string
          reason: string
          status: Database["public"]["Enums"]["cancel_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id: string
          id?: string
          reason: string
          status?: Database["public"]["Enums"]["cancel_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id?: string
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["cancel_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          booking_id: string
          checked_in_at: string
          checked_in_by: string | null
          event_id: string
          id: string
        }
        Insert: {
          booking_id: string
          checked_in_at?: string
          checked_in_by?: string | null
          event_id: string
          id?: string
        }
        Update: {
          booking_id?: string
          checked_in_at?: string
          checked_in_by?: string | null
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          id: string
          name: string
          number: number
          price_satang: number
          status: Database["public"]["Enums"]["table_status"]
          x: number
          y: number
          zone: string
        }
        Insert: {
          capacity: number
          created_at?: string
          event_id: string
          id?: string
          name?: string
          number: number
          price_satang?: number
          status?: Database["public"]["Enums"]["table_status"]
          x?: number
          y?: number
          zone?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          number?: number
          price_satang?: number
          status?: Database["public"]["Enums"]["table_status"]
          x?: number
          y?: number
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          announcement: string
          balance_due_at: string | null
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          booking_closes_at: string
          booking_opens_at: string
          cancel_deadline: string | null
          contact_info: string
          contact_required: boolean
          cover_url: string | null
          created_at: string
          deposit_hours: number
          deposit_percent: number
          description: string
          ends_at: string
          id: string
          latitude: number | null
          layout_meta: Json
          longitude: number | null
          map_url: string | null
          max_attendees: number | null
          organizer_name: string
          owner_id: string | null
          payment_mode: string
          public_slug: string | null
          published_at: string | null
          refund_policy: string
          schedule: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue_address: string
          venue_name: string
          version: number
        }
        Insert: {
          announcement?: string
          balance_due_at?: string | null
          bank_account_name?: string
          bank_account_number?: string
          bank_name?: string
          booking_closes_at: string
          booking_opens_at: string
          cancel_deadline?: string | null
          contact_info?: string
          contact_required?: boolean
          cover_url?: string | null
          created_at?: string
          deposit_hours?: number
          deposit_percent?: number
          description?: string
          ends_at: string
          id?: string
          latitude?: number | null
          layout_meta?: Json
          longitude?: number | null
          map_url?: string | null
          max_attendees?: number | null
          organizer_name?: string
          owner_id?: string | null
          payment_mode?: string
          public_slug?: string | null
          published_at?: string | null
          refund_policy?: string
          schedule?: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue_address?: string
          venue_name?: string
          version?: number
        }
        Update: {
          announcement?: string
          balance_due_at?: string | null
          bank_account_name?: string
          bank_account_number?: string
          bank_name?: string
          booking_closes_at?: string
          booking_opens_at?: string
          cancel_deadline?: string | null
          contact_info?: string
          contact_required?: boolean
          cover_url?: string | null
          created_at?: string
          deposit_hours?: number
          deposit_percent?: number
          description?: string
          ends_at?: string
          id?: string
          latitude?: number | null
          layout_meta?: Json
          longitude?: number | null
          map_url?: string | null
          max_attendees?: number | null
          organizer_name?: string
          owner_id?: string | null
          payment_mode?: string
          public_slug?: string | null
          published_at?: string | null
          refund_policy?: string
          schedule?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue_address?: string
          venue_name?: string
          version?: number
        }
        Relationships: []
      }
      line_account_links: {
        Row: {
          id: string
          line_user_id: string
          linked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          line_user_id: string
          linked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          line_user_id?: string
          linked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      manual_refunds: {
        Row: {
          amount_satang: number
          bank_reference: string
          booking_id: string
          created_at: string
          event_id: string
          id: string
          note: string
          owner_id: string
          paid_at: string
          recorded_by: string
          request_id: string
        }
        Insert: {
          amount_satang: number
          bank_reference: string
          booking_id: string
          created_at?: string
          event_id: string
          id?: string
          note: string
          owner_id: string
          paid_at: string
          recorded_by: string
          request_id: string
        }
        Update: {
          amount_satang?: number
          bank_reference?: string
          booking_id?: string
          created_at?: string
          event_id?: string
          id?: string
          note?: string
          owner_id?: string
          paid_at?: string
          recorded_by?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_refunds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      participating_organizations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "participating_organizations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          amount_satang: number
          bank_reference: string | null
          booking_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          event_id: string
          id: string
          owner_id: string
          paid_at: string
          proof_hash: string
          proof_path: string
          request_id: string
          status: string
        }
        Insert: {
          amount_satang: number
          bank_reference?: string | null
          booking_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id: string
          id?: string
          owner_id: string
          paid_at: string
          proof_hash: string
          proof_path: string
          request_id: string
          status?: string
        }
        Update: {
          amount_satang?: number
          bank_reference?: string | null
          booking_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          event_id?: string
          id?: string
          owner_id?: string
          paid_at?: string
          proof_hash?: string
          proof_path?: string
          request_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_satang: number
          booking_id: string
          created_at: string
          currency: string
          event_id: string
          id: string
          provider: string
          provider_ref: string | null
          raw: Json | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_satang: number
          booking_id: string
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          provider?: string
          provider_ref?: string | null
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_satang?: number
          booking_id?: string
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          provider?: string
          provider_ref?: string | null
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booking_by_token: { Args: { _token_hash: string }; Returns: Json }
      booking_finances: { Args: { _token_hash: string }; Returns: Json }
      create_booking: {
        Args: {
          _code: string
          _contact: string
          _guest_count: number
          _guest_name: string
          _idempotency_key: string
          _organization: string
          _request_hash: string
          _slug: string
          _table_ids: string[]
          _token_hash: string
        }
        Returns: Json
      }
      create_booking_v2: {
        Args: {
          _code: string
          _contact: string
          _expected_total: number
          _expected_version: number
          _guest_count: number
          _guest_name: string
          _idempotency_key: string
          _organization: string
          _request_hash: string
          _slug: string
          _table_ids: string[]
          _token_hash: string
        }
        Returns: Json
      }
      decide_cancellation: {
        Args: { _approve: boolean; _note: string; _request_id: string }
        Returns: Json
      }
      event_summary: { Args: { _event_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manager_cancel_booking: {
        Args: { _booking_id: string; _note: string }
        Returns: Json
      }
      public_event: { Args: { _slug: string }; Returns: Json }
      publish_event: {
        Args: { _event_id: string; _expected_version: number }
        Returns: Json
      }
      rate_limit_hit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      record_manual_refund: {
        Args: {
          _amount: number
          _booking_id: string
          _note: string
          _paid_at: string
          _reference: string
          _request_id: string
        }
        Returns: Json
      }
      request_cancellation: {
        Args: { _reason: string; _token_hash: string }
        Returns: Json
      }
      review_payment: {
        Args: {
          _approve: boolean
          _id: string
          _note: string
          _reference: string
        }
        Returns: Json
      }
      submit_payment: {
        Args: {
          _amount: number
          _hash: string
          _paid_at: string
          _path: string
          _request_id: string
          _token_hash: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "manager" | "developer"
      booking_status: "confirmed" | "pending_payment" | "cancelled" | "expired"
      cancel_status: "pending" | "approved" | "rejected"
      event_status: "draft" | "published" | "closed" | "cancelled" | "completed"
      payment_status:
        | "not_required"
        | "pending"
        | "paid"
        | "refund_pending"
        | "refunded"
        | "failed"
      table_status: "available" | "held" | "disabled"
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
      app_role: ["manager", "developer"],
      booking_status: ["confirmed", "pending_payment", "cancelled", "expired"],
      cancel_status: ["pending", "approved", "rejected"],
      event_status: ["draft", "published", "closed", "cancelled", "completed"],
      payment_status: [
        "not_required",
        "pending",
        "paid",
        "refund_pending",
        "refunded",
        "failed",
      ],
      table_status: ["available", "held", "disabled"],
    },
  },
} as const
