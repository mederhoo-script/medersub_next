import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PricingSettings } from '@/utils/pricing';

export const dynamic = 'force-dynamic';

/** Supplies client pages with the profit settings used by the purchase endpoint. */
export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle();

    if (error) return NextResponse.json({ status: 'failed', message: 'Unable to load pricing' }, { status: 500 });
    const settings = (data?.value || {}) as PricingSettings;
    return NextResponse.json({
        status: 'success',
        data: {
            markup: settings.markup ?? 0,
            data_profit_up_to_1gb: settings.data_profit_up_to_1gb ?? 10,
            data_profit_up_to_3gb: settings.data_profit_up_to_3gb ?? 20,
            data_profit_up_to_5gb: settings.data_profit_up_to_5gb ?? 30,
            data_profit_up_to_10gb: settings.data_profit_up_to_10gb ?? 50,
            data_profit_over_10gb: settings.data_profit_over_10gb ?? 100,
            education_profit_per_pin: settings.education_profit_per_pin ?? 20,
        } satisfies PricingSettings,
    });
}
