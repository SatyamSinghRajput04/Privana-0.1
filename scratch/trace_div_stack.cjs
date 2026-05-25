const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');

// A simple lexical parser that tokenizes JSX tags, ignoring comments and string literals
function parseJSX(code) {
  let pos = 0;
  let len = code.length;
  let tokens = [];
  
  while (pos < len) {
    // 1. Skip single line comments
    if (code.startsWith('//', pos)) {
      pos = code.indexOf('\n', pos);
      if (pos === -1) pos = len;
      continue;
    }
    
    // 2. Skip multi line comments
    if (code.startsWith('/*', pos)) {
      pos = code.indexOf('*/', pos);
      if (pos === -1) pos = len;
      else pos += 2;
      continue;
    }
    
    // 3. Skip template literals
    if (code.charAt(pos) === '`') {
      pos++;
      while (pos < len && code.charAt(pos) !== '`') {
        if (code.charAt(pos) === '\\') pos += 2;
        else pos++;
      }
      pos++;
      continue;
    }
    
    // 4. Skip string literals
    if (code.charAt(pos) === '"' || code.charAt(pos) === "'") {
      const quote = code.charAt(pos);
      pos++;
      while (pos < len && code.charAt(pos) !== quote) {
        if (code.charAt(pos) === '\\') pos += 2;
        else pos++;
      }
      pos++;
      continue;
    }
    
    // 5. Look for JSX tags
    if (code.charAt(pos) === '<') {
      // Check if it's a comment or operator
      const nextChar = code.charAt(pos + 1);
      if (nextChar === '/' || /[a-zA-Z]/.test(nextChar)) {
        // Find end of tag
        let endPos = pos;
        let inQuotes = false;
        let quoteChar = null;
        
        while (endPos < len) {
          const c = code.charAt(endPos);
          if (inQuotes) {
            if (c === quoteChar) inQuotes = false;
            if (c === '\\') endPos++; // skip escaped
          } else {
            if (c === '"' || c === "'") {
              inQuotes = true;
              quoteChar = c;
            } else if (c === '>') {
              break;
            }
          }
          endPos++;
        }
        
        const tagText = code.slice(pos, endPos + 1);
        const lineNum = code.slice(0, pos).split('\n').length;
        tokens.push({ text: tagText, line: lineNum, pos: pos });
        pos = endPos + 1;
        continue;
      }
    }
    
    pos++;
  }
  
  return tokens;
}

const tokens = parseJSX(code);
let stack = [];

tokens.forEach(tok => {
  const text = tok.text;
  const isClosing = text.startsWith('</');
  const isSelfClosing = text.endsWith('/>');
  
  // Extract tag name
  const match = text.match(/^<\/?([a-zA-Z0-9]+)/);
  if (!match) return;
  const tag = match[1];
  
  // We only trace div, Fragment, etc.
  if (tag === 'div') {
    if (isSelfClosing) {
      // ignore
    } else if (isClosing) {
      if (stack.length === 0) {
        console.log(`Error: Extra closing </div> at line ${tok.line}`);
      } else {
        const top = stack.pop();
        // check if match
        if (top.tag !== 'div') {
          console.log(`Error: Mismatched tag. Closed </div> but top of stack is <${top.tag}> from line ${top.line}`);
        }
      }
    } else {
      stack.push({ tag: 'div', line: tok.line });
    }
  } else if (tag === 'Fragment') {
    if (isSelfClosing) {
      // ignore
    } else if (isClosing) {
      const top = stack.pop();
      if (!top || top.tag !== 'Fragment') {
        console.log(`Error: Mismatched tag. Closed </Fragment> but top of stack is <${top ? top.tag : 'empty'}> from line ${top ? top.line : 'N/A'}`);
      }
    } else {
      stack.push({ tag: 'Fragment', line: tok.line });
    }
  }
});

console.log('\nFinal Stack State:');
if (stack.length > 0) {
  stack.forEach(item => {
    console.log(`Unclosed <${item.tag}> opened at line ${item.line}`);
  });
} else {
  console.log('All tracked tags balanced!');
}
