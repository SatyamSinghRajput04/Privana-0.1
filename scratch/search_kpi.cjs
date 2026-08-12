const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');
const lines = code.split('\n');

lines.forEach((line, index) => {
  if (line.includes('KPI Card 1')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
