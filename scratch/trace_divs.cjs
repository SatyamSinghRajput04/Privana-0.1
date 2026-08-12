const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');

// Strip out comments and strings to avoid false positives
const cleanCode = code
  .replace(/\/\*[\s\S]*?\*\//g, '') // remove /* ... */
  .replace(/\/\/.*/g, '')          // remove // ...
  .replace(/`[\s\S]*?`/g, '""')     // remove template strings
  .replace(/'[^']*'/g, '""')        // remove single quoted strings
  .replace(/"[^"]*"/g, '""');       // remove double quoted strings

const lines = cleanCode.split('\n');

let stack = [];

// Regex to find JSX tags on a line
// We look for:
// 1. Closing tags: </TagName>
// 2. Self-closing tags: <TagName ... />
// 3. Opening tags: <TagName ... >
// We only care about div, Fragment, button, span, section, etc.
const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*?)?(\/?)>/g;

lines.forEach((line, idx) => {
  let match;
  // Reset regex index for this line
  tagRegex.lastIndex = 0;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const tagName = match[1];
    const isClosing = line.charAt(match.index + 1) === '/';
    const isSelfClosing = match[2] === '/';
    
    // We only trace div tags for simplicity
    if (tagName === 'div') {
      if (isSelfClosing) {
        // do nothing
      } else if (isClosing) {
        if (stack.length === 0) {
          console.log(`Mismatch: Extra closing </div> at line ${idx + 1}`);
        } else {
          stack.pop();
        }
      } else {
        stack.push(idx + 1); // push line number
      }
    }
  }
});

console.log('Nesting Trace Complete.');
if (stack.length > 0) {
  console.log(`Unclosed <div> tags opened at lines:`, stack);
} else {
  console.log('All <div> tags are balanced!');
}
