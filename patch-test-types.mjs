// patch-test-types.mjs — fixes TypeScript strict null access in loans.api.test.ts
import { readFileSync, writeFileSync } from 'fs';

const path = 'apps/api/src/modules/loans/loans.api.test.ts';
let content = readFileSync(path, 'utf8');

// Replacements: unsafe → safe using helper functions
const replacements = [
  // Test 5
  ["zeroSheetsRes.data.error.message.includes('First month must be fully completed')",
   "getErrorMsg(zeroSheetsRes).includes('First month must be fully completed')"],
  // Test 6
  ["tooHighRes.data.error.message.includes('exceeds maximum limit')",
   "getErrorMsg(tooHighRes).includes('exceeds maximum limit')"],
  // Test 9 assertions
  ["validRes.data.data.loan.status, 'NEW'",
   "getLoanField(validRes, 'status'), 'NEW'"],
  ["validRes.data.data.loan.memberNumber, memberNum1",
   "getLoanField(validRes, 'memberNumber'), memberNum1"],
  ["validRes.data.data.loan.memberName, 'Loan Member 1'",
   "getLoanField(validRes, 'memberName'), 'Loan Member 1'"],
  ["validRes.data.data.loan.shopName, 'Shop Alpha'",
   "getLoanField(validRes, 'shopName'), 'Shop Alpha'"],
  ["validRes.data.data.loan.numberOfSheets, 2",
   "getLoanField(validRes, 'numberOfSheets'), 2"],
  ["loanId1 = validRes.data.data.loan.id;",
   "loanId1 = String(getLoanField(validRes, 'id'));"],
  // Test 10
  ["dupRes.data.error.message.includes('already has an active loan')",
   "getErrorMsg(dupRes).includes('already has an active loan')"],
  // Test 12
  ["singleRes.data.data.loan.id, loanId1",
   "getLoanField(singleRes, 'id'), loanId1"],
  ["singleRes.data.data.loan.memberId, memberId1",
   "getLoanField(singleRes, 'memberId'), memberId1"],
  ["singleRes.data.data.loan.memberNumber, memberNum1",
   "getLoanField(singleRes, 'memberNumber'), memberNum1"],
  ["singleRes.data.data.loan.memberName, 'Loan Member 1'",
   "getLoanField(singleRes, 'memberName'), 'Loan Member 1'"],
  ["singleRes.data.data.loan.shopName, 'Shop Alpha'",
   "getLoanField(singleRes, 'shopName'), 'Shop Alpha'"],
  ["singleRes.data.data.loan.numberOfSheets, 2",
   "getLoanField(singleRes, 'numberOfSheets'), 2"],
  ["singleRes.data.data.loan.requestedAmountPaise, 25000000",
   "getLoanField(singleRes, 'requestedAmountPaise'), 25000000"],
  ["singleRes.data.data.loan.status, 'NEW'",
   "getLoanField(singleRes, 'status'), 'NEW'"],
  ["singleRes.data.data.loan.recordedByAdminId, adminUserId",
   "getLoanField(singleRes, 'recordedByAdminId'), adminUserId"],
  // Test 13
  ["activeRes.data.data.loan !== null",
   "(activeRes.data?.data?.loan ?? null) !== null"],
  ["activeRes.data.data.loan.id, loanId1",
   "getLoanField(activeRes, 'id'), loanId1"],
  // Test 14
  ["inactiveRes.data.data.loan, null",
   "inactiveRes.data?.data?.loan ?? null, null"],
  // Test 15
  ["transActiveRes.data.data.loan.status, 'ACTIVE'",
   "getLoanField(transActiveRes, 'status'), 'ACTIVE'"],
  // Test 16
  ["invalidTransRes.data.error.message.includes('Invalid loan status transition')",
   "getErrorMsg(invalidTransRes).includes('Invalid loan status transition')"],
  // Test 17
  ["transClosedRes.data.data.loan.status, 'CLOSED'",
   "getLoanField(transClosedRes, 'status'), 'CLOSED'"],
  // Test 18
  ["secondLoanRes.data.data.loan.status, 'NEW'",
   "getLoanField(secondLoanRes, 'status'), 'NEW'"],
  ["const loanId2 = secondLoanRes.data.data.loan.id;",
   "const loanId2 = String(getLoanField(secondLoanRes, 'id'));"],
  // Test 19
  ["memberHistoryRes.data.data.loans.length, 2",
   "(memberHistoryRes.data?.data?.loans ?? []).length, 2"],
];

let count = 0;
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
    count++;
  } else {
    console.warn('NOT FOUND:', from.substring(0, 60));
  }
}

writeFileSync(path, content, 'utf8');
console.log(`Applied ${count}/${replacements.length} replacements`);
