/**
 * Fix broken JSX structure from secondary/tertiary chart card injections
 * The inner padding <div> we added was never closed properly
 */
const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

function findLine(text, from = 0, to = lines.length) {
  for (let i = from; i < to; i++) {
    if (lines[i].includes(text)) return i;
  }
  return -1;
}

// SECONDARY CHART FIX:
// The structure currently is (wrong):
//   <div card>
//     <div header/>
//     <div inner-padding>    <-- no closing tag before card close
//     {content...}
//     </div>  <-- closes card
//   
// Should be:
//   <div card>
//     <div header/>
//     {content...}   <-- no extra inner div needed, card already has padding
//   </div>
//
// Simplest fix: REMOVE the extra inner padding div line for secondary
{
  const innerDivLine = findLine("'0.45rem 0.65rem', flex: 1, overflow: 'hidden'");
  if (innerDivLine >= 0) {
    console.log('Found secondary inner padding div at line', innerDivLine + 1, ':', lines[innerDivLine].trim().slice(0, 60));
    lines.splice(innerDivLine, 1);
    console.log('REMOVED secondary inner padding div');
  } else {
    console.warn('MISS: secondary inner padding div');
  }
}

// Re-find tertiary chart area and verify its padding
// Tertiary card still has the OLD style (no header injected by patch3 since it only found secondary)
// Let's check line ~3475 area (now 3474 after splice)
{
  const tertIdx = findLine("TERTIARY CHART");
  if (tertIdx >= 0) {
    console.log('Tertiary chart comment at line', tertIdx + 1);
    // Check if tertiary has the inner padding div too
    const tertPaddingDiv = findLine("'0.45rem 0.65rem'", tertIdx, tertIdx + 15);
    if (tertPaddingDiv >= 0) {
      console.log('Found tertiary inner padding div at line', tertPaddingDiv + 1);
      lines.splice(tertPaddingDiv, 1);
      console.log('REMOVED tertiary inner padding div');
    }
  }
}

// Check if bottom-left stat card got double-wrapped too
// Bottom left "Statistical Summary" — we added a header div + inner padding div
// The inner padding div there IS needed to close properly
// Let's verify the structure by counting divs in the stat summary block
{
  const statStart = findLine("BOTTOM LEFT \u2014 Statistical Summary");
  if (statStart >= 0) {
    console.log('Stat summary card at line', statStart + 1);
    // The structure should be:
    // <div card>
    //   <div header bar>...</div>
    //   <div inner-padding>
    //     {table}
    //   </div>
    // </div>
    // Find the header's closing div
    const headerClose = findLine('</div>', statStart, statStart + 15);
    if (headerClose >= 0) {
      const innerPad = findLine("padding: '0.4rem 0.6rem'", statStart, statStart + 20);
      const cardClose = findLine('</div>', headerClose + 1, statStart + 80);
      console.log('  inner padding div at:', innerPad + 1, '  card close around:', cardClose + 1);
    }
  }
}

// Write fixed file
src = lines.join('\n');
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nFixed! File:', fs.statSync(FILE).size, 'bytes,', lines.length, 'lines');
