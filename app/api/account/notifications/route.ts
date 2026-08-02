import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

type NotificationSettingsRow = {
  push_enabled: boolean;
  transactions_enabled: boolean;
  account_enabled: boolean;
  promos_enabled: boolean;
};

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

const DEFAULT_SETTINGS = {
  pushEnabled: true,
  transactionsEnabled: true,
  accountEnabled: true,
  promosEnabled: false,
};

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('user_notification_settings')
      .select('push_enabled,transactions_enabled,account_enabled,promos_enabled')
      .eq('user_id', user.id)
      .maybeSingle<NotificationSettingsRow>();

    if (error) throw error;

    return NextResponse.json({
      settings: data ? {
        pushEnabled: Boolean(data.push_enabled),
        transactionsEnabled: Boolean(data.transactions_enabled),
        accountEnabled: Boolean(data.account_enabled),
        promosEnabled: Boolean(data.promos_enabled),
      } : DEFAULT_SETTINGS,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load notification settings.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body?.action;

    if (action === 'update-settings') {
      const pushEnabled = body?.pushEnabled !== false;
      const transactionsEnabled = body?.transactionsEnabled !== false;
      const accountEnabled = body?.accountEnabled !== false;
      const promosEnabled = body?.promosEnabled === true;

      const { error } = await supabaseAdmin
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          push_enabled: pushEnabled,
          transactions_enabled: transactionsEnabled,
          account_enabled: accountEnabled,
          promos_enabled: promosEnabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      if (!pushEnabled) {
        const { error: tokenError } = await supabaseAdmin
          .from('user_push_tokens')
          .update({ enabled: false, last_seen_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (tokenError) throw tokenError;
      }

      return NextResponse.json({
        success: true,
        settings: { pushEnabled, transactionsEnabled, accountEnabled, promosEnabled },
      });
    }

    if (action === 'register-token') {
      const token = typeof body?.token === 'string' ? body.token.trim() : '';
      const platform = typeof body?.platform === 'string' ? body.platform.trim().toLowerCase() : 'android';
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : null;

      if (!token || token.length > 4096) {
        return NextResponse.json({ error: 'Invalid push token.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('user_push_tokens')
        .upsert({
          user_id: user.id,
          token,
          platform: ['android', 'ios', 'web'].includes(platform) ? platform : 'android',
          device_id: deviceId || null,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'token' });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'disable-token') {
      const token = typeof body?.token === 'string' ? body.token.trim() : '';
      if (!token || token.length > 4096) {
        return NextResponse.json({ error: 'Invalid push token.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('user_push_tokens')
        .update({ enabled: false, last_seen_at: new Date().toISOString() })
        .eq('token', token)
        .eq('user_id', user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid notifications request action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update notification settings.' }, { status: 500 });
  }
}
