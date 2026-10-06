/**
 * Daily Sheet Controller (Phase 6.4)
 *
 * Handles HTTP requests, session administrative attribution, and standardized response formatting.
 */

import type { Request, Response } from 'express';
import { DailySheetService } from './daily-sheets.service.js';
import { DailySheetRepository } from './daily-sheets.repository.js';
import { MemberRepository } from '../members/members.repository.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../controllers/base.controller.js';
import type { ValidatedCreateDailySheetPayload, ValidatedCorrectDailySheetPayload } from './daily-sheets.validation.js';
import type { DailySheetListFilter } from './daily-sheets.types.js';

let dailySheetServiceInstance: DailySheetService | null = null;

function getDailySheetService(): DailySheetService {
  if (!dailySheetServiceInstance) {
    dailySheetServiceInstance = new DailySheetService(
      new DailySheetRepository(),
      new MemberRepository()
    );
  }
  return dailySheetServiceInstance;
}

/**
 * POST /api/v1/daily-sheets
 * Creates a new daily sheet entry.
 */
export async function createDailySheetController(req: Request, res: Response): Promise<void> {
  const service = getDailySheetService();
  const payload = req.validatedBody as ValidatedCreateDailySheetPayload;
  const adminId = req.user?.id ?? req.auth?.id;

  if (!adminId) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  const dailySheet = await service.createDailySheet(payload, adminId, { requestId: req.id });
  sendCreated(res, { dailySheet });
}

/**
 * GET /api/v1/daily-sheets/:id
 * Retrieves a single daily sheet entry by UUID.
 */
export async function getDailySheetByIdController(req: Request, res: Response): Promise<void> {
  const service = getDailySheetService();
  const id = req.params.id as string;
  const dailySheet = await service.getDailySheetById(id, { requestId: req.id });
  sendSuccess(res, { dailySheet });
}

/**
 * GET /api/v1/daily-sheets
 * Lists daily sheet entries with optional filters (businessDate, memberNumber, status, pagination).
 */
export async function listDailySheetsController(req: Request, res: Response): Promise<void> {
  const service = getDailySheetService();
  const filter = (req.validatedQuery ?? req.query) as DailySheetListFilter;
  const result = await service.listDailySheets(filter, { requestId: req.id });
  sendPaginated(res, result.items, result.pagination);
}

/**
 * GET /api/v1/daily-sheets/member/:memberNumber
 * Retrieves paginated daily sheet history for a member.
 */
export async function getMemberDailySheetHistoryController(req: Request, res: Response): Promise<void> {
  const service = getDailySheetService();
  const memberNumber = req.params.memberNumber as string;
  const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;

  const result = await service.getMemberDailySheetHistory(memberNumber, page, pageSize, { requestId: req.id });
  sendPaginated(res, result.items, result.pagination);
}

/**
 * POST /api/v1/daily-sheets/:id/correct
 * Corrects/voids an existing daily sheet entry with audit trail and optional cash reversal (Phase 6.6).
 */
export async function correctDailySheetController(req: Request, res: Response): Promise<void> {
  const service = getDailySheetService();
  const id = req.params.id as string;
  const adminId = req.user?.id ?? req.auth?.id;
  const adminRole = req.user?.role ?? req.auth?.role;

  if (!adminId || !adminRole) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  const payload = req.validatedBody as ValidatedCorrectDailySheetPayload;
  const result = await service.correctDailySheet(id, payload.reason, adminId, adminRole, { requestId: req.id });
  sendSuccess(res, result);
}
