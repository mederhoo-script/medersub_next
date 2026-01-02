import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for server-side admin tasks (bypass RLS)
// Ensure this is only imported in server components/routes
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
