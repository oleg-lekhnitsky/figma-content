import { createClient } from '@supabase/supabase-js'

// Replace this boundary with Supabase CLI-generated Database types after the
// first linked project migration. Application-facing values remain typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any

export const useSupabaseAdmin = () => {
  if (client) return client
  const config = useRuntimeConfig()
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be configured')
  }
  client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  })
  return client
}
