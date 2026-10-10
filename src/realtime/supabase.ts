import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export function readSupabaseConfig(env: SupabaseEnv): { url: string; anonKey: string } {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url) {
    throw new Error('Missing environment variable VITE_SUPABASE_URL. Copy .env.example to .env.local and set it.')
  }
  if (!anonKey) {
    throw new Error('Missing environment variable VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and set it.')
  }
  return { url, anonKey }
}

export function createSupabaseClient(env: SupabaseEnv = import.meta.env): SupabaseClient {
  const { url, anonKey } = readSupabaseConfig(env)
  return createClient(url, anonKey)
}
