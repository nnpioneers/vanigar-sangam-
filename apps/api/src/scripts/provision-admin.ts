/**
 * Administrator Provisioning CLI Script
 *
 * Secure interactive or environment-driven CLI for provisioning administrative accounts.
 * Passwords are typed securely without console echo and never logged or printed.
 */

import { createInterface } from 'node:readline';
import { loadLocalEnv } from '@vanigar/config';
import type { UserRole } from '@vanigar/shared-types';
import { closeDbPool } from '../database/index.js';
import { provisionAdmin, ProvisioningError } from '../services/admin-provisioning.service.js';

loadLocalEnv();

/**
 * Prompts the user on the console for input.
 */
function promptQuestion(rl: ReturnType<typeof createInterface>, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts for a secret string without echoing characters to terminal.
 */
function promptSecret(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';

    const onData = (char: string) => {
      // Enter key (CR or LF)
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '\u0003') {
        // Ctrl+C
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\nOperation aborted by user.\n');
        process.exit(1);
      } else if (char === '\b' || char === '\x7f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  process.stdout.write('==============================================\n');
  process.stdout.write('   Vanigar Sangam Admin Provisioning Tool     \n');
  process.stdout.write('==============================================\n');

  // Check if credentials are provided via environment variables (for CI/automated setups)
  const envUsername = process.env.ADMIN_USERNAME;
  const envFullName = process.env.ADMIN_FULL_NAME;
  const envRole = process.env.ADMIN_ROLE as UserRole | undefined;
  const envPassword = process.env.ADMIN_PASSWORD;

  let username = envUsername;
  let fullName = envFullName;
  let role = envRole;
  let password = envPassword;

  if (!username || !fullName || !role || !password) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      if (!username) {
        username = await promptQuestion(rl, 'Enter Username: ');
      }
      if (!fullName) {
        fullName = await promptQuestion(rl, 'Enter Full Name: ');
      }
      if (!role) {
        const roleInput = await promptQuestion(rl, 'Select Role (SUPER_ADMIN, ADMIN, CASHIER) [SUPER_ADMIN]: ');
        role = (roleInput ? roleInput.toUpperCase() : 'SUPER_ADMIN') as UserRole;
      }
      rl.close();

      if (!password) {
        password = await promptSecret('Enter Secure Password (minimum 8 characters, will not be displayed): ');
        const confirmPassword = await promptSecret('Confirm Password: ');
        if (password !== confirmPassword) {
          process.stderr.write('❌ Error: Password confirmation does not match.\n');
          await closeDbPool();
          process.exit(1);
        }
      }
    } catch (err) {
      rl.close();
      throw err;
    }
  }

  try {
    const admin = await provisionAdmin({
      username: username!,
      fullName: fullName!,
      role: role!,
      password: password!,
    });

    process.stdout.write('\n✅ Administrator account successfully provisioned!\n');
    process.stdout.write(`   - ID:        ${admin.id}\n`);
    process.stdout.write(`   - Username:  ${admin.username}\n`);
    process.stdout.write(`   - Full Name: ${admin.fullName}\n`);
    process.stdout.write(`   - Role:      ${admin.role}\n`);
    process.stdout.write(`   - Status:    ${admin.status}\n`);
    process.stdout.write(`   - Created:   ${admin.createdAt}\n`);
    process.stdout.write('\n(Note: Passwords and hashes are never printed or stored in plaintext)\n');

    await closeDbPool();
    process.exit(0);
  } catch (err) {
    const msg = err instanceof ProvisioningError ? err.message : (err instanceof Error ? err.message : String(err));
    process.stderr.write(`\n❌ Administrator provisioning failed: ${msg}\n`);
    await closeDbPool();
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
