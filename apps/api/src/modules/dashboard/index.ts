import type { AppModule } from '../module.types.js';
import { dashboardRouter } from './dashboard.routes.js';

export const dashboardModule: AppModule = {
  name: 'dashboard',
  basePath: '/api/v1/dashboard',
  router: dashboardRouter,
};
