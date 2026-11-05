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
      academic_periods: {
        Row: {
          academic_year: string
          created_at: string
          ends_on: string
          id: string
          is_published: boolean
          semester: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          ends_on: string
          id?: string
          is_published?: boolean
          semester: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          ends_on?: string
          id?: string
          is_published?: boolean
          semester?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          academic_period_id: string | null
          counselor_id: string
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_period_id?: string | null
          counselor_id: string
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string | null
          counselor_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participants: {
        Row: {
          address: string | null
          birthplace: string | null
          booking_id: string
          created_at: string
          date_of_birth: string | null
          display_name: string
          education: string | null
          faculty: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_primary: boolean
          is_representative: boolean
          nim: string | null
          participant_status: string
          participant_type: string
          phone_e164: string | null
          religion: string | null
          study_program: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          birthplace?: string | null
          booking_id: string
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          education?: string | null
          faculty?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_primary?: boolean
          is_representative?: boolean
          nim?: string | null
          participant_status?: string
          participant_type?: string
          phone_e164?: string | null
          religion?: string | null
          study_program?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          birthplace?: string | null
          booking_id?: string
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          education?: string | null
          faculty?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_primary?: boolean
          is_representative?: boolean
          nim?: string | null
          participant_status?: string
          participant_type?: string
          phone_e164?: string | null
          religion?: string | null
          study_program?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          availability_slot_id: string | null
          cancellation_reason: string | null
          client_id: string
          counselor_id: string
          created_at: string
          ends_at: string
          group_name: string | null
          id: string
          participant_count: number
          reschedule_reason: string | null
          service_type: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          availability_slot_id?: string | null
          cancellation_reason?: string | null
          client_id: string
          counselor_id: string
          created_at?: string
          ends_at: string
          group_name?: string | null
          id?: string
          participant_count?: number
          reschedule_reason?: string | null
          service_type: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability_slot_id?: string | null
          cancellation_reason?: string | null
          client_id?: string
          counselor_id?: string
          created_at?: string
          ends_at?: string
          group_name?: string | null
          id?: string
          participant_count?: number
          reschedule_reason?: string | null
          service_type?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_audit_logs: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          booking_id: string | null
          booking_participant_id: string | null
          consent_id: string | null
          created_at: string
          event_timestamp: string
          event_type: string
          id: string
          invitation_id: string | null
          metadata: Json
          request_id: string | null
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          booking_id?: string | null
          booking_participant_id?: string | null
          consent_id?: string | null
          created_at?: string
          event_timestamp?: string
          event_type: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          request_id?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          booking_id?: string | null
          booking_participant_id?: string | null
          consent_id?: string | null
          created_at?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_audit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_audit_logs_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_audit_logs_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "informed_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_audit_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "consent_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_invitation_secrets: {
        Row: {
          auth_tag: string
          cleared_at: string | null
          created_at: string
          encrypted_token: string
          invitation_id: string
          iv: string
          key_version: string
        }
        Insert: {
          auth_tag: string
          cleared_at?: string | null
          created_at?: string
          encrypted_token: string
          invitation_id: string
          iv: string
          key_version?: string
        }
        Update: {
          auth_tag?: string
          cleared_at?: string | null
          created_at?: string
          encrypted_token?: string
          invitation_id?: string
          iv?: string
          key_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_invitation_secrets_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "consent_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_invitations: {
        Row: {
          booking_participant_id: string
          claimed_at: string | null
          claimed_by_user_id: string | null
          completed_at: string | null
          consent_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          invitation_type: string
          recipient_email: string | null
          recipient_phone_e164: string | null
          revoked_at: string | null
          revoked_by: string | null
          sent_at: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          booking_participant_id: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          completed_at?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          invitation_type?: string
          recipient_email?: string | null
          recipient_phone_e164?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sent_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          booking_participant_id?: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          completed_at?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invitation_type?: string
          recipient_email?: string | null
          recipient_phone_e164?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sent_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_invitations_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_invitations_claimed_by_user_id_fkey"
            columns: ["claimed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_invitations_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "informed_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          effective_at: string
          file_sha256: string
          file_size_bytes: number
          id: string
          is_active: boolean
          mime_type: string
          storage_bucket: string
          storage_path: string
          template_code: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_at?: string
          file_sha256: string
          file_size_bytes: number
          id?: string
          is_active?: boolean
          mime_type?: string
          storage_bucket?: string
          storage_path?: string
          template_code?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_at?: string
          file_sha256?: string
          file_size_bytes?: number
          id?: string
          is_active?: boolean
          mime_type?: string
          storage_bucket?: string
          storage_path?: string
          template_code?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counseling_sessions: {
        Row: {
          booking_id: string
          completed_at: string | null
          counselor_id: string
          created_at: string
          ends_at: string
          format: string
          id: string
          room: string | null
          started_at: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          counselor_id: string
          created_at?: string
          ends_at: string
          format: string
          id?: string
          room?: string | null
          started_at?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          counselor_id?: string
          created_at?: string
          ends_at?: string
          format?: string
          id?: string
          room?: string | null
          started_at?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counseling_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counseling_sessions_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_history_credentials: {
        Row: {
          counselor_id: string
          created_at: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          counselor_id: string
          created_at?: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          counselor_id?: string
          created_at?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselor_history_credentials_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_profiles: {
        Row: {
          bio: string | null
          created_at: string
          headline: string | null
          is_public: boolean
          photo_path: string | null
          profile_id: string
          public_name: string | null
          specialties: string[]
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          is_public?: boolean
          photo_path?: string | null
          profile_id: string
          public_name?: string | null
          specialties?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          is_public?: boolean
          photo_path?: string | null
          profile_id?: string
          public_name?: string | null
          specialties?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "counselor_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          client_id: string
          comment: string | null
          counselor_id: string
          created_at: string
          disabled_reason: string | null
          id: string
          moderation_status: string
          rating: number
          review_status: string
          session_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          counselor_id: string
          created_at?: string
          disabled_reason?: string | null
          id?: string
          moderation_status?: string
          rating: number
          review_status?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          counselor_id?: string
          created_at?: string
          disabled_reason?: string | null
          id?: string
          moderation_status?: string
          rating?: number
          review_status?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "counseling_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_motivations: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      informed_consents: {
        Row: {
          booking_id: string
          booking_participant_id: string
          consent_statement_version: string
          consent_template_id: string
          created_at: string
          id: string
          identity_snapshot: Json
          revocation_reason: string | null
          revoked_at: string | null
          session_id: string | null
          signature_method: string | null
          signature_storage_path: string | null
          signed_at: string | null
          signed_document_sha256: string | null
          signed_document_size_bytes: number | null
          signed_document_storage_path: string | null
          signer_name_snapshot: string | null
          signer_user_id: string | null
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          booking_id: string
          booking_participant_id: string
          consent_statement_version?: string
          consent_template_id: string
          created_at?: string
          id?: string
          identity_snapshot?: Json
          revocation_reason?: string | null
          revoked_at?: string | null
          session_id?: string | null
          signature_method?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signed_document_sha256?: string | null
          signed_document_size_bytes?: number | null
          signed_document_storage_path?: string | null
          signer_name_snapshot?: string | null
          signer_user_id?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          booking_id?: string
          booking_participant_id?: string
          consent_statement_version?: string
          consent_template_id?: string
          created_at?: string
          id?: string
          identity_snapshot?: Json
          revocation_reason?: string | null
          revoked_at?: string | null
          session_id?: string | null
          signature_method?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signed_document_sha256?: string | null
          signed_document_size_bytes?: number | null
          signed_document_storage_path?: string | null
          signer_name_snapshot?: string | null
          signer_user_id?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "informed_consents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consents_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consents_consent_template_id_fkey"
            columns: ["consent_template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "counseling_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consents_signer_user_id_fkey"
            columns: ["signer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          app_role: string
          created_at: string
          full_name: string
          gender: string | null
          id: string
          identity_code: string | null
          member_category: string | null
          phone_e164: string | null
          siap_number: string | null
          sipp_silp_number: string | null
          sipp_silp_updated_at: string | null
          sipp_silp_valid_until: string | null
          updated_at: string
          whatsapp_opt_in: boolean
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          account_status?: string
          app_role?: string
          created_at?: string
          full_name?: string
          gender?: string | null
          id: string
          identity_code?: string | null
          member_category?: string | null
          phone_e164?: string | null
          siap_number?: string | null
          sipp_silp_number?: string | null
          sipp_silp_updated_at?: string | null
          sipp_silp_valid_until?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          account_status?: string
          app_role?: string
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          identity_code?: string | null
          member_category?: string | null
          phone_e164?: string | null
          siap_number?: string | null
          sipp_silp_number?: string | null
          sipp_silp_updated_at?: string | null
          sipp_silp_valid_until?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          client_note: string | null
          counselor_id: string
          counselor_note: string | null
          created_at: string
          follow_up: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          client_note?: string | null
          counselor_id: string
          counselor_note?: string | null
          created_at?: string
          follow_up?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          client_note?: string | null
          counselor_id?: string
          counselor_note?: string | null
          created_at?: string
          follow_up?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "counseling_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_outbox: {
        Row: {
          attempt_count: number
          booking_id: string
          booking_participant_id: string | null
          created_at: string
          delivered_at: string | null
          error_category: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_type: string
          next_attempt_at: string | null
          payload: Json
          phone_e164: string | null
          provider_message_id: string | null
          provider_request_id: string | null
          provider_response: Json | null
          provider_state: string | null
          provider_state_id: string | null
          provider_status: string | null
          recipient_user_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          booking_id: string
          booking_participant_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_category?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_type: string
          next_attempt_at?: string | null
          payload?: Json
          phone_e164?: string | null
          provider_message_id?: string | null
          provider_request_id?: string | null
          provider_response?: Json | null
          provider_state?: string | null
          provider_state_id?: string | null
          provider_status?: string | null
          recipient_user_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          booking_id?: string
          booking_participant_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_category?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_type?: string
          next_attempt_at?: string | null
          payload?: Json
          phone_e164?: string | null
          provider_message_id?: string | null
          provider_request_id?: string | null
          provider_response?: Json | null
          provider_state?: string | null
          provider_state_id?: string | null
          provider_status?: string | null
          recipient_user_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_app_role: { Args: never; Returns: string }
      is_public_counselor: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      sicare_cancel_availability_slot: {
        Args: { p_counselor_id: string; p_slot_id: string }
        Returns: string
      }
      sicare_check_booking_consent_readiness: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      sicare_claim_consent_invitation: {
        Args: { p_claimer_user_id?: string; p_token_hash: string }
        Returns: Json
      }
      sicare_claim_whatsapp_jobs: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          booking_id: string
          booking_participant_id: string | null
          created_at: string
          delivered_at: string | null
          error_category: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_type: string
          next_attempt_at: string | null
          payload: Json
          phone_e164: string | null
          provider_message_id: string | null
          provider_request_id: string | null
          provider_response: Json | null
          provider_state: string | null
          provider_state_id: string | null
          provider_status: string | null
          recipient_user_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sicare_create_booking: {
        Args: {
          p_client_id: string
          p_counselor_id: string
          p_group_name?: string
          p_participants?: Json
          p_service_type: string
          p_slot_id: string
        }
        Returns: string
      }
      sicare_get_booking_consent_summaries: {
        Args: { p_booking_id: string }
        Returns: {
          consent_id: string
          consent_status: string
          display_name: string
          is_primary: boolean
          participant_id: string
          participant_status: string
          signed_at: string
        }[]
      }
      sicare_get_whatsapp_stats: { Args: never; Returns: Json }
      sicare_public_availability: {
        Args: {
          p_counselor_ids: string[]
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          academic_period_id: string
          counselor_id: string
          ends_at: string
          id: string
          starts_at: string
          status: string
        }[]
      }
      sicare_reschedule_booking: {
        Args: { p_booking_id: string; p_client_id: string; p_slot_id: string }
        Returns: string
      }
      sicare_save_availability_slot: {
        Args: {
          p_academic_period_id?: string
          p_counselor_id: string
          p_ends_at: string
          p_slot_id: string
          p_starts_at: string
        }
        Returns: string
      }
      sicare_submit_feedback: {
        Args: {
          p_client_id: string
          p_comment?: string
          p_rating: number
          p_session_id: string
        }
        Returns: string
      }
      sicare_transition_booking: {
        Args: {
          p_actor_id: string
          p_booking_id: string
          p_reason?: string
          p_room?: string
          p_session_format?: string
          p_target_status: string
        }
        Returns: string
      }
      sicare_transition_session: {
        Args: {
          p_actor_id: string
          p_session_id: string
          p_target_status: string
        }
        Returns: string
      }
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
    Enums: {},
  },
} as const
