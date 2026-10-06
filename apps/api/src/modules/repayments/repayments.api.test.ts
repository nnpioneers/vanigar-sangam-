import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../../database/index.js';
import { createApp } from '../../app.js';
import { createSession } from '../../services/session.service.js';

loadLocalEnv();

interface TestApiResponse {
  status: number;
  body: Record<string, any>;
}

async function makeRequest(
  port: number,
  method: string,
  path: string,
  cookie?: string,
  body?: Record<string, unknown>
): Promise<TestApiResponse> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const parsedData = await res.json().catch(() => null);
  return { status: res.status, body: parsedData as Record<string, any> };
}

async function runTests() {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Repayments Integration Tests (Phase 11)       \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let port: number;

  try {
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => resolve()).on('error', reject);
    });
    port = (server!.address() as AddressInfo).port;

    const uniqueSuffix = Math.random().toString(36).substring(7);

    // Setup Admin
    const adminRes = await pool.query(
      `INSERT INTO admin_users (username, password_hash, full_name, role) VALUES ('repayadmin_${uniqueSuffix}', 'hash', 'Admin', 'SUPER_ADMIN') RETURNING id`
    );
    const adminId = adminRes.rows[0].id;

    // Login via service
    const sessionRes = await createSession({ adminId });
    const adminSessionCookie = `vs_session=${sessionRes.id}`;

    // Create member
    const memberRes = await pool.query(
      `INSERT INTO members (member_number, member_name, related_person_name, related_person_relationship, address, mobile_number, number_of_sheets, status) VALUES ('REP_${uniqueSuffix}', 'Repayment Member', 'Father', 'FATHER', 'Address', '1234567890', 1, 'ACTIVE') RETURNING id`

    );
    const memberId = memberRes.rows[0].id;

    // Create Active Loan
    const loanRes = await pool.query(
      `INSERT INTO loans (member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id) 
       VALUES ($1, 5000000, 5000000, 'ACTIVE', '2023-01-10', $2) RETURNING id`,
      [memberId, adminId]
    );
    const loanId = loanRes.rows[0].id;

    // Create Closed Loan
    const closedRes = await pool.query(
      `INSERT INTO loans (member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id) 
       VALUES ($1, 2000000, 2000000, 'CLOSED', '2023-01-15', $2) RETURNING id`,
      [memberId, adminId]
    );
    const closedLoanId = closedRes.rows[0].id;


    // 1. Valid repayment creation
    let res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 50000, // 500 INR
      repaymentDate: '2023-02-01',
      paymentMode: 'CASH',
      idempotencyKey: `repay_1_${uniqueSuffix}`
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body?.data?.amountPaise, 50000);
    assert.strictEqual(res.body?.data?.loanId, loanId);
    process.stdout.write('  ✅ PASS: 1. Valid repayment creation\n');


    // 2. Unknown loan rejection
    res = await makeRequest(port, 'POST', `/api/v1/loans/00000000-0000-0000-0000-000000000000/repayments`, adminSessionCookie, {
      amountPaise: 50000, repaymentDate: '2023-02-01', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 404);
    process.stdout.write('  ✅ PASS: 2. Unknown loan rejection\n');

    // 3. Invalid amount rejection
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 'invalid', repaymentDate: '2023-02-01', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    process.stdout.write('  ✅ PASS: 3. Invalid amount rejection\n');

    // 4. Zero amount rejection
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 0, repaymentDate: '2023-02-01', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    process.stdout.write('  ✅ PASS: 4. Zero amount rejection\n');


    // 5. Negative amount rejection
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: -500, repaymentDate: '2023-02-01', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    process.stdout.write('  ✅ PASS: 5. Negative amount rejection\n');


    // 6. Invalid repayment date rejection
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 5000, repaymentDate: 'not-a-date', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    process.stdout.write('  ✅ PASS: 6. Invalid repayment date rejection\n');


    // 7. Closed/ineligible loan behavior
    res = await makeRequest(port, 'POST', `/api/v1/loans/${closedLoanId}/repayments`, adminSessionCookie, {
      amountPaise: 5000, repaymentDate: '2023-02-01', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATE');
    process.stdout.write('  ✅ PASS: 7. Closed/ineligible loan behavior\n');


    // 8. Duplicate/idempotency behavior
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 50000,
      repaymentDate: '2023-02-01',
      paymentMode: 'CASH',
      idempotencyKey: `repay_1_${uniqueSuffix}`
    });
    assert.strictEqual(res.status, 201);
    const countRes = await pool.query(`SELECT COUNT(*) FROM loan_repayments WHERE idempotency_key = 'repay_1_${uniqueSuffix}'`);
    assert.strictEqual(countRes.rows[0].count, '1');
    process.stdout.write('  ✅ PASS: 8. Duplicate/idempotency behavior\n');

    // 9. Repayment retrieval
    res = await makeRequest(port, 'GET', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body?.data?.items?.length > 0);
    process.stdout.write('  ✅ PASS: 9. Repayment retrieval\n');


    // 10. Audit creation
    const auditRes = await pool.query('SELECT * FROM loan_repayments_audit WHERE loan_id = $1', [loanId]);
    assert.ok(auditRes.rows.length > 0);
    assert.strictEqual(auditRes.rows[0].action, 'CREATE_REPAYMENT');
    process.stdout.write('  ✅ PASS: 10. Audit creation\n');


    // 11. Immutability / DELETE protection
    let deleteFailed = false;
    try {
      await pool.query('DELETE FROM loan_repayments WHERE loan_id = $1', [loanId]);
    } catch (err: any) {
      if (err.message.includes('Physical deletion')) {
        deleteFailed = true;
      }
    }
    assert.ok(deleteFailed, 'Should have thrown an exception');
    process.stdout.write('  ✅ PASS: 11. Immutability / DELETE protection\n');


    // 12. Deterministic outstanding calculation
    res = await makeRequest(port, 'GET', `/api/v1/loans/${loanId}/outstanding`, adminSessionCookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.data?.principalAmountPaise, 5000000);
    assert.strictEqual(res.body?.data?.totalRepaidPaise, 50000);
    assert.strictEqual(res.body?.data?.remainingPrincipalPaise, 4950000);
    process.stdout.write('  ✅ PASS: 12. Deterministic outstanding calculation\n');

    // 13. Concurrent duplicate request handling
    const concurrentKey = `repay_concurrent_${uniqueSuffix}`;
    const req1 = makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 50000, repaymentDate: '2023-02-02', paymentMode: 'CASH', idempotencyKey: concurrentKey
    });
    const req2 = makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 50000, repaymentDate: '2023-02-02', paymentMode: 'CASH', idempotencyKey: concurrentKey
    });
    const [res1, res2] = await Promise.all([req1, req2]);
    assert.strictEqual(res1.status === 201 || res2.status === 201, true);
    const countConcurrent = await pool.query(`SELECT COUNT(*) FROM loan_repayments WHERE idempotency_key = $1`, [concurrentKey]);
    assert.strictEqual(countConcurrent.rows[0].count, '1');
    process.stdout.write('  ✅ PASS: 13. Concurrent duplicate request handling via DB constraint\n');

    // 14. Overpayment prevention
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 5000000, // this exceeds the remaining 4,900,000
      repaymentDate: '2023-02-03', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body?.error?.code, 'PENDING_BUSINESS_RULE');
    process.stdout.write('  ✅ PASS: 14. Overpayment prevention (pending business rule)\n');

    // 15. Full principal repayment
    res = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/repayments`, adminSessionCookie, {
      amountPaise: 4900000, // pays off exactly the rest
      repaymentDate: '2023-02-04', paymentMode: 'CASH'
    });
    assert.strictEqual(res.status, 201);
    const finalOutstanding = await makeRequest(port, 'GET', `/api/v1/loans/${loanId}/outstanding`, adminSessionCookie);
    assert.strictEqual(finalOutstanding.body?.data?.remainingPrincipalPaise, 0);
    process.stdout.write('  ✅ PASS: 15. Full principal repayment\n');



    process.stdout.write('========================================================\n');
    process.stdout.write(' ALL 15 REPAYMENTS INTEGRATION TESTS PASSED!             \n');
    process.stdout.write('========================================================\n\n');

  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server!) {
      server.close();
    }
    await closeDbPool();
  }
}

runTests();
