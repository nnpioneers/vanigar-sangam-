/**
 * Collections Repository (Phase 6.8)
 *
 * Handles database persistence, querying, and financial recap aggregation for Collections.
 */

import { BaseRepository } from '../../repositories/base.repository.js';
import type { Queryable } from '../../database/index.js';
import type {
  Collection,
  CollectionListFilter,
  CollectionListResult,
  CollectionSummary,
  CreateCollectionInput,
} from './collections.types.js';

interface CollectionRow {
  id: string;
  dailySheetId: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  amountPaise: string;
  paymentMode: string;
  cashTransactionId: string | null;
  businessDate: string;
  recordedByAdminId: string;
  recordedByAdminName: string | null;
  collectedAt: Date | string;
  createdAt: Date | string;
  status: 'COLLECTED' | 'CORRECTED';
  isCorrected: boolean;
  correctionReason: string | null;
  correctedAt: Date | string | null;
}

interface SummaryRow {
  totalCount: string;
  activeCount: string;
  correctedCount: string;
  totalAmountPaise: string;
  totalGrossAmountPaise: string;
  correctedAmountPaise: string;
  cashAmountPaise: string;
  digitalAmountPaise: string;
}

function mapRowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    dailySheetId: row.dailySheetId,
    memberId: row.memberId,
    memberNumber: row.memberNumber,
    memberName: row.memberName,
    amountPaise: Number(row.amountPaise),
    paymentMode: row.paymentMode as Collection['paymentMode'],
    cashTransactionId: row.cashTransactionId,
    businessDate: typeof row.businessDate === 'string' ? row.businessDate.slice(0, 10) : new Date(row.businessDate).toISOString().slice(0, 10),
    recordedByAdminId: row.recordedByAdminId,
    recordedByAdminName: row.recordedByAdminName,
    collectedAt: row.collectedAt instanceof Date ? row.collectedAt.toISOString() : new Date(row.collectedAt).toISOString(),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
    status: row.status,
    isCorrected: Boolean(row.isCorrected),
    correctionReason: row.correctionReason ?? null,
    correctedAt: row.correctedAt ? (row.correctedAt instanceof Date ? row.correctedAt.toISOString() : new Date(row.correctedAt).toISOString()) : null,
  };
}

export class CollectionsRepository extends BaseRepository {
  /**
   * Persists a new collection financial event atomically linked to a daily sheet.
   */
  async create(input: CreateCollectionInput, tx?: Queryable): Promise<Collection> {
    const res = await this.query<{ id: string }>(
      `INSERT INTO collections (
        daily_sheet_id,
        member_id,
        amount_paise,
        payment_mode,
        cash_transaction_id,
        business_date,
        recorded_by_admin_id,
        collected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
      RETURNING id;`,
      [
        input.dailySheetId,
        input.memberId,
        input.amountPaise,
        input.paymentMode,
        input.cashTransactionId ?? null,
        input.businessDate,
        input.recordedByAdminId,
        input.collectedAt ?? null,
      ],
      tx
    );

    const first = res[0];
    if (!first) {
      throw new Error(`Failed to retrieve newly created collection`);
    }
    const createdId = first.id;
    const item = await this.findById(createdId, tx);
    if (!item) {
      throw new Error(`Failed to retrieve newly created collection ${createdId}`);
    }
    return item;
  }

  /**
   * Resolves a collection event by UUID with joined member, admin, and correction details.
   */
  async findById(id: string, tx?: Queryable): Promise<Collection | null> {
    const rows = await this.query<CollectionRow>(
      `SELECT
        c.id,
        c.daily_sheet_id AS "dailySheetId",
        c.member_id AS "memberId",
        m.member_number AS "memberNumber",
        m.member_name AS "memberName",
        c.amount_paise::text AS "amountPaise",
        c.payment_mode AS "paymentMode",
        c.cash_transaction_id AS "cashTransactionId",
        c.business_date::text AS "businessDate",
        c.recorded_by_admin_id AS "recordedByAdminId",
        u.full_name AS "recordedByAdminName",
        c.collected_at AS "collectedAt",
        c.created_at AS "createdAt",
        CASE WHEN dsc.id IS NOT NULL THEN 'CORRECTED' ELSE 'COLLECTED' END AS "status",
        (dsc.id IS NOT NULL) AS "isCorrected",
        dsc.reason AS "correctionReason",
        dsc.created_at AS "correctedAt"
      FROM collections c
      INNER JOIN members m ON m.id = c.member_id
      LEFT JOIN admin_users u ON u.id = c.recorded_by_admin_id
      LEFT JOIN daily_sheet_corrections dsc ON dsc.original_daily_sheet_id = c.daily_sheet_id
      WHERE c.id = $1
      LIMIT 1;`,
      [id],
      tx
    );

    const first = rows[0];
    if (!first) {
      return null;
    }
    return mapRowToCollection(first);
  }

  /**
   * Resolves a collection event by originating dailySheetId.
   */
  async findByDailySheetId(dailySheetId: string, tx?: Queryable): Promise<Collection | null> {
    const rows = await this.query<CollectionRow>(
      `SELECT
        c.id,
        c.daily_sheet_id AS "dailySheetId",
        c.member_id AS "memberId",
        m.member_number AS "memberNumber",
        m.member_name AS "memberName",
        c.amount_paise::text AS "amountPaise",
        c.payment_mode AS "paymentMode",
        c.cash_transaction_id AS "cashTransactionId",
        c.business_date::text AS "businessDate",
        c.recorded_by_admin_id AS "recordedByAdminId",
        u.full_name AS "recordedByAdminName",
        c.collected_at AS "collectedAt",
        c.created_at AS "createdAt",
        CASE WHEN dsc.id IS NOT NULL THEN 'CORRECTED' ELSE 'COLLECTED' END AS "status",
        (dsc.id IS NOT NULL) AS "isCorrected",
        dsc.reason AS "correctionReason",
        dsc.created_at AS "correctedAt"
      FROM collections c
      INNER JOIN members m ON m.id = c.member_id
      LEFT JOIN admin_users u ON u.id = c.recorded_by_admin_id
      LEFT JOIN daily_sheet_corrections dsc ON dsc.original_daily_sheet_id = c.daily_sheet_id
      WHERE c.daily_sheet_id = $1
      LIMIT 1;`,
      [dailySheetId],
      tx
    );

    const first = rows[0];
    if (!first) {
      return null;
    }
    return mapRowToCollection(first);
  }

