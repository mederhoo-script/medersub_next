import { supabaseAdmin } from '@/lib/supabase-admin';

export type PaymentProvider = 'monnify' | 'korapay';

export function normalizePaymentProvider(value?: string | null): PaymentProvider {
  const lower = (value || 'monnify').toLowerCase();
  return lower === 'korapay' ? 'korapay' : 'monnify';
}

export async function getActivePaymentProvider(): Promise<PaymentProvider> {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_provider')
    .maybeSingle();

  if (error) {
    console.warn('[payment-provider] Failed to resolve active provider:', error.message);
    return 'monnify';
  }

  return normalizePaymentProvider(typeof data?.value === 'string' ? data.value : (data?.value as any)?.provider ?? 'monnify');
}

export async function setActivePaymentProvider(provider: PaymentProvider) {
  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert(
      { key: 'payment_provider', value: provider, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    throw new Error(error.message);
  }
}
