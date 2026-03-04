import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'pipeline.py');

export async function POST() {
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

        // We run the pipeline synchronously up to a point, or trigger it asynchronously.
        // It might take time, we trigger it, wait for 1 sec to catch immediate errors, then let it run
        const child = execFile(python, [SCRIPT_PATH], {
            cwd: process.cwd(),
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
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[pipeline] Error:', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
