const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
const lines = code.split('\n');

lines.forEach((line, index) => {
  if (line.includes('useEffect')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 10 lines after
    for (let j = index + 1; j < Math.min(index + 12, lines.length); j++) {
      console.log(`  ${j + 1}: ${lines[j]}`);
    }
  }
});
