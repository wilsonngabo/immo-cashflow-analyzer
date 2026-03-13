/**
 * Node-only pipeline runner. Loaded only when NEXT_RUNTIME=nodejs.
 * Uses process.cwd(), execFile - not available in Edge.
 */
import path from 'path';
import { execFile } from 'child_process';

function getPythonPath(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || '',
      'Programs',
      'Python',
      'Python312',
      'python.exe'
    );
  }
  return 'python3';
}

export function runPipeline(): void {
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
