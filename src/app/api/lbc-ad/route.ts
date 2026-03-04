import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'lbc_scrape.py');

function getPythonPath(): string {
    const winPythonPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
    if (process.platform === 'win32' && winPythonPath) {
        return winPythonPath;
    }
    return 'python3';
}

/**
 * GET /api/lbc-ad?id=3083550740
 * Fetches a single LeBonCoin ad by list_id using the Python scraper (curl_cffi).
 * Used by parse-url when user pastes an LBC ad URL.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const adId = idParam ? parseInt(idParam, 10) : NaN;

    if (!idParam || isNaN(adId) || adId <= 0) {
        return NextResponse.json({ error: 'ID d\'annonce invalide' }, { status: 400 });
    }

    try {
        const python = getPythonPath();
        const { stdout, stderr } = await execFileAsync(python, [SCRIPT_PATH, '--ad-id', String(adId)], {
            cwd: process.cwd(),
            timeout: 20000,
            maxBuffer: 1024 * 1024,
        });

        if (stderr) {
            console.log('[lbc-ad stderr]', stderr.slice(-300));
        }

        const text = (stdout || '').trim();
        if (!text) {
            return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
        }

        let data: Record<string, unknown>;
        try {
            data = JSON.parse(text) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Réponse invalide du scraper' }, { status: 502 });
        }

        if (data.error) {
            return NextResponse.json(
                { error: typeof data.error === 'string' ? data.error : 'Annonce introuvable' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('timeout') || (err as NodeJS.ErrnoException)?.code === 'ETIMEDOUT') {
            return NextResponse.json({ error: 'Délai dépassé' }, { status: 504 });
        }
        console.error('[lbc-ad] Error:', err);
        return NextResponse.json({ error: 'Impossible de récupérer l\'annonce' }, { status: 502 });
    }
}
