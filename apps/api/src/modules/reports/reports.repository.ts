import { BaseRepository } from '../../repositories/base.repository.js';
import type { Queryable } from '../../database/index.js';
import type { 
  DailyCollectionReportFilter, 
  CollectionsReportFilter, 
  LoanReportFilter, 
  RepaymentReportFilter, 
  MemberReportFilter, 
  GuarantorReportFilter, 
  CashReportFilter, 
  PaginatedReport 
} from './reports.types.js';

export class ReportsRepository extends BaseRepository {
  
  private buildPagination(page: number = 1, pageSize: number = 20, isExport: boolean = false) {
    if (isExport) {
      // Allow up to 10000 records for export to protect DB
      return { limit: 10000, offset: 0 };
    }
    const limit = Math.max(1, Math.min(pageSize, 100));
    const offset = (Math.max(1, page) - 1) * limit;
    return { limit, offset };
  }

  // 13.2 Daily Collection Report
  async getDailyCollections(filter: DailyCollectionReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        d.id,
        d.business_date as "date",
        m.member_number as "memberNumber",
        m.member_name as "memberName",
        m.shop_name as "shopName",
        d.number_of_sheets as "sheets",
        d.daily_due_amount_paise as "dailyDue",
        d.previous_arrears_paise as "previousArrears",
        d.total_due_paise as "totalDue",
        d.actual_paid_paise as "actualPaid",
        d.status,
        d.payment_mode as "paymentMode",
        d.payment_time as "paymentTime",
        a.username as "recordedAdmin"
      FROM daily_sheets d
      JOIN members m ON d.member_id = m.id
      LEFT JOIN admin_users a ON d.recorded_by_admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.dateFrom) {
      params.push(filter.dateFrom);
      query += ` AND d.business_date >= $${params.length}`;
    }
    if (filter.dateTo) {
      params.push(filter.dateTo);
      query += ` AND d.business_date <= $${params.length}`;
    }
    if (filter.memberNumber) {
      params.push(filter.memberNumber);
      query += ` AND m.member_number = $${params.length}`;
    }
    if (filter.memberName) {
      params.push(`%${filter.memberName}%`);
      query += ` AND m.member_name ILIKE $${params.length}`;
    }
    if ((filter as any).status) {
      params.push((filter as any).status);
      query += ` AND d.status = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM("totalDue"), 0) as total_due_sum,
        COALESCE(SUM("actualPaid"), 0) as total_paid_sum
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY d.business_date DESC, m.member_number ASC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalDue: parseInt(summaryResult.rows[0].total_due_sum || '0', 10),
        totalPaid: parseInt(summaryResult.rows[0].total_paid_sum || '0', 10),
        count: total
      }
    };
  }

  // 13.3 Collections Report
  async getCollections(filter: CollectionsReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        c.id,
        c.business_date as "date",
        m.member_number as "memberNumber",
        m.member_name as "memberName",
        c.amount_paise as "amount",
        c.payment_mode as "paymentMode",
        a.username as "recordedAdmin",
        c.daily_sheet_id as "dailySheetId"
      FROM collections c
      JOIN members m ON c.member_id = m.id
      LEFT JOIN admin_users a ON c.recorded_by_admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.dateFrom) {
      params.push(filter.dateFrom);
      query += ` AND c.business_date >= $${params.length}`;
    }
    if (filter.dateTo) {
      params.push(filter.dateTo);
      query += ` AND c.business_date <= $${params.length}`;
    }
    if (filter.memberNumber) {
      params.push(filter.memberNumber);
      query += ` AND m.member_number = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY c.created_at DESC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: parseInt(summaryResult.rows[0].total_amount || '0', 10),
        count: total
      }
    };
  }

  // 13.4 Loan Report
  async getLoans(filter: LoanReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        l.id,
        m.member_number as "memberNumber",
        m.member_name as "memberName",
        m.shop_name as "shopName",
        l.requested_amount_paise as "requestedAmount",
        l.approved_amount_paise as "approvedAmount",
        l.status,
        l.application_date as "applicationDate",
        l.disbursement_date as "disbursementDate",
        l.max_due_date as "maxDueDate",
        (SELECT COALESCE(SUM(amount_paise), 0) FROM loan_repayments WHERE loan_id = l.id) as "totalRepaid",
        (l.requested_amount_paise - (SELECT COALESCE(SUM(amount_paise), 0) FROM loan_repayments WHERE loan_id = l.id)) as "derivedOutstanding"
      FROM loans l
      JOIN members m ON l.member_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.dateFrom) {
      params.push(filter.dateFrom);
      query += ` AND l.application_date >= $${params.length}`;
    }
    if (filter.dateTo) {
      params.push(filter.dateTo);
      query += ` AND l.application_date <= $${params.length}`;
    }
    if (filter.memberNumber) {
      params.push(filter.memberNumber);
      query += ` AND m.member_number = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      query += ` AND l.status = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM("requestedAmount"), 0) as total_requested,
        COALESCE(SUM("derivedOutstanding"), 0) as total_outstanding
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY l.created_at DESC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalRequested: parseInt(summaryResult.rows[0].total_requested || '0', 10),
        totalOutstanding: parseInt(summaryResult.rows[0].total_outstanding || '0', 10),
        count: total
      }
    };
  }

  // 13.5 Repayment Report
  async getRepayments(filter: RepaymentReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        r.id,
        r.loan_id as "loanId",
        m.member_number as "memberNumber",
        m.member_name as "memberName",
        r.repayment_date as "repaymentDate",
        r.amount_paise as "amount",
        r.payment_mode as "paymentMode",
        a.username as "recordedAdmin"
      FROM loan_repayments r
      JOIN loans l ON r.loan_id = l.id
      JOIN members m ON l.member_id = m.id
      LEFT JOIN admin_users a ON r.recorded_by_admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.dateFrom) {
      params.push(filter.dateFrom);
      query += ` AND r.repayment_date >= $${params.length}`;
    }
    if (filter.dateTo) {
      params.push(filter.dateTo);
      query += ` AND r.repayment_date <= $${params.length}`;
    }
    if (filter.memberNumber) {
      params.push(filter.memberNumber);
      query += ` AND m.member_number = $${params.length}`;
    }
    if (filter.loanId) {
      params.push(filter.loanId);
      query += ` AND r.loan_id = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY r.created_at DESC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: parseInt(summaryResult.rows[0].total_amount || '0', 10),
        count: total
      }
    };
  }

  // 13.6 Member Report
  async getMembers(filter: MemberReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        m.member_number as "memberNumber",
        m.member_name as "memberName",
        m.related_person_name as "relatedPerson",
        m.shop_name as "shopName",
        m.mobile_number as "mobile",
        m.number_of_sheets as "sheets",
        m.nominee_name as "nominee",
        m.insurance_number as "insurance",
        m.status,
        m.created_at as "createdDate"
      FROM members m
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.memberNumber) {
      params.push(filter.memberNumber);
      query += ` AND m.member_number = $${params.length}`;
    }
    if (filter.memberName) {
      params.push(`%${filter.memberName}%`);
      query += ` AND m.member_name ILIKE $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      query += ` AND m.status = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    query += ` ORDER BY m.member_number ASC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: { count: total }
    };
  }

  // 13.7 Guarantor Report
  async getGuarantors(filter: GuarantorReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        g.loan_id as "loanId",
        bm.member_number as "borrowerMemberNumber",
        bm.member_name as "borrowerName",
        gm.member_number as "guarantorMemberNumber",
        gm.member_name as "guarantorName",
        g.responsibility_amount_paise as "assignedResponsibility",
        g.status as "guarantorStatus",
        l.status as "loanStatus",
        l.requested_amount_paise as "loanAmount",
        (l.requested_amount_paise - (SELECT COALESCE(SUM(amount_paise), 0) FROM loan_repayments WHERE loan_id = l.id)) as "derivedLoanOutstanding"
      FROM loan_guarantors g
      JOIN loans l ON g.loan_id = l.id
      JOIN members bm ON l.member_id = bm.id
      JOIN members gm ON g.guarantor_member_id = gm.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.guarantorMemberNumber) {
      params.push(filter.guarantorMemberNumber);
      query += ` AND gm.member_number = $${params.length}`;
    }
    if (filter.borrowerMemberNumber) {
      params.push(filter.borrowerMemberNumber);
      query += ` AND bm.member_number = $${params.length}`;
    }
    if (filter.loanId) {
      params.push(filter.loanId);
      query += ` AND g.loan_id = $${params.length}`;
    }
    if (filter.loanStatus) {
      params.push(filter.loanStatus);
      query += ` AND l.status = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM("assignedResponsibility"), 0) as total_responsibility
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY g.created_at DESC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalResponsibility: parseInt(summaryResult?.rows?.[0]?.total_responsibility || '0', 10),
        count: total
      }
    };
  }

  // 13.8 Cash / Admin Report
  async getCashLedger(filter: CashReportFilter, client?: Queryable): Promise<PaginatedReport<any>> {
    const q = this.resolveExecutor(client);
    let query = `
      SELECT 
        l.id,
        a.username as "admin",
        l.transacted_at as "date",
        l.transaction_type as "type",
        l.amount_paise as "amount",
        l.direction,
        l.correlation_id as "referenceId",
        l.notes
      FROM cash_transactions l
      JOIN admin_cash_accounts ca ON l.account_id = ca.id
      JOIN admin_users a ON ca.admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filter.dateFrom) {
      params.push(filter.dateFrom);
      query += ` AND l.transacted_at >= $${params.length}`;
    }
    if (filter.dateTo) {
      params.push(filter.dateTo);
      query += ` AND l.transacted_at <= $${params.length}`;
    }
    if (filter.transactionType) {
      params.push(filter.transactionType);
      query += ` AND l.transaction_type = $${params.length}`;
    }
    if (filter.direction) {
      params.push(filter.direction);
      query += ` AND l.direction = $${params.length}`;
    }
    
    const countResult = await q.query(`SELECT COUNT(*) FROM (${query}) as t`, params);
    const total = parseInt(countResult?.rows?.[0]?.count || '0', 10);
    
    const summaryResult = await q.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) as total_out
      FROM (${query}) as t
    `, params);

    query += ` ORDER BY l.transacted_at DESC, l.created_at DESC`;
    const { limit, offset } = this.buildPagination(filter.page, filter.pageSize, filter.export);
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await q.query(query, params);
    
    const totalIn = parseInt(summaryResult.rows[0].total_in || '0', 10);
    const totalOut = parseInt(summaryResult.rows[0].total_out || '0', 10);

    return {
      items: result.rows,
      total,
      page: filter.export ? 1 : (filter.page || 1),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalCredits: totalIn,
        totalDebits: totalOut,
        derivedBalance: totalIn - totalOut,
        count: total
      }
    };
  }
}
