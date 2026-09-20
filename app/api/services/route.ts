import { NextResponse } from 'next/server';
import { inlomax } from '@/lib/inlomax';
import { getSmeApiDataPlans, normalizeNetworkName, normalizeSmeApiDataPlans, normalizeVtuProviderConfig, selectVtuProvider } from '@/lib/vtu-providers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const data = await inlomax.getServices();
        const { data: providerSetting } = await supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'vtu_provider_config')
            .maybeSingle();
        const providerConfig = normalizeVtuProviderConfig(providerSetting?.value);
        const needsSmeApi = ['MTN', 'GLO', 'AIRTEL', 'T2MOBILE'].some((network) => selectVtuProvider(providerConfig, 'DATA', network) === 'smeapi');
        const smeApiDataPlans = needsSmeApi ? await getSmeApiDataPlans() : null;
        const inlomaxPlans = Array.isArray(data?.data?.dataPlans) ? data.data.dataPlans : [];
        const smeApiPlans = normalizeSmeApiDataPlans(smeApiDataPlans);
        if (data?.data) {
            data.data.dataPlans = ['MTN', 'GLO', 'AIRTEL', 'T2MOBILE'].flatMap((network) => {
                const provider = selectVtuProvider(providerConfig, 'DATA', network);
                return provider === 'smeapi'
                    ? smeApiPlans.filter((plan) => normalizeNetworkName(plan.network) === network)
                    : inlomaxPlans.filter((plan: { network?: string }) => normalizeNetworkName(plan.network) === network);
            });
            data.data.providerConfig = providerConfig;
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
