
export interface MarketEstimates {
    pricePerSqm: number;
    rentPerSqm: number;
}

export function estimateMarketData(city: any): MarketEstimates {
    if (!city) return { pricePerSqm: 0, rentPerSqm: 0 };

    // Mock Logic (deterministic based on city code)
    // In real app, this would fetch from an API

    // Base prices
    const basePrice = 2000;
    const baseRent = 10;

    const modifier = (parseInt(city.code) % 100) * 50; // Random-ish variety
    const nameModifier = city.nom.length * 50;

    const pricePerSqm = Math.round(basePrice + modifier + nameModifier);
    // Rent usually correlates, approx 5-6% gross yield base
    // Price = 3000 -> Rent ~ 15/m2
    const rentPerSqm = Math.round((pricePerSqm * 0.06) / 12 * 10) / 10; // 6% yield assumption

    return {
        pricePerSqm,
        rentPerSqm
    };
}
