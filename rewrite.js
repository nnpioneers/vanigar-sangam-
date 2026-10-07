const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'apps', 'web', 'src', 'app', 'daily-sheets', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const modalStartTag = '<ConfirmDialog\r\n          isOpen={Boolean(customPayModal)}';
const nextModalTag = '<ConfirmDialog\r\n          isOpen={Boolean(pastPayModal)}';

const startIndex = content.indexOf(modalStartTag);
const endIndex = content.indexOf(nextModalTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Tags not found', { startIndex, endIndex });
  process.exit(1);
}

const replacement = \        <ConfirmDialog
          isOpen={Boolean(customPayModal)}
          onClose={() => setCustomPayModal(null)}
          title={\\\Custom Payment for \\\\\\}
          description="Select the amounts you are paying. Arrears will be cleared first."
          confirmLabel={\\\Pay ₹\\\\\\}
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (customSCount === 0 && customLCount === 0) {
              notification.error("Please select an amount to pay.");
              return;
            }
            
            const actualTodayStr = new Date().toISOString().slice(0,10);
            
            setPayments(prev => {
               const newPrev = { ...prev };
               if (!newPrev[customPayModal.id]) newPrev[customPayModal.id] = {};
               
               let sRemaining = customSCount;
               let lRemaining = customLCount;
               
               const orderedDates = [...days.map(d => d.toISOString().slice(0,10))];
               if (!orderedDates.includes(actualTodayStr)) orderedDates.push(actualTodayStr);
               orderedDates.sort();
               
               let advanceDateS = new Date(actualTodayStr);
               let advanceDateL = new Date(actualTodayStr);
               
               for (const dStr of orderedDates) {
                  if (dStr > actualTodayStr) break;
                  
                  const p = newPrev[customPayModal.id][dStr] || { s: false, l: false };
                  if (!p.s && sRemaining > 0) {
                     newPrev[customPayModal.id][dStr] = { ...newPrev[customPayModal.id][dStr], s: true, sDate: actualTodayStr };
                     sRemaining--;
                  }
                  if (!p.l && customPayModal.hasLoan && lRemaining > 0) {
                     newPrev[customPayModal.id][dStr] = { ...newPrev[customPayModal.id][dStr], l: true, lDate: actualTodayStr };
                     lRemaining--;
                  }
               }
               
               while(sRemaining > 0) {
                  advanceDateS.setDate(advanceDateS.getDate() + 1);
                  const advStr = advanceDateS.toISOString().slice(0,10);
                  if (!newPrev[customPayModal.id][advStr]?.s) {
                     newPrev[customPayModal.id][advStr] = { ...(newPrev[customPayModal.id][advStr] || {s:false, l:false}), s: true, sDate: actualTodayStr };
                     sRemaining--;
                  }
               }
               
               while(lRemaining > 0 && customPayModal.hasLoan) {
                  advanceDateL.setDate(advanceDateL.getDate() + 1);
                  const advStr = advanceDateL.toISOString().slice(0,10);
                  if (!newPrev[customPayModal.id][advStr]?.l) {
                     newPrev[customPayModal.id][advStr] = { ...(newPrev[customPayModal.id][advStr] || {s:false, l:false}), l: true, lDate: actualTodayStr };
                     lRemaining--;
                  }
               }
               
               return newPrev;
            });
            
            notification.success("Custom payments recorded successfully");
            setCustomPayModal(null);
          }}
        >
          {(() => {
             const actualTodayStr = new Date().toISOString().slice(0,10);
             let sArrearsCount = 0;
             let lArrearsCount = 0;
             let sTodayMissing = false;
             let lTodayMissing = false;
             
             if (customPayModal) {
                 for (const d of days) {
                    const dStr = d.toISOString().slice(0,10);
                    if (dStr < actualTodayStr) {
                       if (!payments[customPayModal.id]?.[dStr]?.s) sArrearsCount++;
                       if (customPayModal.hasLoan && !payments[customPayModal.id]?.[dStr]?.l) lArrearsCount++;
                    } else if (dStr === actualTodayStr) {
                       if (!payments[customPayModal.id]?.[dStr]?.s) sTodayMissing = true;
                       if (customPayModal.hasLoan && !payments[customPayModal.id]?.[dStr]?.l) lTodayMissing = true;
                    }
                 }
             }
             
             const sArrearsCovered = Math.min(sArrearsCount, customSCount);
             const sTodayCovered = Math.min(sTodayMissing ? 1 : 0, Math.max(0, customSCount - sArrearsCount));
             const sAdvanceCovered = Math.max(0, customSCount - sArrearsCount - (sTodayMissing ? 1 : 0));
             
             const lArrearsCovered = Math.min(lArrearsCount, customLCount);
             const lTodayCovered = Math.min(lTodayMissing ? 1 : 0, Math.max(0, customLCount - lArrearsCount));
             const lAdvanceCovered = Math.max(0, customLCount - lArrearsCount - (lTodayMissing ? 1 : 0));
             
             const sRemArrears = sArrearsCount - sArrearsCovered;
             const lRemArrears = lArrearsCount - lArrearsCovered;

             return (
               <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 
                 {/* Savings Breakdown */}
                 <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Savings Amount</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
                         <button onClick={() => setCustomSCount(Math.max(0, customSCount - 1))} style={{ width: '28px', height: '28px', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
                         <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customSCount}</span>
                         <button onClick={() => setCustomSCount(customSCount + 1)} style={{ width: '28px', height: '28px', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                       {sArrearsCount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Balance Due ({sArrearsCount} days):</span>
                             <span style={{ fontWeight: 600, color: sRemArrears > 0 ? '#ef4444' : '#16a34a' }}>₹{((sRemArrears) * (customPayModal?.daily || 0)) / 100}</span>
                          </div>
                       )}
                       {sTodayMissing && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Present (Today):</span>
                             <span style={{ fontWeight: 600, color: sTodayCovered === 0 ? '#ef4444' : '#16a34a' }}>₹{((1 - sTodayCovered) * (customPayModal?.daily || 0)) / 100}</span>
                          </div>
                       )}
                       {sAdvanceCovered > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ color: '#64748b' }}>Advance Paid:</span>
                             <span style={{ fontWeight: 600, color: '#16a34a' }}>+ ₹{(sAdvanceCovered * (customPayModal?.daily || 0)) / 100}</span>
                          </div>
                       )}
                    </div>
                 </div>
                 
                 {/* Loan Breakdown */}
                 {customPayModal?.hasLoan && (
                   <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-espresso-900)' }}>Loan Repayment</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.25rem' }}>
                           <button onClick={() => setCustomLCount(Math.max(0, customLCount - 1))} style={{ width: '28px', height: '28px', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>-</button>
                           <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{customLCount}</span>
                           <button onClick={() => setCustomLCount(customLCount + 1)} style={{ width: '28px', height: '28px', border: 'none', background: '#f1f5f9', borderRadius: '0.25rem', cursor: 'pointer', color: '#475569' }}>+</button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                         {lArrearsCount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                               <span style={{ color: '#64748b' }}>Balance Due ({lArrearsCount} days):</span>
                               <span style={{ fontWeight: 600, color: lRemArrears > 0 ? '#ef4444' : '#16a34a' }}>₹{((lRemArrears) * (customPayModal?.loan || 0)) / 100}</span>
                            </div>
                         )}
                         {lTodayMissing && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                               <span style={{ color: '#64748b' }}>Present (Today):</span>
                               <span style={{ fontWeight: 600, color: lTodayCovered === 0 ? '#ef4444' : '#16a34a' }}>₹{((1 - lTodayCovered) * (customPayModal?.loan || 0)) / 100}</span>
                            </div>
                         )}
                         {lAdvanceCovered > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                               <span style={{ color: '#64748b' }}>Advance Paid:</span>
                               <span style={{ fontWeight: 600, color: '#16a34a' }}>+ ₹{(lAdvanceCovered * (customPayModal?.loan || 0)) / 100}</span>
                            </div>
                         )}
                      </div>
                   </div>
                 )}
               </div>
             );
          })()}
        </ConfirmDialog>
\r\n\r\n\;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('Successfully updated modal logic.');
