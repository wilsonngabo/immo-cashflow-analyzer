import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'pipeline.py');

function getPythonPath(): string {
    if (process.platform === 'win32') {
        const winPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
        return winPath;
    }
    return 'python3';
}

/**
 * POST /api/pipeline — Trigger pipeline from server (body: { mode?, no_vpn?, region? })
 */
export async function POST(request: Request) {
    try {
        let mode: string | undefined;
        let noVpn = false;
        let region: string | undefined;
        try {
            const body = await request.json().catch(() => ({}));
            mode = body.mode;
            noVpn = body.no_vpn === true || body.no_vpn === '1';
            region = body.region;
        } catch {
            // ignore
        }

        const args: string[] = [];
        if (mode === 'bienveo-only') args.push('--bienveo-only');
        else if (mode === 'lbconly' || mode === 'lbc-only') args.push('--lbc-only');
        if (noVpn) args.push('--no-vpn');

        const env = { ...process.env };
        if (region) env.PIPELINE_REGION = region;
        env.PYTHONUNBUFFERED = '1';

        let python = getPythonPath();
        if (process.platform === 'win32') {
            try {
                await execFileAsync(python, ['--version'], { timeout: 3000 });
            } catch {
                python = 'python';
            }
        } else {
            try {
                await execFileAsync('python3', ['--version'], { timeout: 3000 });
            } catch {
                python = 'python';
            }
        }

        const child = execFile(python, [SCRIPT_PATH, ...args], {
            cwd: process.cwd(),
            env,
        });

        // We could collect stdout/stderr or just let it run.
        let isError = false;
        let errMsg = '';

        child.on('error', (err) => {
            console.error('Pipeline Error:', err);
            isError = true;
            errMsg = err.message;
        });

        child.stderr?.on('data', (data) => {
            console.log(`[Pipeline stderr]: ${data}`);
        });

        child.stdout?.on('data', (data) => {
            console.log(`[Pipeline stdout]: ${data}`);
        });

        // wait 1 second to see if it crashed immediately
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (isError) {
            return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Pipeline lancée en arrière-plan',
            mode: mode || 'full',
            region: region || null,
            no_vpn: noVpn,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[pipeline] Error:', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
