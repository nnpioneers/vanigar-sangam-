const fs = require('fs');
let content = fs.readFileSync('apps/api/src/modules/daily-sheets/daily-sheets.controller.ts', 'utf8');

const oldSavings = `     let dailySheet = null;
     if (savingsAmountPaise > 0) {
        // Fetch member details to satisfy database constraints
        const memRes = await pool.query(\`SELECT number_of_sheets FROM members WHERE id = $1\`, [memberId]);
        const numSheets = memRes.rows[0]?.number_of_sheets || 1;

        const res1 = await pool.query(\`
          INSERT INTO daily_sheets (
            member_id, business_date, actual_paid_paise, status, recorded_by_admin_id,
            number_of_sheets, daily_due_amount_paise, previous_arrears_paise, total_due_paise
          )
          VALUES ($1, $2, $3, 'PAID', $4, $5, $3, 0, $3) RETURNING id
        \`, [memberId, businessDate, savingsAmountPaise, adminId, numSheets]);
        dailySheet = { id: res1.rows[0].id, memberId, actualPaidPaise: savingsAmountPaise };
     }`;

const newSavings = `     let dailySheet = null;
     const existSheet = await pool.query(\`SELECT id FROM daily_sheets WHERE member_id = $1 AND business_date = $2\`, [memberId, businessDate]);
     const memRes = await pool.query(\`SELECT number_of_sheets FROM members WHERE id = $1\`, [memberId]);
     const numSheets = memRes.rows[0]?.number_of_sheets || 1;

     if (existSheet.rows.length > 0) {
        await pool.query(\`
           UPDATE daily_sheets 
           SET actual_paid_paise = $1, status = $2, recorded_by_admin_id = $3
           WHERE member_id = $4 AND business_date = $5
        \`, [savingsAmountPaise, savingsAmountPaise > 0 ? 'PAID' : 'NOT_PAID', adminId, memberId, businessDate]);
        dailySheet = { memberId, actualPaidPaise: savingsAmountPaise };
     } else {
        const res1 = await pool.query(\`
          INSERT INTO daily_sheets (
            member_id, business_date, actual_paid_paise, status, recorded_by_admin_id,
            number_of_sheets, daily_due_amount_paise, previous_arrears_paise, total_due_paise
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $7) RETURNING id
        \`, [memberId, businessDate, savingsAmountPaise, savingsAmountPaise > 0 ? 'PAID' : 'NOT_PAID', adminId, numSheets, savingsAmountPaise > 0 ? savingsAmountPaise : 0]);
        dailySheet = { id: res1.rows[0].id, memberId, actualPaidPaise: savingsAmountPaise };
     }`;

content = content.replace(oldSavings, newSavings);

const oldLoan = `     let repayment = null;
     if (loanAmountPaise > 0 && loanId) {
        const res2 = await pool.query(\`
          INSERT INTO loan_repayments (loan_id, repayment_date, amount_paise, recorded_by_admin_id, payment_mode)
          VALUES ($1, $2, $3, $4, 'CASH') RETURNING id
        \`, [loanId, businessDate, loanAmountPaise, adminId]);
        repayment = { id: res2.rows[0].id, loanId, amountPaise: loanAmountPaise };
     }`;

const newLoan = `     let repayment = null;
     if (loanId) {
        const existLoan = await pool.query(\`SELECT id FROM loan_repayments WHERE loan_id = $1 AND repayment_date = $2\`, [loanId, businessDate]);
        if (existLoan.rows.length > 0) {
           if (loanAmountPaise > 0) {
               await pool.query(\`UPDATE loan_repayments SET amount_paise = $1, recorded_by_admin_id = $2 WHERE loan_id = $3 AND repayment_date = $4\`, [loanAmountPaise, adminId, loanId, businessDate]);
           } else {
               await pool.query(\`DELETE FROM loan_repayments WHERE loan_id = $1 AND repayment_date = $2\`, [loanId, businessDate]);
           }
        } else if (loanAmountPaise > 0) {
           const res2 = await pool.query(\`
             INSERT INTO loan_repayments (loan_id, repayment_date, amount_paise, recorded_by_admin_id, payment_mode)
             VALUES ($1, $2, $3, $4, 'CASH') RETURNING id
           \`, [loanId, businessDate, loanAmountPaise, adminId]);
           repayment = { id: res2.rows[0].id, loanId, amountPaise: loanAmountPaise };
        }
     }`;

content = content.replace(oldLoan, newLoan);

fs.writeFileSync('apps/api/src/modules/daily-sheets/daily-sheets.controller.ts', content);
console.log("Fixed API controller to UPSERT payments.");
