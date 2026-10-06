import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = [
  'apps/api/dist',
  'apps/web/.next',
  'packages/rules/dist',
  'packages/shared-types/dist',
  'packages/validation/dist',
  'packages/config/dist',
];

const root = process.cwd();

for (const target of targets) {
  await rm(resolve(root, target), { recursive: true, force: true });
}

process.stdout.write(`Cleaned ${targets.length} build locations.\n`);
