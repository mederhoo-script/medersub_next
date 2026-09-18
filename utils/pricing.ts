export type PricingSettings = {
    markup?: number | string;
    data_profit_up_to_1gb?: number | string;
    data_profit_up_to_3gb?: number | string;
    data_profit_up_to_5gb?: number | string;
    data_profit_up_to_10gb?: number | string;
    data_profit_over_10gb?: number | string;
    education_profit_per_pin?: number | string;
};

function nonNegativeNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/** Calculates the configured profit for a data plan, retaining the original defaults. */
export function calculateDataProfit(planName: string, settings: PricingSettings = {}): number {
    const name = planName.toLowerCase().replace(/\s/g, '');
    const match = name.match(/(\d+(?:\.\d+)?)(mb|gb|tb)/);

    if (!match) return nonNegativeNumber(settings.markup, 0);

    const value = parseFloat(match[1]);
    const unit = match[2];
    let sizeInGB = value;
    if (unit === 'mb') sizeInGB = value / 1024;
    else if (unit === 'tb') sizeInGB = value * 1024;

    if (sizeInGB <= 1) return nonNegativeNumber(settings.data_profit_up_to_1gb, 10);
    if (sizeInGB <= 3) return nonNegativeNumber(settings.data_profit_up_to_3gb, 20);
    if (sizeInGB <= 5) return nonNegativeNumber(settings.data_profit_up_to_5gb, 30);
    if (sizeInGB <= 10) return nonNegativeNumber(settings.data_profit_up_to_10gb, 50);
    return nonNegativeNumber(settings.data_profit_over_10gb, 100);
}

export function educationProfitPerPin(settings: PricingSettings = {}) {
    return nonNegativeNumber(settings.education_profit_per_pin, 20);
}
