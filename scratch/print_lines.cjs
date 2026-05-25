const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 3130; i < 3170; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
