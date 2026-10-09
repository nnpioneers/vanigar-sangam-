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
import { getDbPool } from '../../database/index.js';

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

/**
 * GET /api/v1/daily-sheets/grid
 * Retrieves grid data for daily sheets and loans in a specific date range.
 * MOCKED FOR TESTING: Generates 4 members (2 with loans) to demonstrate the UI.
 */
export async function getDailySheetsGridDataController(req: Request, res: Response): Promise<void> {
   const { startDate, endDate } = req.query;
   if (!startDate || !endDate) {
     res.status(400).json({ error: { message: 'startDate and endDate required' } });
     return;
   }

   try {
     const pool = getDbPool();
     
     // Get all active members
     const membersResult = await pool.query(`
       SELECT id, member_number, member_name, mobile_number, shop_name, number_of_sheets, TO_CHAR(COALESCE(join_date, created_at), 'YYYY-MM-DD') as join_date
       FROM members WHERE status = 'ACTIVE' ORDER BY member_number ASC
     `);
     const members = membersResult.rows;

     // Get active loans
     const loansResult = await pool.query(`
       SELECT id as loan_id, member_id, approved_amount_paise 
       FROM loans WHERE status IN ('ACTIVE', 'PARTIALLY_REPAID')
     `);
     const loans = loansResult.rows;

     // Get daily sheets within date range
     const sheetsResult = await pool.query(`
       SELECT member_id, TO_CHAR(business_date, 'YYYY-MM-DD') as business_date, actual_paid_paise, TO_CHAR(COALESCE(payment_time, created_at), 'YYYY-MM-DD') as payment_date 
       FROM daily_sheets 
       WHERE business_date >= $1 AND business_date <= $2 AND status IN ('PAID', 'PARTIAL', 'ADVANCE_PAID')
     `, [startDate, endDate]);
     const dailySheets = sheetsResult.rows;

     // Get loan repayments within date range
     const repaysResult = await pool.query(`
       SELECT l.member_id, TO_CHAR(r.repayment_date, 'YYYY-MM-DD') as business_date, r.amount_paise, TO_CHAR(r.created_at, 'YYYY-MM-DD') as payment_date 
       FROM loan_repayments r
       JOIN loans l ON r.loan_id = l.id
       WHERE r.repayment_date >= $1 AND r.repayment_date <= $2
     `, [startDate, endDate]);
     const repayments = repaysResult.rows;

     res.json({
       data: {
         members,
         loans,
         dailySheets,
         repayments
       }
     });
   } catch (error: any) {
     res.status(500).json({ error: { message: error.message } });
   }
}

/**
 * POST /api/v1/daily-sheets/record-payment
 * Records savings and/or loan repayment sequentially for atomicity simulation.
 * MOCKED FOR TESTING: Returns success immediately without database insert.
 */
export async function recordPaymentController(req: Request, res: Response): Promise<void> {
   const { memberId, businessDate, savingsAmountPaise, loanAmountPaise, loanId } = req.body;
   const adminId = req.user?.id ?? req.auth?.id;
   
   if (!adminId) {
     res.status(401).json({ error: { message: 'Auth required' } });
     return;
   }

   try {
     const pool = getDbPool();
     await pool.query('BEGIN');
     
     let dailySheet = null;
     if (savingsAmountPaise > 0) {
        // Fetch member details to satisfy database constraints
        const memRes = await pool.query(`SELECT number_of_sheets FROM members WHERE id = $1`, [memberId]);
        const numSheets = memRes.rows[0]?.number_of_sheets || 1;

        const res1 = await pool.query(`
          INSERT INTO daily_sheets (
            member_id, business_date, actual_paid_paise, status, recorded_by_admin_id,
            number_of_sheets, daily_due_amount_paise, previous_arrears_paise, total_due_paise
          )
          VALUES ($1, $2, $3, 'PAID', $4, $5, $3, 0, $3) RETURNING id
        `, [memberId, businessDate, savingsAmountPaise, adminId, numSheets]);
        dailySheet = { id: res1.rows[0].id, memberId, actualPaidPaise: savingsAmountPaise };
     }

     let repayment = null;
     if (loanAmountPaise > 0 && loanId) {
        const res2 = await pool.query(`
          INSERT INTO loan_repayments (loan_id, repayment_date, amount_paise, recorded_by_admin_id, payment_mode)
          VALUES ($1, $2, $3, $4, 'CASH') RETURNING id
        `, [loanId, businessDate, loanAmountPaise, adminId]);
        repayment = { id: res2.rows[0].id, loanId, amountPaise: loanAmountPaise };
     }

     await pool.query('COMMIT');
     res.json({ data: { success: true, dailySheet, repayment } });
   } catch (e: any) {
     const pool = getDbPool();
     await pool.query('ROLLBACK');
     res.status(400).json({ error: { message: e.message } });
   }
}
