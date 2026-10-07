const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

// 1. Add getLocalISODate helper function right after imports
content = content.replace(
    "import { apiRequest } from '@/lib/api/client';",
    "import { apiRequest } from '@/lib/api/client';\n\nconst getLocalISODate = (d: Date) => {\n  const offset = d.getTimezoneOffset() * 60000;\n  return new Date(d.getTime() - offset).toISOString().slice(0, 10);\n};"
);

// 2. Fix currentDate initialization to start from the 1st/8th/15th/22nd/29th of the month
const oldCurrentDate = `  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    // Default to a week that includes today
    d.setDate(d.getDate() - d.getDay() + 1); // Start of week (Monday)
    return d;
  });`;
const newCurrentDate = `  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    const dom = d.getDate();
    const chunkStart = Math.floor((dom - 1) / 7) * 7 + 1;
    d.setDate(chunkStart);
    return d;
  });`;
content = content.replace(oldCurrentDate, newCurrentDate);

// 3. Fix nextWeek and prevWeek logic
const oldNextWeek = `  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };
  
  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };`;
const newNextWeek = `  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    if (next.getMonth() !== currentDate.getMonth()) {
        next.setDate(1);
    }
    setCurrentDate(next);
  };
  
  const prevWeek = () => {
    const prev = new Date(currentDate);
    if (currentDate.getDate() === 1) {
       prev.setDate(0); // Last day of prev month
       const lastDay = prev.getDate();
       const chunkStart = Math.floor((lastDay - 1) / 7) * 7 + 1;
       prev.setDate(chunkStart);
    } else {
       prev.setDate(prev.getDate() - 7);
       if (prev.getMonth() !== currentDate.getMonth()) {
           prev.setDate(1);
       }
    }
    setCurrentDate(prev);
  };`;
content = content.replace(oldNextWeek, newNextWeek);

// 4. Fix ALL `.toISOString().slice(0, 10)` to use `getLocalISODate()`
// We'll just replace `.toISOString().slice(0, 10)` or `.toISOString().slice(0,10)`
content = content.replace(/\.toISOString\(\)\.slice\(0,\s*10\)/g, ' => getLocalISODate() replacement'); // Temporary marker to avoid tricky regex backreferences
// Actually, it's safer to just replace it:
content = content.split('.toISOString().slice(0, 10)').join(') /* temp */');
content = content.split('.toISOString().slice(0,10)').join(') /* temp */');

// Now we need to wrap the variable before it with getLocalISODate( ... )
// Instead of complex regex in js, let's just use string replacements for the known ones:
let finalContent = fs.readFileSync('apps/web/src/app/daily-sheets/page.tsx', 'utf8');

finalContent = finalContent.replace(
    "import { apiRequest } from '@/lib/api/client';",
    "import { apiRequest } from '@/lib/api/client';\n\nconst getLocalISODate = (d: Date) => {\n  const offset = d.getTimezoneOffset() * 60000;\n  return new Date(d.getTime() - offset).toISOString().slice(0, 10);\n};"
);

finalContent = finalContent.replace(oldCurrentDate, newCurrentDate);
finalContent = finalContent.replace(oldNextWeek, newNextWeek);

// Replace known ISO strings
finalContent = finalContent.replace(/d\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(d)");
finalContent = finalContent.replace(/days\[0\]\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(days[0])");
finalContent = finalContent.replace(/days\[6\]\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(days[6])");
finalContent = finalContent.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(new Date())");
finalContent = finalContent.replace(/selectedDate\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(selectedDate)");
finalContent = finalContent.replace(/advanceDateS\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(advanceDateS)");
finalContent = finalContent.replace(/advanceDateL\.toISOString\(\)\.slice\(0,\s*10\)/g, "getLocalISODate(advanceDateL)");

// Also fix the select month onChange logic so it snaps to the 1st correctly.
const oldMonthChange = `              <select value={currentDate.getMonth()} onChange={(e) => {
                const newMonthIndex = parseInt(e.target.value, 10);
                const newDate = new Date(2026, newMonthIndex, 1);
                setCurrentDate(newDate);
              }}`;
const newMonthChange = `              <select value={currentDate.getMonth()} onChange={(e) => {
                const newMonthIndex = parseInt(e.target.value, 10);
                const newDate = new Date(currentDate.getFullYear(), newMonthIndex, 1);
                setCurrentDate(newDate);
              }}`;
finalContent = finalContent.replace(oldMonthChange, newMonthChange);

fs.writeFileSync('apps/web/src/app/daily-sheets/page.tsx', finalContent);
console.log("Fixed date chunking and timezone issues.");
