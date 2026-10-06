import { loadLocalEnv } from '@vanigar/config';
import { runPendingMigrations, closeDbPool } from './index.js';

loadLocalEnv();

async function main(): Promise<void> {
  process.stdout.write('Starting database migrations...\n');
  try {
    const result = await runPendingMigrations();
    if (result.executedCount === 0) {
      process.stdout.write('✨ Database schema is up-to-date. No pending migrations.\n');
    } else {
      process.stdout.write(`✅ Applied ${result.executedCount} pending migration(s) successfully.\n`);
    }
    await closeDbPool();
    process.exit(0);
  } catch (err) {
    process.stderr.write(`❌ Migration execution failed: ${err instanceof Error ? err.message : String(err)}\n`);
    await closeDbPool();
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Unhandled error in run-migrations: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
