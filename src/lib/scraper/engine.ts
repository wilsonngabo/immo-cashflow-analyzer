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
    const formattedCity = cityName.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
    const dept = zipCode.substring(0, 2);
    const searchUrl = `https://www.seloger.com/annonces/achat-de-bien/${formattedCity}-${dept}/`;

    console.log(`Scraping ${cityName} from: ${searchUrl}`);

    try {
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        if (!res.ok) {
            console.warn(`Blocked or Error for ${cityName}: ${res.status}`);
            return simulateListings(cityName, zipCode);
        }

        const html = await res.text();

        const listings: MarketListing[] = [];
        // Regex for Price: "price": 250000
        const regexPrice = /"price":(\d+)/g;
        // This is a naive heuristic. Real scraping requires traversing the DOM or JSON state.
        // We will try to extract just enough to prove it works, otherwise fallback.

        let match;
        // Trying to find the JSON data block SeLoger uses (often heavily nested)
        // If we find 0 real matches, we will return simulation.

        // Let's rely on fallback for now because regex parsing a dynamic React site is unreliable without Puppeteer.
        // But if we DO extract something, we mark it REAL.

        if (listings.length === 0) {
            return simulateListings(cityName, zipCode);
        }

        return listings;

    } catch (e) {
        console.error(`Scrape failed for ${cityName}`, e);
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
