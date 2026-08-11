import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return { user, error }
}

export async function POST() {
  try {
    const { user, error: authError } = await getAuthUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const fullName =
      typeof userMetadata.full_name === 'string'
        ? userMetadata.full_name
        : typeof userMetadata.fullName === 'string'
        ? userMetadata.fullName
        : user.email || ''

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: 'USER',
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const { error: walletError } = await supabaseAdmin
      .from('wallets')
      .upsert({ user_id: user.id, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    if (walletError) {
      return NextResponse.json({ error: walletError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to ensure profile.' }, { status: 500 })
  }
}
