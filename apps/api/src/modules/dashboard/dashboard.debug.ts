import { loadLocalEnv } from '@vanigar/config';
loadLocalEnv();
import { getDbPool, closeDbPool } from '../../database/index.js';

const pool = getDbPool();
try {
  // Run the full summary query to see where it fails
  const bd = await pool.query(`SELECT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date as business_date`);
  const businessDate = bd.rows[0].business_date;
  console.log('businessDate:', businessDate, typeof businessDate);

  const disbursedResult = await pool.query(`
    SELECT COALESCE(SUM(amount_paise), 0) as total_disbursed
    FROM loan_disbursements
    WHERE status = 'COMPLETED';
  `);
  console.log('disbursed:', disbursedResult.rows[0]);

  const repaidResult = await pool.query(`SELECT COALESCE(SUM(amount_paise), 0) as total_repaid FROM loan_repayments;`);
  console.log('repaid:', repaidResult.rows[0]);

  const cashResult = await pool.query(`SELECT account_id, admin_id, account_name, balance_paise FROM v_admin_cash_balances;`);
  console.log('cash rows:', cashResult.rows);

  // Try BigInt conversion
  const totalDisbursed = BigInt(disbursedResult.rows[0].total_disbursed);
  const totalRepaid = BigInt(repaidResult.rows[0].total_repaid);
  console.log('BigInt totalDisbursed:', totalDisbursed);
  console.log('BigInt totalRepaid:', totalRepaid);

  // Check businessDate type for date comparison
  const collResult = await pool.query(`
    SELECT COALESCE(SUM(amount_paise), 0) as today_collection_amount, COUNT(*) as today_collection_count
    FROM collections WHERE business_date = $1;
  `, [businessDate]);
  console.log('collections today:', collResult.rows[0]);

  const cashRow = cashResult.rows[0];
  if (cashRow) {
    console.log('balance_paise type:', typeof cashRow.balance_paise, cashRow.balance_paise);
    const bal = BigInt(cashRow.balance_paise);
    console.log('BigInt balance:', bal);
  }

  console.log('All queries OK');
} catch(e: any) { console.error('ERROR:', e.message, e.stack); }
await closeDbPool();
