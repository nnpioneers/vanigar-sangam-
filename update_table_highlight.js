const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

// 1. Update Table Headers for Days
const oldHeaderDays = `{days.map((d, i) => (
                  <th key={i} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', minWidth: '40px' }}>
                    {d.getDate()}/{d.getMonth() + 1}<br/>
                    <span style={{fontWeight: 400, textTransform: 'capitalize'}}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</span>
                  </th>
                ))}`;

const newHeaderDays = `{days.map((d, i) => {
                  const isToday = d.toISOString().slice(0, 10) === actualTodayStr;
                  const isSelected = d.toISOString().slice(0, 10) === selectedDate.toISOString().slice(0, 10);
                  const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');
                  const color = isToday ? '#16a34a' : 'inherit';
                  return (
                  <th key={i} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', minWidth: '40px', background: bg, color: color, fontWeight: isToday ? 800 : 600 }}>
                    {d.getDate()}/{d.getMonth() + 1}<br/>
                    <span style={{fontWeight: isToday ? 700 : 400, textTransform: 'capitalize'}}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</span>
                  </th>
                  );
                })}`;

// 2. Update Sub-Headers (S/L)
const oldSubHeaderDays = `{days.map((d, i) => (
                   <th key={i} style={{ padding: '0.25rem 0', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
                       <span style={{flex: 1, textAlign: 'center'}}>S</span>
                       <span style={{flex: 1, textAlign: 'center'}}>L</span>
                     </div>
                   </th>
                ))}`;

const newSubHeaderDays = `{days.map((d, i) => {
                   const isToday = d.toISOString().slice(0, 10) === actualTodayStr;
                   const isSelected = d.toISOString().slice(0, 10) === selectedDate.toISOString().slice(0, 10);
                   const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');
                   const color = isToday ? '#16a34a' : 'inherit';
                   return (
                   <th key={i} style={{ padding: '0.25rem 0', textAlign: 'center', borderRight: '1px solid #e2e8f0', background: bg, color: color, fontWeight: isToday ? 800 : 600 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}>
                       <span style={{flex: 1, textAlign: 'center'}}>S</span>
                       <span style={{flex: 1, textAlign: 'center'}}>L</span>
                     </div>
                   </th>
                   );
                })}`;

// 3. Update Table Body Cells (td)
const oldTdDay = `<td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>`;

const newTdDay = `
                       const isSelected = dateStr === selectedDate.toISOString().slice(0, 10);
                       const isToday = dateStr === actualTodayStr;
                       const bg = isSelected ? '#f0fdf4' : (isToday ? '#f8fafc' : 'transparent');
                       const shadow = isSelected ? 'inset 0 0 10px rgba(22, 163, 74, 0.1)' : 'none';
                       return (
                         <td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', background: bg, boxShadow: shadow }}>`;

content = content.replace(oldHeaderDays, newHeaderDays);
content = content.replace(oldSubHeaderDays, newSubHeaderDays);
content = content.replace(
  `                       return (\n                         <td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>`,
  `                       const isSelected = dateStr === selectedDate.toISOString().slice(0, 10);\n                       const isToday = dateStr === actualTodayStr;\n                       const bg = isSelected ? '#dcfce7' : (isToday ? '#f0fdf4' : 'transparent');\n                       const shadow = isSelected ? 'inset 0 0 8px rgba(22, 163, 74, 0.2)' : 'none';\n                       return (\n                         <td key={dayIndex} style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', background: bg, boxShadow: shadow }}>`
);

fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', content);
console.log("Updated highlights.");
