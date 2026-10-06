/**
 * Authentication Routes
 *
 * Mounts:
 * - POST /api/v1/auth/login
 * - GET  /api/v1/auth/me (guarded by requireAuth)
 * - POST /api/v1/auth/logout
 */

import { Router } from 'express';
import {
  loginController,
  meController,
  logoutController,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AppModule } from '../modules/module.types.js';

export const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.get('/me', requireAuth, meController);
authRouter.post('/logout', logoutController);

export const authModule: AppModule = {
  name: 'auth',
  basePath: '/api/v1/auth',
  router: authRouter,
};
