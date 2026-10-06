import { loadLocalEnv } from '@vanigar/config';
import { getMigrationStatus, closeDbPool } from './index.js';

loadLocalEnv();

async function main(): Promise<void> {
  process.stdout.write('Checking database migration status...\n');
  try {
    const status = await getMigrationStatus();
    if (status.length === 0) {
      process.stdout.write('No migration files found in database/migrations.\n');
    } else {
      process.stdout.write('Migration Status Summary:\n');
      let pendingCount = 0;
      let modifiedCount = 0;
      let appliedCount = 0;

      for (const item of status) {
        let badge = '⏳ PENDING';
        if (item.isModified) {
          badge = '⚠️ MODIFIED ON DISK (checksum mismatch)';
          modifiedCount++;
        } else if (item.applied) {
          badge = '✅ APPLIED';
          appliedCount++;
        } else {
          pendingCount++;
        }

        const detail = item.applied && item.executedAt
          ? ` (executed at ${new Date(item.executedAt).toISOString()}, ${item.executionTimeMs}ms)`
          : '';
        process.stdout.write(`  - ${item.filename}: ${badge}${detail}\n`);
      }

      process.stdout.write(`Status: ${appliedCount} applied, ${pendingCount} pending, ${modifiedCount} modified\n`);
    }
    await closeDbPool();
    process.exit(0);
  } catch (err) {
    process.stderr.write(`❌ Failed fetching migration status: ${err instanceof Error ? err.message : String(err)}\n`);
    await closeDbPool();
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Unhandled error in migration-status: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
