import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rent-estimate?postalCode=69720&surface=50&rooms=2&bedrooms=1
 *
 * Returns average/median rent from LBC location listings that are
 * similar in location (same postal prefix or department) and size.
 *
 * Response:
 *   { count, avgRent, medianRent, p25, p75, dept, source: 'db' | 'fallback' }
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

        // Scope the search: prefer same postal prefix (4 chars), fall back to dept (2 chars)
        const prefix4 = postalCode.substring(0, 4);
        const dept2   = postalCode.startsWith('97') ? postalCode.substring(0, 3) : postalCode.substring(0, 2);

        // Surface range ±40% (skip if no surface provided)
        const surfMin = surface > 10 ? surface * 0.55 : 0;
        const surfMax = surface > 10 ? surface * 1.55 : 99999;

        // Room matching: prefer bedrooms, fall back to rooms (total pieces - 1)
        const targetRooms = bedrooms > 0 ? bedrooms + 1 : rooms;  // bedrooms → rooms total approximation

        // Step 1 — try same postal code prefix (4 digits), no room filter
        let rows = queryRents(db, `postalCode LIKE ?`, [prefix4 + '%'], surface, surfMin, surfMax);

        // Step 2 — widen to department if <5 results
        if (rows.length < 5) {
            rows = queryRents(db, `postalCode LIKE ?`, [dept2 + '%'], surface, surfMin, surfMax);
        }

        // Step 3 — if still nothing, just same dept without surface filter
        if (rows.length < 3) {
            rows = queryRents(db, `postalCode LIKE ?`, [dept2 + '%'], 0, 0, 99999);
        }

        if (rows.length === 0) {
            return NextResponse.json({ count: 0, avgRent: null, medianRent: null, dept: dept2 });
        }

        const prices = rows.map((r: any) => r.price as number).sort((a: number, b: number) => a - b);
        const count     = prices.length;
        const avgRent   = Math.round(prices.reduce((s, p) => s + p, 0) / count);
        const medianRent = prices[Math.floor(count / 2)];
        const p25 = prices[Math.floor(count * 0.25)];
        const p75 = prices[Math.floor(count * 0.75)];

        return NextResponse.json({ count, avgRent, medianRent, p25, p75, dept: dept2 });

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
        SELECT price, surface, rooms, postalCode
        FROM properties
        WHERE listingType = 'rent'
          AND source = 'leboncoin'
          AND price > 150 AND price < 8000
          AND ${locationClause}
          ${surfaceClause}
        ORDER BY scrapedAt DESC
        LIMIT 60
    `).all(...locationParams, ...surfaceParams) as any[];
}
