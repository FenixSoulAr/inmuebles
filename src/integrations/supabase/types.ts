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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_user_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_user_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_user_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_adjustment_events: {
        Row: {
          contract_id: string
          created_at: string
          effective_date: string
          id: string
          method: string
          new_rent: number
          note: string | null
          previous_rent: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          effective_date: string
          id?: string
          method: string
          new_rent: number
          note?: string | null
          previous_rent: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          method?: string
          new_rent?: number
          note?: string | null
          previous_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_adjustment_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_services: {
        Row: {
          active: boolean
          contract_id: string
          created_at: string
          due_day: number | null
          expected_amount: number | null
          id: string
          service_type: string
        }
        Insert: {
          active?: boolean
          contract_id: string
          created_at?: string
          due_day?: number | null
          expected_amount?: number | null
          id?: string
          service_type: string
        }
        Update: {
          active?: boolean
          contract_id?: string
          created_at?: string
          due_day?: number | null
          expected_amount?: number | null
          id?: string
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          adjustment_frequency: number | null
          adjustment_type: string
          clause_flags: Json | null
          clauses_text: string | null
          created_at: string
          currency: string | null
          current_rent: number
          deposit: number | null
          end_date: string
          id: string
          initial_rent: number
          is_active: boolean
          next_adjustment_date: string | null
          property_id: string
          public_submission_token: string | null
          rent_due_day: number | null
          signed_contract_file_url: string | null
          start_date: string
          submission_language: string
          tenant_id: string
          token_created_at: string | null
          token_rotated_at: string | null
          token_status: string
          updated_at: string
        }
        Insert: {
          adjustment_frequency?: number | null
          adjustment_type?: string
          clause_flags?: Json | null
          clauses_text?: string | null
          created_at?: string
          currency?: string | null
          current_rent: number
          deposit?: number | null
          end_date: string
          id?: string
          initial_rent: number
          is_active?: boolean
          next_adjustment_date?: string | null
          property_id: string
          public_submission_token?: string | null
          rent_due_day?: number | null
          signed_contract_file_url?: string | null
          start_date: string
          submission_language?: string
          tenant_id: string
          token_created_at?: string | null
          token_rotated_at?: string | null
          token_status?: string
          updated_at?: string
        }
        Update: {
          adjustment_frequency?: number | null
          adjustment_type?: string
          clause_flags?: Json | null
          clauses_text?: string | null
          created_at?: string
          currency?: string | null
          current_rent?: number
          deposit?: number | null
          end_date?: string
          id?: string
          initial_rent?: number
          is_active?: boolean
          next_adjustment_date?: string | null
          property_id?: string
          public_submission_token?: string | null
          rent_due_day?: number | null
          signed_contract_file_url?: string | null
          start_date?: string
          submission_language?: string
          tenant_id?: string
          token_created_at?: string | null
          token_rotated_at?: string | null
          token_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantors: {
        Row: {
          contact_info: string | null
          created_at: string
          full_name: string
          id: string
          notes: string | null
          tenant_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          tenant_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_issues: {
        Row: {
          created_at: string
          description: string
          estimate_amount: number | null
          id: string
          payer: string
          property_id: string
          receipt_file_url: string | null
          reported_at: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          estimate_amount?: number | null
          id?: string
          payer: string
          property_id: string
          receipt_file_url?: string | null
          reported_at?: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          estimate_amount?: number | null
          id?: string
          payer?: string
          property_id?: string
          receipt_file_url?: string | null
          reported_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_issues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          contract_id: string
          created_at: string
          currency: string | null
          due_date: string
          expected_amount: number | null
          id: string
          kind: string
          payment_proof_id: string | null
          period: string
          property_id: string
          service_type: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          currency?: string | null
          due_date: string
          expected_amount?: number | null
          id?: string
          kind: string
          payment_proof_id?: string | null
          period: string
          property_id: string
          service_type?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          currency?: string | null
          due_date?: string
          expected_amount?: number | null
          id?: string
          kind?: string
          payment_proof_id?: string | null
          period?: string
          property_id?: string
          service_type?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_payment_proof_id_fkey"
            columns: ["payment_proof_id"]
            isOneToOne: false
            referencedRelation: "payment_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_stakes: {
        Row: {
          created_at: string
          holder_name: string
          holder_type: string
          id: string
          property_id: string
          share_percent: number
        }
        Insert: {
          created_at?: string
          holder_name: string
          holder_type: string
          id?: string
          property_id: string
          share_percent: number
        }
        Update: {
          created_at?: string
          holder_name?: string
          holder_type?: string
          id?: string
          property_id?: string
          share_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "ownership_stakes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          comment: string | null
          contract_id: string
          created_at: string
          files: string[]
          id: string
          obligation_id: string | null
          paid_at: string
          period: string
          proof_status: string
          rejection_reason: string | null
          replaces_proof_id: string | null
          service_type: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          comment?: string | null
          contract_id: string
          created_at?: string
          files?: string[]
          id?: string
          obligation_id?: string | null
          paid_at?: string
          period: string
          proof_status?: string
          rejection_reason?: string | null
          replaces_proof_id?: string | null
          service_type?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          comment?: string | null
          contract_id?: string
          created_at?: string
          files?: string[]
          id?: string
          obligation_id?: string | null
          paid_at?: string
          period?: string
          proof_status?: string
          rejection_reason?: string | null
          replaces_proof_id?: string | null
          service_type?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_replaces_proof_id_fkey"
            columns: ["replaces_proof_id"]
            isOneToOne: false
            referencedRelation: "payment_proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          attachment_url: string | null
          created_at: string
          id: string
          method: string
          notes: string | null
          obligation_id: string
          paid_at: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          obligation_id: string
          paid_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          obligation_id?: string
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          active: boolean
          created_at: string
          full_address: string
          id: string
          internal_identifier: string
          owner_user_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_address: string
          id?: string
          internal_identifier: string
          owner_user_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_address?: string
          id?: string
          internal_identifier?: string
          owner_user_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          category: string
          file_url: string
          generated_name: string
          id: string
          original_file_name: string
          property_id: string
          uploaded_at: string
        }
        Insert: {
          category: string
          file_url: string
          generated_name: string
          id?: string
          original_file_name: string
          property_id: string
          uploaded_at?: string
        }
        Update: {
          category?: string
          file_url?: string
          generated_name?: string
          id?: string
          original_file_name?: string
          property_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_valuations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          property_id: string
          valuation_amount: number
          valuation_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          valuation_amount: number
          valuation_date: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          valuation_amount?: number
          valuation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_dues: {
        Row: {
          balance_due: number
          contract_id: string
          created_at: string
          due_date: string
          expected_amount: number
          id: string
          period_month: string
          property_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_due: number
          contract_id: string
          created_at?: string
          due_date: string
          expected_amount: number
          id?: string
          period_month: string
          property_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_due?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          expected_amount?: number
          id?: string
          period_month?: string
          property_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_dues_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_dues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_dues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          payment_date: string
          receipt_file_url: string | null
          rent_due_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date: string
          receipt_file_url?: string | null
          rent_due_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          receipt_file_url?: string | null
          rent_due_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_rent_due_id_fkey"
            columns: ["rent_due_id"]
            isOneToOne: false
            referencedRelation: "rent_dues"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_obligations: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          due_date: string
          frequency: string
          id: string
          notes: string | null
          property_id: string
          receipt_file_url: string | null
          responsible: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          due_date: string
          frequency?: string
          id?: string
          notes?: string | null
          property_id: string
          receipt_file_url?: string | null
          responsible: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          due_date?: string
          frequency?: string
          id?: string
          notes?: string | null
          property_id?: string
          receipt_file_url?: string | null
          responsible?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_obligations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_links: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          property_id: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          property_id: string
          start_date: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          doc_id: string | null
          email: string | null
          full_name: string
          id: string
          owner_user_id: string
          phone: string | null
          preferred_language: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          owner_user_id: string
          phone?: string | null
          preferred_language?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          owner_user_id?: string
          phone?: string | null
          preferred_language?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_obligations: {
        Row: {
          active: boolean
          created_at: string
          due_day_of_month: number | null
          frequency: string
          id: string
          payer: string
          property_id: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          due_day_of_month?: number | null
          frequency?: string
          id?: string
          payer: string
          property_id: string
          type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          due_day_of_month?: number | null
          frequency?: string
          id?: string
          payer?: string
          property_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_obligations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_proofs: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          period_month: string
          status: string
          submitted_at: string | null
          utility_obligation_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          period_month: string
          status?: string
          submitted_at?: string | null
          utility_obligation_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          period_month?: string
          status?: string
          submitted_at?: string | null
          utility_obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_proofs_utility_obligation_id_fkey"
            columns: ["utility_obligation_id"]
            isOneToOne: false
            referencedRelation: "utility_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
