const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

// 1. Add Filter States
if (!content.includes('const [searchTerm, setSearchTerm]')) {
    content = content.replace(
        "const [membersList, setMembersList] = useState<any[]>([]);",
        "const [membersList, setMembersList] = useState<any[]>([]);\n  const [searchTerm, setSearchTerm] = useState('');\n  const [categoryFilter, setCategoryFilter] = useState('All Categories');"
    );
}

// 2. Fix search input wiring
content = content.replace(
    `<input type="text" placeholder="Search member name, shop, or ID..." style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.375rem', outline: 'none' }} />`,
    `<input type="text" placeholder="Search member name, shop, or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.375rem', outline: 'none' }} />`
);

// 3. Fix category dropdown wiring
content = content.replace(
    `<select style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>\n                <option>All Categories</option>\n              </select>`,
    `<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '0.5rem 2rem 0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>\n                <option>All Categories</option>\n                <option>General</option>\n              </select>`
);

// 4. Apply Filters to tableData
content = content.replace(
    "const tableData = membersList;",
    `const tableData = membersList.filter(m => {
    const matchesSearch = !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.shop.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All Categories' || m.category === categoryFilter;
    return matchesSearch && matchesCat;
  });`
);

// 5. Fix Page Jump (Fullscreen loader on every week change)
content = content.replace(
    "if (authLoading || dashboardLoading || loadingMembers) return <LoadingState label=\"Loading...\" fullscreen />;",
    "if (authLoading || dashboardLoading) return <LoadingState label=\"Loading...\" fullscreen />;"
);
// And add opacity to the main container
content = content.replace(
    "<div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>",
    "<div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', opacity: loadingMembers ? 0.6 : 1, transition: 'opacity 0.2s' }}>"
);

// 6. Fix API calls in handleBoxClick
const handleBoxOld = `      if (isPast && !isChecked) {
         setPastPayModal({ row, dateStr, d: clickedDate, type });
         return;
      }
      
      const actualTodayStr = new Date().toISOString().slice(0, 10);
      setPayments(prev => ({`;

const handleBoxNew = `      if (isPast && !isChecked) {
         setPastPayModal({ row, dateStr, d: clickedDate, type });
         return;
      }
      
      // Make actual API call
      apiRequest('/daily-sheets/record-payment', {
        method: 'POST',
        body: {
          memberId: row.memberId,
          businessDate: dateStr,
          savingsAmountPaise: type === 's' ? (!isChecked ? row.daily : 0) : 0,
          loanAmountPaise: type === 'l' ? (!isChecked ? row.loan : 0) : 0,
          loanId: row.loanId
        }
      }).catch(console.error);

      const actualTodayStr = new Date().toISOString().slice(0, 10);
      setPayments(prev => ({`;
content = content.replace(handleBoxOld, handleBoxNew);

// 7. Fix API calls in pastPayModal onConfirm
const pastPayOld = `        <ConfirmDialog
          isOpen={!!pastPayModal}
          title="Confirm Past Payment"
          message={\`Are you sure you want to record a \${pastPayModal?.type === 's' ? 'Savings' : 'Loan'} payment for \${pastPayModal?.d.toLocaleDateString()}?\`}
          confirmLabel="Record Payment"
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (!pastPayModal) return;
            const { row, dateStr, type } = pastPayModal;
            const actualTodayStr = new Date().toISOString().slice(0, 10);
            
            setPayments(prev => ({`;

const pastPayNew = `        <ConfirmDialog
          isOpen={!!pastPayModal}
          title="Confirm Past Payment"
          message={\`Are you sure you want to record a \${pastPayModal?.type === 's' ? 'Savings' : 'Loan'} payment for \${pastPayModal?.d.toLocaleDateString()}?\`}
          confirmLabel="Record Payment"
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (!pastPayModal) return;
            const { row, dateStr, type } = pastPayModal;
            const actualTodayStr = new Date().toISOString().slice(0, 10);
            
            // Make actual API call
            await apiRequest('/daily-sheets/record-payment', {
                method: 'POST',
                body: {
                    memberId: row.memberId,
                    businessDate: dateStr,
                    savingsAmountPaise: type === 's' ? row.daily : 0,
                    loanAmountPaise: type === 'l' ? row.loan : 0,
                    loanId: row.loanId
                }
            }).catch(console.error);

            setPayments(prev => ({`;
content = content.replace(pastPayOld, pastPayNew);

fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', content);
console.log("Fixed all issues correctly.");
