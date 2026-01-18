import * as cheerio from 'cheerio';
import { MarketListing } from './engine';

export async function scrapeWithCheerio(city: string, zipCode: string): Promise<MarketListing[]> {
    console.log(`[Cheerio] Starting fetch for ${city} (${zipCode})...`);

    // Using the URL structure found in the article/legacy or standard search
    // Article suggests: list.htm?projects=2&types=1,2&places=[{cp:75}] ...
    // Let's try to map our City/Zip to this params structure.

    // projects=2 (Buy)
    // types=1,2 (Appart, Maison)
    // places=[{cp:zipCode}] -> This is specific to SeLoger's internal encoding sometimes, 
    // but often works with simple cp if we format it right.
    // However, the `annonces/achat-de-bien` URL is the modern SEO friendly one. 
    // Let's keep the Modern URL but use Cheerio to parse, as the simple python script suggests.

    // Optimized Legacy URL from Article
    // projects=2 (Buy), types=1,2 (Apt/House)
    const url = `https://www.seloger.com/list.htm?projects=2&types=1,2&places=[{cp:${zipCode}}]&enterprise=0&qsVersion=1.0`;

    console.log(`[Cheerio] Fetching: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            }
        });

        if (!response.ok) {
            console.warn(`[Cheerio] HTTP Error: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Debug Title
        const title = $('title').text();
        console.log(`[Cheerio] Page Title: ${title}`);

        if (title.includes("Captcha") || title.includes("robot")) {
            console.warn("[Cheerio] CAPTCHA Detected.");
            return [];
        }

        const listings: MarketListing[] = [];

        // Parsing logic based on Article + Observation
        // Article Python example: soup.find_all('div', class_='Card__ContentZone-sc-7insep-3')
        // CSS classes are usually hashed/obfuscated (sc-...) and change often.
        // We look for consistent data attributes.

        // 1. Try __NEXT_DATA__ (Best)
        const nextDataScript = $('#__NEXT_DATA__').html();
        if (nextDataScript) {
            try {
                const json = JSON.parse(nextDataScript);
                const props = json.props?.pageProps;
                let items = props?.listings || props?.searchResults?.items || [];

                if (items.length > 0) {
                    console.log(`[Cheerio] Found ${items.length} items in __NEXT_DATA__`);
                    return items.map((item: any) => ({
                        id: item.id?.toString() || String(Math.random()),
                        city: item.cityLabel || city,
                        zipCode: item.zipCode || zipCode,
                        price: item.pricing?.price || item.price || 0,
                        surface: item.surface || item.livingArea || 0,
                        pricePerSqm: item.pricing?.squareMeterPrice || 0,
                        url: item.permaLink || item.url || '',
                        isPro: true,
                        source: 'REAL'
                    })).filter((x: any) => x.price > 0) as MarketListing[];
                }
            } catch (e) { console.error("[Cheerio] JSON parse error", e); }
        }

        // 2. DOM Scraping (Fallback)
        // Selectors akin to article: .c-pa-list c-pa-sl__item (Old) or data-testid

        $('[data-testid="sl-card-container"]').each((_, element) => {
            const priceText = $(element).find('[data-test="price"]').text();
            const price = parseInt(priceText.replace(/\D/g, '')) || 0;

            // Surface
            let surface = 0;
            $(element).find('[data-test="sl-tags"] div').each((_, tag) => {
                const t = $(tag).text();
                if (t.includes('m²')) {
                    surface = parseFloat(t.replace(',', '.').replace(/\D/g, '')) || 0;
                }
            });

            const link = $(element).find('a').attr('href') || '';
            const id = link.split('/')[link.split('/').length - 1]?.split('.')[0] || String(Math.random());

            if (price > 0) {
                listings.push({
                    id,
                    city,
                    zipCode,
                    price,
                    surface,
                    pricePerSqm: surface > 0 ? Math.round(price / surface) : 0,
                    url: link,
                    isPro: true,
                    source: 'REAL'
                });
            }
        });

        console.log(`[Cheerio] Scraped ${listings.length} items from DOM.`);
        return listings;

    } catch (e) {
        console.error("[Cheerio] Error:", e);
        return [];
    }
}
