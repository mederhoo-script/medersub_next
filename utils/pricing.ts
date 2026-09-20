export type PricingSettings = {
    markup?: number | string;
    data_profit_up_to_1gb?: number | string;
    data_profit_up_to_3gb?: number | string;
    data_profit_up_to_5gb?: number | string;
    data_profit_up_to_10gb?: number | string;
    data_profit_over_10gb?: number | string;
    education_profit_per_pin?: number | string;
    data_profit_by_network?: Record<string, Partial<Record<'up_to_1gb' | 'up_to_3gb' | 'up_to_5gb' | 'up_to_10gb' | 'over_10gb', number | string>>>;
};

type DataProfitBucket = 'up_to_1gb' | 'up_to_3gb' | 'up_to_5gb' | 'up_to_10gb' | 'over_10gb';

const DATA_PROFIT_BUCKETS: Array<{ key: DataProfitBucket; fallback: number }> = [
    { key: 'up_to_1gb', fallback: 10 },
    { key: 'up_to_3gb', fallback: 20 },
    { key: 'up_to_5gb', fallback: 30 },
    { key: 'up_to_10gb', fallback: 50 },
    { key: 'over_10gb', fallback: 100 },
];

function normalizeNetworkKey(value?: string): string {
    const cleaned = String(value ?? '').trim().replace(/[_\-\s]+/g, '').toUpperCase();
    if (!cleaned) return '';
    if (cleaned.includes('T2MOBILE') || cleaned.includes('9MOBILE') || cleaned.includes('9MO') || cleaned.includes('T2M')) return 'T2MOBILE';
    return cleaned;
}

function getNetworkOverride(settings: PricingSettings, network?: string, bucket?: DataProfitBucket) {
    if (!bucket) return undefined;
    const normalized = normalizeNetworkKey(network);
    if (!normalized || !settings.data_profit_by_network) return undefined;
    const networkSettings = settings.data_profit_by_network[normalized] || settings.data_profit_by_network[normalized.toLowerCase()];
    if (!networkSettings) return undefined;
    return networkSettings[bucket];
}

function getBucketKey(sizeInGB: number): DataProfitBucket {
    if (sizeInGB <= 1) return 'up_to_1gb';
    if (sizeInGB <= 3) return 'up_to_3gb';
    if (sizeInGB <= 5) return 'up_to_5gb';
    if (sizeInGB <= 10) return 'up_to_10gb';
    return 'over_10gb';
}

function nonNegativeNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/** Calculates the configured profit for a data plan, retaining the original defaults. */
export function calculateDataProfit(planName: string, settings: PricingSettings = {}, network?: string): number {
    const name = planName.toLowerCase().replace(/\s/g, '');
    const match = name.match(/(\d+(?:\.\d+)?)(mb|gb|tb)/);

    if (!match) return nonNegativeNumber(settings.markup, 0);

    const value = parseFloat(match[1]);
    const unit = match[2];
    let sizeInGB = value;
    if (unit === 'mb') sizeInGB = value / 1024;
    else if (unit === 'tb') sizeInGB = value * 1024;

    const bucket = getBucketKey(sizeInGB);
    const fallbackValue = (DATA_PROFIT_BUCKETS.find((entry) => entry.key === bucket) || DATA_PROFIT_BUCKETS[0]).fallback;
    const networkOverride = getNetworkOverride(settings, network, bucket);
    if (networkOverride !== undefined) return nonNegativeNumber(networkOverride, fallbackValue);

    if (bucket === 'up_to_1gb') return nonNegativeNumber(settings.data_profit_up_to_1gb, fallbackValue);
    if (bucket === 'up_to_3gb') return nonNegativeNumber(settings.data_profit_up_to_3gb, fallbackValue);
    if (bucket === 'up_to_5gb') return nonNegativeNumber(settings.data_profit_up_to_5gb, fallbackValue);
    if (bucket === 'up_to_10gb') return nonNegativeNumber(settings.data_profit_up_to_10gb, fallbackValue);
    return nonNegativeNumber(settings.data_profit_over_10gb, fallbackValue);
}

export function educationProfitPerPin(settings: PricingSettings = {}) {
    return nonNegativeNumber(settings.education_profit_per_pin, 20);
}
