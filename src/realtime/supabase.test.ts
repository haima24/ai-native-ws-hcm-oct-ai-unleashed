import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabase'

describe('readSupabaseConfig', () => {
  it('returns the url and anon key when both are set', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' }),
    ).toEqual({ url: 'https://example.supabase.co', anonKey: 'anon' })
  })

  it('throws naming VITE_SUPABASE_URL when it is missing', () => {
    expect(() => readSupabaseConfig({ VITE_SUPABASE_ANON_KEY: 'anon' })).toThrow('VITE_SUPABASE_URL')
  })

  it('throws naming VITE_SUPABASE_ANON_KEY when it is missing or blank', () => {
    expect(() => readSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: ' ' })).toThrow(
      'VITE_SUPABASE_ANON_KEY',
    )
  })
})
