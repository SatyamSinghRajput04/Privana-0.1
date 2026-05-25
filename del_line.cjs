const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

console.log('Total lines:', lines.length);
console.log('Line 3389:', JSON.stringify(lines[3388]));
console.log('Line 3390:', JSON.stringify(lines[3389]));
console.log('Line 3391:', JSON.stringify(lines[3390]));
console.log('Line 3392:', JSON.stringify(lines[3391]));
console.log('Line 3393:', JSON.stringify(lines[3392]));

// Remove line 3391 (0-indexed: 3390) — the stray </div>
if (lines[3390].includes('</div>') && !lines[3390].includes('\r')) {
  lines.splice(3390, 1);
  console.log('Removed stray </div> at line 3391');
} else {
  console.log('Line 3391 content:', JSON.stringify(lines[3390]));
  console.log('Manual check needed');
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('Done. Lines now:', lines.length);
