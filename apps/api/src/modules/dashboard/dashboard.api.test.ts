import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import { loadLocalEnv } from '@vanigar/config';
import { getDbPool, closeDbPool } from '../../database/index.js';
import { createTestIdentifier } from '../../test-utils/index.js';
import { createApp } from '../../app.js';
import { createSession } from '../../services/session.service.js';

loadLocalEnv();

async function makeRequest(
  port: number,
  method: string,
  path: string,
  cookie?: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let parsedData = null;
  try {
    parsedData = await res.json();
  } catch (e) {
    // Ignore parse error
  }

  return { status: res.status, data: parsedData };
}

async function runDashboardTests() {
  console.log('Starting Dashboard Module API Tests...');
  let exitCode = 0;
  const pool = getDbPool();
  const app = createApp();

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const port = (server.address() as AddressInfo).port;

  let testAdminId: string;
  let adminSessionCookie: string;
  let adminSessionId: string;

  try {
    const testId = createTestIdentifier();
    
    // Create admin
    const adminRes = await pool.query(
      `INSERT INTO admin_users (username, password_hash, full_name, role)
       VALUES ($1, 'hashed_password', 'Dashboard Admin', 'ADMIN')
       RETURNING id`,
      [`admin_${testId}`]
    );
    testAdminId = adminRes.rows[0].id;
    const sessionObj = await createSession({ adminId: testAdminId, ipAddress: '127.0.0.1', userAgent: 'Test-Agent' });
    adminSessionCookie = `vs_session=${sessionObj.id || sessionObj}`;

    // Add minimal test data to ensure query syntax is valid
    // For members
    const memberRes = await pool.query(
      `INSERT INTO members (member_number, member_name, related_person_name, related_person_relationship, address, mobile_number, number_of_sheets)
       VALUES ($1, 'Test Member', 'Related Person', 'FATHER', 'Address', '1234567890', 1)
       RETURNING id`,
      [`MEM_${testId}`]
    );
    const memberId = memberRes.rows[0].id;

    // For Daily Sheets
    const businessDate = new Date().toISOString().split('T')[0];
    const dailySheetRes = await pool.query(
      `INSERT INTO daily_sheets (member_id, business_date, number_of_sheets, daily_due_amount_paise, previous_arrears_paise, total_due_paise, actual_paid_paise, status, recorded_by_admin_id)
       VALUES ($1, $2, 1, 10000, 0, 10000, 0, 'NOT_PAID', $3)
       RETURNING id`,
      [memberId, businessDate, testAdminId]
    );

    // Test 1: Unauthenticated request
    console.log('Running test: Unauthenticated request');
    const res1 = await makeRequest(port, 'GET', '/api/v1/dashboard/summary');
    assert.strictEqual(res1.status, 401, 'Expected 401 for unauthenticated summary');

    // Test 2: Authenticated request - Summary
    console.log('Running test: Authenticated summary');
    const res2 = await makeRequest(port, 'GET', '/api/v1/dashboard/summary', adminSessionCookie);
    assert.strictEqual(res2.status, 200, 'Expected 200 for authenticated summary');
    assert.strictEqual(res2.data.error, null);
    assert.ok(res2.data.data.coreMetrics);
    assert.ok(res2.data.data.collectionMetrics);
    assert.ok(res2.data.data.loanMetrics);
    assert.ok(res2.data.data.cashMetrics);
    assert.ok(res2.data.data.overdueMetrics);
    assert.ok(res2.data.data.businessDate);

    // Test 3: Authenticated request - Transactions
    console.log('Running test: Authenticated transactions');
    const res3 = await makeRequest(port, 'GET', '/api/v1/dashboard/recent-transactions', adminSessionCookie);
    assert.strictEqual(res3.status, 200, 'Expected 200 for authenticated transactions');
    assert.strictEqual(res3.data.error, null);
    assert.ok(Array.isArray(res3.data.data.transactions));

    console.log('All Dashboard Module API Tests Passed!');
  } catch (error) {
    console.error('Test Failed:', error);
    exitCode = 1;
  } finally {
    server.close();
    await closeDbPool();
    process.exit(exitCode);
  }
}

runDashboardTests();
