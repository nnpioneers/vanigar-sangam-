import express from 'express';

import { requestContextMiddleware } from './middleware/request-context.middleware.js';
import { sessionMiddleware } from './middleware/auth.middleware.js';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware.js';
import { authModule } from './routes/auth.routes.js';
import { cashModule } from './modules/cash/index.js';
import { membersModule } from './modules/members/index.js';
import { dailySheetsModule } from './modules/daily-sheets/index.js';
import { collectionsModule } from './modules/collections/index.js';
import { loansModule } from './modules/loans/index.js';
import { repaymentsModule } from './modules/repayments/index.js';
import { reportsModule } from './modules/reports/index.js';
import { dashboardModule } from './modules/dashboard/index.js';
import { healthRouter } from './routes/health.js';
import { defaultModuleRegistry, type ModuleRegistry } from './modules/index.js';

// Ensure core authentication module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === authModule.name)) {
  defaultModuleRegistry.register(authModule);
}

// Ensure minimal cash foundation module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === cashModule.name)) {
  defaultModuleRegistry.register(cashModule);
}

// Ensure member foundation module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === membersModule.name)) {
  defaultModuleRegistry.register(membersModule);
}

// Ensure daily sheets module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === dailySheetsModule.name)) {
  defaultModuleRegistry.register(dailySheetsModule);
}

// Ensure collections module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === collectionsModule.name)) {
  defaultModuleRegistry.register(collectionsModule);
}

// Ensure loans module is registered in the default module registry
if (!defaultModuleRegistry.getAll().some((m) => m.name === loansModule.name)) {
  defaultModuleRegistry.register(loansModule);
}

// Ensure repayments module is registered
if (!defaultModuleRegistry.getAll().some((m) => m.name === repaymentsModule.name)) {
  defaultModuleRegistry.register(repaymentsModule);
}

// Ensure reports module is registered
if (!defaultModuleRegistry.getAll().some((m) => m.name === reportsModule.name)) {
  defaultModuleRegistry.register(reportsModule);
}

// Ensure dashboard module is registered
if (!defaultModuleRegistry.getAll().some((m) => m.name === dashboardModule.name)) {
  defaultModuleRegistry.register(dashboardModule);
}

/**
 * Application assembly: middleware and route wiring only.
 * Startup (listening, shutdown) lives in `server.ts`.
 */
export function createApp(registry: ModuleRegistry = defaultModuleRegistry): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContextMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(sessionMiddleware);

  app.use(healthRouter);
  registry.mountAll(app);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
