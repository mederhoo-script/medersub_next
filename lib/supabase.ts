import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client for public access (optional, if needed for client-side)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
