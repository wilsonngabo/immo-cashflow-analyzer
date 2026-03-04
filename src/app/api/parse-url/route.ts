import { NextResponse } from 'next/server';

export interface ParsedListing {
    title?: string;
    price?: number;
    surface?: number;
    rooms?: number;
    city?: string;
    postalCode?: string;
    monthlyRent?: number;
    propertyType?: 'OLD' | 'NEW' | 'HLM';
    source?: string;
    url?: string;
    description?: string;
}

const FAKE_BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
};

function detectSource(url: string): 'seloger' | 'leboncoin' | 'pap' | 'bienici' | 'unknown' {
    if (url.includes('seloger.com')) return 'seloger';
    if (url.includes('leboncoin.fr')) return 'leboncoin';
    if (url.includes('pap.fr')) return 'pap';
    if (url.includes('bienici.com')) return 'bienici';
    return 'unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: unknown, ...keys: string[]): unknown {
    let current: unknown = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/**
 * Extract JSON-LD structured data (often present even on JS-heavy sites).
 * This is the most reliable extraction strategy.
 */
function extractJsonLd(html: string): Record<string, unknown> | null {
    // Match all <script type="application/ld+json"> blocks
    const regex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        try {
            const data = JSON.parse(match[1]) as Record<string, unknown>;
            // Look for RealEstateListing or Product schema
            const type = String(data['@type'] ?? '').toLowerCase();
            if (type.includes('realestate') || type.includes('product') || type.includes('offer') || data.price || data.name) {
                return data;
            }
            // Handle @graph arrays
            if (Array.isArray(data['@graph'])) {
                for (const item of data['@graph'] as Record<string, unknown>[]) {
                    const t = String(item['@type'] ?? '').toLowerCase();
                    if (t.includes('realestate') || t.includes('product') || item.price) {
                        return item;
                    }
                }
            }
        } catch {
            // Try next block
        }
    }
    return null;
}

/**
 * Extract Open Graph / meta tags — reliable fallback always present.
 */
function extractMetaTags(html: string): { title?: string; description?: string; image?: string } {
    const result: { title?: string; description?: string; image?: string } = {};
    const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/) ??
        html.match(/content="([^"]+)"\s+property="og:title"/);
    if (ogTitle) result.title = ogTitle[1].replace(/\s*[-|]\s*(SeLoger|LeBonCoin|PAP|BienIci).*$/i, '').trim();

    const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/) ??
        html.match(/content="([^"]+)"\s+property="og:description"/);
    if (ogDesc) result.description = ogDesc[1];

    if (!result.title) {
        const titleTag = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTag) result.title = titleTag[1].replace(/\s*[-|]\s*(SeLoger|LeBonCoin|PAP|BienIci).*$/i, '').trim();
    }

    return result;
}

function extractJsonFromNextData(html: string): Record<string, unknown> | null {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
    if (match) {
        try { return JSON.parse(match[1]) as Record<string, unknown>; } catch { /* ignore */ }
    }
    return null;
}

/** Parse price from a raw string like "350 000 €" or "350000" */
function parsePrice(raw: string | number | undefined): number | undefined {
    if (raw === undefined || raw === null) return undefined;
    const cleaned = String(raw).replace(/[\s\u00a0]/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) || val <= 0 ? undefined : val;
}

// ─── Site-specific parsers ───────────────────────────────────────────────────

