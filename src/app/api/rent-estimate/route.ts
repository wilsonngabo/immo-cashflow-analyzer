import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rent-estimate?postalCode=69720&surface=50&rooms=2&bedrooms=1
 *
 * Returns average/median rent from LBC location listings that are
 * similar in location (same postal prefix or department) and size.
 * Also returns per-room colocation estimates from colocation listings.
 *
 * Response:
 *   { count, avgRent, medianRent, p25, p75, dept,
 *     colocPerRoom, colocCount, colocSource }
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const postalCode = searchParams.get('postalCode') ?? '';
    const surface    = parseFloat(searchParams.get('surface')   ?? '0');
    const rooms      = parseInt  (searchParams.get('rooms')     ?? '0');
    const bedrooms   = parseInt  (searchParams.get('bedrooms')  ?? '0');

    if (!postalCode || postalCode.length < 2) {
        return NextResponse.json({ count: 0, avgRent: null, medianRent: null });
    }

    try {
        const db = getDB();

        const prefix4 = postalCode.substring(0, 4);
        const dept2   = postalCode.startsWith('97') ? postalCode.substring(0, 3) : postalCode.substring(0, 2);

        const surfMin = surface > 10 ? surface * 0.55 : 0;
        const surfMax = surface > 10 ? surface * 1.55 : 99999;

        // === Standard rent estimate ===
        let rows = queryRents(db, `postalCode LIKE ?`, [prefix4 + '%'], surface, surfMin, surfMax);
        if (rows.length < 5) {
            rows = queryRents(db, `postalCode LIKE ?`, [dept2 + '%'], surface, surfMin, surfMax);
        }
        if (rows.length < 3) {
            rows = queryRents(db, `postalCode LIKE ?`, [dept2 + '%'], 0, 0, 99999);
        }

        let count = 0, avgRent: number | null = null, medianRent: number | null = null;
        let p25: number | null = null, p75: number | null = null;

        if (rows.length > 0) {
            const prices = rows.map((r: any) => r.price as number).sort((a: number, b: number) => a - b);
            count = prices.length;
            avgRent = Math.round(prices.reduce((s, p) => s + p, 0) / count);
            medianRent = prices[Math.floor(count / 2)];
            p25 = prices[Math.floor(count * 0.25)];
            p75 = prices[Math.floor(count * 0.75)];
        }

        // === Colocation per-room estimate ===
        // Query colocation listings to get price per room
        const numBedrooms = bedrooms > 0 ? bedrooms : (rooms > 1 ? rooms - 1 : 0);
        let colocPerRoom: number | null = null;
        let colocCount = 0;
        let colocSource: 'coloc_listings' | 'rent_estimate' | null = null;

        // Try to find actual colocation listings in the area
        const colocRows = queryColocRents(db, dept2);
        if (colocRows.length >= 3) {
            const perRoomPrices = colocRows
                .filter((r: any) => r.rooms && r.rooms > 1 && r.price > 0)
                .map((r: any) => {
                    const br = r.bedrooms > 0 ? r.bedrooms : Math.max(1, r.rooms - 1);
                    return r.price / br;
                })
                .sort((a: number, b: number) => a - b);

            if (perRoomPrices.length >= 3) {
                colocPerRoom = Math.round(perRoomPrices[Math.floor(perRoomPrices.length / 2)]);
                colocCount = perRoomPrices.length;
                colocSource = 'coloc_listings';
            }
        }

        // Fallback: derive from standard rental listings (÷ bedrooms × premium)
        if (colocPerRoom == null && medianRent && numBedrooms > 0) {
            colocPerRoom = Math.round((medianRent / numBedrooms) * 1.15);
            colocCount = count;
            colocSource = 'rent_estimate';
        }

        return NextResponse.json({
            count, avgRent, medianRent, p25, p75, dept: dept2,
            colocPerRoom, colocCount, colocSource,
        });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ count: 0, avgRent: null, medianRent: null, error: msg }, { status: 500 });
    }
}

function queryRents(
    db: ReturnType<typeof getDB>,
    locationClause: string,
    locationParams: (string | number)[],
    surface: number,
    surfMin: number,
    surfMax: number,
): any[] {
    const surfaceClause = surface > 10 ? `AND surface BETWEEN ? AND ?` : '';
    const surfaceParams = surface > 10 ? [surfMin, surfMax] : [];

    return db.prepare(`
        SELECT price, surface, rooms, bedrooms, postalCode
        FROM properties
        WHERE listingType = 'rent'
          AND source = 'leboncoin'
          AND price > 150 AND price < 8000
          AND (LOWER(COALESCE(title,'')) || ' ' || LOWER(COALESCE(description,''))) NOT LIKE '%coloc%'
          AND ${locationClause}
          ${surfaceClause}
        ORDER BY scrapedAt DESC
        LIMIT 80
    `).all(...locationParams, ...surfaceParams) as any[];
}

function queryColocRents(
    db: ReturnType<typeof getDB>,
    dept: string,
): any[] {
    return db.prepare(`
        SELECT price, surface, rooms, bedrooms, postalCode
        FROM properties
        WHERE listingType = 'rent'
          AND source = 'leboncoin'
          AND price > 100 AND price < 5000
          AND rooms >= 2
          AND (LOWER(COALESCE(title,'')) || ' ' || LOWER(COALESCE(description,''))) LIKE '%coloc%'
          AND postalCode LIKE ?
        ORDER BY scrapedAt DESC
        LIMIT 100
    `).all(dept + '%') as any[];
}
