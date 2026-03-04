import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'pipeline.py');

function getPythonPath(): string {
    const winPythonPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
    if (process.platform === 'win32') return winPythonPath;
    return 'python3';
}

/**
 * GET /api/cron/pipeline?secret=xxx
 * Runs the data pipeline. Used by:
 * - Vercel Cron (add in vercel.json: "crons": [{ "path": "/api/cron/pipeline", "schedule": "0 2 * * *" }])
 * - External cron (e.g. curl "https://your-app.vercel.app/api/cron/pipeline?secret=YOUR_CRON_SECRET")
 * Set CRON_SECRET in env and pass it as query param or Authorization header.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const expected = process.env.CRON_SECRET;

    if (expected && secret !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let python = getPythonPath();
        try {
            await execFileAsync(python, ['--version'], { timeout: 3000 });
        } catch {
            python = process.platform === 'win32' ? 'python' : 'python3';
        }

        const child = execFile(python, [SCRIPT_PATH], { cwd: process.cwd() });
        child.on('error', (err) => console.error('[cron/pipeline]', err));
        child.stderr?.on('data', (d) => console.log('[cron/pipeline stderr]', d.toString().slice(-200)));
        child.stdout?.on('data', (d) => console.log('[cron/pipeline stdout]', d.toString().slice(-200)));

        await new Promise((resolve) => setTimeout(resolve, 1500));
        return NextResponse.json({ ok: true, message: 'Pipeline lancée en arrière-plan' });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[cron/pipeline]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
