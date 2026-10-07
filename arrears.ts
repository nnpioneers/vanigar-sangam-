import { getDbPool } from '../../lib/db.js';

export async function getMemberArrearsController(req: Request, res: Response): Promise<void> {
  const { memberId } = req.params;
  try {
    const pool = getDbPool();
    // Fetch member
    const memberRes = await pool.query('SELECT join_date, number_of_sheets FROM members WHERE id = $1', [memberId]);
    if (!memberRes.rows.length) { res.status(404).json({ error: { message: 'Member not found' } }); return; }
    
    const member = memberRes.rows[0];
    const dailyAmt = (member.number_of_sheets || 1) * 200 * 100;
    
    // Fetch loans
    const loanRes = await pool.query('SELECT id, approved_amount_paise FROM loans WHERE member_id = $1 AND status IN ('ACTIVE', 'PARTIALLY_REPAID')', [memberId]);
    const hasLoan = loanRes.rows.length > 0;
    const loanAmt = hasLoan ? 1000 * 100 : 0;
    
    // Default join date to 30 days ago if null
    const joinDate = member.join_date ? new Date(member.join_date) : new Date(new Date().setDate(new Date().getDate() - 30));
    
    // Fetch all savings paid dates
    const savingsPaidRes = await pool.query('SELECT business_date FROM daily_sheets WHERE member_id = $1 AND actual_paid_paise > 0', [memberId]);
    const savingsPaidDates = new Set(savingsPaidRes.rows.map(r => new Date(r.business_date).toISOString().slice(0,10)));
    
    // Fetch all loan paid dates
    const loanPaidRes = await pool.query('SELECT business_date FROM loan_repayments WHERE member_id = $1 AND amount_paise > 0', [memberId]);
    const loanPaidDates = new Set(loanPaidRes.rows.map(r => new Date(r.business_date).toISOString().slice(0,10)));

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const missedSavingsDates = [];
    const missedLoanDates = [];
    
    let current = new Date(joinDate);
    current.setHours(0,0,0,0);
    
    while(current < today) {
       const dateStr = current.toISOString().slice(0,10);
       
       if (!savingsPaidDates.has(dateStr)) {
         missedSavingsDates.push(dateStr);
       }
       if (hasLoan && !loanPaidDates.has(dateStr)) {
         missedLoanDates.push(dateStr);
       }
       
       current.setDate(current.getDate() + 1);
    }
    
    res.json({
      data: {
        savings: {
          missedDates: missedSavingsDates,
          missedAmountPaise: missedSavingsDates.length * dailyAmt,
          dailyAmt
        },
        loan: {
          missedDates: missedLoanDates,
          missedAmountPaise: missedLoanDates.length * loanAmt,
          loanAmt
        }
      }
    });
  } catch(e: any) {
    res.status(400).json({ error: { message: e.message } });
  }
}
