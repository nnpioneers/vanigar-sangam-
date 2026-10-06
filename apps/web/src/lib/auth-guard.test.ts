/**
 * Automated Test Suite for Route Protection & Redirection Logic (Task 2.8)
 *
 * Verifies:
 * 1. Unauthenticated users accessing `/dashboard` or protected sub-routes are redirected to `/login` with return target.
 * 2. Authenticated users accessing `/login` or `/` are redirected to `/dashboard`.
 * 3. Authenticated users accessing `/dashboard` or protected sub-routes are allowed through.
 * 4. Unauthenticated users accessing `/login` are allowed through.
 * 5. Session cookie name conforms strictly to `vs_session`.
 */

import assert from 'node:assert/strict';
import {
  isProtectedRoute,
  isAuthRoute,
  resolveAuthRedirect,
  SESSION_COOKIE_NAME,
} from './auth-guard.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n--- Running Task 2.8 Route Protection & Auth State Tests ---');

runTest('SESSION_COOKIE_NAME must be vs_session', () => {
  assert.equal(SESSION_COOKIE_NAME, 'vs_session');
});

runTest('isProtectedRoute correctly identifies protected routes', () => {
  assert.equal(isProtectedRoute('/dashboard'), true);
  assert.equal(isProtectedRoute('/dashboard/'), true);
  assert.equal(isProtectedRoute('/dashboard/members'), true);
  assert.equal(isProtectedRoute('/dashboard/loans/new'), true);
  assert.equal(isProtectedRoute('/members'), true);
  assert.equal(isProtectedRoute('/members/'), true);
  assert.equal(isProtectedRoute('/daily-sheets'), true);
  assert.equal(isProtectedRoute('/collections'), true);
  assert.equal(isProtectedRoute('/loans'), true);
  assert.equal(isProtectedRoute('/login'), false);
  assert.equal(isProtectedRoute('/'), false);
  assert.equal(isProtectedRoute('/about'), false);
});

runTest('isAuthRoute correctly identifies auth routes', () => {
  assert.equal(isAuthRoute('/login'), true);
  assert.equal(isAuthRoute('/login/'), true);
  assert.equal(isAuthRoute('/dashboard'), false);
  assert.equal(isAuthRoute('/'), false);
});

runTest('Root route (/) redirects unauthenticated users to /login', () => {
  const redirect = resolveAuthRedirect('/', false);
  assert.equal(redirect, '/login');
});

runTest('Root route (/) redirects authenticated users to /dashboard', () => {
  const redirect = resolveAuthRedirect('/', true);
  assert.equal(redirect, '/dashboard');
});

runTest('Unauthenticated user accessing /dashboard is redirected to /login with target', () => {
  const redirect = resolveAuthRedirect('/dashboard', false);
  assert.equal(redirect, '/login?from=%2Fdashboard');
});

runTest('Unauthenticated user accessing nested /dashboard/members is redirected with target', () => {
  const redirect = resolveAuthRedirect('/dashboard/members', false);
  assert.equal(redirect, '/login?from=%2Fdashboard%2Fmembers');
});

runTest('Trailing slash on protected route is normalized correctly', () => {
  const redirect = resolveAuthRedirect('/dashboard/', false);
  assert.equal(redirect, '/login?from=%2Fdashboard');
});

runTest('Authenticated user accessing /dashboard is permitted (returns null)', () => {
  const redirect = resolveAuthRedirect('/dashboard', true);
  assert.equal(redirect, null);
});

runTest('Unauthenticated user accessing /members is redirected to /login with target', () => {
  const redirect = resolveAuthRedirect('/members', false);
  assert.equal(redirect, '/login?from=%2Fmembers');
});

runTest('Authenticated user accessing /members is permitted (returns null)', () => {
  const redirect = resolveAuthRedirect('/members', true);
  assert.equal(redirect, null);
});

runTest('Authenticated user accessing /dashboard/loans is permitted (returns null)', () => {
  const redirect = resolveAuthRedirect('/dashboard/loans', true);
  assert.equal(redirect, null);
});

runTest('Authenticated user accessing /login is redirected to /dashboard', () => {
  const redirect = resolveAuthRedirect('/login', true);
  assert.equal(redirect, '/dashboard');
});

runTest('Unauthenticated user accessing /login is permitted (returns null)', () => {
  const redirect = resolveAuthRedirect('/login', false);
  assert.equal(redirect, null);
});

runTest('Public unhandled route is permitted without redirection', () => {
  const unauthRedirect = resolveAuthRedirect('/privacy-policy', false);
  const authRedirect = resolveAuthRedirect('/privacy-policy', true);
  assert.equal(unauthRedirect, null);
  assert.equal(authRedirect, null);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
