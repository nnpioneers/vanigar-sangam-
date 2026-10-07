export async function getMemberArrearsController(req: Request, res: Response): Promise<void> {
  const { memberId } = req.params;
  try {
    const pool = getDbPool();
    // Simplified logic: assume joining date is 30 days ago for MVP or query min date
    // Actually just get all unpaid days from join_date up to yesterday
    const memberRes = await pool.query('SELECT join_date, number_of_sheets FROM members WHERE id = $1', [memberId]);
    if (!memberRes.rows.length) { res.status(404).json({ error: { message: 'Member not found' } }); return; }
    const member = memberRes.rows[0];
    const dailyAmt = (member.number_of_sheets || 1) * 200 * 100;
    
    // Get all dates they paid
    const paidRes = await pool.query('SELECT business_date FROM daily_sheets WHERE member_id = $1 AND actual_paid_paise > 0', [memberId]);
    const paidDates = new Set(paidRes.rows.map(r => new Date(r.business_date).toISOString().slice(0,10)));
    
    const joinDate = member.join_date ? new Date(member.join_date) : new Date(new Date().setDate(new Date().getDate() - 30));
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const missedDates = [];
    let current = new Date(joinDate);
    current.setHours(0,0,0,0);
    while(current < today) {
       const dateStr = current.toISOString().slice(0,10);
       // Skip sundays if applicable, but for now just check if not paid
       if (!paidDates.has(dateStr)) {
         missedDates.push(dateStr);
       }
       current.setDate(current.getDate() + 1);
    }
    
    res.json({ data: { missedDates, missedAmountPaise: missedDates.length * dailyAmt, dailyAmt } });
  } catch(e: any) {
    res.status(400).json({ error: { message: e.message } });
  }
}
