export function calculateDataProfit(planName: string): number {
    // Normalize string: remove spaces, lowercase
    const name = planName.toLowerCase().replace(/\s/g, '');

    // Extract number and unit
    const match = name.match(/(\d+(?:\.\d+)?)(mb|gb|tb)/);

    if (!match) return 0; // Default if parsing fails

    const value = parseFloat(match[1]);
    const unit = match[2];

    // Convert to GB for standardized comparison
    let sizeInGB = value;
    if (unit === 'mb') {
        sizeInGB = value / 1024;
    } else if (unit === 'tb') {
        sizeInGB = value * 1024;
    }

    // Pricing tiers logic
    if (sizeInGB <= 1) {
        return 10;
    } else if (sizeInGB <= 3) {
        return 20;
    } else if (sizeInGB <= 5) {
        return 30;
    } else if (sizeInGB <= 10) {
        return 50;
    } else {
        return 100; // > 10GB
    }
}
