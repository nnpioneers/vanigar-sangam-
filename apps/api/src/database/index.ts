import pg from 'pg';
import { readEnv, readIntEnv } from '@vanigar/config';

const { Pool } = pg;

export interface DatabaseHealthStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

let pool: pg.Pool | null = null;

/**
 * Returns the shared PostgreSQL connection pool instance.
 * Initializes the pool lazily on first call using configuration
 * read from environment variables via `@vanigar/config`.
 */
export function getDbPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const connectionString = readEnv('DATABASE_URL');

  const config: pg.PoolConfig = connectionString
    ? { connectionString }
    : {
        host: readEnv('DB_HOST') ?? 'localhost',
        port: readIntEnv('DB_PORT', 5432),
        database: readEnv('DB_NAME') ?? 'vanigar_sangam',
        user: readEnv('DB_USER') ?? 'postgres',
        password: readEnv('DB_PASSWORD') ?? undefined,
      };

  config.max = readIntEnv('DB_POOL_MAX', 10);
  config.idleTimeoutMillis = readIntEnv('DB_POOL_IDLE_TIMEOUT_MS', 30000);
  config.connectionTimeoutMillis = readIntEnv('DB_POOL_CONN_TIMEOUT_MS', 5000);

  pool = new Pool(config);

  // Attach error listener to prevent idle client errors from crashing the Node.js process
  pool.on('error', (err) => {
    process.stderr.write(`[database pool error] unexpected error on idle client: ${err.message}\n`);
  });

  return pool;
}

/**
 * Executes a lightweight connectivity check (`SELECT 1 AS alive`)
 * against the configured PostgreSQL connection pool.
 */
export async function checkDatabaseConnection(): Promise<DatabaseHealthStatus> {
  const activePool = getDbPool();
  const startTime = Date.now();
  try {
    const result = await activePool.query('SELECT 1 AS alive');
    const latencyMs = Date.now() - startTime;
    if (result.rows[0]?.alive === 1) {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: 'Unexpected result from SELECT 1 query' };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs, error: errorMessage };
  }
}

/**
 * Gracefully shuts down the PostgreSQL connection pool.
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    const poolToClose = pool;
    pool = null;
    await poolToClose.end();
  }
}

export * from './migrator.js';
export * from './transaction.js';
export * from './conventions.js';
export * from './money.js';
export * from './migration-validator.js';
