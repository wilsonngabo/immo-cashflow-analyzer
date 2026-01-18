import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { MarketListing } from './engine';

// Enable Stealth
puppeteer.use(StealthPlugin());

export async function scrapeWithPuppeteer(city: string, zipCode: string): Promise<MarketListing[]> {
    console.log(`[Puppeteer Stealth] Starting scrape for ${city} (${zipCode})...`);

    // Launch browser with stealth settings
    // HEADLESS: FALSE for Debugging/Verification so user sees it working
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,800' // Smaller window for visibility
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

        // DOM Fallback - Robust Text-Based Scraping
        if (entries.length === 0) {
            console.log("[Puppeteer Stealth] Fallback to robust DOM text scraping...");
            entries = await page.evaluate(() => {
                const listings: any[] = [];
                // Find all links that look like property ads
                const links = Array.from(document.querySelectorAll('a[href*="/annonces/"], a[href*="/achat/"]'));

                links.forEach(link => {
                    // Go up to find the card container (heuristic: block element with sufficient text)
                    let card = link.parentElement;
                    while (card && (card.innerText.length < 50 || card.tagName === 'SPAN')) {
                        card = card.parentElement;
                        if (!card || card.tagName === 'BODY') return;
                    }

                    if (!card) return;
                    const text = card.innerText;

                    // Regex Extraction
                    const priceMatch = text.match(/(\d{1,3}(?: \d{3})*)\s*€/);
                    const surfaceMatch = text.match(/(\d+(?:,\d+)?)\s*m²/);

                    if (priceMatch) {
                        const price = parseInt(priceMatch[1].replace(/\s/g, '')) || 0;
                        const surface = surfaceMatch ? parseFloat(surfaceMatch[1].replace(',', '.')) : 0;
                        const href = link.getAttribute('href') || "";

                        // Avoid duplicates
                        if (!listings.find(l => l.url === href)) {
                            listings.push({
                                id: href.split('/').pop()?.split('.htm')[0] || Math.random().toString(),
                                city: "", // Inferred later
                                zipCode: "",
                                price,
                                surface,
                                pricePerSqm: surface > 0 ? Math.round(price / surface) : 0,
                                url: href.startsWith('http') ? href : `https://www.seloger.com${href}`,
                                isPro: text.includes('Pro') || text.includes('Agenc'),
                                source: 'REAL'
                            });
                        }
                    }
                });
                return listings;
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
