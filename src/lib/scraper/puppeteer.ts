import puppeteer from 'puppeteer';
import { MarketListing } from './engine';

export async function scrapeWithPuppeteer(city: string, zipCode: string): Promise<MarketListing[]> {
    console.log(`[Puppeteer] Starting scrape for ${city} (${zipCode})...`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true, // Set to false to debug visually
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Anti-bot evasion: Set User Agent
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);

        // Set Viewport
        await page.setViewport({ width: 1366, height: 768 });

        // Construct URL
        const formattedCity = city.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
        const dept = zipCode.substring(0, 2);
        const url = `https://www.seloger.com/annonces/achat-de-bien/${formattedCity}-${dept}/`;

        console.log(`[Puppeteer] Navigating to ${url}`);

        // Navigate
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Try to extract Next.js Data (Most reliable)
        const nextData = await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            if (script) {
                return JSON.parse(script.innerHTML);
            }
            return null;
        });

        let listings: MarketListing[] = [];

        if (nextData && nextData.props && nextData.props.pageProps) {
            console.log("[Puppeteer] Found __NEXT_DATA__, extracting listings...");
            // The path to listings varies, usually initialProps.listings or searchResults
            // We need to inspect the structure dynamically or rely on known paths.
            // SeLoger 2024 structure usually: pageProps.searchHelper.results OR pageProps.listings

            // Try to find the list in deep object
            const findListings = (obj: any): any[] => {
                if (!obj) return [];
                if (Array.isArray(obj)) {
                    // Check if items look like listings (have price, id)
                    if (obj.length > 0 && obj[0].pricing && obj[0].id) return obj;
                }
                if (typeof obj === 'object') {
                    for (const key in obj) {
                        if (key === 'cards' || key === 'list' || key === 'items') {
                            if (Array.isArray(obj[key])) return obj[key];
                        }
                        // recursive search (shallow restricted)
                    }
                }
                return [];
            };

            // Heuristic to locate the array of ads
            // Often it's in searchResults.listings or similar
            // For now, let's look for "props.pageProps.listingSearchResponse.items" (common pattern)

            let rawItems: any[] = [];

            // Attempt 1: searchResults
            if (nextData.props.pageProps.searchResults && nextData.props.pageProps.searchResults.items) {
                rawItems = nextData.props.pageProps.searchResults.items;
            }
            // Attempt 2: listings
            else if (nextData.props.pageProps.listings) {
                rawItems = nextData.props.pageProps.listings;
            }

            // Map standard SeLoger object to our MarketListing
            listings = rawItems.map((item: any) => {
                try {
                    return {
                        id: item.id?.toString() || item.reference || String(Math.random()),
                        city: item.cityLabel || city,
                        zipCode: item.zipCode || zipCode,
                        price: item.pricing?.price || item.price || 0,
                        surface: item.surface || item.livingArea || 0,
                        pricePerSqm: item.pricing?.squareMeterPrice || 0,
                        url: item.permaLink || item.url || '',
                        isPro: item.isPro || true,
                        source: 'REAL'
                    } as MarketListing;
                } catch (e) { return null; }
            }).filter(Boolean) as MarketListing[];

        } else {
            console.log("[Puppeteer] __NEXT_DATA__ not found or empty. data-scraping DOM...");
            // Fallback: Scrape DOM Elements
            listings = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('[data-testid="sl-card-container"]'));
                return cards.map(card => {
                    const priceText = card.querySelector('[data-test="price"]')?.textContent || "0";
                    const price = parseInt(priceText.replace(/\D/g, '')) || 0;

                    // Surface often like "3 p 2 ch 76 m²"
                    const tags = Array.from(card.querySelectorAll('[data-test="sl-tags"] div'));
                    let surface = 0;
                    tags.forEach(t => {
                        if (t.textContent?.includes('m²')) {
                            surface = parseFloat(t.textContent.replace(',', '.').replace(/\D/g, '')) || 0;
                        }
                    });

                    // Link
                    const link = card.querySelector('a[data-test="sl-card-link"]')?.getAttribute('href') || "";

                    return {
                        id: Math.random().toString(), // No ID in DOM easily
                        city: "", // Inferred from context
                        zipCode: "",
                        price,
                        surface,
                        pricePerSqm: surface > 0 ? Math.round(price / surface) : 0,
                        url: link,
                        isPro: true,
                        source: 'REAL'
                    };
                });
            });

            // Fixup DOM data
            listings = listings.map(l => ({ ...l, city, zipCode }));
        }

        console.log(`[Puppeteer] Scraped ${listings.length} listings.`);
        return listings;

    } catch (error) {
        console.error("[Puppeteer] Error:", error);
        return [];
    } finally {
        await browser.close();
    }
}
