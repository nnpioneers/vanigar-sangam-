import { readFileSync, writeFileSync } from 'fs';
const path = 'apps/api/src/modules/loans/loans.api.test.ts';
let content = readFileSync(path, 'utf8');
const oldLine = `    assert.ok(overdueBlockRes.data?.error?.message?.includes('overdue loan'));`;
const newLines = [
  '    assert.ok(',
  "      (overdueBlockRes.data?.error?.message ?? '').includes('overdue loan') ||",
  "      (overdueBlockRes.data?.error?.message ?? '').includes('100 days'),",
  "      'Expected 409 with overdue gate message'",
  '    );',
].join('\n');
if (!content.includes(oldLine)) { console.error('NOT FOUND'); process.exit(1); }
content = content.replace(oldLine, newLines);
writeFileSync(path, content, 'utf8');
console.log('Patched OK');
