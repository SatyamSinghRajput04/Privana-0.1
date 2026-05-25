const fs = require('fs');

const f1 = 'src/pages/AnalyzePage.tsx';
const f2 = 'src/pages/AnalyzePage_test.tsx';

if (!fs.existsSync(f1) || !fs.existsSync(f2)) {
  console.log('One of the files does not exist.');
  process.exit(1);
}

const c1 = fs.readFileSync(f1, 'utf8').split('\n');
const c2 = fs.readFileSync(f2, 'utf8').split('\n');

console.log(`File 1 lines: ${c1.length}`);
console.log(`File 2 lines: ${c2.length}`);

let diffCount = 0;
const maxDiffs = 20;

for (let i = 0; i < Math.max(c1.length, c2.length); i++) {
  const l1 = c1[i] || '';
  const l2 = c2[i] || '';
  if (l1 !== l2) {
    diffCount++;
    if (diffCount <= maxDiffs) {
      console.log(`Line ${i + 1} differ:`);
      console.log(`  File 1: ${l1.trim().slice(0, 100)}`);
      console.log(`  File 2: ${l2.trim().slice(0, 100)}`);
    }
  }
}

console.log(`Total line differences: ${diffCount}`);
