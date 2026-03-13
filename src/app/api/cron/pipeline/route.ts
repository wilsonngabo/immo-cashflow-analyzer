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
 * GET /api/cron/pipeline?secret=xxx&mode=bienveo-only&no_vpn=1&region=Normandie
 * Runs the data pipeline on the server. Used by:
 * - Cron on server: curl "http://localhost:3000/api/cron/pipeline?secret=XXX"
 * - Browser/remote: https://your-server.com/api/cron/pipeline?secret=XXX
 * - Optional params: mode=bienveo-only|lbconly, no_vpn=1, region=Normandie
 * Set CRON_SECRET in env. If unset, accepts any request (use only on trusted networks).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const expected = process.env.CRON_SECRET;

    if (expected && secret !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mode = searchParams.get('mode'); // bienveo-only | lbconly
    const noVpn = searchParams.get('no_vpn') === '1' || searchParams.get('no_vpn') === 'true';
    const region = searchParams.get('region') || undefined;

    const args: string[] = [];
    if (mode === 'bienveo-only') args.push('--bienveo-only');
    else if (mode === 'lbconly') args.push('--lbc-only');
    if (noVpn) args.push('--no-vpn');

    const env = { ...process.env };
    if (region) env.PIPELINE_REGION = region;
    env.PYTHONUNBUFFERED = '1';

    try {
        let python = getPythonPath();
        try {
            await execFileAsync(python, ['--version'], { timeout: 3000 });
        } catch {
            python = process.platform === 'win32' ? 'python' : 'python3';
        }

        const child = execFile(python, [SCRIPT_PATH, ...args], { cwd: process.cwd(), env });
        child.on('error', (err) => console.error('[cron/pipeline]', err));
        child.stderr?.on('data', (d) => console.log('[cron/pipeline stderr]', d.toString().slice(-200)));
        child.stdout?.on('data', (d) => console.log('[cron/pipeline stdout]', d.toString().slice(-200)));

        await new Promise((resolve) => setTimeout(resolve, 1500));
        return NextResponse.json({
            ok: true,
            message: 'Pipeline lancée en arrière-plan',
            mode: mode || 'full',
            region: region || null,
            no_vpn: noVpn,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[cron/pipeline]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
