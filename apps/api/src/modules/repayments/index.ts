export * from './repayments.types.js';
export * from './repayments.repository.js';
export * from './repayments.service.js';
export * from './repayments.controller.js';
export { repaymentsRouter } from './repayments.routes.js';

import type { AppModule } from '../module.types.js';
import { repaymentsRouter } from './repayments.routes.js';

export const repaymentsModule: AppModule = {
  name: 'repayments',
  basePath: '/api/v1',
  router: repaymentsRouter,
};
