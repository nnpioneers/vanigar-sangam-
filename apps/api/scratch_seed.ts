import { loadLocalEnv } from '@vanigar/config';
loadLocalEnv();
import { getDbPool } from './src/database/index.js';
import { randomUUID } from 'crypto';

async function seed() {
  const pool = getDbPool();
  try {
    console.log('Clearing old data...');
    await pool.query('TRUNCATE loans CASCADE;');
    await pool.query('TRUNCATE members CASCADE;');
    await pool.query('TRUNCATE admin_users CASCADE;');

    console.log('Seeding 4 members...');
    const m1Id = randomUUID();
    const m2Id = randomUUID();
    const m3Id = randomUUID();
    const m4Id = randomUUID();
    
    // Member 1 - M001
    await pool.query(`INSERT INTO members (id, member_number, member_name, related_person_name, related_person_relationship, mobile_number, shop_name, address, status, number_of_sheets) VALUES ($1, 'M001', 'Arun Kumar', 'Father', 'FATHER', '9876543210', 'Arun Stores', 'Chennai', 'ACTIVE', 1)`, [m1Id]);
    // Member 2 - M002
    await pool.query(`INSERT INTO members (id, member_number, member_name, related_person_name, related_person_relationship, mobile_number, shop_name, address, status, number_of_sheets) VALUES ($1, 'M002', 'Balaji', 'Father', 'FATHER', '9876543211', 'Balaji Electronics', 'Chennai', 'ACTIVE', 1)`, [m2Id]);
    // Member 3 - M003
    await pool.query(`INSERT INTO members (id, member_number, member_name, related_person_name, related_person_relationship, mobile_number, shop_name, address, status, number_of_sheets) VALUES ($1, 'M003', 'Chandran', 'Father', 'FATHER', '9876543212', 'Chandran Mobiles', 'Chennai', 'ACTIVE', 1)`, [m3Id]);
    // Member 4 - M004
    await pool.query(`INSERT INTO members (id, member_number, member_name, related_person_name, related_person_relationship, mobile_number, shop_name, address, status, number_of_sheets) VALUES ($1, 'M004', 'Dinesh', 'Father', 'FATHER', '9876543213', 'Dinesh Bakery', 'Chennai', 'ACTIVE', 1)`, [m4Id]);

    console.log('Creating dummy admin...');
    await pool.query(`INSERT INTO admin_users (id, username, password_hash, full_name, role) VALUES ('00000000-0000-0000-0000-000000000000', 'admin', 'dummy', 'Admin', 'SUPER_ADMIN')`);

    console.log('Creating loans for Member 1 and 3...');
    await pool.query(`INSERT INTO loans (id, member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id) 
                      VALUES ($1, $2, 10000000, 10000000, 'ACTIVE', CURRENT_DATE, '00000000-0000-0000-0000-000000000000')`, [randomUUID(), m1Id]);

    await pool.query(`INSERT INTO loans (id, member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id) 
                      VALUES ($1, $2, 20000000, 20000000, 'ACTIVE', CURRENT_DATE, '00000000-0000-0000-0000-000000000000')`, [randomUUID(), m3Id]);

    console.log('Seeding completed.');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end();
  }
}

seed();
