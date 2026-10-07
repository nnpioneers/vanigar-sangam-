const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

const oldCode = `          setPayments(prev => {
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
             
          // Perform actual API calls for all custom payments sequentially to persist
          for (const dStr of Object.keys(newPrev[customPayModal.id])) {
             const dayP = newPrev[customPayModal.id][dStr];
             if (dayP.sDate === actualTodayStr || dayP.lDate === actualTodayStr) {
                 await apiRequest('/daily-sheets/record-payment', {
                    method: 'POST',
                    body: {
                       memberId: customPayModal.memberId,
                       businessDate: dStr,
                       savingsAmountPaise: dayP.sDate === actualTodayStr ? customPayModal.daily : 0,
                       loanAmountPaise: dayP.lDate === actualTodayStr ? customPayModal.loan : 0,
                       loanId: customPayModal.loanId
                    }
                 }).catch(console.error);
             }
          }

             return newPrev;
          });`;

const newCode = `          
          // First, calculate what the new state will be without modifying it directly
          const newPrev = { ...payments };
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
          
          // Perform actual API calls for all custom payments sequentially to persist
          for (const dStr of Object.keys(newPrev[customPayModal.id])) {
             const dayP = newPrev[customPayModal.id][dStr];
             if (dayP.sDate === actualTodayStr || dayP.lDate === actualTodayStr) {
                 await apiRequest('/daily-sheets/record-payment', {
                    method: 'POST',
                    body: {
                       memberId: customPayModal.memberId,
                       businessDate: dStr,
                       savingsAmountPaise: dayP.sDate === actualTodayStr ? customPayModal.daily : 0,
                       loanAmountPaise: dayP.lDate === actualTodayStr ? customPayModal.loan : 0,
                       loanId: customPayModal.loanId
                    }
                 }).catch(console.error);
             }
          }
          
          setPayments(newPrev);`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', content);
console.log("Fixed async state issue");
