import { Router } from 'express';

import { SERVICE_NAME, SERVICE_VERSION } from '../app-info.js';

const processStartedAt = Date.now();

/**
 * Health endpoint — proves the API process is alive and serving requests.
 * Deliberately dependency-free: no database, no business logic.
 */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    uptimeSeconds: Math.round((Date.now() - processStartedAt) / 100) / 10,
    timestamp: new Date().toISOString(),
  });
});
