'use client';

import { useState, useEffect } from 'react';

export interface LiveRates {
    date: string;
    source: string;
    sourceUrl: string;
    national: Record<number, number>;
    regional: Record<string, Record<number, number>>;
}

let cachedRates: LiveRates | null = null;
let fetchPromise: Promise<LiveRates | null> | null = null;

async function fetchRates(): Promise<LiveRates | null> {
    try {
        const res = await fetch('/api/rates');
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export function useRates(): { rates: LiveRates | null; loading: boolean } {
    const [rates, setRates] = useState<LiveRates | null>(cachedRates);
    const [loading, setLoading] = useState(!cachedRates);

    useEffect(() => {
        if (cachedRates) {
            setRates(cachedRates);
            setLoading(false);
            return;
        }

        if (!fetchPromise) {
            fetchPromise = fetchRates().then((data) => {
                cachedRates = data;
                return data;
            });
        }

        fetchPromise.then((data) => {
            setRates(data);
            setLoading(false);
        });
    }, []);

    return { rates, loading };
}

/**
 * Interpolate rate for any duration given a set of reference points.
 * Falls back to nearest boundary if outside range.
 */
export function interpolateFromTable(
    table: Record<number, number>,
    years: number
): number {
    const entries = Object.entries(table)
        .map(([k, v]) => [Number(k), v] as [number, number])
        .sort((a, b) => a[0] - b[0]);

    if (entries.length === 0) return 3.26;
    if (years <= entries[0][0]) return entries[0][1];
    if (years >= entries[entries.length - 1][0]) return entries[entries.length - 1][1];

    for (let i = 0; i < entries.length - 1; i++) {
        const [y1, r1] = entries[i];
        const [y2, r2] = entries[i + 1];
        if (years >= y1 && years <= y2) {
            const t = (years - y1) / (y2 - y1);
            return Math.round((r1 + t * (r2 - r1)) * 100) / 100;
        }
    }
    return entries[entries.length - 1][1];
}

/**
 * Get rate from live data for given duration and optional region.
 * If region has rates, uses them directly. Otherwise uses national + regional spread.
 */
export function getLiveRate(
    rates: LiveRates,
    years: number,
    region?: string
): number {
    const nationalRate = interpolateFromTable(rates.national, years);

    if (!region || !rates.regional[region]) return nationalRate;

    const regionalTable = rates.regional[region];
    if (Object.keys(regionalTable).length >= 2) {
        return interpolateFromTable(regionalTable, years);
    }

    const national25 = rates.national[25] ?? 3.41;
    const regional25 = regionalTable[25];
    if (regional25 != null) {
        const spread = regional25 - national25;
        return Math.round((nationalRate + spread) * 100) / 100;
    }

    return nationalRate;
}
