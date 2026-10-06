/**
 * Member Routes (Phase 5.1)
 *
 * Mounts endpoints for member management.
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { validateParams, validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { validateUuidParam } from '@vanigar/validation';
import {
  validateCreateMemberPayload,
  validateUpdateMemberPayload,
  validateMemberSearchQuery,
  validateMemberNumberParam,
} from './members.validation.js';
import {
  createMemberController,
  getMemberByNumberController,
  getMemberProfileController,
  updateMemberController,
  updateMemberByNumberController,
  deactivateMemberController,
  deactivateMemberByNumberController,
  activateMemberController,
  activateMemberByNumberController,
  listMembersController,
} from './members.controller.js';
import type { AppModule } from '../module.types.js';

export const membersRouter = Router();

membersRouter.use(requireAuth);

membersRouter.post('/', validateBody(validateCreateMemberPayload), createMemberController);
membersRouter.get('/', validateQuery(validateMemberSearchQuery), listMembersController);

membersRouter.get('/number/:memberNumber', getMemberByNumberController);
membersRouter.get('/:memberNumber/profile', validateParams(validateMemberNumberParam), getMemberProfileController);

membersRouter.patch(
  '/number/:memberNumber',
  validateParams(validateMemberNumberParam),
  validateBody(validateUpdateMemberPayload),
  updateMemberByNumberController
);

membersRouter.patch(
  '/:memberNumber/profile',
  validateParams(validateMemberNumberParam),
  validateBody(validateUpdateMemberPayload),
  updateMemberByNumberController
);

membersRouter.patch(
  '/:id',
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p.id, 'id');
  }),
  validateBody(validateUpdateMemberPayload),
  updateMemberController
);

membersRouter.post(
  '/number/:memberNumber/activate',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateParams(validateMemberNumberParam),
  activateMemberByNumberController
);

membersRouter.post(
  '/:id/activate',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p.id, 'id');
  }),
  activateMemberController
);

membersRouter.post(
  '/number/:memberNumber/deactivate',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateParams(validateMemberNumberParam),
  deactivateMemberByNumberController
);

membersRouter.post(
  '/:id/deactivate',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  validateParams((params: unknown) => {
    const p = params as { id?: unknown };
    return validateUuidParam(p.id, 'id');
  }),
  deactivateMemberController
);

export const membersModule: AppModule = {
  name: 'members',
  basePath: '/api/v1/members',
  router: membersRouter,
};