  /**
   * Lists collections with filtering, pagination, and authoritative financial summaries.
   */
  async findCollections(
    filter: CollectionListFilter,
    tx?: Queryable
  ): Promise<CollectionListResult> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.businessDate) {
      conditions.push(`c.business_date = $${paramIndex++}`);
      params.push(filter.businessDate);
    }

    if (filter.startDate) {
      conditions.push(`c.business_date >= $${paramIndex++}`);
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`c.business_date <= $${paramIndex++}`);
      params.push(filter.endDate);
    }

    if (filter.memberNumber) {
      conditions.push(`m.member_number ILIKE $${paramIndex++}`);
      params.push(`%${filter.memberNumber.trim()}%`);
    }

    if (filter.paymentMode) {
      conditions.push(`c.payment_mode = $${paramIndex++}`);
      params.push(filter.paymentMode);
    }

    if (filter.status === 'COLLECTED') {
      conditions.push(`dsc.id IS NULL`);
    } else if (filter.status === 'CORRECTED') {
      conditions.push(`dsc.id IS NOT NULL`);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Fetch Aggregated Financial Summary
    const summaryQuery = `
      SELECT
        COUNT(c.id)::text AS "totalCount",
        COUNT(CASE WHEN dsc.id IS NULL THEN 1 END)::text AS "activeCount",
        COUNT(CASE WHEN dsc.id IS NOT NULL THEN 1 END)::text AS "correctedCount",
        COALESCE(SUM(CASE WHEN dsc.id IS NULL THEN c.amount_paise ELSE 0 END), 0)::text AS "totalAmountPaise",
        COALESCE(SUM(c.amount_paise), 0)::text AS "totalGrossAmountPaise",
        COALESCE(SUM(CASE WHEN dsc.id IS NOT NULL THEN c.amount_paise ELSE 0 END), 0)::text AS "correctedAmountPaise",
        COALESCE(SUM(CASE WHEN dsc.id IS NULL AND c.payment_mode = 'CASH' THEN c.amount_paise ELSE 0 END), 0)::text AS "cashAmountPaise",
        COALESCE(SUM(CASE WHEN dsc.id IS NULL AND c.payment_mode != 'CASH' THEN c.amount_paise ELSE 0 END), 0)::text AS "digitalAmountPaise"
      FROM collections c
      INNER JOIN members m ON m.id = c.member_id
      LEFT JOIN daily_sheet_corrections dsc ON dsc.original_daily_sheet_id = c.daily_sheet_id
      WHERE ${whereClause};
    `;

    const summaryRows = await this.query<SummaryRow>(summaryQuery, params, tx);
    const summaryRaw = summaryRows[0];

    const summary: CollectionSummary = {
      totalCount: Number(summaryRaw?.totalCount || 0),
      activeCount: Number(summaryRaw?.activeCount || 0),
      correctedCount: Number(summaryRaw?.correctedCount || 0),
      totalAmountPaise: Number(summaryRaw?.totalAmountPaise || 0),
      totalGrossAmountPaise: Number(summaryRaw?.totalGrossAmountPaise || 0),
      correctedAmountPaise: Number(summaryRaw?.correctedAmountPaise || 0),
      cashAmountPaise: Number(summaryRaw?.cashAmountPaise || 0),
      digitalAmountPaise: Number(summaryRaw?.digitalAmountPaise || 0),
    };

    const totalCount = summary.totalCount;
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20));
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    // 2. Fetch Paginated Records with explicit columns
    const listParams = [...params, pageSize, offset];
    const listQuery = `
      SELECT
        c.id,
        c.daily_sheet_id AS "dailySheetId",
        c.member_id AS "memberId",
        m.member_number AS "memberNumber",
        m.member_name AS "memberName",
        c.amount_paise::text AS "amountPaise",
        c.payment_mode AS "paymentMode",
        c.cash_transaction_id AS "cashTransactionId",
        c.business_date::text AS "businessDate",
        c.recorded_by_admin_id AS "recordedByAdminId",
        u.full_name AS "recordedByAdminName",
        c.collected_at AS "collectedAt",
        c.created_at AS "createdAt",
        CASE WHEN dsc.id IS NOT NULL THEN 'CORRECTED' ELSE 'COLLECTED' END AS "status",
        (dsc.id IS NOT NULL) AS "isCorrected",
        dsc.reason AS "correctionReason",
        dsc.created_at AS "correctedAt"
      FROM collections c
      INNER JOIN members m ON m.id = c.member_id
      LEFT JOIN admin_users u ON u.id = c.recorded_by_admin_id
      LEFT JOIN daily_sheet_corrections dsc ON dsc.original_daily_sheet_id = c.daily_sheet_id
      WHERE ${whereClause}
      ORDER BY c.business_date DESC, c.collected_at DESC, c.created_at DESC, c.id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRows = await this.query<CollectionRow>(listQuery, listParams, tx);
    const items = listRows.map(mapRowToCollection);

    return {
      items,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
    };
  }
}
