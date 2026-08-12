const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 1800; i < 1850; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
