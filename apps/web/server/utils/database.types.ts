import type { Role } from '@content-library/shared'

export interface AllowedUserRow {
  id: string
  organization_id: string
  email: string | null
  figma_user_id: string | null
  figma_handle: string | null
  avatar_url: string | null
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
  password_hash: string | null
  must_change_password: boolean
  failed_login_count: number
  locked_until: string | null
}

export interface Database {
  public: {
    Tables: {
      allowed_users: { Row: AllowedUserRow, Insert: Partial<AllowedUserRow>, Update: Partial<AllowedUserRow>, Relationships: [] }
      sessions: { Row: Record<string, unknown>, Insert: Record<string, unknown>, Update: Record<string, unknown>, Relationships: [] }
      oauth_states: { Row: Record<string, unknown>, Insert: Record<string, unknown>, Update: Record<string, unknown>, Relationships: [] }
      plugin_auth_codes: { Row: Record<string, unknown>, Insert: Record<string, unknown>, Update: Record<string, unknown>, Relationships: [] }
      audit_logs: { Row: Record<string, unknown>, Insert: Record<string, unknown>, Update: Record<string, unknown>, Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      consume_plugin_auth_code: { Args: { p_code_hash: string, p_now: string }, Returns: { allowed_user_id: string }[] }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
