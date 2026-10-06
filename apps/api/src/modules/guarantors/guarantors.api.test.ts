/**
 * Automated Test Suite for Guarantors Foundation (Phase 9.5)
 */

import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../../database/index.js';
import { createTestIdentifier } from '../../test-utils/index.js';
import { createApp } from '../../app.js';
import { MemberService } from '../members/members.service.js';
import { createSession } from '../../services/session.service.js';

loadLocalEnv();

interface TestApiResponse {
  status: number;
  data: unknown;
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

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Guarantors Integration Tests (Phase 9.5)       \n');
  process.stdout.write('========================================================\n');

  const pool = getDbPool();
  const testSuffix = createTestIdentifier();
  const app = await createApp();
  
  let server: import('node:http').Server | undefined;
  let port: number = 0;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = (server!.address() as AddressInfo).port;
      resolve();
    });
  });

  // Provision Admin
  const adminUsername = `admin_${testSuffix}`;
  const adminRes = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (username, password_hash, full_name, role, status)
     VALUES ($1, 'fakehash', 'Admin Test', 'ADMIN', 'ACTIVE') RETURNING id;`,
    [adminUsername]
  );
  const adminUserId = adminRes.rows[0]!.id;
  const adminSession = await createSession({ adminId: adminUserId });
  const adminCookie = `vs_session=${adminSession.id}`;

  // Provision 3 members
  const memberService = new MemberService();
  const borrowerNum = `mb_${testSuffix}`;
  const m1 = await memberService.createMember({
    memberNumber: borrowerNum,
    memberName: 'Borrower',
    relatedPersonName: 'Wife',
    relatedPersonRelationship: 'WIFE',
    shopName: 'Shop A',
    address: 'Addr',
    mobileNumber: '9999999991',
    numberOfSheets: 2,
  });

  const guar1Num = `g1_${testSuffix}`;
  const m2 = await memberService.createMember({
    memberNumber: guar1Num,
    memberName: 'Guarantor 1',
    relatedPersonName: 'Father',
    relatedPersonRelationship: 'FATHER',
    shopName: 'Shop B',
    address: 'Addr',
    mobileNumber: '9999999992',
    numberOfSheets: 2,
  });

  const guar2Num = `g2_${testSuffix}`;
  const m3 = await memberService.createMember({
    memberNumber: guar2Num,
    memberName: 'Guarantor 2',
    relatedPersonName: 'Son',
    relatedPersonRelationship: 'SON',
    shopName: 'Shop C',
    address: 'Addr',
    mobileNumber: '9999999993',
    numberOfSheets: 2,
  });

  // Setup: create two more members for concurrency testing
  const m4Num = `${testSuffix}-M4`;
  const m4 = await memberService.createMember({
    memberNumber: m4Num,
    memberName: 'Guar4',
    shopName: 'Shop4',
    relatedPersonName: 'Rel4',
    relatedPersonRelationship: 'OTHER',
    address: 'Addr',
    mobileNumber: '9999999994',
    numberOfSheets: 2,
  });

  const m5Num = `${testSuffix}-M5`;
  const m5 = await memberService.createMember({
    memberNumber: m5Num,
    memberName: 'Guar5',
    shopName: 'Shop5',
    relatedPersonName: 'Rel5',
    relatedPersonRelationship: 'OTHER',
    address: 'Addr',
    mobileNumber: '9999999995',
    numberOfSheets: 2,
  });

  // Provision Loan for Borrower (1 lakh)
  const loanRes = await pool.query<{ id: string }>(
    `INSERT INTO loans (member_id, requested_amount_paise, application_date, recorded_by_admin_id, status)
     VALUES ($1, 10000000, '2026-10-04', $2, 'NEW') RETURNING id;`,
    [m1.id, adminUserId]
  );
  const loanId = loanRes.rows[0]!.id;

  let loan2Id: string | undefined;
  try {
    // Test 1: Add Guarantor (Valid)
    const validRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
      memberNumber: guar1Num,
      responsibilityAmountPaise: 5000000 // 50k
    });
    assert.strictEqual(validRes.status, 201);
    const validData = validRes.data as { data: { guarantor: { guarantorMemberNumber: string } } };
    assert.strictEqual(validData.data.guarantor.guarantorMemberNumber, guar1Num);
    process.stdout.write('  ✅ PASS: 1. Add valid guarantor successfully\n');

    // Test 2: Borrower cannot be their own guarantor
    const selfRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
      memberNumber: borrowerNum,
      responsibilityAmountPaise: 1000000
    });
    assert.strictEqual(selfRes.status, 409);
    process.stdout.write('  ✅ PASS: 2. Borrower cannot be their own guarantor (409 Conflict)\n');

    // Test 3: Duplicate guarantor not allowed
    const dupRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
      memberNumber: guar1Num,
      responsibilityAmountPaise: 1000000
    });
    assert.strictEqual(dupRes.status, 409);
    process.stdout.write('  ✅ PASS: 3. Duplicate guarantor on same loan rejected (409 Conflict)\n');

    // Test 4: Responsibility amount <= loan amount
    const excessRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
      memberNumber: guar2Num,
      responsibilityAmountPaise: 10000001 // 1 lakh + 1 paise
    });
    assert.strictEqual(excessRes.status, 400);
    process.stdout.write('  ✅ PASS: 4. Responsibility exceeding loan amount rejected (400)\n');

    // Test 5: Total responsibility <= loan amount
    const excessTotalRes = await makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
      memberNumber: guar2Num,
      responsibilityAmountPaise: 6000000 // 50k already + 60k = 110k (exceeds 100k)
    });
    assert.strictEqual(excessTotalRes.status, 400);
    process.stdout.write('  ✅ PASS: 5. Total responsibility exceeding loan amount rejected (400)\n');

    // Test 6: List Guarantors
    const listRes = await makeRequest(port, 'GET', `/api/v1/loans/${loanId}/guarantors`, adminCookie);
    assert.strictEqual(listRes.status, 200);
    const listData = listRes.data as { data: { items: unknown[] } };
    assert.strictEqual(listData.data.items.length, 1);
    process.stdout.write('  ✅ PASS: 6. List guarantors returns correctly\n');

    // Test 7: My Guarantees
    const myGuarRes = await makeRequest(port, 'GET', `/api/v1/loans/member/${guar1Num}/guarantees`, adminCookie);
    assert.strictEqual(myGuarRes.status, 200);
    const myGuarData = myGuarRes.data as { data: { items: unknown[]; total: number } };
    assert.strictEqual(myGuarData.data.items.length, 1);
    assert.strictEqual(myGuarData.data.total, 1);
    process.stdout.write('  ✅ PASS: 7. My Guarantees returns correctly\n');

    // Test 8: Concurrent Duplicate (Scenario A)
    // Send 3 requests for the same guarantor simultaneously
    const dupPromises = [
      makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
        memberNumber: guar2Num,
        responsibilityAmountPaise: 10000
      }),
      makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
        memberNumber: guar2Num,
        responsibilityAmountPaise: 10000
      }),
      makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
        memberNumber: guar2Num,
        responsibilityAmountPaise: 10000
      })
    ];
    const dupResults = await Promise.all(dupPromises);
    const dupSuccesses = dupResults.filter(r => r.status === 201);
    assert.strictEqual(dupSuccesses.length, 1);
    process.stdout.write('  ✅ PASS: 8. Concurrent duplicate requests handled safely (Scenario A)\n');

    // Test 9: Concurrent Max-3 (Scenario B)
    // We already have 2 guarantors (guar1, guar2). We need 1 more to reach 3.
    // If we send 2 requests concurrently for different members, only 1 should succeed.
    const max3Promises = [
      makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
        memberNumber: m4Num,
        responsibilityAmountPaise: 10000
      }),
      makeRequest(port, 'POST', `/api/v1/loans/${loanId}/guarantors`, adminCookie, {
        memberNumber: m5Num,
        responsibilityAmountPaise: 10000
      })
    ];
    const max3Results = await Promise.all(max3Promises);
    const max3Successes = max3Results.filter(r => r.status === 201);
    assert.strictEqual(max3Successes.length, 1);
    process.stdout.write('  ✅ PASS: 9. Concurrent max-3 requests handled safely (Scenario B)\n');

    // Test 10: Concurrent Responsibility Limit (Scenario C)
    // We have 3 guarantors, but let's test responsibility limit on another loan
    // Test 10: Concurrent Responsibility Limit (Scenario C)
    // We have 3 guarantors, but let's test responsibility limit on another loan
    const loan2 = await pool.query(`
      INSERT INTO loans (member_id, requested_amount_paise, approved_amount_paise, status, application_date, recorded_by_admin_id)
      VALUES ($1, $2, $3, 'NEW', NOW(), $4)
      RETURNING id;
    `, [m4.id, 10000000, 10000000, adminUserId]);
    loan2Id = loan2.rows[0].id;

    const limitPromises = [
      makeRequest(port, 'POST', `/api/v1/loans/${loan2Id}/guarantors`, adminCookie, {
        memberNumber: guar1Num,
        responsibilityAmountPaise: 6000000 // 60k
      }),
      makeRequest(port, 'POST', `/api/v1/loans/${loan2Id}/guarantors`, adminCookie, {
        memberNumber: guar2Num,
        responsibilityAmountPaise: 6000000 // 60k
      })
    ];
    const limitResults = await Promise.all(limitPromises);
    const limitSuccesses = limitResults.filter(r => r.status === 201);
    assert.strictEqual(limitSuccesses.length, 1);
    process.stdout.write('  ✅ PASS: 10. Concurrent responsibility limit requests handled safely (Scenario C)\n');

  } finally {
    // Cleanup
    try {
      await pool.query(`ALTER TABLE loan_guarantors DISABLE TRIGGER trg_protect_guarantors_delete;`);
      await pool.query(`DELETE FROM loan_guarantors WHERE loan_id = $1;`, [loanId]);
      if (loan2Id) {
        await pool.query(`DELETE FROM loan_guarantors WHERE loan_id = $1;`, [loan2Id]);
      }
      await pool.query(`ALTER TABLE loan_guarantors ENABLE TRIGGER trg_protect_guarantors_delete;`);
      
      await pool.query(`ALTER TABLE loans DISABLE TRIGGER trg_protect_loans_delete;`);
      if (loan2Id) {
        await pool.query(`DELETE FROM loans WHERE id = $1;`, [loan2Id]);
      }
      await pool.query(`DELETE FROM loans WHERE id = $1;`, [loanId]);
      await pool.query(`ALTER TABLE loans ENABLE TRIGGER trg_protect_loans_delete;`);
      
      await pool.query(`ALTER TABLE members DISABLE TRIGGER trg_protect_members_delete;`);
      await pool.query(`DELETE FROM members WHERE id IN ($1, $2, $3, $4, $5);`, [m1.id, m2.id, m3.id, m4?.id, m5?.id].filter(Boolean));
      await pool.query(`ALTER TABLE members ENABLE TRIGGER trg_protect_members_delete;`);
      
      await pool.query(`DELETE FROM sessions WHERE admin_id = $1;`, [adminUserId]);
      await pool.query(`DELETE FROM admin_users WHERE id = $1;`, [adminUserId]);
    } catch (e) {
      console.error(e);
    }

    console.log("\\n========================================================");
    console.log(" CHECKING GUARANTOR DATA INTEGRITY");
    console.log("========================================================");
    
    const dupCheck = await pool.query(`SELECT loan_id, guarantor_member_id, COUNT(*) FROM loan_guarantors GROUP BY loan_id, guarantor_member_id HAVING COUNT(*) > 1`);
    console.log(`- Duplicate (loan_id, guarantor_member_id): ${dupCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + dupCheck.rowCount + ')'}`);

    const max3Check = await pool.query(`SELECT loan_id, COUNT(*) FROM loan_guarantors GROUP BY loan_id HAVING COUNT(*) > 3`);
    console.log(`- More than 3 guarantors: ${max3Check.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + max3Check.rowCount + ')'}`);

    const maxRespCheck = await pool.query(`
      SELECT g.loan_id 
      FROM loan_guarantors g 
      JOIN loans l ON g.loan_id = l.id 
      GROUP BY g.loan_id, l.requested_amount_paise 
      HAVING SUM(g.responsibility_amount_paise) > l.requested_amount_paise
    `);
    console.log(`- Responsibility exceeds loan amount: ${maxRespCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + maxRespCheck.rowCount + ')'}`);

    const negCheck = await pool.query(`SELECT id FROM loan_guarantors WHERE responsibility_amount_paise <= 0`);
    console.log(`- Zero/Negative responsibility: ${negCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + negCheck.rowCount + ')'}`);

    const selfCheck = await pool.query(`
      SELECT g.id 
      FROM loan_guarantors g 
      JOIN loans l ON g.loan_id = l.id 
      WHERE g.guarantor_member_id = l.member_id
    `);
    console.log(`- Borrower is own guarantor: ${selfCheck.rowCount === 0 ? 'PASS (0)' : 'FAIL (' + selfCheck.rowCount + ')'}`);
    server?.close();
    await closeDbPool();
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 10 GUARANTORS INTEGRATION TESTS PASSED!            \n');
  process.stdout.write('========================================================\n\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
