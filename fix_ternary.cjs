const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// Fix 1: broken ternary — missing ? after isMentalHealthSchema condition
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('isMentalHealthSchema && kpis.records > 0') && 
      i + 1 < lines.length && lines[i+1].trim().startsWith('[')) {
    lines[i+1] = lines[i+1].replace(/^(\s*)\[/, '$1? [');
    console.log('FIXED: missing ? in ternary at line', i+2);
    break;
  }
}

// Fix 2: fix all remaining em dash placeholder issues
src = lines.join('\n');

// Fix em dash fallback values (— character stored as mojibake)
const fixes = [
  // Fix placeholder dashes in value fields
  [/value: kpis\.records > 0 \? kpis\.records\.toLocaleString\(\) : \(selectedDataset\?\.row_count\?\.toLocaleString\(\) \|\| '[^']*'\)/, 
   `value: kpis.records > 0 ? kpis.records.toLocaleString() : (selectedDataset?.row_count?.toLocaleString() || '\u2014')`],
  // Fix column count dash
  [/value: columnsList\.length \|\| '[^']*', sub: 'Schema/,
   `value: columnsList.length || '\u2014', sub: 'Schema`],
  // Fix numeric fields dash
  [/value: numericColCount \|\| '[^']*', sub: 'Queryable/,
   `value: numericColCount || '\u2014', sub: 'Queryable`],
  // Fix dataset name dash
  [/\?\.slice\(0,10\) \|\| '[^']*', sub: selectedDataset/,
   `?.slice(0,10) || '\u2014', sub: selectedDataset`],
];

for (const [pattern, replacement] of fixes) {
  src = src.replace(pattern, replacement);
}

// Final comprehensive mojibake sweep
const mojiMap = [
  ['\u00E2\u0080\u0094', '\u2014'],
  ['\u00E2\u0080\u0093', '\u2013'],
  ['\u00E2\u0086\u0092', '\u2192'],
  ['\u00C3\u0097', '\u00D7'],
  ['\u00C2\u00B2', '\u00B2'],
  ['\u00CF\u0083', '\u03C3'],
  ['\u00E2\u0096\u00B2', '\u25B2'],
  ['\u00E2\u0096\u00BC', '\u25BC'],
  ['\u00C5\u00B7', '\u0177'],
  ['\u00C2\u00B7', '\u00B7'],
  ['\u00E2\u0094\u0080', '\u2500'],
  ['\u00E2\u009C\u0095', '\u2715'],
  ['\u00E2\u0086\u0090 ', '\u2190 '],
];
for (const [from, to] of mojiMap) {
  while (src.includes(from)) src = src.split(from).join(to);
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('Done. File:', fs.statSync(FILE).size, 'bytes');
