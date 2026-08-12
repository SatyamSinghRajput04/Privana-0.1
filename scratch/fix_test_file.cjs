const fs = require('fs');

const testFile = 'src/pages/AnalyzePage_test.tsx';
const targetFile = 'src/pages/AnalyzePage.tsx';

if (!fs.existsSync(testFile)) {
  console.error(`Source file ${testFile} does not exist.`);
  process.exit(1);
}

const content = fs.readFileSync(testFile, 'utf8');
const lines = content.split('\n');
console.log('Original lines count:', lines.length);

// We need to delete lines 3144 to 3160 inclusive (1-indexed).
// In 0-indexed array, this corresponds to index 3143 to 3159 inclusive.
// That is 17 lines starting at index 3143.
const deletedLines = lines.splice(3143, 17);

console.log('Deleted lines:');
deletedLines.forEach((l, i) => console.log(`  [${i}] ${l.trim()}`));

console.log('New lines count:', lines.length);

fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
console.log(`Saved repaired code to ${targetFile}`);
