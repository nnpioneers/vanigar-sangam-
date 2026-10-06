import pg from 'pg';
import crypto from 'crypto';

async function seed() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/vanigar_sangam'
  });
  console.log('Seeding database with demo data...');

  try {
    // 1. Create a dummy admin
    const adminId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO admins (id, username, password_hash, full_name, role)
      VALUES ($1, 'demo_admin', 'hash', 'Demo Admin', 'SUPERADMIN')
      ON CONFLICT (username) DO NOTHING;
    `, [adminId]);

    const adminRes = await pool.query(`SELECT id FROM admins WHERE username = 'demo_admin'`);
    const actualAdminId = adminRes.rows[0].id;

    // 2. Insert 10 members
    console.log('Inserting members...');
    const members = [];
    for (let i = 1; i <= 10; i++) {
      const memberId = crypto.randomUUID();
      const memberNum = `VN00${i}`;
      await pool.query(`
        INSERT INTO members (
          id, member_number, member_name, related_person_name, related_person_relationship,
          mobile_number, number_of_sheets, address, status, recorded_by_admin_id
        ) VALUES (
          $1, $2, $3, 'Demo Relative', 'FATHER', '9999999999', 1, 'Demo Address', 'ACTIVE', $4
        ) ON CONFLICT (member_number) DO NOTHING;
      `, [memberId, memberNum, `Demo Member ${i}`, actualAdminId]);
      
      const mRes = await pool.query(`SELECT id FROM members WHERE member_number = $1`, [memberNum]);
      members.push(mRes.rows[0].id);
    }

    // 3. Insert Loans for first 5 members
    console.log('Inserting loans...');
    const loans = [];
    for (let i = 0; i < 5; i++) {
      const loanId = crypto.randomUUID();
      await pool.query(`
        INSERT INTO loans (
          id, member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id
        ) VALUES (
          $1, $2, 5000000, 5000000, 'ACTIVE', CURRENT_DATE, $3
        )
      `, [loanId, members[i], actualAdminId]);

      // Add a disbursement
      await pool.query(`
        INSERT INTO loan_disbursements (
          id, loan_id, amount_paise, status, recorded_by_admin_id
        ) VALUES (
          $1, $2, 5000000, 'COMPLETED', $3
        )
      `, [crypto.randomUUID(), loanId, actualAdminId]);

      loans.push(loanId);
    }

    // 4. Insert Collections for all 10 members
    console.log('Inserting collections...');
    for (let i = 0; i < 10; i++) {
      await pool.query(`
        INSERT INTO collections (
          id, member_id, amount_paise, collected_at, business_date, recorded_by_admin_id, entry_type
        ) VALUES (
          $1, $2, 20000, NOW(), CURRENT_DATE, $3, 'SHEET'
        )
      `, [crypto.randomUUID(), members[i], actualAdminId]);
    }

    // 5. Insert Cash Balance for admin
    console.log('Inserting cash balances...');
    const accId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO admin_cash_accounts (id, admin_id, account_name)
      VALUES ($1, $2, 'Main Safe')
      ON CONFLICT (admin_id, account_name) DO NOTHING
    `, [accId, actualAdminId]);

    const accRes = await pool.query(`SELECT id FROM admin_cash_accounts WHERE admin_id = $1 LIMIT 1`, [actualAdminId]);
    
    await pool.query(`
      INSERT INTO admin_cash_ledgers (
        id, account_id, transaction_type, amount_paise, reference_type, reference_id, notes, recorded_by_admin_id
      ) VALUES (
        $1, $2, 'CREDIT', 10000000, 'MANUAL_ADJUSTMENT', NULL, 'Initial Demo Cash', $3
      )
    `, [crypto.randomUUID(), accRes.rows[0].id, actualAdminId]);

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    pool.end();
  }
}

seed();
