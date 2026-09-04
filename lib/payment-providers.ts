import { supabaseAdmin } from '@/lib/supabase-admin';

export type PaymentProvider = 'monnify' | 'korapay' | 'none';

export function normalizePaymentProvider(value?: string | null): PaymentProvider {
  let normalizedValue = value || 'monnify';
  try {
    const parsed = JSON.parse(normalizedValue);
    if (typeof parsed === 'string') normalizedValue = parsed;
  } catch {
    // The setting may already be a plain string.
  }

  const lower = normalizedValue.trim().toLowerCase().replace(/^['"]|['"]$/g, '');
  if (lower === 'korapay') return 'korapay';
  if (lower === 'none' || lower === 'manual') return 'none';
  return 'monnify';
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

  const settingValue = typeof data?.value === 'string' ? data.value : (data?.value as any)?.provider;
  return normalizePaymentProvider(settingValue);
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
