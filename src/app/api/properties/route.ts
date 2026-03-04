import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { Property } from '@/lib/types';
import { getDepartmentCode, getRegionForDepartment } from '@/lib/geography';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const city = searchParams.get('city');
        const department = searchParams.get('department');
        const regionName = searchParams.get('region');
        const source = searchParams.get('source');
        const listingType = searchParams.get('listingType') || 'buy';
        const postalCode = searchParams.get('postalCode');
        const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
        const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
        const minSurface = searchParams.get('minSurface') ? Number(searchParams.get('minSurface')) : undefined;
        const minRooms = searchParams.get('minRooms') ? Number(searchParams.get('minRooms')) : undefined;
        const minYield = searchParams.get('minYield') ? Number(searchParams.get('minYield')) : undefined;
        const minCashflow = searchParams.get('minCashflow') ? Number(searchParams.get('minCashflow')) : undefined;
        const page = Number(searchParams.get('page') ?? '1');
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '24'), 200);
        const sortBy = searchParams.get('sortBy') ?? 'scrapedAt';
        const sortDir = (searchParams.get('sortDir') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const db = getDB();

        // 1. Build Query
        let query = 'SELECT * FROM properties WHERE 1=1';
        const params: any[] = [];

        if (listingType && listingType !== 'all') { query += ' AND listingType = ?'; params.push(listingType); }
        if (source && source !== 'all') { query += ' AND source = ?'; params.push(source); }
        if (department && department !== 'all') { query += ' AND SUBSTR(postalCode, 1, 2) = ?'; params.push(department); }
        if (postalCode) { query += ' AND postalCode = ?'; params.push(postalCode); }
        if (city && city !== 'all') { query += ' AND city LIKE ?'; params.push(`%${city}%`); }
        if (minPrice) { query += ' AND price >= ?'; params.push(minPrice); }
        if (maxPrice) { query += ' AND price <= ?'; params.push(maxPrice); }
        if (minSurface) { query += ' AND surface >= ?'; params.push(minSurface); }

        // Load rows
        const rows = db.prepare(query).all(params) as any[];

        // Map types & Augment
        let properties = rows.map(p => ({
            ...p,
            hasElevator: p.hasElevator === 1,
            hasBalcony: p.hasBalcony === 1,
            hasParking: p.hasParking === 1,
            isNew: p.isNew === 1,
            isFurnished: p.isFurnished === 1,
            hasCellar: p.hasCellar === 1,
            hasGarage: p.hasGarage === 1,
        })) as Property[];

        properties = properties.map(p => {
            if (p.postalCode && !p.department) {
                const d = getDepartmentCode(p.postalCode);
                p.department = d;
                if (d) p.region = getRegionForDepartment(d);
            }
            if (p.listingType === 'buy' && p.price > 0 && p.surface && p.pricePerSqm) {
                let y = 10.5 - (p.pricePerSqm / 1000);
                y = Math.max(3.0, Math.min(10.0, y));
                const cf = (p.price * (y / 100) * 0.7 - (p.price * 1.08 * 0.073)) / 12;
                p.estimatedYield = Math.round(y * 10) / 10;
                p.estimatedCashflow = Math.round(cf);
            }
            return p;
        });

        // Computed Filters
        if (regionName && regionName !== 'all') properties = properties.filter(p => p.region === regionName);
        if (minYield) properties = properties.filter(p => (p.estimatedYield ?? 0) >= minYield);
        if (minCashflow) properties = properties.filter(p => (p.estimatedCashflow ?? -9999) >= minCashflow);

        // Sort
        properties.sort((a, b) => {
            const va = (a[sortBy as keyof Property] as any) ?? 0;
            const vb = (b[sortBy as keyof Property] as any) ?? 0;
            return sortDir === 'ASC' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });

        const total = properties.length;
        const paginated = properties.slice((page - 1) * pageSize, page * pageSize);

        return NextResponse.json({
            properties: paginated,
            stats: { total },
            pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (err: any) {
        console.error("GET Properties Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
