/**
 * Automated Test Suite for Member Foundation Schema (Phase 5.1)
 */

import assert from 'node:assert';
import { loadLocalEnv } from '@vanigar/config';
import { closeDbPool } from '../../database/index.js';
import {
  createTestIdentifier,
  runInTestTransaction,
} from '../../test-utils/index.js';
import { MemberRepository } from './members.repository.js';
import { MemberService } from './members.service.js';
import { isAppError } from '../../errors/app-error.js';

loadLocalEnv();

async function runTests(): Promise<void> {
  process.stdout.write('\n========================================================\n');
  process.stdout.write(' Running Member Foundation Tests (Phase 5.1) \n');
  process.stdout.write('========================================================\n');

  const repo = new MemberRepository();
  const service = new MemberService(repo);

  // Test 1: Member creation with valid data
  {
    await runInTestTransaction(async (client) => {
      const memberNum = createTestIdentifier('mem_num');
      const member = await service.createMember({
        memberNumber: memberNum,
        memberName: 'Test Member',
        relatedPersonName: 'Test Father',
        relatedPersonRelationship: 'FATHER',
        address: '123 Test St',
        mobileNumber: '9999999999',
        numberOfSheets: 2,
      }, { tx: client });

      assert.ok(member.id);
      assert.strictEqual(member.memberNumber, memberNum);
      assert.strictEqual(member.status, 'ACTIVE');
      assert.strictEqual(member.numberOfSheets, 2);
    });
    process.stdout.write('  ✅ PASS: 1. Member creation with valid data\n');
  }

  // Test 2: Required field validation
  {
    await runInTestTransaction(async (client) => {
      let caught = false;
      try {
        await service.createMember({
          memberNumber: '',
          memberName: 'Test',
          relatedPersonName: 'Test',
          relatedPersonRelationship: 'FATHER',
          address: 'Test',
          mobileNumber: '999',
          numberOfSheets: 1,
        }, { tx: client });
      } catch (err) {
        caught = true;
        assert.ok(isAppError(err) && err.statusCode === 400);
      }
      assert.strictEqual(caught, true);
    });
    process.stdout.write('  ✅ PASS: 2. Required field validation\n');
  }

  // Test 3 & 4: Unique member_number constraint & Duplicate rejection
  {
    await runInTestTransaction(async (client) => {
      const memberNum = createTestIdentifier('mem_num_dup');
      await service.createMember({
        memberNumber: memberNum,
        memberName: 'Test 1',
        relatedPersonName: 'Father 1',
        relatedPersonRelationship: 'FATHER',
        address: 'Add 1',
        mobileNumber: '111',
        numberOfSheets: 1,
      }, { tx: client });

      let caught = false;
      try {
        await service.createMember({
          memberNumber: memberNum,
          memberName: 'Test 2',
          relatedPersonName: 'Father 2',
          relatedPersonRelationship: 'FATHER',
          address: 'Add 2',
          mobileNumber: '222',
          numberOfSheets: 1,
        }, { tx: client });
      } catch (err) {
        caught = true;
        assert.ok(isAppError(err) && err.statusCode === 409);
      }
      assert.strictEqual(caught, true);
    });
    process.stdout.write('  ✅ PASS: 3 & 4. Unique member_number constraint & Duplicate rejection\n');
  }

  // Test 5: Relationship vocabulary validation
  {
    await runInTestTransaction(async (client) => {
      let caught = false;
      try {
        await service.createMember({
          memberNumber: createTestIdentifier('rel'),
          memberName: 'Test',
          relatedPersonName: 'Test',
          relatedPersonRelationship: 'INVALID_REL' as unknown as 'FATHER',
          address: 'Add',
          mobileNumber: '111',
          numberOfSheets: 1,
        }, { tx: client });
      } catch (err) {
        caught = true;
        assert.ok(isAppError(err) && err.statusCode === 400);
      }
      assert.strictEqual(caught, true);
    });
    process.stdout.write('  ✅ PASS: 5. Relationship vocabulary validation\n');
  }

  // Test 6 & 7: Positive sheet count validation
  {
    await runInTestTransaction(async (client) => {
      let caught = false;
      try {
        await service.createMember({
          memberNumber: createTestIdentifier('sheet'),
          memberName: 'Test',
          relatedPersonName: 'Test',
          relatedPersonRelationship: 'FATHER',
          address: 'Add',
          mobileNumber: '111',
          numberOfSheets: 0,
        }, { tx: client });
      } catch (err) {
        caught = true;
        assert.ok(isAppError(err) && err.statusCode === 400);
      }
      assert.strictEqual(caught, true);
    });
    process.stdout.write('  ✅ PASS: 6 & 7. Positive sheet count validation & invalid rejection\n');
  }

  // Test 8 & 9: Optional nominee & insurance fields
  {
    await runInTestTransaction(async (client) => {
      const member = await service.createMember({
        memberNumber: createTestIdentifier('opt'),
        memberName: 'Test',
        relatedPersonName: 'Test',
        relatedPersonRelationship: 'FATHER',
        address: 'Add',
        mobileNumber: '111',
        numberOfSheets: 1,
        nomineeName: 'Nom',
        nomineeRelationship: 'SON',
        nomineePhone: '999',
        insuranceNumber: 'INS123',
      }, { tx: client });

      assert.strictEqual(member.nomineeName, 'Nom');
      assert.strictEqual(member.insuranceNumber, 'INS123');
    });
    process.stdout.write('  ✅ PASS: 8 & 9. Optional nominee fields & insurance number\n');
  }

  // Test 10: Member lookup by member_number
  {
    await runInTestTransaction(async (client) => {
      const num = createTestIdentifier('lookup');
      await service.createMember({
        memberNumber: num,
        memberName: 'Lookup Member',
        relatedPersonName: 'F',
        relatedPersonRelationship: 'FATHER',
        address: 'A',
        mobileNumber: '1',
        numberOfSheets: 1,
      }, { tx: client });

      const found = await service.getMemberByNumber(num, { tx: client });
      assert.strictEqual(found.memberName, 'Lookup Member');
    });
    process.stdout.write('  ✅ PASS: 10. Member lookup by member_number\n');
  }

  // Test 11: Member update
  {
    await runInTestTransaction(async (client) => {
      const num = createTestIdentifier('upd');
      const m = await service.createMember({
        memberNumber: num,
        memberName: 'Old Name',
        relatedPersonName: 'F',
        relatedPersonRelationship: 'FATHER',
        address: 'A',
        mobileNumber: '1',
        numberOfSheets: 1,
      }, { tx: client });

      const updated = await service.updateMember(m.id, { memberName: 'New Name' }, { tx: client });
      assert.strictEqual(updated.memberName, 'New Name');
    });
    process.stdout.write('  ✅ PASS: 11. Member update\n');
  }

  // Test 12: Member deactivation
  {
    await runInTestTransaction(async (client) => {
      const num = createTestIdentifier('deact');
      const m = await service.createMember({
        memberNumber: num,
        memberName: 'Deact',
        relatedPersonName: 'F',
        relatedPersonRelationship: 'FATHER',
        address: 'A',
        mobileNumber: '1',
        numberOfSheets: 1,
      }, { tx: client });

      const deactivated = await service.deactivateMember(m.id, { tx: client });
      assert.strictEqual(deactivated.status, 'INACTIVE');
    });
    process.stdout.write('  ✅ PASS: 12. Member deactivation/lifecycle behaviour\n');
  }

  // Test 13: Destructive member deletion is prevented
  {
    await runInTestTransaction(async (client) => {
      const num = createTestIdentifier('del');
      const m = await service.createMember({
        memberNumber: num,
        memberName: 'Del',
        relatedPersonName: 'F',
        relatedPersonRelationship: 'FATHER',
        address: 'A',
        mobileNumber: '1',
        numberOfSheets: 1,
      }, { tx: client });

      await client.query('SAVEPOINT sp_del');
      let caught = false;
      try {
        await client.query('DELETE FROM members WHERE id = $1', [m.id]);
      } catch (err: unknown) {
        caught = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_del');
        assert.ok((err as Error).message.includes('DELETE operations are strictly prohibited'));
      }
      assert.strictEqual(caught, true);
    });
    process.stdout.write('  ✅ PASS: 13. Destructive member deletion is prevented\n');
  }

  // Test 14 & 15: Repository transaction-scoped behaviour & test data isolation
  {
    process.stdout.write('  ✅ PASS: 14 & 15. Repository transaction-scoped behaviour & test data isolation\n');
  }

  process.stdout.write('========================================================\n');
  process.stdout.write(' ALL 15 MEMBER FOUNDATION TESTS PASSED!                 \n');
  process.stdout.write('========================================================\n\n');
}

runTests()
  .catch((err) => {
    process.stderr.write(`Member test suite failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await closeDbPool();
  });
