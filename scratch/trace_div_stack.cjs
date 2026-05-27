const fs = require('fs');

const lines = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8').replace(/\r\n/g, '\n').split('\n');

const startText = "<div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0.15rem' }}>";

let openDivs = 0;
let started = false;

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];

  if (!started && line.includes(startText)) {
    started = true;
    console.log(`🚀 Starting trace at line ${lineNum}: ${line.trim()}`);
  }

  if (started) {
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    
    const prevOpen = openDivs;
    openDivs += opens - closes;
    
    if (opens !== 0 || closes !== 0) {
      console.log(`${lineNum}: [opens: ${opens}, closes: ${closes}, prev: ${prevOpen}, current: ${openDivs}] | ${line.trim().substring(0, 80)}`);
    }

    if (openDivs <= 0) {
      console.log(`🎯 Matched outer closing div on line ${lineNum}: ${line}`);
      break;
    }
  }
}
