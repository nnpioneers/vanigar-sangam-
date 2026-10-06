import { loadLocalEnv } from '@vanigar/config';
import { checkDatabaseConnection, closeDbPool } from './index.js';

loadLocalEnv();

async function runVerification(): Promise<void> {
  process.stdout.write('Testing PostgreSQL database connectivity...\n');
  const result = await checkDatabaseConnection();
  if (result.ok) {
    process.stdout.write(`✅ PostgreSQL connection test PASSED (latency: ${result.latencyMs}ms)\n`);
    await closeDbPool();
    process.exit(0);
  } else {
    process.stderr.write(`❌ PostgreSQL connection test FAILED (latency: ${result.latencyMs}ms): ${result.error}\n`);
    await closeDbPool();
    process.exit(1);
  }
}

runVerification().catch((err) => {
  process.stderr.write(`Unhandled verification error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
