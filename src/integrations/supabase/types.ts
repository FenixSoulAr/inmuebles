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
          project_id: string
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
          project_id: string
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
          project_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clause_templates: {
        Row: {
          applies_to: string
          created_at: string
          default_enabled: boolean
          id: string
          is_active: boolean
          is_optional: boolean
          name: string
          order_default: number
          project_id: string
          tags: string | null
          template_text: string
          updated_at: string
          version: number
        }
        Insert: {
          applies_to?: string
          created_at?: string
          default_enabled?: boolean
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name: string
          order_default?: number
          project_id: string
          tags?: string | null
          template_text?: string
          updated_at?: string
          version?: number
        }
        Update: {
          applies_to?: string
          created_at?: string
          default_enabled?: boolean
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name?: string
          order_default?: number
          project_id?: string
          tags?: string | null
          template_text?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clause_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
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
          project_id: string
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
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_adjustment_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustment_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_adjustments: {
        Row: {
          adjustment_date: string
          calculated_amount: number
          confirmed_amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          contract_id: string
          created_at: string
          id: string
          manual_percentage: number | null
          note: string | null
          previous_amount: number
          project_id: string
          status: string
        }
        Insert: {
          adjustment_date: string
          calculated_amount: number
          confirmed_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id: string
          created_at?: string
          id?: string
          manual_percentage?: number | null
          note?: string | null
          previous_amount: number
          project_id: string
          status?: string
        }
        Update: {
          adjustment_date?: string
          calculated_amount?: number
          confirmed_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          manual_percentage?: number | null
          note?: string | null
          previous_amount?: number
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_adjustments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_adjustments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          clause_template_id: string | null
          contract_id: string
          created_at: string
          enabled: boolean
          id: string
          order_position: number
          project_id: string
          rendered_text: string
          source_version: number | null
          title: string
          updated_at: string
        }
        Insert: {
          clause_template_id?: string | null
          contract_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          order_position?: number
          project_id: string
          rendered_text?: string
          source_version?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          clause_template_id?: string | null
          contract_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          order_position?: number
          project_id?: string
          rendered_text?: string
          source_version?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_clauses_clause_template_id_fkey"
            columns: ["clause_template_id"]
            isOneToOne: false
            referencedRelation: "clause_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_clauses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          doc_type: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_primary: boolean | null
          mime_type: string | null
          notes: string | null
          project_id: string
          status: string
          title: string
          uploaded_at: string
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          contract_id: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          project_id: string
          status?: string
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          contract_id?: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          project_id?: string
          status?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_guarantors: {
        Row: {
          address: string | null
          company_name: string | null
          contract_id: string
          coverage_amount: number | null
          created_at: string
          details: Json | null
          document_or_cuit: string | null
          email: string | null
          full_name: string
          guarantee_type: string | null
          guarantor_type: string
          id: string
          insurance_policy_number: string | null
          insurance_valid_from: string | null
          insurance_valid_to: string | null
          notes: string | null
          phone: string | null
          project_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contract_id: string
          coverage_amount?: number | null
          created_at?: string
          details?: Json | null
          document_or_cuit?: string | null
          email?: string | null
          full_name: string
          guarantee_type?: string | null
          guarantor_type?: string
          id?: string
          insurance_policy_number?: string | null
          insurance_valid_from?: string | null
          insurance_valid_to?: string | null
          notes?: string | null
          phone?: string | null
          project_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contract_id?: string
          coverage_amount?: number | null
          created_at?: string
          details?: Json | null
          document_or_cuit?: string | null
          email?: string | null
          full_name?: string
          guarantee_type?: string | null
          guarantor_type?: string
          id?: string
          insurance_policy_number?: string | null
          insurance_valid_from?: string | null
          insurance_valid_to?: string | null
          notes?: string | null
          phone?: string | null
          project_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_guarantors_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_guarantors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
          service_type: string
        }
        Insert: {
          active?: boolean
          contract_id: string
          created_at?: string
          due_day?: number | null
          expected_amount?: number | null
          id?: string
          project_id: string
          service_type: string
        }
        Update: {
          active?: boolean
          contract_id?: string
          created_at?: string
          due_day?: number | null
          expected_amount?: number | null
          id?: string
          project_id?: string
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
          {
            foreignKeyName: "contract_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          adjustment_base_date: string | null
          adjustment_frequency: number | null
          adjustment_type: string
          basic_terms: string | null
          booking_channel: string | null
          clause_flags: Json | null
          clauses_text: string | null
          created_at: string
          currency: string | null
          currency_deposit: string | null
          current_rent: number
          deposit: number | null
          deposit_mode: string
          deposit_type: string
          draft_last_generated_at: string | null
          draft_status: string
          draft_text: string | null
          end_date: string
          expensas_extraordinarias: boolean | null
          expensas_ordinarias: boolean | null
          grace_days: number | null
          has_price_update: boolean
          id: string
          impuestos_a_cargo_locatario: boolean | null
          index_notes: string | null
          initial_rent: number
          is_active: boolean
          jurisdiction_region: string | null
          next_adjustment_date: string | null
          pdf_url: string | null
          penalty_type: string | null
          penalty_value: number | null
          permite_mascotas: boolean | null
          permite_subalquiler: boolean | null
          price_mode: string
          project_id: string
          property_id: string
          public_submission_token: string | null
          rent_due_day: number | null
          seguro_obligatorio: boolean | null
          seguro_tipo: string | null
          signed_contract_file_url: string | null
          start_date: string
          submission_language: string
          tenant_id: string
          tenant_insurance_notes: string | null
          texto_contrato: string | null
          tipo_contrato: string | null
          token_created_at: string | null
          token_rotated_at: string | null
          token_status: string
          update_percentage: number | null
          updated_at: string
          usa_seguro: boolean | null
        }
        Insert: {
          adjustment_base_date?: string | null
          adjustment_frequency?: number | null
          adjustment_type?: string
          basic_terms?: string | null
          booking_channel?: string | null
          clause_flags?: Json | null
          clauses_text?: string | null
          created_at?: string
          currency?: string | null
          currency_deposit?: string | null
          current_rent: number
          deposit?: number | null
          deposit_mode?: string
          deposit_type?: string
          draft_last_generated_at?: string | null
          draft_status?: string
          draft_text?: string | null
          end_date: string
          expensas_extraordinarias?: boolean | null
          expensas_ordinarias?: boolean | null
          grace_days?: number | null
          has_price_update?: boolean
          id?: string
          impuestos_a_cargo_locatario?: boolean | null
          index_notes?: string | null
          initial_rent: number
          is_active?: boolean
          jurisdiction_region?: string | null
          next_adjustment_date?: string | null
          pdf_url?: string | null
          penalty_type?: string | null
          penalty_value?: number | null
          permite_mascotas?: boolean | null
          permite_subalquiler?: boolean | null
          price_mode?: string
          project_id: string
          property_id: string
          public_submission_token?: string | null
          rent_due_day?: number | null
          seguro_obligatorio?: boolean | null
          seguro_tipo?: string | null
          signed_contract_file_url?: string | null
          start_date: string
          submission_language?: string
          tenant_id: string
          tenant_insurance_notes?: string | null
          texto_contrato?: string | null
          tipo_contrato?: string | null
          token_created_at?: string | null
          token_rotated_at?: string | null
          token_status?: string
          update_percentage?: number | null
          updated_at?: string
          usa_seguro?: boolean | null
        }
        Update: {
          adjustment_base_date?: string | null
          adjustment_frequency?: number | null
          adjustment_type?: string
          basic_terms?: string | null
          booking_channel?: string | null
          clause_flags?: Json | null
          clauses_text?: string | null
          created_at?: string
          currency?: string | null
          currency_deposit?: string | null
          current_rent?: number
          deposit?: number | null
          deposit_mode?: string
          deposit_type?: string
          draft_last_generated_at?: string | null
          draft_status?: string
          draft_text?: string | null
          end_date?: string
          expensas_extraordinarias?: boolean | null
          expensas_ordinarias?: boolean | null
          grace_days?: number | null
          has_price_update?: boolean
          id?: string
          impuestos_a_cargo_locatario?: boolean | null
          index_notes?: string | null
          initial_rent?: number
          is_active?: boolean
          jurisdiction_region?: string | null
          next_adjustment_date?: string | null
          pdf_url?: string | null
          penalty_type?: string | null
          penalty_value?: number | null
          permite_mascotas?: boolean | null
          permite_subalquiler?: boolean | null
          price_mode?: string
          project_id?: string
          property_id?: string
          public_submission_token?: string | null
          rent_due_day?: number | null
          seguro_obligatorio?: boolean | null
          seguro_tipo?: string | null
          signed_contract_file_url?: string | null
          start_date?: string
          submission_language?: string
          tenant_id?: string
          tenant_insurance_notes?: string | null
          texto_contrato?: string | null
          tipo_contrato?: string | null
          token_created_at?: string | null
          token_rotated_at?: string | null
          token_status?: string
          update_percentage?: number | null
          updated_at?: string
          usa_seguro?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
      documents: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string
          doc_type: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          project_id: string
          property_id: string | null
          scope: string
          title: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          project_id: string
          property_id?: string | null
          scope: string
          title: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string
          doc_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          project_id?: string
          property_id?: string | null
          scope?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          project_id: string
          tenant_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          project_id: string
          tenant_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          project_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
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
          project_id: string
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
          project_id?: string
          property_id?: string
          receipt_file_url?: string | null
          reported_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
            foreignKeyName: "obligations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      owners: {
        Row: {
          address: string | null
          created_at: string
          dni_cuit: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          dni_cuit?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          dni_cuit?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
          property_id: string
          share_percent: number
        }
        Insert: {
          created_at?: string
          holder_name: string
          holder_type: string
          id?: string
          project_id: string
          property_id: string
          share_percent: number
        }
        Update: {
          created_at?: string
          holder_name?: string
          holder_type?: string
          id?: string
          project_id?: string
          property_id?: string
          share_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "ownership_stakes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
          proof_reviewed_at: string | null
          proof_reviewed_by: string | null
          proof_status: string
          proof_waived_note: string | null
          proof_waived_reason: string | null
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
          project_id: string
          proof_reviewed_at?: string | null
          proof_reviewed_by?: string | null
          proof_status?: string
          proof_waived_note?: string | null
          proof_waived_reason?: string | null
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
          project_id?: string
          proof_reviewed_at?: string | null
          proof_reviewed_by?: string | null
          proof_status?: string
          proof_waived_note?: string | null
          proof_waived_reason?: string | null
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
            foreignKeyName: "payment_proofs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
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
          project_id: string
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
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      project_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
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
          project_id: string
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
          project_id: string
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
          project_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
          property_id: string
          uploaded_at: string
        }
        Insert: {
          category: string
          file_url: string
          generated_name: string
          id?: string
          original_file_name: string
          project_id: string
          property_id: string
          uploaded_at?: string
        }
        Update: {
          category?: string
          file_url?: string
          generated_name?: string
          id?: string
          original_file_name?: string
          project_id?: string
          property_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          ownership_percent: number | null
          project_id: string
          property_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          ownership_percent?: number | null
          project_id: string
          property_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          ownership_percent?: number | null
          project_id?: string
          property_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
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
          project_id: string
          property_id: string
          valuation_amount: number
          valuation_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          property_id: string
          valuation_amount: number
          valuation_date: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          property_id?: string
          valuation_amount?: number
          valuation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_valuations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
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
          project_id: string
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
          project_id?: string
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
            foreignKeyName: "rent_dues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
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
          project_id: string
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
          project_id?: string
          receipt_file_url?: string | null
          rent_due_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
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
          project_id: string
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
          project_id?: string
          property_id?: string
          receipt_file_url?: string | null
          responsible?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_obligations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
          property_id: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          property_id: string
          start_date: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          property_id?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          phone: string | null
          preferred_language: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          preferred_language?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string
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
          project_id: string
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
          project_id?: string
          property_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_obligations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
          project_id: string
          status: string
          submitted_at: string | null
          utility_obligation_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          period_month: string
          project_id: string
          status?: string
          submitted_at?: string | null
          utility_obligation_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          period_month?: string
          project_id?: string
          status?: string
          submitted_at?: string | null
          utility_obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_proofs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
      accept_invite: { Args: { _token: string }; Returns: Json }
      get_project_role: {
        Args: { _pid: string; _uid: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      has_admin_role: { Args: { _pid: string; _uid: string }; Returns: boolean }
      has_write_role: { Args: { _pid: string; _uid: string }; Returns: boolean }
      is_project_member: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      membership_status: "active" | "invited" | "removed"
      project_role: "owner" | "admin" | "collaborator" | "viewer"
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
      membership_status: ["active", "invited", "removed"],
      project_role: ["owner", "admin", "collaborator", "viewer"],
    },
  },
} as const
