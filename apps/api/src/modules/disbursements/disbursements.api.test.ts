/**
 * Disbursements API Integration Tests (Phase 10.10)
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool } from '../../database/index.js';

loadLocalEnv();
import { createApp } from '../../app.js';
import { MemberService } from '../members/members.service.js';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

async function makeRequest(port: number, method: string, path: string, cookie: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Disbursements Integration Tests (Phase 10.10)  \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();
  const testSuffix = Date.now().toString();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;

  let loanId = '';

  try {
    // 1. Create Admin and Login
    const adminRes = await pool.query(
      `INSERT INTO admin_users (username, password_hash, role, status, full_name) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [`distestadmin_${testSuffix}`, 'hash', 'SUPER_ADMIN', 'ACTIVE', 'Disbursement Test Admin']
    );
    const adminId = adminRes.rows[0].id;

    const sessionRes = await pool.query(
      `INSERT INTO sessions (id, admin_id, expires_at) VALUES (gen_random_uuid(), $1, NOW() + INTERVAL '1 day') RETURNING id`,
      [adminId]
    );
    const sessionId = sessionRes.rows[0].id;
    const adminCookie = `vs_session=${sessionId}`;

    // 2. Create Members
    const memberService = new MemberService();
    const m1 = await memberService.createMember({
      memberNumber: `DIS-${testSuffix}`,
      memberName: 'Disbursement Borrower',
      relatedPersonName: 'Wife',
      relatedPersonRelationship: 'WIFE',
      shopName: 'Shop A',
      address: 'Addr',
      mobileNumber: '9999999991',
      numberOfSheets: 2,
    });
    const borrowerId = m1.id;

    // 3. Create a Loan via SQL to bypass eligibility logic easily
    const loanRes = await pool.query<{ id: string }>(
      `INSERT INTO loans (member_id, requested_amount_paise, application_date, recorded_by_admin_id, status)
       VALUES ($1, 10000000, '2025-01-01', $2, 'NEW') RETURNING id;`,
      [borrowerId, adminId]
    );
    loanId = loanRes.rows[0]!.id;

    // Test 1: Try to create disbursement without an agreement (Architectural safety)
    const missingAgreementRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/disbursement`, adminCookie, {
      disbursementDate: '2025-01-15'
    });
    assert.strictEqual(missingAgreementRes.status, 409); // ConflictError
    process.stdout.write('  ✅ PASS: 1. Disbursement rejected without an agreement (409 Conflict)\n');

    // Add Agreement via SQL so we can test the next steps
    await pool.query(
      `INSERT INTO loan_agreements (loan_id, agreement_date, recorded_by_admin_id) VALUES ($1, $2, $3)`,
      [loanId, '2025-01-10', adminId]
    );

    // Test 2: Add Pending Disbursement Successfully (Pending Account Policy)
    const validRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/disbursement`, adminCookie, {
      disbursementDate: '2025-01-15'
    });
    if (validRes.status !== 201) console.log(validRes.data);
    assert.strictEqual(validRes.status, 201);
    const validData = validRes.data as { data: { disbursement: { status: string; disbursementDate: string, amountPaise: number } } };
    assert.strictEqual(validData.data.disbursement.status, 'PENDING');
    assert.strictEqual(validData.data.disbursement.amountPaise, 10000000);
    assert.ok(validData.data.disbursement.disbursementDate);
    process.stdout.write('  ✅ PASS: 2. Add pending disbursement successfully due to unresolved cash policy\n');

    // Test 3: Duplicate disbursement rejected (409 Conflict)
    const dupRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/disbursement`, adminCookie, {
      disbursementDate: '2025-01-16'
    });
    assert.strictEqual(dupRes.status, 409);
    process.stdout.write('  ✅ PASS: 3. Duplicate disbursement rejected (409 Conflict)\n');

    // Test 4: Get disbursement returns correctly
    const getRes = await makeRequest(port, 'GET', `/api/v1/loans/${loanId}/disbursement`, adminCookie);
    assert.strictEqual(getRes.status, 200);
    const getData = getRes.data as { data: { disbursement: { status: string } } };
    assert.strictEqual(getData.data.disbursement.status, 'PENDING');
    process.stdout.write('  ✅ PASS: 4. Get disbursement returns correctly\n');

    // Test 5: Invalid date input rejected
    const invalidDateRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/disbursement`, adminCookie, {
      disbursementDate: 'invalid-date'
    });
    assert.strictEqual(invalidDateRes.status, 400); // Bad Request (validation)
    process.stdout.write('  ✅ PASS: 5. Invalid date input rejected (400 Bad Request)\n');

    process.stdout.write('========================================================\n');
    process.stdout.write(' ALL 5 DISBURSEMENTS INTEGRATION TESTS PASSED!          \n');
    process.stdout.write('========================================================\n\n');

  } finally {
    try {
      await pool.query('DELETE FROM sessions');
    } catch (e) {
      console.error('Cleanup failed', e);
    }
    
    server.close();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
