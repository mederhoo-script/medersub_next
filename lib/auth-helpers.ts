import { supabaseAdmin } from '@/lib/supabase-admin';

export async function ensureWalletRow(userId: string) {
  const { error } = await supabaseAdmin
    .from('wallets')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message);
  }
}

export function getUserProfileName(user: any, profile?: any) {
  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.fullName || '';
  return fullName || user?.email || 'Medersub User';
}
