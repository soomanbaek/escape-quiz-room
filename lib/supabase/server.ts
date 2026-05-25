// Supabase server client wrapper
// Re-export createServerClient for compatibility
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Alias for backwards compatibility (createServerClient name)
export const createServerClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