function parseSeLoger(html: string, url: string): ParsedListing {
    const result: ParsedListing = { source: 'SeLoger', url };

    // 1. JSON-LD (primary)
    const ld = extractJsonLd(html);
    if (ld) {
        result.price = parsePrice(deepGet(ld, 'offers', 'price') as string ?? ld.price as string);
        result.surface = Number(deepGet(ld, 'floorSize', 'value') ?? deepGet(ld, 'surface')) || undefined;
        result.title = String(ld.name ?? ld.title ?? '').trim() || undefined;
        const loc = deepGet(ld, 'address') as Record<string, unknown> | undefined;
        if (loc) result.city = String(loc.addressLocality ?? loc.city ?? '').trim() || undefined;
    }

    // 2. __NEXT_DATA__ (secondary)
    if (!result.price || !result.surface) {
        const json = extractJsonFromNextData(html);
        if (json) {
            const props = deepGet(json, 'props', 'pageProps') as Record<string, unknown> | undefined;
            const listing = props
                ? (deepGet(props, 'listing') ?? deepGet(props, 'ad') ?? deepGet(props, 'property')) as Record<string, unknown> | undefined
                : undefined;
            if (listing) {
                result.price ??= parsePrice(deepGet(listing, 'prix') as string ?? deepGet(listing, 'price') as string ?? deepGet(listing, 'prix_vente') as string);
                result.surface ??= Number(deepGet(listing, 'surface') ?? deepGet(listing, 'area')) || undefined;
                result.rooms ??= Number(deepGet(listing, 'nb_pieces') ?? deepGet(listing, 'rooms')) || undefined;
                result.title ??= String(deepGet(listing, 'titre') ?? deepGet(listing, 'title') ?? '').trim() || undefined;
                result.city ??= String(deepGet(listing, 'ville') ?? deepGet(listing, 'city') ?? '').trim() || undefined;
            }
        }
    }

    // 3. Regex fallbacks
    if (!result.price) {
        const m = html.match(/"prix"[\s:]*"?(\d[\d\s]*)"?/) ??
            html.match(/"price"[\s:]*"?(\d[\d\s]*)"?/) ??
            html.match(/(\d{5,9})\s*€/) ??
            html.match(/Prix\s*:\s*(\d[\d\s]*)/i);
        if (m) result.price = parseInt(m[1].replace(/\s/g, ''), 10) || undefined;
    }
    if (!result.surface) {
        const m = html.match(/"surface"[\s:]*"?(\d+(?:\.\d+)?)/) ??
            html.match(/(\d+(?:,\d+)?)\s*m[²2]/i);
        if (m) result.surface = parseFloat(m[1].replace(',', '.')) || undefined;
    }
    if (!result.rooms) {
        const m = html.match(/"nb_pieces"[\s:]*"?(\d+)/) ??
            html.match(/(\d+)\s*pi[eè]ces?/i);
        if (m) result.rooms = parseInt(m[1], 10) || undefined;
    }
    if (!result.city) {
        const m = html.match(/"ville"[\s:]*"([^"]+)"/) ??
            html.match(/<span[^>]+class="[^"]*city[^"]*"[^>]*>([^<]+)<\/span>/i);
        if (m) result.city = m[1].trim();
    }

    // 4. Meta tags (title always useful)
    const meta = extractMetaTags(html);
    result.title ??= meta.title;
    result.description ??= meta.description;

    return result;
}

function parseLeBonCoin(html: string, url: string): ParsedListing {
    const result: ParsedListing = { source: 'LeBonCoin', url };

    // 1. JSON-LD (primary — LBC includes Product schema)
    const ld = extractJsonLd(html);
    if (ld) {
        result.price = parsePrice(deepGet(ld, 'offers', 'price') as string ?? ld.price as string);
        result.title = String(ld.name ?? ld.title ?? '').replace(/\s*-?\s*leboncoin.*$/i, '').trim() || undefined;
        result.description = String(ld.description ?? '').trim() || undefined;

        // Parse surface / rooms from description or additionalProperty
        const additionalProps = ld.additionalProperty as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(additionalProps)) {
            for (const prop of additionalProps) {
                const name = String(prop.name ?? '').toLowerCase();
                const val = prop.value;
                if (name.includes('surface') || name.includes('m²')) result.surface = Number(val) || result.surface;
                if (name.includes('pi') && name.includes('ce')) result.rooms = Number(val) || result.rooms;
            }
        }
    }

    // 2. __NEXT_DATA__
    if (!result.price || !result.surface) {
        const json = extractJsonFromNextData(html);
        if (json) {
            const ad = (deepGet(json, 'props', 'pageProps', 'ad') ??
                deepGet(json, 'props', 'pageProps', 'listing')) as Record<string, unknown> | undefined;
            if (ad) {
                result.title ??= String(ad.subject ?? ad.title ?? '').trim() || undefined;
                result.price ??= parsePrice(
                    (Array.isArray(ad.price) ? (ad.price as number[])[0] : ad.price) as string
                );
                result.city ??= String(deepGet(ad, 'location', 'city') ?? deepGet(ad, 'city') ?? '').trim() || undefined;
                result.postalCode ??= String(deepGet(ad, 'location', 'zipcode') ?? deepGet(ad, 'zipcode') ?? '').trim() || undefined;

                const attrs = ad.attributes as Array<{ key: string; value: string | string[] }> | undefined;
                if (Array.isArray(attrs)) {
                    for (const attr of attrs) {
                        const val = Array.isArray(attr.value) ? attr.value[0] : attr.value;
                        if (attr.key === 'square' || attr.key === 'surface') result.surface ??= parseFloat(String(val)) || undefined;
                        if (attr.key === 'rooms') result.rooms ??= parseInt(String(val), 10) || undefined;
                        if (attr.key === 'real_estate_type') {
                            if (String(val).toLowerCase().includes('neuf')) result.propertyType = 'NEW';
                        }
                    }
                }
            }
        }
    }

    // 3. Regex fallbacks
    if (!result.price) {
        const m = html.match(/"price":\s*\[?(\d+)\]?/) ?? html.match(/(\d[\d\s]{3,})\s*€/);
        if (m) result.price = parseInt(m[1].replace(/\s/g, ''), 10) || undefined;
    }
    if (!result.surface) {
        const m = html.match(/"square":\s*"?(\d+(?:\.\d+)?)/) ?? html.match(/(\d+(?:,\d+)?)\s*m[²2]/i);
        if (m) result.surface = parseFloat(m[1].replace(',', '.')) || undefined;
    }
    if (!result.rooms) {
        const m = html.match(/"rooms":\s*"?(\d+)/) ?? html.match(/(\d+)\s*pi[eè]ces?/i);
        if (m) result.rooms = parseInt(m[1], 10) || undefined;
    }
    if (!result.city) {
        const m = html.match(/"city":\s*"([^"]+)"/) ?? html.match(/property="og:locality"\s+content="([^"]+)"/);
        if (m) result.city = m[1].trim();
    }

    // 4. Meta tags
    const meta = extractMetaTags(html);
    result.title ??= meta.title;
    result.description ??= meta.description;

    // Try to parse surface/rooms from title (common pattern: "Appartement 3 pièces 65 m²")
    if (result.title && !result.surface) {
        const sm = result.title.match(/(\d+(?:,\d+)?)\s*m[²2]/i);
        if (sm) result.surface = parseFloat(sm[1].replace(',', '.')) || undefined;
    }
    if (result.title && !result.rooms) {
        const rm = result.title.match(/(\d+)\s*pi[eè]ces?/i);
        if (rm) result.rooms = parseInt(rm[1], 10) || undefined;
    }

    return result;
}

function parseBienIci(html: string, url: string): ParsedListing {
    const result: ParsedListing = { source: 'BienIci', url };

    // 1. JSON-LD
    const ld = extractJsonLd(html);
    if (ld) {
        result.price = parsePrice(deepGet(ld, 'offers', 'price') as string ?? ld.price as string);
        result.surface = Number(deepGet(ld, 'floorSize', 'value') ?? deepGet(ld, 'surface')) || undefined;
        result.title = String(ld.name ?? '').trim() || undefined;
        const loc = deepGet(ld, 'address') as Record<string, unknown> | undefined;
        if (loc) {
            result.city = String(loc.addressLocality ?? '').trim() || undefined;
            result.postalCode = String(loc.postalCode ?? '').trim() || undefined;
        }
    }

    // 2. __NEXT_DATA__
    if (!result.price) {
        const json = extractJsonFromNextData(html);
        if (json) {
            const listing = deepGet(json, 'props', 'pageProps', 'listingData') as Record<string, unknown> | undefined;
            if (listing) {
                result.price ??= Number(deepGet(listing, 'price')) || undefined;
                result.surface ??= Number(deepGet(listing, 'surfaceArea', 'value')) || undefined;
                result.rooms ??= Number(deepGet(listing, 'roomsQuantity')) || undefined;
                result.title ??= String(deepGet(listing, 'title') ?? '').trim() || undefined;
                result.city ??= String(deepGet(listing, 'city') ?? '').trim() || undefined;
                result.postalCode ??= String(deepGet(listing, 'postalCode') ?? '').trim() || undefined;
            }
        }
    }

    const meta = extractMetaTags(html);
    result.title ??= meta.title;
    result.description ??= meta.description;
    return result;
}

function parsePAP(html: string, url: string): ParsedListing {
    const result: ParsedListing = { source: 'PAP', url };

    const ld = extractJsonLd(html);
    if (ld) {
        result.price = parsePrice(deepGet(ld, 'offers', 'price') as string ?? ld.price as string);
        result.surface = Number(deepGet(ld, 'floorSize', 'value')) || undefined;
        result.title = String(ld.name ?? '').trim() || undefined;
    }

    if (!result.price) {
        const m = html.match(/(\d[\d\s]{3,})\s*€/) ?? html.match(/"prix":\s*(\d+)/);
        if (m) result.price = parseInt(m[1].replace(/\s/g, ''), 10) || undefined;
    }
    if (!result.surface) {
        const m = html.match(/(\d+(?:,\d+)?)\s*m[²2]/i);
        if (m) result.surface = parseFloat(m[1].replace(',', '.')) || undefined;
    }

    const meta = extractMetaTags(html);
    result.title ??= meta.title;
    result.description ??= meta.description;
    return result;
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildFetchUrl(targetUrl: string): string {
    const scraperApiKey = process.env.SCRAPERAPI_KEY;
    if (scraperApiKey) {
        // ScraperAPI renders JS for us and handles anti-bot
        return `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}&render=true&country_code=fr`;
    }
    return targetUrl;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    let url = '';
    try {
        const body = await request.json();
        url = body.url as string;

        if (!url) {
            return NextResponse.json({ error: 'URL requise' }, { status: 400 });
        }

        // Validate URL
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
        }

        const source = detectSource(url);
        const scraperApiKey = process.env.SCRAPERAPI_KEY;
        const fetchUrl = buildFetchUrl(url);

        const response = await fetch(fetchUrl, {
            headers: scraperApiKey ? {} : FAKE_BROWSER_HEADERS, // ScraperAPI adds its own headers
            signal: AbortSignal.timeout(15000),
            redirect: 'follow',
        });

        if (!response.ok) {
            const isKnownJsSite = source === 'seloger' || source === 'leboncoin';
            const tip = isKnownJsSite && !scraperApiKey
                ? ` Ce site utilise du rendu JavaScript côté client. Configurez SCRAPERAPI_KEY pour améliorer la compatibilité, ou renseignez les données manuellement.`
                : '';

            return NextResponse.json({
                error: `Impossible de récupérer la page (HTTP ${response.status}).${tip}`,
                blocked: true,
                scraperApiConfigured: !!scraperApiKey,
                source,
            }, { status: 422 });
        }

        const html = await response.text();

        let parsed: ParsedListing;
        switch (source) {
            case 'seloger': parsed = parseSeLoger(html, url); break;
            case 'leboncoin': parsed = parseLeBonCoin(html, url); break;
            case 'bienici': parsed = parseBienIci(html, url); break;
            case 'pap': parsed = parsePAP(html, url); break;
            default:
                parsed = parseSeLoger(html, url); // Generic NEXT_DATA + JSON-LD + regex
                parsed.source = parsedUrl.hostname;
                break;
        }

        const hasUsefulData = parsed.price || parsed.surface || (parsed.title && parsed.title.length > 5);
        const isKnownJsSite = source === 'seloger' || source === 'leboncoin';

        if (!hasUsefulData) {
            return NextResponse.json({
                warning: isKnownJsSite && !scraperApiKey
                    ? `Ce site charge ses données via JavaScript. Nous n'avons pas pu extraire les informations automatiquement. Vous pouvez les saisir manuellement ci-dessous.`
                    : `Aucune donnée exploitable trouvée sur cette page.`,
                blocked: isKnownJsSite && !scraperApiKey,
                scraperApiConfigured: !!scraperApiKey,
                source: parsed.source,
                // Still return what we have (title from og:meta)
                listing: Object.values(parsed).some(v => v) ? parsed : undefined,
            }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            scraperApiConfigured: !!scraperApiKey,
            listing: parsed,
        });

    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);

        if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || errMsg.includes('timeout')) {
            return NextResponse.json({
                error: 'Connexion impossible. Vérifiez l\'URL ou votre connexion réseau.',
                url,
            }, { status: 503 });
        }

        if (errMsg.includes('Invalid URL')) {
            return NextResponse.json({ error: 'URL invalide.' }, { status: 400 });
        }

        console.error('[parse-url] Error:', errMsg);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
