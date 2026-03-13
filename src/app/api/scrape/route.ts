import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const DB_PATH = path.join(process.cwd(), 'data', 'properties.json');
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'lbc_scrape.py');
const BIENVEO_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'bienveo_scrape.py');

interface ScrapeRequest {
    city?: string;
    listingType?: 'buy' | 'rent';
    propertyKind?: 'apartment' | 'house' | 'both';
    minPrice?: number;
    maxPrice?: number;
    minSurface?: number;
    radiusKm?: number;
    limit?: number;
    ownerType?: 'all' | 'private' | 'professional';
    sources?: ('leboncoin' | 'seloger' | 'bienveo')[];  // default: ['leboncoin']
}

interface ScrapeResult {
    source: string;
    count: number;
    error?: string;
}

import { getDB } from '@/lib/db';

async function getDBCount(): Promise<number> {
    try {
        const db = getDB();
        const res = db.prepare('SELECT COUNT(*) as c FROM properties').get() as { c: number };
        return res.c;
    } catch {
        return 0;
    }
}

// ─── Python scraper (LeBonCoin via curl_cffi) ────────────────────────────────

async function scrapeLeBonCoin(params: ScrapeRequest): Promise<ScrapeResult> {
    const args = [
        SCRIPT_PATH,
        '--city', params.city ?? 'Paris',
        '--type', params.listingType ?? 'buy',
        '--kind', params.propertyKind === 'apartment' ? 'apartment'
            : params.propertyKind === 'house' ? 'house' : 'both',
        '--limit', String(Math.min(params.limit ?? 100, 1000000)),
        '--db', DB_PATH.replace('.json', '.db'),
        '--merge',
        '--owner-type', params.ownerType ?? 'all',
    ];
    if (params.minPrice) args.push('--min-price', String(params.minPrice));
    if (params.maxPrice) args.push('--max-price', String(params.maxPrice));
    if (params.minSurface) args.push('--min-surface', String(params.minSurface));
    if (params.radiusKm) args.push('--radius', String(params.radiusKm));

    try {
        // Try precise Windows install path first, then fallbacks
        const winPythonPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
        let python = 'python3';

        try {
            await execFileAsync(winPythonPath, ['--version'], { timeout: 3000 });
            python = winPythonPath;
        } catch {
            try {
                await execFileAsync('python3', ['--version'], { timeout: 3000 });
                python = 'python3';
            } catch {
                python = 'python';
            }
        }

        const { stdout, stderr } = await execFileAsync(python, args, {
            timeout: 60_000, // 60s max
            cwd: process.cwd(),
        });

        if (stderr) {
            console.log('[lbc_scrape stderr]', stderr.slice(-500));
        }

        const result = JSON.parse(stdout.trim());
        if (result.error) {
            return { source: 'leboncoin', count: 0, error: result.error };
        }
        return { source: 'leboncoin', count: result.count ?? 0 };

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        // Check if it's a "not found" error (python not installed)
        if (msg.includes('ENOENT') || msg.includes('not found')) {
            return {
                source: 'leboncoin',
                count: 0,
                error: 'Python non trouvé. Installez Python 3.9+ et lancez: pip install curl_cffi',
            };
        }

        // Check if curl_cffi is not installed
        if (msg.includes('curl_cffi')) {
            return {
                source: 'leboncoin',
                count: 0,
                error: 'Dépendance manquante. Lancez: pip install curl_cffi',
            };
        }

        return { source: 'leboncoin', count: 0, error: msg.slice(0, 200) };
    }
}

// ─── Bienveo scraper (via curl_cffi + __NEXT_DATA__) ─────────────────────────

async function scrapeBienveo(params: ScrapeRequest): Promise<ScrapeResult> {
    const args = [
        BIENVEO_SCRIPT_PATH,
        '--type', params.listingType ?? 'buy',
        '--kind', params.propertyKind === 'apartment' ? 'apartment'
            : params.propertyKind === 'house' ? 'house' : 'both',
        '--limit', String(Math.min(params.limit ?? 200, 10000)),
        '--db', DB_PATH.replace('.json', '.db'),
    ];
    if (params.city) args.push('--city', params.city);

    try {
        const winPythonPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
        let python = 'python3';
        try {
            await execFileAsync(winPythonPath, ['--version'], { timeout: 3000 });
            python = winPythonPath;
        } catch {
            try {
                await execFileAsync('python3', ['--version'], { timeout: 3000 });
                python = 'python3';
            } catch {
                python = 'python';
            }
        }

        const { stdout, stderr } = await execFileAsync(python, args, {
            timeout: 120_000, // 2 min max (bienveo is slower due to HTML scraping)
            cwd: process.cwd(),
        });

        if (stderr) console.log('[bienveo_scrape stderr]', stderr.slice(-500));

        const result = JSON.parse(stdout.trim());
        if (result.error) return { source: 'bienveo', count: 0, error: result.error };
        return { source: 'bienveo', count: result.count ?? 0 };

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('ENOENT') || msg.includes('not found')) {
            return { source: 'bienveo', count: 0, error: 'Python non trouvé. Installez Python 3.9+ et lancez: pip install curl_cffi' };
        }
        if (msg.includes('curl_cffi')) {
            return { source: 'bienveo', count: 0, error: 'Dépendance manquante. Lancez: pip install curl_cffi' };
        }
        return { source: 'bienveo', count: 0, error: msg.slice(0, 200) };
    }
}

// ─── POST — trigger scrape ────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const params: ScrapeRequest = await request.json().catch(() => ({}));
        const sources = params.sources?.length ? params.sources : ['leboncoin', 'bienveo'];
        const results: ScrapeResult[] = [];
        let totalNew = 0;

        if (sources.includes('leboncoin')) {
            const result = await scrapeLeBonCoin(params);
            results.push(result);
            totalNew += result.count ?? 0;
        }
        if (sources.includes('bienveo')) {
            const result = await scrapeBienveo(params);
            results.push(result);
            totalNew += result.count ?? 0;
        }

        const totalCount = await getDBCount();

        return NextResponse.json({
            success: totalNew > 0,
            results,
            newCount: totalNew,
            totalCount,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[scrape] Error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE — clear DB ───────────────────────────────────────────────────────

export async function DELETE() {
    try {
        const db = getDB();
        db.prepare('DELETE FROM properties').run();
        return NextResponse.json({ success: true, message: 'Database cleared' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
