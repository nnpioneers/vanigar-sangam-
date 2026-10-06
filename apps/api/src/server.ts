import { loadLocalEnv, readIntEnv, validateEnvironment } from '@vanigar/config';

import { SERVICE_NAME } from './app-info.js';
import { createApp } from './app.js';
import { closeDbPool } from './database/index.js';

const DEFAULT_PORT = 4000;

loadLocalEnv();

const configValidation = validateEnvironment();
if (!configValidation.ok) {
  process.stderr.write(`[${SERVICE_NAME}] Environment configuration validation failed:\n`);
  for (const err of configValidation.errors) {
    process.stderr.write(`  - ERROR: ${err}\n`);
  }
  process.exit(1);
}

if (configValidation.warnings.length > 0) {
  for (const warn of configValidation.warnings) {
    process.stdout.write(`[${SERVICE_NAME}] CONFIG WARNING: ${warn}\n`);
  }
}

const configuredPort = readIntEnv('PORT', DEFAULT_PORT);
// `PORT=0` means "any free port" to Node.js; treat it as unset so the API is
// reachable on its documented port instead of a random one.
const port = configuredPort > 0 ? configuredPort : DEFAULT_PORT;

const app = createApp();

const server = app.listen(port, () => {
  process.stdout.write(`${SERVICE_NAME} listening on http://localhost:${port}\n`);
});

server.on('error', (error) => {
  process.stderr.write(`[${SERVICE_NAME}] failed to start: ${error.message}\n`);
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  process.stdout.write(`[${SERVICE_NAME}] received ${signal}, shutting down\n`);
  await closeDbPool();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
