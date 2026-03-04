/**
 * Runs when the Next.js server starts (Node.js runtime only).
 * - Starts the data pipeline once after 30s (so the server is ready).
 * - Then runs the pipeline every 24h.
 * The user does not need to click "Lancer la Pipeline" — it runs automatically.
 */

const DELAY_FIRST_RUN_MS = 30 * 1000;   // 30 seconds after server start
const INTERVAL_DAILY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getPythonPath(): string {
  if (process.platform === 'win32') {
    const winPath = require('path').join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'Python',
      'Python312',
      'python.exe'
    );
    return winPath;
  }
  return 'python3';
}

function runPipeline(): void {
  const path = require('path');
  const { execFile } = require('child_process');
  const scriptPath = path.join(process.cwd(), 'scripts', 'pipeline.py');
  const python = getPythonPath();

  execFile(python, [scriptPath], { cwd: process.cwd() }, (err: Error | null) => {
    if (err) {
      console.error('[Pipeline auto] Error:', err.message);
      return;
    }
    console.log('[Pipeline auto] Run completed.');
  });
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // First run after delay so the server can start
  setTimeout(() => {
    console.log('[Pipeline auto] First run (scheduled at server start).');
    runPipeline();
  }, DELAY_FIRST_RUN_MS);

  // Then every 24h
  setInterval(() => {
    console.log('[Pipeline auto] Daily run.');
    runPipeline();
  }, INTERVAL_DAILY_MS);
}
