import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDB } from '@/lib/db';
import { Property } from '@/lib/types';
import { getDepartmentCode, getRegionForDepartment } from '@/lib/geography';

const JSON_PATH = path.join(process.cwd(), 'data', 'properties.json');

/** Exclure les achats viager ou terrain seul (pour le filtre "achat"). */
function isViagerOrTerrainOnly(p: Property): boolean {
    if (p.listingType !== 'buy') return false;
    const title = (p.title ?? '').toLowerCase();
    const desc = (p.description ?? '').toLowerCase();
    const text = `${title} ${desc}`;
    if (/viager/.test(text)) return true;
    const surface = p.surface ?? 0;
    const noHabitableSurface = surface <= 0 || surface < 15;
    const looksLikeLand = /terrain\s*(seul|à bâtir|constructible|nu)|vente\s*terrain|lotissement/.test(text)
        || (p.propertyKind === 'other' && noHabitableSurface);
    if (noHabitableSurface && looksLikeLand) return true;
    return false;
}

function normalizeRow(p: any): Property {
    return {
        ...p,
        hasElevator: p.hasElevator === 1,
        hasBalcony: p.hasBalcony === 1,
        hasParking: p.hasParking === 1,
        isNew: p.isNew === 1,
        isFurnished: p.isFurnished === 1,
        hasCellar: p.hasCellar === 1,
        hasGarage: p.hasGarage === 1,
    } as Property;
}

function augmentProperties(properties: Property[]): Property[] {
    return properties.map(p => {
        const out = { ...p };
        if (p.postalCode && !out.department) {
            const d = getDepartmentCode(p.postalCode);
            out.department = d;
            if (d) out.region = getRegionForDepartment(d);
        }
        if (p.listingType !== 'buy' || !p.price || p.price <= 0) return out;

        const pricePerSqm = p.pricePerSqm ?? (p.surface && p.price ? p.price / p.surface : undefined);
        let y: number;
        let cf: number;
        if (pricePerSqm && pricePerSqm > 0) {
            y = 10.5 - (pricePerSqm / 1000);
            y = Math.max(3.0, Math.min(10.0, y));
            cf = (p.price * (y / 100) * 0.7 - (p.price * 1.08 * 0.073)) / 12;
            if (!out.pricePerSqm) out.pricePerSqm = pricePerSqm;
        } else {
            y = 6;
            cf = (p.price * (y / 100) * 0.7 - (p.price * 1.08 * 0.073)) / 12;
        }
        out.estimatedYield = Math.round(y * 10) / 10;
        out.estimatedCashflow = Math.round(cf);
        return out;
    });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const city = searchParams.get('city');
        const department = searchParams.get('department');
        const regionName = searchParams.get('region');
        const source = searchParams.get('source');
        const ownerType = searchParams.get('ownerType');
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

        let properties: Property[];

        try {
            const db = getDB();
            let query = 'SELECT * FROM properties WHERE 1=1';
            const params: any[] = [];

            if (listingType && listingType !== 'all') { query += ' AND listingType = ?'; params.push(listingType); }
            if (source && source !== 'all') { query += ' AND source = ?'; params.push(source); }
            if (ownerType && ownerType !== 'all') { query += ' AND ownerType = ?'; params.push(ownerType); }
            if (department && department !== 'all') { query += ' AND SUBSTR(postalCode, 1, 2) = ?'; params.push(department); }
            if (postalCode) { query += ' AND postalCode = ?'; params.push(postalCode); }
            if (city && city !== 'all') { query += ' AND city LIKE ?'; params.push(`%${city}%`); }
            if (minPrice) { query += ' AND price >= ?'; params.push(minPrice); }
            if (maxPrice) { query += ' AND price <= ?'; params.push(maxPrice); }
            if (minSurface) { query += ' AND surface >= ?'; params.push(minSurface); }

            const rows = db.prepare(query).all(params) as any[];
            properties = rows.map(normalizeRow);
        } catch (_dbErr) {
            try {
                const raw = await fs.readFile(JSON_PATH, 'utf-8');
                const list = JSON.parse(raw) as Property[];
                properties = list.filter(p => {
                    if (listingType && listingType !== 'all' && p.listingType !== listingType) return false;
                    if (source && source !== 'all' && p.source !== source) return false;
                    if (ownerType && ownerType !== 'all' && p.ownerType !== ownerType) return false;
                    if (department && department !== 'all') {
                        if (getDepartmentCode(p.postalCode) !== department) return false;
                    }
                    if (postalCode && p.postalCode !== postalCode) return false;
                    if (city && city !== 'all' && (!p.city || !p.city.toLowerCase().includes(city.toLowerCase()))) return false;
                    if (minPrice != null && (p.price == null || p.price < minPrice)) return false;
                    if (maxPrice != null && (p.price == null || p.price > maxPrice)) return false;
                    if (minSurface != null && (p.surface == null || p.surface < minSurface)) return false;
                    return true;
                });
            } catch (_jsonErr) {
                properties = [];
            }
        }

        properties = augmentProperties(properties);

        if (listingType === 'buy') {
            properties = properties.filter(p => !isViagerOrTerrainOnly(p));
        }
        if (regionName && regionName !== 'all') properties = properties.filter(p => p.region === regionName);
        if (minYield) properties = properties.filter(p => (p.estimatedYield ?? 0) >= minYield);
        if (minCashflow) properties = properties.filter(p => (p.estimatedCashflow ?? -9999) >= minCashflow);

        properties.sort((a, b) => {
            const va = a[sortBy as keyof Property];
            const vb = b[sortBy as keyof Property];
            if (sortBy === 'scrapedAt') {
                const sa = (va != null ? String(va) : '') || '';
                const sb = (vb != null ? String(vb) : '') || '';
                const cmp = sa.localeCompare(sb);
                return sortDir === 'ASC' ? cmp : -cmp;
            }
            const na = Number(va ?? 0);
            const nb = Number(vb ?? 0);
            if (sortDir === 'ASC') return na > nb ? 1 : na < nb ? -1 : 0;
            return na < nb ? 1 : na > nb ? -1 : 0;
        });

        const total = properties.length;
        const paginated = properties.slice((page - 1) * pageSize, page * pageSize);

        const withPrice = properties.filter(p => p.price > 0);
        const withSurface = properties.filter(p => p.surface && p.surface > 0);
        const withPricePerSqm = properties.filter(p => p.pricePerSqm && p.pricePerSqm > 0);
        const bySources = { leboncoin: 0, seloger: 0, bienveo: 0 };
        properties.forEach(p => {
            if (p.source === 'leboncoin') bySources.leboncoin++;
            else if (p.source === 'seloger') bySources.seloger++;
            else if (p.source === 'bienveo') bySources.bienveo++;
        });

        const stats = {
            total,
            avgPrice: withPrice.length ? Math.round(withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length) : 0,
            avgSurface: withSurface.length ? Math.round(withSurface.reduce((s, p) => s + (p.surface ?? 0), 0) / withSurface.length * 10) / 10 : 0,
            avgPricePerSqm: withPricePerSqm.length ? Math.round(withPricePerSqm.reduce((s, p) => s + (p.pricePerSqm ?? 0), 0) / withPricePerSqm.length) : 0,
            bySources,
        };

        return NextResponse.json({
            properties: paginated,
            stats,
            pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (err: any) {
        console.error("GET Properties Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
