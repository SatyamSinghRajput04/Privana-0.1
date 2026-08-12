import fs from 'fs';

const content = fs.readFileSync('./src/pages/AnalyzePage.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('selectedDataset')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
