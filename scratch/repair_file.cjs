const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
const lines = code.split('\n');
console.log('Current lines count:', lines.length);

// 1. Insert the deleted 16 lines back at line 44 (index 43)
const linesToInsert = [
  "        parts.push(<strong key={`${key}-b${idx++}`} style={{ color: '#f4f4f5', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);",
  "      } else {",
  "        parts.push(<em key={`${key}-i${idx++}`} style={{ color: '#d4d4d8', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);",
  "      }",
  "      last = m.index + token.length;",
  "    }",
  "    if (last < raw.length) parts.push(<Fragment key={`${key}-te${idx++}`}>{raw.slice(last)}</Fragment>);",
  "    return parts.length === 1 ? parts[0] : <Fragment key={key}>{parts}</Fragment>;",
  "  };",
  "",
  "  const lines = text.split('\\n');",
  "  const nodes: React.ReactNode[] = [];",
  "  let i = 0;",
  "  while (i < lines.length) {",
  "    const line = lines[i];",
  ""
];

lines.splice(43, 0, ...linesToInsert);
console.log('After restoring 16 lines, lines count:', lines.length);

// 2. Find the true orphan index (must be after line 3000)
let orphanIdx = -1;
for (let i = 3000; i < lines.length; i++) {
  if (lines[i].includes('0 }}')) {
    orphanIdx = i;
    break;
  }
}

if (orphanIdx !== -1) {
  console.log('Found true orphan index:', orphanIdx);
  // Delete the 16 lines of orphaned code
  lines.splice(orphanIdx, 16);
} else {
  console.log('WARNING: True orphan index not found!');
}

fs.writeFileSync('src/pages/AnalyzePage.tsx', lines.join('\n'));
console.log('Final lines count:', lines.length);
