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

let duplicateIdx = -1;
let duplicateEndIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('KPI Card 1: Sleep Hours')) {
    // Look ahead to see if another "KPI Card 1: Sleep Hours" exists
    let nextCommentIdx = -1;
    for (let j = i + 1; j < Math.min(i + 45, lines.length); j++) {
      if (lines[j].includes('KPI Card 1: Sleep Hours')) {
        nextCommentIdx = j;
        break;
      }
    }
    
    if (nextCommentIdx !== -1) {
      duplicateIdx = i;
      duplicateEndIdx = nextCommentIdx;
      break;
    }
  }
}

if (duplicateIdx !== -1) {
  console.log(`Found duplicate stub starting at line: ${duplicateIdx + 1} and ending before line: ${duplicateEndIdx + 1}`);
  const deleteCount = duplicateEndIdx - duplicateIdx;
  console.log(`Deleting ${deleteCount} lines...`);
  const deletedLines = lines.splice(duplicateIdx, deleteCount);
  console.log('Deleted lines:');
  deletedLines.forEach((l, idx) => console.log(`  [${idx}] ${l.trim()}`));
  
  fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
  console.log(`Successfully wrote fixed file to ${targetFile}`);
} else {
  console.log('ERROR: Could not find duplicate stub comments.');
}
