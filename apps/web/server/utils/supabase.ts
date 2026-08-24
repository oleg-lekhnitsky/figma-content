import { createClient } from '@supabase/supabase-js'
import { databaseError } from './app-error'

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

export const runSupabaseQuery = async <T>(
  operation: string,
  query: () => PromiseLike<T>,
  attempts = 2,
  acceptError?: (error: unknown) => boolean,
) => {
  let cause: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await query()
      const error = (result as { error?: unknown }).error
      if (!error || acceptError?.(error)) return result
      cause = error
    } catch (error) {
      cause = error
    }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
  }
  throw databaseError(operation, cause)
}
