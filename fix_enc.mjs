const fs = require('fs');
const path = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';

let content = fs.readFileSync(path, 'utf8');

// Fix all mojibake — these are UTF-8 bytes misread as Latin-1
const fixes = [
  // Superscript 2: Â² → ²
  ['\u00C2\u00B2', '\u00B2'],
  // Em dash: â€" → —
  ['\u00E2\u0080\u0094', '\u2014'],
  // En dash: â€" → –
  ['\u00E2\u0080\u0093', '\u2013'],
  // Right arrow: â†' → →
  ['\u00E2\u0086\u0092', '\u2192'],
  // Left arrow: â† → ←
  ['\u00E2\u0086\u0090', '\u2190'],
  // Greek sigma: Ïƒ → σ
  ['\u00CF\u0083', '\u03C3'],
  // Triangle up: â–² → ▲
  ['\u00E2\u0096\u00B2', '\u25B2'],
  // Triangle down: â–¼ → ▼
  ['\u00E2\u0096\u00BC', '\u25BC'],
  // Multiplication: Ã— → ×
  ['\u00C3\u0097', '\u00D7'],
  // y-hat: Å· → ŷ
  ['\u00C5\u00B7', '\u0177'],
  // Middle dot: Â· → ·
  ['\u00C2\u00B7', '\u00B7'],
  // Box draw horizontal: â"€ → ─
  ['\u00E2\u0094\u0080', '\u2500'],
  // Box draw double horizontal: â• → ═
  ['\u00E2\u0095\u0090', '\u2550'],
  // Non-breaking space / Â prefix
  ['\u00C2\u00A0', '\u00A0'],
  // 4-byte emoji fixes (UTF-8 bytes read as Latin-1)
  // 📐 (U+1F4D0): ðŸ"
  ['\u00F0\u009F\u0094\u0090', '\uD83D\uDD10'],  // lock emoji - skip
  // Use simple string replacements for emojis since they're in comments only
];

// Apply byte-level fixes
for (const [from, to] of fixes) {
  while (content.includes(from)) {
    content = content.split(from).join(to);
  }
}

// Additional simple text fixes for remaining patterns
const textFixes = [
  // These appear in JSX strings and comments
  ['RÂ²', 'R\u00B2'],
  ['\u00CF\u0083', '\u03C3'],
  ['Ïƒ', 'σ'],
  ['â€"', '—'],
  ['â€"', '\u2014'],
  ['â†'', '→'],
  ['â†'', '\u2192'],
  ['Ã—', '×'],
  ['â–²', '▲'],
  ['â–¼', '▼'],
  ['Å·', 'ŷ'],
  ['Â·', '·'],
  ['â"€', '─'],
  ['â•', '═'],
  ['Â²', '²'],
  ['âœ•', '✕'],
  ['â† ', '← '],
  ['â†'', '\u2192'],
  // Emojis in JSX (these appear as text nodes)
  ['ðŸ"', '📐'],
  ['ðŸ"‰', '📉'],
  ['ðŸ"Š', '📊'],
  ['ðŸ†\u00A0', '🏆 '],
  ['ðŸ†', '🏆'],
  ['ðŸ"¦', '📦'],
  ['ðŸ¥§', '🥧'],
  ['ðŸ"‚', '📂'],
  ['ðŸŽ¨', '🎨'],
  ['ðŸ"', '🔍'],
  ['âš¡', '⚡'],
  ['ðŸ"\u00A0', '🔐 '],
  ['ðŸ"', '🔐'],
  ['ðŸ"', '🔒'],
  ['â† ', '← '],
  ['UNIFIED DASHBOARD SHELL â€" permanent operating system', 'UNIFIED DASHBOARD SHELL — permanent operating system'],
  ['All query types render inside this grid. Only data changes.', 'All query types render inside this grid. Only data changes.'],
];

for (const [from, to] of textFixes) {
  while (content.includes(from)) {
    content = content.split(from).join(to);
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Encoding fixed. File size:', fs.statSync(path).size, 'bytes');

// Verify key strings
const checks = ['R²', 'σ', '—', '→', '▲', '▼', 'σ'];
for (const c of checks) {
  const found = content.includes(c);
  console.log(`  ${c}: ${found ? 'FOUND ✓' : 'MISSING ✗'}`);
}

// Check for remaining mojibake
const moji = ['Â²', 'Ïƒ', 'â€"', 'â†'', 'â–²', 'â–¼', 'Ã—', 'Å·'];
let mojiCount = 0;
for (const m of moji) {
  if (content.includes(m)) { console.log('  STILL BROKEN:', m); mojiCount++; }
}
if (mojiCount === 0) console.log('  No mojibake remaining ✓');
