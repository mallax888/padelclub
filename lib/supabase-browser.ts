import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Passkey support (auth.registerPasskey/signInWithPasskey/passkey.*) is
    // still marked experimental in @supabase/auth-js and throws on every
    // call unless explicitly opted into here.
    { auth: { experimental: { passkey: true } } }
  )