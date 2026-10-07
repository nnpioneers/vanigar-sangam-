const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

if (content.includes("const [selectedDate, setSelectedDate]")) {
   console.log("Already added selectedDate");
   process.exit(0);
}

// 1. Add selectedDate state
content = content.replace(
  "const [currentDate, setCurrentDate] = useState(() => {",
  "const [selectedDate, setSelectedDate] = useState<Date>(new Date());\n  const [currentDate, setCurrentDate] = useState(() => {"
);

// 2. Fetch past 30 days instead of just 7 days to get correct arrears
content = content.replace(
  "const sDate = days[0].toISOString().slice(0, 10);",
  "const s = new Date(days[0]);\n        s.setDate(s.getDate() - 30);\n        const sDate = s.toISOString().slice(0, 10);"
);

// 3. Make calendar days clickable and highlight selectedDate
content = content.replace(
  "const isToday = d.toISOString().slice(0, 10) === actualTodayStr;",
  "const isToday = d.toISOString().slice(0, 10) === actualTodayStr;\n             const isSelected = d.toISOString().slice(0, 10) === selectedDate.toISOString().slice(0, 10);"
);
content = content.replace(
  "<div key={i} style={{ flex: 1, background: isToday ? '#f0fdf4' : '#fff', border: isToday ? '1px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '0.375rem', padding: '0.5rem 0', textAlign: 'center', minWidth: '80px' }}>",
  "<div key={i} onClick={() => setSelectedDate(d)} style={{ cursor: 'pointer', flex: 1, background: isSelected ? '#f0fdf4' : '#fff', border: isSelected ? '2px solid #16a34a' : (isToday ? '1px solid #16a34a' : '1px solid #e2e8f0'), borderRadius: '0.375rem', padding: '0.5rem 0', textAlign: 'center', minWidth: '80px' }}>"
);

// 4. Update table rendering to use selectedDate for the Pay button
content = content.replace(
  "const todayDateStr = new Date().toISOString().slice(0,10);",
  "const todayDateStr = new Date().toISOString().slice(0,10);\n                  const selectedDateStr = selectedDate.toISOString().slice(0, 10);"
);
content = content.replace(
  "const rowPayments = payments[row.id]?.[todayDateStr] || { s: false, l: false };",
  "const rowPayments = payments[row.id]?.[selectedDateStr] || { s: false, l: false };"
);
content = content.replace(
  "onClick={() => handlePay(row.id, todayDateStr, true, row.hasLoan)}",
  "onClick={() => handlePay(row.id, selectedDateStr, true, row.hasLoan)}"
);

// 5. Update customPayModal arrears calculation to use last 30 days instead of visible days
content = content.replace(
  "for (const d of days) {",
  "const arrearsDays = Array.from({length: 30}, (_, i) => {\n                  const d = new Date(actualTodayStr);\n                  d.setDate(d.getDate() - 30 + i);\n                  return d;\n               });\n               for (const d of arrearsDays) {"
);

// 6. Update customPayModal API calls
const apiCallCode = `
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
`;
content = content.replace(
  "return newPrev;\n          });\n          \n          notification.success",
  apiCallCode + "\n             return newPrev;\n          });\n          \n          notification.success"
);

fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', content);
console.log("Fixed page.tsx");
