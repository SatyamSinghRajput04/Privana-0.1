const fs = require('fs');

const content = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('ComputedView') || line.includes('function ComputedView') || line.includes('const ComputedView')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
