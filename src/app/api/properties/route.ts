import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDB } from '@/lib/db';
import { Property } from '@/lib/types';
import { getDepartmentCode, getRegionForDepartment, REGIONS } from '@/lib/geography';

const JSON_PATH = path.join(process.cwd(), 'data', 'properties.json');

/** SQL: department code derived from postalCode (2A/2B, 97x, else 2 digits). */
const DEPT_FROM_POSTAL_SQL = `(CASE
  WHEN postalCode LIKE '97%' THEN SUBSTR(postalCode, 1, 3)
  WHEN postalCode GLOB '20*' AND CAST(COALESCE(postalCode,'0') AS INTEGER) < 20200 THEN '2A'
  WHEN postalCode GLOB '20*' THEN '2B'
  ELSE SUBSTR(postalCode, 1, 2)
END)`;

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
        if (out.estimatedYield != null && out.estimatedCashflow != null) return out;

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

const ALLOWED_SORT: Record<string, string> = {
    scrapedAt: 'scrapedAt',
    price: 'price',
    surface: 'surface',
    estimatedYield: 'estimatedYield',
    estimatedCashflow: 'estimatedCashflow',
};

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
        const minYield = searchParams.get('minYield') ? Number(searchParams.get('minYield')) : undefined;
        const minCashflow = searchParams.get('minCashflow') ? Number(searchParams.get('minCashflow')) : undefined;
        const page = Number(searchParams.get('page') ?? '1');
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '24'), 200);
        const sortBy = ALLOWED_SORT[searchParams.get('sortBy') ?? ''] ?? 'scrapedAt';
        const sortDir = (searchParams.get('sortDir') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        try {
            const db = getDB();
            const conditions: string[] = ['1=1'];
            const params: any[] = [];

            if (listingType && listingType !== 'all') { conditions.push('listingType = ?'); params.push(listingType); }
            if (source && source !== 'all') { conditions.push('source = ?'); params.push(source); }
            if (ownerType && ownerType !== 'all') { conditions.push('ownerType = ?'); params.push(ownerType); }
            if (regionName && regionName !== 'all') {
                // Optimisation : filtre par colonne region (index) si disponible
                conditions.push('(region = ? OR (region IS NULL AND ' + DEPT_FROM_POSTAL_SQL + ' IN (' + (REGIONS[regionName]?.map(() => '?') ?? []).join(',') + ')))');
                params.push(regionName, ...(REGIONS[regionName] ?? []));
            }
            if (department && department !== 'all') {
                conditions.push(`${DEPT_FROM_POSTAL_SQL} = ?`);
                params.push(department);
            }
            if (postalCode) { conditions.push('postalCode = ?'); params.push(postalCode); }
            if (city && city !== 'all') { conditions.push('city LIKE ?'); params.push(`%${city}%`); }
            if (minPrice != null) { conditions.push('price >= ?'); params.push(minPrice); }
            if (maxPrice != null) { conditions.push('price <= ?'); params.push(maxPrice); }
            if (minSurface != null) { conditions.push('surface >= ?'); params.push(minSurface); }
            if (minYield != null) { conditions.push('(COALESCE(estimatedYield, 0) >= ?)'); params.push(minYield); }
            if (minCashflow != null) { conditions.push('(COALESCE(estimatedCashflow, 0) >= ?)'); params.push(minCashflow); }
            if (listingType === 'buy') {
                conditions.push("(listingType <> 'buy' OR ( (COALESCE(title,'') || ' ' || COALESCE(description,'')) NOT LIKE '%viager%' AND (surface IS NULL OR surface >= 15) ))");
            }

            const whereSql = conditions.join(' AND ');
            const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM properties WHERE ${whereSql}`);
            const total = (countStmt.get(params) as { c: number }).c;

            const orderCol = sortBy === 'scrapedAt' ? 'scrapedAt' : sortBy;
            const orderSql = `${orderCol} ${sortDir}`;
            const offset = (page - 1) * pageSize;
            const dataStmt = db.prepare(
                `SELECT * FROM properties WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`
            );
            const rows = dataStmt.all(...params, pageSize, offset) as any[];
            let properties = rows.map(normalizeRow);
            properties = augmentProperties(properties);
            if (listingType === 'buy') properties = properties.filter(p => !isViagerOrTerrainOnly(p));

            const countForStats = total;
            const statsStmt = db.prepare(
                `SELECT AVG(CASE WHEN price > 0 THEN price ELSE NULL END) AS avgPrice,
                        AVG(CASE WHEN surface > 0 THEN surface ELSE NULL END) AS avgSurface,
                        AVG(CASE WHEN pricePerSqm > 0 THEN pricePerSqm ELSE NULL END) AS avgPricePerSqm,
                        SUM(CASE WHEN source = 'leboncoin' THEN 1 ELSE 0 END) AS lbc,
                        SUM(CASE WHEN source = 'seloger' THEN 1 ELSE 0 END) AS sl,
                        SUM(CASE WHEN source = 'bienveo' THEN 1 ELSE 0 END) AS bv
                 FROM properties WHERE ${whereSql}`
            );
            const st = statsStmt.get(params) as { avgPrice: number | null; avgSurface: number | null; avgPricePerSqm: number | null; lbc: number; sl: number; bv: number };

            const stats = {
                total: countForStats,
                avgPrice: st.avgPrice != null ? Math.round(st.avgPrice) : 0,
                avgSurface: st.avgSurface != null ? Math.round(st.avgSurface * 10) / 10 : 0,
                avgPricePerSqm: st.avgPricePerSqm != null ? Math.round(st.avgPricePerSqm) : 0,
                bySources: { leboncoin: st.lbc ?? 0, seloger: st.sl ?? 0, bienveo: st.bv ?? 0 },
            };

            return NextResponse.json({
                properties,
                stats,
                pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
            });
        } catch (_dbErr) {
            try {
                const raw = await fs.readFile(JSON_PATH, 'utf-8');
                const list = JSON.parse(raw) as Property[];
                let properties = list.filter(p => {
                    if (listingType && listingType !== 'all' && p.listingType !== listingType) return false;
                    if (source && source !== 'all' && p.source !== source) return false;
                    if (ownerType && ownerType !== 'all' && p.ownerType !== ownerType) return false;
                    if (regionName && regionName !== 'all') {
                        if (getRegionForDepartment(getDepartmentCode(p.postalCode) ?? '') !== regionName) return false;
                    } else if (department && department !== 'all') {
                        if (getDepartmentCode(p.postalCode) !== department) return false;
                    }
                    if (postalCode && p.postalCode !== postalCode) return false;
                    if (city && city !== 'all' && (!p.city || !p.city.toLowerCase().includes(city.toLowerCase()))) return false;
                    if (minPrice != null && (p.price == null || p.price < minPrice)) return false;
                    if (maxPrice != null && (p.price == null || p.price > maxPrice)) return false;
                    if (minSurface != null && (p.surface == null || p.surface < minSurface)) return false;
                    return true;
                });
                properties = augmentProperties(properties);
                if (listingType === 'buy') properties = properties.filter(p => !isViagerOrTerrainOnly(p));
                if (regionName && regionName !== 'all') properties = properties.filter(p => p.region === regionName);
                if (minYield != null) properties = properties.filter(p => (p.estimatedYield ?? 0) >= minYield);
                if (minCashflow != null) properties = properties.filter(p => (p.estimatedCashflow ?? -9999) >= minCashflow);

                const sortBy = ALLOWED_SORT[searchParams.get('sortBy') ?? ''] ?? 'scrapedAt';
                const sortDir = (searchParams.get('sortDir') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
                properties.sort((a, b) => {
                    const va = a[sortBy as keyof Property];
                    const vb = b[sortBy as keyof Property];
                    if (sortBy === 'scrapedAt') {
                        const cmp = String(va ?? '').localeCompare(String(vb ?? ''));
                        return sortDir === 'ASC' ? cmp : -cmp;
                    }
                    const na = Number(va ?? 0);
                    const nb = Number(vb ?? 0);
                    return sortDir === 'ASC' ? na - nb : nb - na;
                });
                const total = properties.length;
                const page = Number(searchParams.get('page') ?? '1');
                const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '24'), 200);
                const paginated = properties.slice((page - 1) * pageSize, page * pageSize);
                const withPrice = properties.filter(p => p.price && p.price > 0);
                const withSurface = properties.filter(p => p.surface && p.surface > 0);
                const withPricePerSqm = properties.filter(p => p.pricePerSqm && p.pricePerSqm > 0);
                const bySources = { leboncoin: 0, seloger: 0, bienveo: 0 };
                properties.forEach(p => {
                    if (p.source === 'leboncoin') bySources.leboncoin++;
                    else if (p.source === 'seloger') bySources.seloger++;
                    else if (p.source === 'bienveo') bySources.bienveo++;
                });
                return NextResponse.json({
                    properties: paginated,
                    stats: {
                        total,
                        avgPrice: withPrice.length ? Math.round(withPrice.reduce((s, p) => s + p.price!, 0) / withPrice.length) : 0,
                        avgSurface: withSurface.length ? Math.round(withSurface.reduce((s, p) => s + (p.surface ?? 0), 0) / withSurface.length * 10) / 10 : 0,
                        avgPricePerSqm: withPricePerSqm.length ? Math.round(withPricePerSqm.reduce((s, p) => s + (p.pricePerSqm ?? 0), 0) / withPricePerSqm.length) : 0,
                        bySources,
                    },
                    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
                });
            } catch (_jsonErr) {
                return NextResponse.json({
                    properties: [],
                    stats: { total: 0, avgPrice: 0, avgSurface: 0, avgPricePerSqm: 0, bySources: { leboncoin: 0, seloger: 0, bienveo: 0 } },
                    pagination: { total: 0, page: 1, pageSize: 24, totalPages: 1 },
                });
            }
        }
    } catch (err: any) {
        console.error("GET Properties Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
