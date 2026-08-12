const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage.tsx', 'utf8');
const lines = code.split('\n');
console.log('Original lines count:', lines.length);

// 1. Fix the Q&A Box close button and insert the closing tags.
// Line 2729 (index 2728) is: e.currentTarget.style.borderColor = '#e              {!selectedDataset ? (
// We replace it and the next line (index 2729) with the correct closing tags.
lines.splice(2728, 2, 
  "                        e.currentTarget.style.borderColor = '#ef4444';",
  "                      }}",
  "                      onMouseLeave={(e) => {",
  "                        e.currentTarget.style.background = 'transparent';",
  "                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';",
  "                      }}",
  "                    >",
  "                      Close Q&A Response",
  "                    </button>",
  "                  </motion.div>",
  "                )}",
  "              </div>",
  "",
  "              {!selectedDataset ? ("
);

// 2. Delete the orphaned code at the end of the report tab.
// The orphaned block starts with the broken '0 }}' from the BarChart and ends before the data tab.
let orphanIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('0 }}')) {
    orphanIdx = i;
    break;
  }
}

if (orphanIdx !== -1) {
  console.log('Found orphan index:', orphanIdx);
  // We delete the 16 lines of orphaned chart code
  lines.splice(orphanIdx, 16);
} else {
  console.log('WARNING: Orphan index not found!');
}

// 3. Fix the handleAskAI onClick bug (passing the event to handleAskAI)
// Let's find the onClick={handleAskAI} line and change it to onClick={() => handleAskAI()}
let onClickIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('onClick={handleAskAI}')) {
    onClickIdx = i;
    break;
  }
}

if (onClickIdx !== -1) {
  console.log('Found onClick={handleAskAI} at line:', onClickIdx + 1);
  lines[onClickIdx] = lines[onClickIdx].replace('onClick={handleAskAI}', 'onClick={() => handleAskAI()}');
}

fs.writeFileSync('src/pages/AnalyzePage.tsx', lines.join('\n'));
console.log('New lines count:', lines.length);
