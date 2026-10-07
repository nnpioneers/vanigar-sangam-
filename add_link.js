const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

// Import Link
if (!content.includes("import Link from 'next/link';")) {
    content = content.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect } from 'react';\nimport Link from 'next/link';"
    );
}

// Wrap Member ID
const oldIdCell = `<td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#16a34a', borderRight: '1px solid #e2e8f0' }}>{row.id}</td>`;
const newIdCell = `<td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>\n  <Link href={\`/members/\${row.memberId}\`} style={{ color: '#16a34a', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>{row.id}</Link>\n</td>`;
content = content.replace(oldIdCell, newIdCell);

// Wrap Member Name
const oldNameCell = `<div style={{ fontWeight: 600, color: 'var(--color-espresso-900)' }}>{row.name}</div>`;
const newNameCell = `<div style={{ fontWeight: 600 }}>\n  <Link href={\`/members/\${row.memberId}\`} style={{ color: 'var(--color-espresso-900)', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>{row.name}</Link>\n</div>`;
content = content.replace(oldNameCell, newNameCell);

fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', content);
console.log("Added Link to member ID and name.");
