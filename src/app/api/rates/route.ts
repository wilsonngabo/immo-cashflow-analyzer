import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export interface RateEntry {
    duration: number;
    region: string | null;
    rate: number;
}

export interface RatesResponse {
    date: string;
    source: string;
    sourceUrl: string;
    national: Record<number, number>;
    regional: Record<string, Record<number, number>>;
}

export async function GET() {
    try {
        const db = getDB();

        const latestDate = db.prepare(
            `SELECT scrapedAt FROM mortgage_rates ORDER BY scrapedAt DESC LIMIT 1`
        ).get() as { scrapedAt: string } | undefined;

        if (!latestDate) {
            return NextResponse.json({ error: 'No rates data available' }, { status: 404 });
        }

        const rows = db.prepare(
            `SELECT duration, region, rate, source, sourceUrl
             FROM mortgage_rates
             WHERE scrapedAt = ?
             ORDER BY region IS NULL DESC, region, duration`
        ).all(latestDate.scrapedAt) as Array<{
            duration: number;
            region: string | null;
            rate: number;
            source: string;
            sourceUrl: string;
        }>;

        const national: Record<number, number> = {};
        const regional: Record<string, Record<number, number>> = {};
        let source = 'CAFPI';
        let sourceUrl = '';

        for (const row of rows) {
            source = row.source;
            sourceUrl = row.sourceUrl || '';
            if (row.region === null) {
                national[row.duration] = row.rate;
            } else {
                if (!regional[row.region]) regional[row.region] = {};
                regional[row.region][row.duration] = row.rate;
            }
        }

        const response: RatesResponse = {
            date: latestDate.scrapedAt,
            source,
            sourceUrl,
            national,
            regional,
        };

        return NextResponse.json(response, {
            headers: { 'Cache-Control': 'public, max-age=3600' },
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
