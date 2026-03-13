/**
 * Runs when the Next.js server starts (Node.js runtime only).
 * - Starts the data pipeline once after 30s (so the server is ready).
 * - Then runs the pipeline every 24h.
 * The user does not need to click "Lancer la Pipeline" — it runs automatically.
 * Node-only code is in instrumentation-node.ts to avoid Edge Runtime errors.
 */

const DELAY_FIRST_RUN_MS = 30 * 1000;   // 30 seconds after server start
const INTERVAL_DAILY_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { runPipeline } = await import('./instrumentation-node');

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
