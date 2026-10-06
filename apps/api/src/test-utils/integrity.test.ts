import 'dotenv/config';
import { getDbPool } from '../database/index.js';
const pool = getDbPool();

async function check() {
  console.log("Checking Data Integrity:");
  
  // 1. no duplicate (loan_id, guarantor_member_id)
  const dupCheck = await pool.query(`SELECT loan_id, guarantor_member_id, COUNT(*) FROM loan_guarantors GROUP BY loan_id, guarantor_member_id HAVING COUNT(*) > 1`);
  console.log(`- Duplicate (loan_id, guarantor_member_id): ${dupCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + dupCheck.rowCount + ')'}`);

  // 2. no loan has more than 3 guarantors
  const max3Check = await pool.query(`SELECT loan_id, COUNT(*) FROM loan_guarantors GROUP BY loan_id HAVING COUNT(*) > 3`);
  console.log(`- More than 3 guarantors: ${max3Check.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + max3Check.rowCount + ')'}`);

  // 3. no loan has total guarantor responsibility greater than loan amount
  const maxRespCheck = await pool.query(`
    SELECT g.loan_id 
    FROM loan_guarantors g 
    JOIN loans l ON g.loan_id = l.id 
    GROUP BY g.loan_id, l.requested_amount_paise 
    HAVING SUM(g.responsibility_amount_paise) > l.requested_amount_paise
  `);
  console.log(`- Responsibility exceeds loan amount: ${maxRespCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + maxRespCheck.rowCount + ')'}`);

  // 4. no guarantor has zero/negative responsibility
  const negCheck = await pool.query(`SELECT id FROM loan_guarantors WHERE responsibility_amount_paise <= 0`);
  console.log(`- Zero/Negative responsibility: ${negCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + negCheck.rowCount + ')'}`);

  // 5. no borrower is their own guarantor
  const selfCheck = await pool.query(`
    SELECT g.id 
    FROM loan_guarantors g 
    JOIN loans l ON g.loan_id = l.id 
    WHERE g.guarantor_member_id = l.member_id
  `);
  console.log(`- Borrower is own guarantor: ${selfCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + selfCheck.rowCount + ')'}`);
  
  process.exit(0);
}

check().catch(console.error);
