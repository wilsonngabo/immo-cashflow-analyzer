import { scrapeWithPuppeteer } from './puppeteer';

export interface MarketListing {
    id: string;
    city: string;
    zipCode: string;
    price: number;
    surface: number;
    pricePerSqm: number;
    url: string;
    isPro: boolean;
    source: 'REAL' | 'SIMULATION';
}

export async function scrapeSeLogerByCity(cityName: string, zipCode: string): Promise<MarketListing[]> {
    try {
        console.log(`[Engine] Requested scan for ${cityName} (${zipCode})`);

        // Attempt Real Scrape with Puppeteer
        const realListings = await scrapeWithPuppeteer(cityName, zipCode);

        if (realListings && realListings.length > 0) {
            console.log(`[Engine] Successfully scraped ${realListings.length} items via Puppeteer.`);
            return realListings;
        }

        console.warn("[Engine] Puppeteer returned 0 items. Falling back to simulation.");
        return simulateListings(cityName, zipCode);

    } catch (e: any) {
        console.error(`[Engine] Critical failure for ${cityName}:`, e.message);
        // Fallback, but log loud
        return simulateListings(cityName, zipCode);
    }
}

export function simulateListings(city: string, zip: string): MarketListing[] {
    // Generates 10-20 realistic listings for a city
    const listings: MarketListing[] = [];
    const count = Math.floor(Math.random() * 15) + 5;

    // Base prices based on city reputation
    let basePricePerSqm = 3000;
    if (city.includes('paris')) basePricePerSqm = 10000;
    if (city.includes('lyon') || city.includes('bordeaux')) basePricePerSqm = 5000;
    if (city.includes('marly')) basePricePerSqm = 4500;

    for (let i = 0; i < count; i++) {
        const surface = 20 + Math.floor(Math.random() * 80);
        const variance = (Math.random() * 0.4) - 0.2;
        const pricePerSqm = basePricePerSqm * (1 + variance);
        const price = Math.round(surface * pricePerSqm);

        listings.push({
            id: `${city}-${i}-${Date.now()}`,
            city: city,
            zipCode: zip,
            price: price,
            surface: surface,
            pricePerSqm: Math.round(pricePerSqm),
            url: `https://www.seloger.com/demo/${city}/${i}`,
            isPro: Math.random() > 0.3,
            source: 'SIMULATION'
        });
    }
    return listings;
}
