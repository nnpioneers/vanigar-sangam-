/**
 * Daily Sheet Service (Phase 6.4)
 *
 * Coordinates business rules, member verification, financial calculations,
 * idempotency, and transactional persistence for Daily Sheet entries.
 */

import { withTransaction, type Queryable } from '../../database/index.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../errors/app-error.js';
import type { ServiceContext } from '../module.types.js';
import type { DailySheetRepository } from './daily-sheets.repository.js';
import type { MemberRepository } from '../members/members.repository.js';
import type {
  DailySheet,
  DailySheetListFilter,
  DailySheetStatus,
  DailySheetCorrection,
} from './daily-sheets.types.js';
import type { ValidatedCreateDailySheetPayload } from './daily-sheets.validation.js';
import {
  calculateDailyDuePaise,
  calculateTotalDuePaise,
  resolveConfirmedDailySheetStatus,
} from '@vanigar/rules';
import type { PaginatedData } from '@vanigar/shared-types';

export class DailySheetService {
  constructor(
    private readonly sheetRepo: DailySheetRepository,
    private readonly memberRepo: MemberRepository
  ) {}

  /**
   * Creates a new Daily Sheet entry with authoritative server-side financial calculations.
   */
  async createDailySheet(
    payload: ValidatedCreateDailySheetPayload,
    adminId: string,
    context?: ServiceContext
  ): Promise<DailySheet> {
    const runInTx = async (tx: Queryable): Promise<DailySheet> => {
      // 1. Resolve member authoritatively from database
      let member = null;
      if (payload.memberNumber) {
        member = await this.memberRepo.findByMemberNumber(payload.memberNumber, tx);
      } else if (payload.memberId) {
        member = await this.memberRepo.findById(payload.memberId, tx);
      }

      if (!member) {
        throw new NotFoundError(
          payload.memberNumber
            ? `Member with number "${payload.memberNumber}" not found`
            : `Member with ID "${payload.memberId}" not found`
        );
      }

      if (member.status === 'INACTIVE') {
        throw new ConflictError(
          `Cannot record daily sheet entry for inactive member "${member.memberNumber}". Member must be ACTIVE.`
        );
      }

      // 2. Check Idempotency Key (if provided)
      if (payload.idempotencyKey) {
        const existingByIdem = await this.sheetRepo.findByIdempotencyKey(payload.idempotencyKey, tx);
        if (existingByIdem) {
          if (
            existingByIdem.memberId === member.id &&
            existingByIdem.businessDate === payload.businessDate
          ) {
            // Idempotent replay: return existing entry safely
            return existingByIdem;
          }
          throw new ConflictError(
            `Idempotency key "${payload.idempotencyKey}" already used for a different daily sheet entry`
          );
        }
      }

      // 3. Prevent duplicate entry for member on the same business date
      const existingOnDate = await this.sheetRepo.findByMemberAndDate(
        member.id,
        payload.businessDate,
        tx
      );
      if (existingOnDate) {
        throw new ConflictError(
          `Daily sheet entry already exists for member "${member.memberNumber}" on date "${payload.businessDate}"`
        );
      }

      // 4. Server-side authoritative daily due calculation: numberOfSheets × ₹200 (20,000 paise)
      const dailyDueAmountPaise = calculateDailyDuePaise(member.numberOfSheets);

      // 5. Total due calculation: dailyDue + previousArrears
      const previousArrearsPaise = payload.previousArrearsPaise ?? 0;
      const totalDuePaise = calculateTotalDuePaise(dailyDueAmountPaise, previousArrearsPaise);

      // 6. Actual paid amount (defaults to 0 if not supplied)
      const actualPaidPaise = payload.actualPaidPaise ?? 0;

      // 7. Status resolution:
      // Keep only confirmed status classifications directly supported by frozen rules.
      // Excess payment preserves numerical excess (excessPaidPaise) without guessing future advance allocation.
      // Unresolved advance coverage and overdue behaviors are NOT automatically assigned.
      const status = resolveConfirmedDailySheetStatus<DailySheetStatus>(
        totalDuePaise,
        actualPaidPaise,
        payload.status
      );

      // 8. Payment time and payment mode handling
      const paymentTime = actualPaidPaise > 0
        ? (payload.paymentTime ?? new Date().toISOString())
        : payload.paymentTime ?? null;

      const paymentMode = actualPaidPaise > 0
        ? (payload.paymentMode ?? 'CASH')
        : payload.paymentMode ?? null;

      // 9. Persist daily sheet record
      const created = await this.sheetRepo.create(
        {
          memberId: member.id,
          businessDate: payload.businessDate,
          numberOfSheets: member.numberOfSheets,
          dailyDueAmountPaise,
          previousArrearsPaise,
          totalDuePaise,
          actualPaidPaise,
          status,
          paymentTime,
          paymentMode,
          notes: payload.notes ?? null,
          idempotencyKey: payload.idempotencyKey ?? null,
          recordedByAdminId: adminId,
        },
        tx
      );

      // 10. Collections integration (Phase 6.8):
      // If payment was made (actualPaidPaise > 0), record collection event & cash transaction atomically
      if (actualPaidPaise > 0 && paymentMode) {
        let cashTxId: string | null = null;

        // 10a. If CASH payment mode, credit admin cash account if one exists
        if (paymentMode === 'CASH') {
          const cashAccRes = await tx.query<{ id: string }>(
            `SELECT id FROM admin_cash_accounts WHERE admin_id = $1 LIMIT 1;`,
            [adminId]
          );
          const cashAccountId = cashAccRes.rows[0]?.id;
          if (cashAccountId) {
            const cashTxRes = await tx.query<{ id: string }>(
              `INSERT INTO cash_transactions (
                account_id,
                amount_paise,
                direction,
                transaction_type,
                domain_entity_type,
                domain_entity_id,
                correlation_id,
                notes,
                recorded_by_admin_id
              ) VALUES ($1, $2, 'CREDIT', 'COLLECTION_DEPOSIT', 'DAILY_SHEET', $3, $4, $5, $6)
              RETURNING id;`,
              [
                cashAccountId,
                actualPaidPaise,
                created.id,
                payload.idempotencyKey ?? created.id,
                `Daily sheet collection deposit for member ${member.memberNumber}`,
                adminId,
              ]
            );
            cashTxId = cashTxRes.rows[0]?.id ?? null;
          }
        }

        // 10b. Record collection financial event linking Daily Sheet, Member, and Cash Transaction
        await tx.query(
          `INSERT INTO collections (
            daily_sheet_id,
            member_id,
            amount_paise,
            payment_mode,
            cash_transaction_id,
            business_date,
            recorded_by_admin_id,
            collected_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            created.id,
            member.id,
            actualPaidPaise,
            paymentMode,
            cashTxId,
            payload.businessDate,
            adminId,
            paymentTime ? new Date(paymentTime) : new Date(),
          ]
        );
      }

      // Enrich with resolved member identity
      return {
        ...created,
        memberNumber: member.memberNumber,
        memberName: member.memberName,
      };
    };

    if (context?.tx) {
      return runInTx(context.tx);
    }
    return withTransaction(runInTx);
  }

  /**
   * Retrieves a daily sheet entry by UUID.
   */
  async getDailySheetById(id: string, context?: ServiceContext): Promise<DailySheet> {
    const entry = await this.sheetRepo.findById(id, context?.tx);
    if (!entry) {
      throw new NotFoundError(`Daily sheet entry with ID "${id}" not found`);
    }
    return entry;
  }

  /**
   * Lists daily sheets with filtering and pagination.
   */
  async listDailySheets(
    filter: DailySheetListFilter,
    context?: ServiceContext
  ): Promise<PaginatedData<DailySheet>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const result = await this.sheetRepo.findMany(
      { ...filter, page, pageSize },
      context?.tx
    );

    const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

    return {
      items: result.items,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves daily sheet history for a member.
   */
  async getMemberDailySheetHistory(
    memberNumber: string,
    page = 1,
    pageSize = 20,
    context?: ServiceContext
  ): Promise<PaginatedData<DailySheet>> {
    const member = await this.memberRepo.findByMemberNumber(memberNumber, context?.tx);
    if (!member) {
      throw new NotFoundError(`Member with number "${memberNumber}" not found`);
    }

    return this.listDailySheets({ memberNumber, page, pageSize }, context);
  }

  /**
   * Corrects/voids an existing Daily Sheet entry in an auditable manner (Phase 6.6).
   *
   * Rules:
   * - Authorized roles: SUPER_ADMIN and ADMIN only. CASHIER is strictly blocked (403).
   * - Preserves the original Daily Sheet record (physical DELETE is strictly prohibited).
   * - Prevents duplicate correction of the same record (409 Conflict).
   * - Records an append-only audit record in daily_sheet_corrections.
   * - If the original entry had actualPaid > 0 and paymentMode === 'CASH', records an offsetting
   *   reversal in the cash ledger (cash_transactions) without mutating historical rows.
   */
  async correctDailySheet(
    sheetId: string,
    reason: string,
    adminId: string,
    adminRole: string,
    context?: ServiceContext
  ): Promise<{ dailySheet: DailySheet; correction: DailySheetCorrection }> {
    if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can correct daily sheet entries');
    }

    const runInTx = async (tx: Queryable) => {
      // 1. Resolve original sheet
      const original = await this.sheetRepo.findById(sheetId, tx);
      if (!original) {
        throw new NotFoundError(`Daily sheet entry with ID "${sheetId}" not found`);
      }

      // 2. Prevent duplicate correction
      const existingCorrection = await this.sheetRepo.findCorrectionBySheetId(sheetId, tx);
      if (existingCorrection) {
        throw new ConflictError(
          `Daily sheet entry for member "${original.memberNumber}" on date "${original.businessDate}" has already been corrected`
        );
      }

      // 3. If cash was collected, post an offsetting DEBIT reversal in cash_transactions
      let reversalCashTxId: string | null = null;
      if (original.actualPaidPaise > 0 && original.paymentMode === 'CASH') {
        const cashAccRes = await tx.query<{ id: string }>(
          `SELECT id FROM admin_cash_accounts WHERE admin_id = $1 LIMIT 1;`,
          [adminId]
        );
        const cashAccountId = cashAccRes.rows[0]?.id;
        if (cashAccountId) {
          const cashTxRes = await tx.query<{ id: string }>(
            `INSERT INTO cash_transactions (
              account_id,
              amount_paise,
              direction,
              transaction_type,
              domain_entity_type,
              domain_entity_id,
              notes,
              recorded_by_admin_id
            ) VALUES ($1, $2, 'DEBIT', 'ADJUSTMENT', 'DAILY_SHEET_CORRECTION', $3, $4, $5)
            RETURNING id;`,
            [
              cashAccountId,
              original.actualPaidPaise,
              sheetId,
              `Correction reversal: ${reason}`,
              adminId,
            ]
          );
          reversalCashTxId = cashTxRes.rows[0]?.id ?? null;
        }
      }

      // 4. Record correction audit entry
      const correction = await this.sheetRepo.createCorrection(
        {
          originalDailySheetId: original.id,
          memberId: original.memberId,
          businessDate: original.businessDate,
          originalActualPaidPaise: original.actualPaidPaise,
          originalStatus: original.status,
          reason,
          reversalCashTransactionId: reversalCashTxId,
          correctedByAdminId: adminId,
        },
        tx
      );

      // 5. Fetch updated daily sheet reflecting correction metadata
      const updated = await this.sheetRepo.findById(sheetId, tx);

      return {
        dailySheet: updated!,
        correction,
      };
    };

    if (context?.tx) {
      return runInTx(context.tx);
    }
    return withTransaction(runInTx);
  }
}
