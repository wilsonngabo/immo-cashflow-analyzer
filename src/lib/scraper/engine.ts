import { scrapeWithPuppeteer } from './puppeteer';
import { scrapeWithApify } from './apify';
import { scrapeWithCheerio } from './cheerio';

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

        // 1. Try Apify (The "Better Way")
        const apifyResults = await scrapeWithApify(cityName, zipCode);
        if (apifyResults && apifyResults.length > 0) {
            console.log(`[Engine] Successfully scraped ${apifyResults.length} items via APIFY.`);
            return apifyResults;
        }

        // 2. Try Cheerio (Fast HTTP Request - "Python Style")
        console.log("[Engine] Trying Lightweight Cheerio Scraper...");
        const cheerioResults = await scrapeWithCheerio(cityName, zipCode);
        if (cheerioResults && cheerioResults.length > 0) {
            console.log(`[Engine] Successfully scraped ${cheerioResults.length} items via Cheerio.`);
            return cheerioResults;
        }

        // 3. Fallback to Local Puppeteer (Heavy Browser)
        console.log("[Engine] Cheerio failed (likely blocked). Trying Local Puppeteer...");
        const realListings = await scrapeWithPuppeteer(cityName, zipCode);

        if (realListings && realListings.length > 0) {
            console.log(`[Engine] Successfully scraped ${realListings.length} items via Puppeteer.`);
            return realListings;
        }

        console.warn("[Engine] All real scrapers failed. Falling back to simulation.");
        return simulateListings(cityName, zipCode);

    } catch (e: any) {
        console.error(`[Engine] Critical failure for ${cityName}:`, e.message);
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
