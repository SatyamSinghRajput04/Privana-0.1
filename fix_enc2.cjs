const fs = require('fs');
const path = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';

let content = fs.readFileSync(path, { encoding: 'latin1' });

// The file was saved with UTF-8 bytes but read as Latin-1 previously.
// Now we read it as UTF-8 correctly:
content = fs.readFileSync(path, 'utf8');

// Fix patterns: these are multi-byte UTF-8 sequences misinterpreted as Latin-1
// We match them as the garbled latin-1 strings and replace with correct chars

const replacePairs = [];

// Build replacements using Buffer to avoid source file encoding issues
function latin1ToStr(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

// U+00B2 ² = bytes C2 B2
replacePairs.push([latin1ToStr([0xC2, 0xB2]), '\u00B2']);
// U+2014 — = bytes E2 80 94
replacePairs.push([latin1ToStr([0xE2, 0x80, 0x94]), '\u2014']);
// U+2013 – = bytes E2 80 93
replacePairs.push([latin1ToStr([0xE2, 0x80, 0x93]), '\u2013']);
// U+2192 -> = bytes E2 86 92
replacePairs.push([latin1ToStr([0xE2, 0x86, 0x92]), '\u2192']);
// U+2190 <- = bytes E2 86 90
replacePairs.push([latin1ToStr([0xE2, 0x86, 0x90]), '\u2190']);
// U+03C3 sigma = bytes CF 83
replacePairs.push([latin1ToStr([0xCF, 0x83]), '\u03C3']);
// U+25B2 triangle up = bytes E2 96 B2
replacePairs.push([latin1ToStr([0xE2, 0x96, 0xB2]), '\u25B2']);
// U+25BC triangle down = bytes E2 96 BC
replacePairs.push([latin1ToStr([0xE2, 0x96, 0xBC]), '\u25BC']);
// U+00D7 times = bytes C3 97
replacePairs.push([latin1ToStr([0xC3, 0x97]), '\u00D7']);
// U+0177 y-hat = bytes C5 B7
replacePairs.push([latin1ToStr([0xC5, 0xB7]), '\u0177']);
// U+00B7 middle dot = bytes C2 B7
replacePairs.push([latin1ToStr([0xC2, 0xB7]), '\u00B7']);
// U+2500 box horizontal = bytes E2 94 80
replacePairs.push([latin1ToStr([0xE2, 0x94, 0x80]), '\u2500']);
// U+2550 box double horizontal = bytes E2 95 90
replacePairs.push([latin1ToStr([0xE2, 0x95, 0x90]), '\u2550']);
// U+2714 checkmark = bytes E2 9C 94
replacePairs.push([latin1ToStr([0xE2, 0x9C, 0x94]), '\u2714']);
// U+2715 cross = bytes E2 9C 95
replacePairs.push([latin1ToStr([0xE2, 0x9C, 0x95]), '\u2715']);
// Emoji: U+1F4D0 = F0 9F 93 90
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x93, 0x90]), '\uD83D\uDCD0']);
// Emoji: U+1F4C9 chart down = F0 9F 93 89
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x93, 0x89]), '\uD83D\uDCC9']);
// Emoji: U+1F4CA chart bar = F0 9F 93 8A
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x93, 0x8A]), '\uD83D\uDCCA']);
// Emoji: U+1F3C6 trophy = F0 9F 8F 86
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x8F, 0x86]), '\uD83C\uDFC6']);
// Emoji: U+1F4E6 package = F0 9F 93 A6
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x93, 0xA6]), '\uD83D\uDCE6']);
// Emoji: U+1F967 pie = F0 9F A5 A7
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0xA5, 0xA7]), '\uD83E\uDD67']);
// Emoji: U+1F4C2 folder = F0 9F 93 82
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x93, 0x82]), '\uD83D\uDCC2']);
// Emoji: U+1F3A8 art = F0 9F 8E A8
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x8E, 0xA8]), '\uD83C\uDFA8']);
// Emoji: U+1F50D magnifier = F0 9F 94 8D
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x94, 0x8D]), '\uD83D\uDD0D']);
// Emoji: U+26A1 lightning = E2 9A A1
replacePairs.push([latin1ToStr([0xE2, 0x9A, 0xA1]), '\u26A1']);
// Emoji: U+1F510 lock = F0 9F 94 90
replacePairs.push([latin1ToStr([0xF0, 0x9F, 0x94, 0x90]), '\uD83D\uDD10']);

// Apply all replacements
for (const [from, to] of replacePairs) {
  content = content.split(from).join(to);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done. File size:', fs.statSync(path).size);

// Verify
const stillBroken = ['\u00C2\u00B2', '\u00CF\u0083'];
let ok = true;
for (const b of stillBroken) {
  if (content.includes(b)) { console.log('STILL BROKEN:', b); ok = false; }
}
if (ok) console.log('All mojibake cleared!');
