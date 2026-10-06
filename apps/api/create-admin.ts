import { loadLocalEnv } from '@vanigar/config';
loadLocalEnv();
import { getDbPool } from './src/database/index.js';
import { hashPassword } from './src/services/password.service.js';

async function run() {
  const pool = getDbPool();
  const pwdHash = await hashPassword('password123');
  
  await pool.query(
    `INSERT INTO admin_users (username, full_name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO UPDATE SET password_hash = $3, status = $5`,
    ['admin', 'Super Admin', pwdHash, 'SUPER_ADMIN', 'ACTIVE']
  );
  
  console.log('Admin user "admin" created/updated with password "password123".');
  process.exit(0);
}
run();
