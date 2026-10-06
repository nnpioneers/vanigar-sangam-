/**
 * Collections Routes (Phase 6.8)
 *
 * Mounts HTTP endpoints for Collections operations under /api/v1/collections.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateQuery, validateParams } from '../../middleware/validation.middleware.js';
import { validateUuidParam } from '@vanigar/validation';
import { validateCollectionListQuery } from './collections.validation.js';
import {
  listCollectionsController,
  getCollectionByIdController,
  exportCollectionsController,
} from './collections.controller.js';
import type { AppModule } from '../module.types.js';

export const collectionsRouter = Router();

collectionsRouter.use(requireAuth);

collectionsRouter.get(
  '/',
  validateQuery(validateCollectionListQuery),
  listCollectionsController
);

collectionsRouter.get(
  '/export',
  validateQuery(validateCollectionListQuery),
  exportCollectionsController
);

collectionsRouter.get(
  '/:id',
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p?.id, 'id');
  }),
  getCollectionByIdController
);

export const collectionsModule: AppModule = {
  name: 'collections',
  basePath: '/api/v1/collections',
  router: collectionsRouter,
};
