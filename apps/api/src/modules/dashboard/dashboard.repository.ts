import { getDbPool, type Queryable } from '../../database/index.js';
import type { DashboardSummaryResponse, RecentTransaction } from './dashboard.types.js';

export class DashboardRepository {
  private async getCurrentBusinessDate(tx: Queryable = getDbPool()): Promise<string> {
    // Determine the association business date in IST
    const result = await tx.query(`SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date as business_date`);
    const dateStr = result.rows[0].business_date as Date;
    // Format as YYYY-MM-DD
    const yyyy = dateStr.getFullYear();
    const mm = String(dateStr.getMonth() + 1).padStart(2, '0');
    const dd = String(dateStr.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async getDashboardSummary(tx: Queryable = getDbPool()): Promise<DashboardSummaryResponse> {
    const businessDate = await this.getCurrentBusinessDate(tx);

    // Core Metrics
    const memberResult = await tx.query(`
      SELECT 
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_members,
        COUNT(*) FILTER (WHERE status = 'INACTIVE') as inactive_members
      FROM members;
    `);

    // Collection Metrics
    // Today, Weekly, Monthly, Yearly collection based on the authoritative business date
    const collectionResult = await tx.query(`
      SELECT 
        COALESCE(SUM(amount_paise) FILTER (WHERE business_date = $1), 0) as today_collection_amount,
        COUNT(*) FILTER (WHERE business_date = $1) as today_collection_count,
        COALESCE(SUM(amount_paise) FILTER (WHERE business_date >= date_trunc('week', $1::date)), 0) as weekly_collection_amount,
        COALESCE(SUM(amount_paise) FILTER (WHERE business_date >= date_trunc('month', $1::date)), 0) as monthly_collection_amount,
        COALESCE(SUM(amount_paise) FILTER (WHERE business_date >= date_trunc('year', $1::date)), 0) as yearly_collection_amount
      FROM collections;
    `, [businessDate]);

    // Pending and Advance from Daily Sheets
    const dailySheetResult = await tx.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('NOT_PAID', 'PARTIAL', 'OVERDUE')) as pending_count,
        COUNT(*) FILTER (WHERE status IN ('ADVANCE_PAID', 'ADVANCE_COVERED')) as advance_count,
        COALESCE(SUM(total_due_paise), 0) as expected_today_amount
      FROM daily_sheets
      WHERE business_date = $1;
    `, [businessDate]);

    // Cumulative collection amount
    const totalCollectionResult = await tx.query(`
      SELECT 
        COALESCE(SUM(amount_paise), 0) as total_collection_amount
      FROM collections;
    `);

    // Loan Metrics
    const loanResult = await tx.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_loans,
        COUNT(*) FILTER (WHERE status = 'PARTIALLY_REPAID') as partially_repaid_loans,
        COUNT(*) FILTER (WHERE status = 'CLOSED') as closed_loans
      FROM loans;
    `);

    // Outstanding = Total Disbursed - Total Repaid (Accepted)
    const disbursedResult = await tx.query(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_disbursed
      FROM loan_disbursements
      WHERE status = 'COMPLETED';
    `);
    
    const repaidResult = await tx.query(`
      SELECT 
        COALESCE(SUM(amount_paise), 0) as total_repaid,
        COALESCE(SUM(amount_paise) FILTER (WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $1::date), 0) as today_repaid
      FROM loan_repayments;
    `, [businessDate]);

    const totalDisbursed = BigInt(disbursedResult.rows[0]?.total_disbursed ?? 0);
    const totalRepaid = BigInt(repaidResult.rows[0]?.total_repaid ?? 0);
    const outstanding = totalDisbursed - totalRepaid;

    // Overdue Metrics
    const overdueResult = await tx.query(`
      SELECT COUNT(*) as overdue_count
      FROM loans
      WHERE status = 'OVERDUE';
    `);

    // Cash Metrics
    const cashResult = await tx.query(`
      SELECT 
        account_id,
        admin_id,
        account_name,
        balance_paise
      FROM v_admin_cash_balances;
    `);

    let totalCash = 0n;
    const adminWiseCash = cashResult.rows.map(row => {
      const balance = BigInt(row.balance_paise);
      totalCash += balance;
      return {
        accountId: row.account_id,
        adminId: row.admin_id,
        accountName: row.account_name,
        balancePaise: Number(balance)
      };
    });

    return {
      coreMetrics: {
        totalMembers: Number(memberResult.rows[0]?.total_members ?? 0),
        activeMembers: Number(memberResult.rows[0]?.active_members ?? 0),
        inactiveMembers: Number(memberResult.rows[0]?.inactive_members ?? 0)
      },
      collectionMetrics: {
        todayCollectionAmountPaise: Number(collectionResult.rows[0]?.today_collection_amount ?? 0),
        weeklyCollectionAmountPaise: Number(collectionResult.rows[0]?.weekly_collection_amount ?? 0),
        monthlyCollectionAmountPaise: Number(collectionResult.rows[0]?.monthly_collection_amount ?? 0),
        yearlyCollectionAmountPaise: Number(collectionResult.rows[0]?.yearly_collection_amount ?? 0),
        todayCollectionCount: Number(collectionResult.rows[0]?.today_collection_count ?? 0),
        pendingCollectionsCount: Number(dailySheetResult.rows[0]?.pending_count ?? 0),
        advanceCollectionsCount: Number(dailySheetResult.rows[0]?.advance_count ?? 0),
        totalCollectionAmountPaise: Number(totalCollectionResult.rows[0]?.total_collection_amount ?? 0),
        expectedTodayAmountPaise: Number(dailySheetResult.rows[0]?.expected_today_amount ?? 0)
      },
      loanMetrics: {
        totalLoans: Number(loanResult.rows[0]?.total_loans ?? 0),
        activeLoans: Number(loanResult.rows[0]?.active_loans ?? 0),
        partiallyRepaidLoans: Number(loanResult.rows[0]?.partially_repaid_loans ?? 0),
        closedLoans: Number(loanResult.rows[0]?.closed_loans ?? 0),
        totalLoansGivenPaise: Number(totalDisbursed),
        totalLoanRepaidPaise: Number(totalRepaid),
        todayLoanRepaidPaise: Number(repaidResult.rows[0]?.today_repaid ?? 0),
        outstandingLoansPaise: Number(outstanding)
      },
      cashMetrics: {
        totalCashInHandPaise: Number(totalCash),
        adminWiseCash
      },
      overdueMetrics: {
        status: 'AVAILABLE',
        overdueCount: Number(overdueResult.rows[0]?.overdue_count ?? 0)
      },
      businessDate: businessDate
    };
  }

  async getRecentTransactions(limit = 10, tx: Queryable = getDbPool()): Promise<RecentTransaction[]> {
    // Using UNION ALL across the different authoritative tables
    // To ensure this is performant, we limit inside the subqueries or just union limited results.
    // Given the simplicity and scale for this MVP, a UNION ALL with a top-level order and limit is fine.

    const result = await tx.query(`
      WITH combined_transactions AS (
        SELECT 
          c.id as id,
          c.collected_at as transacted_at,
          'COLLECTION' as transaction_type,
          m.member_number as reference_id,
          m.id as member_id,
          m.member_name as member_name,
          c.amount_paise as amount_paise,
          'CREDIT' as direction
        FROM collections c
        JOIN members m ON c.member_id = m.id

        UNION ALL

        SELECT
          d.id as id,
          d.created_at as transacted_at,
          'LOAN_DISBURSEMENT' as transaction_type,
          l.id::text as reference_id,
          m.id as member_id,
          m.member_name as member_name,
          d.amount_paise as amount_paise,
          'DEBIT' as direction
        FROM loan_disbursements d
        JOIN loans l ON d.loan_id = l.id
        JOIN members m ON l.member_id = m.id
        WHERE d.status = 'COMPLETED'

        UNION ALL

        SELECT
          r.id as id,
          r.created_at as transacted_at,
          'LOAN_REPAYMENT' as transaction_type,
          r.reference_number as reference_id,
          m.id as member_id,
          m.member_name as member_name,
          r.amount_paise as amount_paise,
          'CREDIT' as direction
        FROM loan_repayments r
        JOIN loans l ON r.loan_id = l.id
        JOIN members m ON l.member_id = m.id
      )
      SELECT * 
      FROM combined_transactions
      ORDER BY transacted_at DESC
      LIMIT $1;
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      transactedAt: row.transacted_at.toISOString(),
      transactionType: row.transaction_type,
      referenceId: row.reference_id || 'N/A',
      memberId: row.member_id,
      memberName: row.member_name,
      amountPaise: Number(row.amount_paise),
      direction: row.direction
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
