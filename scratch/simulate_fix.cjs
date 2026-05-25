const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');
const lines = code.split('\n');

// Insert </div> at line 2740 (index 2740)
lines.splice(2740, 0, '              </div>');

const modifiedCode = lines.join('\n');

// Clean code from comments and strings
const cleanCode = modifiedCode
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '')
  .replace(/`[\s\S]*?`/g, '""')
  .replace(/'[^']*'/g, '""')
  .replace(/"[^"]*"/g, '""');

// Tracing function
const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*?)?(\/?)>/g;
const traceLines = cleanCode.split('\n');
let stack = [];

traceLines.forEach((line, idx) => {
  let match;
  tagRegex.lastIndex = 0;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const tagName = match[1];
    const isClosing = line.charAt(match.index + 1) === '/';
    const isSelfClosing = match[2] === '/';
    
    if (tagName === 'div') {
      if (isSelfClosing) {
        // ignore
      } else if (isClosing) {
        if (stack.length === 0) {
          console.log(`Mismatch: Extra closing </div> at line ${idx + 1}`);
        } else {
          stack.pop();
        }
      } else {
        stack.push(idx + 1);
      }
    }
  }
});

console.log('Simulation Nesting Trace Complete.');
if (stack.length > 0) {
  console.log(`Unclosed <div> tags opened at lines:`, stack);
} else {
  console.log('ALL <div> TAGS ARE PERFECTLY BALANCED!');
}
