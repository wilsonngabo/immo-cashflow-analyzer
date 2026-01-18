import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { MarketListing } from './engine';

// Enable Stealth
puppeteer.use(StealthPlugin());

export async function scrapeWithPuppeteer(city: string, zipCode: string): Promise<MarketListing[]> {
    console.log(`[Puppeteer Stealth] Starting scrape for ${city} (${zipCode})...`);

    // Launch browser with stealth settings
    const browser = await puppeteer.launch({
        headless: true, // Keep headless for server environment
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();

        // Randomize User Agent slightly
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);

        await page.setViewport({ width: 1920, height: 1080 });

        // Construct URL
        const formattedCity = city.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
        const dept = zipCode.substring(0, 2);
        const url = `https://www.seloger.com/annonces/achat-de-bien/${formattedCity}-${dept}/`;

        console.log(`[Puppeteer Stealth] Navigating to ${url}`);

        // Navigate with extended timeout
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Check for Captcha title or text
        const title = await page.title();
        console.log(`[Puppeteer Stealth] Page Title: ${title}`);

        if (title.includes("Captcha") || title.includes("Attention")) {
            console.warn("[Puppeteer Stealth] CAPTCHA Detected!");
            // Can't solve captcha in headless without external services
            return [];
        }

        // Try to extract Next.js Data (Most reliable)
        let entries: MarketListing[] = [];

        try {
            const nextData = await page.evaluate(() => {
                const script = document.getElementById('__NEXT_DATA__');
                if (script) {
                    return JSON.parse(script.innerHTML);
                }
                return null;
            });

            if (nextData && nextData.props && nextData.props.pageProps) {
                console.log("[Puppeteer Stealth] Found __NEXT_DATA__");
                // Attempt to find items in various known paths
                let rawItems: any[] = [];
                const pp = nextData.props.pageProps;

                if (pp.listings) rawItems = pp.listings;
                else if (pp.searchResults && pp.searchResults.items) rawItems = pp.searchResults.items;
                else if (pp.listingSearchResponse && pp.listingSearchResponse.items) rawItems = pp.listingSearchResponse.items;

                entries = rawItems.map((item: any) => {
                    try {
                        return {
                            id: item.id?.toString() || item.reference || String(Math.random()),
                            city: item.cityLabel || city,
                            zipCode: item.zipCode || zipCode,
                            price: item.pricing?.price || item.price || 0,
                            surface: item.surface || item.livingArea || 0,
                            pricePerSqm: item.pricing?.squareMeterPrice || 0,
                            url: item.permaLink || item.url || '',
                            isPro: true,
                            source: 'REAL'
                        } as MarketListing;
                    } catch (e) { return null; }
                }).filter(Boolean) as MarketListing[];
            }
        } catch (e) {
            console.error("[Puppeteer Stealth] JSON Parse failed", e);
        }

        // DOM Fallback if JSON failed
        if (entries.length === 0) {
            console.log("[Puppeteer Stealth] Fallback to DOM Scraping...");
            entries = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('[data-testid="sl-card-container"]')); // Standard ID
                // Also try generic class if testid fails
                const cardsAlt = cards.length > 0 ? cards : Array.from(document.querySelectorAll('div[class*="Card__CardContainer"]'));

                return cardsAlt.map(card => {
                    const priceText = card.querySelector('[data-test="price"], [class*="Price__PriceContainer"]')?.textContent || "0";
                    const price = parseInt(priceText.replace(/\D/g, '')) || 0;

                    const tags = Array.from(card.querySelectorAll('[data-test="sl-tags"] div, [class*="Tags__TagContainer"] div'));
                    let surface = 0;
                    tags.forEach(t => {
                        if (t.textContent?.includes('m²')) {
                            surface = parseFloat(t.textContent.replace(',', '.').replace(/\D/g, '')) || 0;
                        }
                    });

                    const link = card.querySelector('a')?.getAttribute('href') || "";

                    return {
                        id: Math.random().toString(),
                        city: "",
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

            // Fixup
            entries = entries.map(l => ({ ...l, city, zipCode }));
        }

        console.log(`[Puppeteer Stealth] Found ${entries.length} listings.`);
        return entries;

    } catch (error) {
        console.error("[Puppeteer Stealth] Fatal Error:", error);
        return [];
    } finally {
        await browser.close();
    }
}
