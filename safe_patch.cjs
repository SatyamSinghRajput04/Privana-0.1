/**
 * CLEAN RESTORE + MINIMAL SAFE PATCHES
 * Strategy: Only replace STYLE ATTRIBUTES and TEXT — no structural JSX changes
 * This is safe because style attribute replacement can't break JSX structure
 */
const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
let src = fs.readFileSync(FILE, 'utf8');

// ─── UNDO all structural injections that broke JSX ───────────────────────────
// These are the header divs we inserted into chart cards

// UNDO: Primary chart header + inner padding div injection
// The card now has extra header divs that weren't properly balanced
// Find the injected header block and remove it
const primaryHeaderBlock = [
  `                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.85rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>`,
  `                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>`,
  `                            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#ef4444' }} />`,
  `                            <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>`,
  `                              {analyticalContext ? analyticalContext.title : isMentalHealthSchema ? 'Overview' : 'Primary Chart'}`,
  `                            </span>`,
  `                          </div>`,
  `                          <div style={{ display: 'flex', gap: '0.3rem' }}>`,
  `                            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#252535' }} />)}`,
  `                          </div>`,
  `                        </div>`,
  `                        <div style={{ padding: '0.65rem 0.8rem', flex: 1, display: 'flex', flexDirection: 'column' }}>`
].join('\n');

if (src.includes(primaryHeaderBlock)) {
  src = src.replace(primaryHeaderBlock, '');
  console.log('UNDONE: Primary chart header injection');
} else {
  console.warn('Primary header block not found for undo — partial cleanup');
  // Try line by line removal
  const lines = src.split('\n');
  let removed = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("padding: '0.65rem 0.8rem', flex: 1, display: 'flex', flexDirection: 'column'")) {
      lines.splice(i, 1); removed++;
    }
    if (lines[i].includes("padding: '0.55rem 0.85rem', borderBottom: '1px solid #14141e', flexShrink: 0")) {
      // Remove this line and next 10
      lines.splice(i, 12);
      removed++;
      break;
    }
  }
  src = lines.join('\n');
  if (removed > 0) console.log('Partial undo via line removal:', removed, 'blocks');
}

// UNDO: Secondary chart header injection
const secondaryHeaderStart = `                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{ width: 2, height: 10, borderRadius: 2, background: '#3b82f6' }} />
                              <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Distribution</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#1e1e28' }} />)}
                            </div>
                          </div>`;
if (src.includes(secondaryHeaderStart)) {
  src = src.replace(secondaryHeaderStart, '');
  console.log('UNDONE: Secondary chart header');
} else {
  console.warn('Secondary header not found');
}

// UNDO: Bottom-left stat card header injection  
const statCardHeader = `                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: 2, height: 10, borderRadius: 2, background: '#8b5cf6' }} />
                            <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Statistical Summary</span>
                          </div>
                          <span style={{ fontSize: '0.48rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>LIVE</span>
                        </div>
                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'auto' }}>`;
if (src.includes(statCardHeader)) {
  src = src.replace(statCardHeader, '');
  console.log('UNDONE: Stat summary card header');
}

// UNDO: Bottom-center gender card header
const genderCardHeader = `                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0, gap: '0.4rem' }}>
                          <div style={{ width: 2, height: 10, borderRadius: 2, background: '#ec4899' }} />
                          <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Gender Summary</span>
                        </div>
                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'auto' }}>`;
if (src.includes(genderCardHeader)) {
  src = src.replace(genderCardHeader, '');
  console.log('UNDONE: Gender card header');
}

// UNDO: Bottom-right top5 card header injection
const top5CardHeader = `                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0, gap: '0.4rem' }}>
                          <div style={{ width: 2, height: 10, borderRadius: 2, background: '#eab308' }} />
                          <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            {analyticalContext && analyticalContext.topRows?.length > 0 ? \`Top 5 by \${analyticalContext.cntCol}\` : 'Anxiety Distribution'}
                          </span>
                        </div>
                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'hidden' }}>`;
if (src.includes(top5CardHeader)) {
  src = src.replace(top5CardHeader, '');
  console.log('UNDONE: Top5 card header');
}

// ─── NOW APPLY SAFE STYLE-ONLY CHANGES ───────────────────────────────────────

// 1. Upgrade PRIMARY card style attributes only (no structural changes)
src = src.replace(
  `{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', minHeight: 220 }`,
  `{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', padding: '0.75rem', minHeight: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }`
);
console.log('Style: Primary card upgraded');

// 2. Upgrade SECONDARY card — first occurrence of this style
src = src.replace(
  `{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120 }`,
  `{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', padding: '0.65rem', flex: 1, minHeight: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }`
);
console.log('Style: Secondary card upgraded');

// 3. Upgrade TERTIARY card — will be the second replacement if same pattern
src = src.replace(
  `{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120 }`,
  `{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', padding: '0.65rem', flex: 1, minHeight: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }`
);
console.log('Style: Tertiary card upgraded');

// 4. Upgrade bottom 3 cards (overflow: 'hidden' variants)
src = src.replace(
  /\{ background: '#0e0e12', border: '1\.5px solid #3c1417', borderRadius: '16px', padding: '0\.75rem', overflow: 'hidden' \}/g,
  `{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', padding: '0.75rem', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }`
);
console.log('Style: Bottom 3 cards upgraded');

// 5. Upgrade MH KPI card OLD style (safe inline style replacement)
src = src.replace(
  `{ background: '#0e0e12', border: '1px solid #3c1417', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem' }`,
  `{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: \`1px solid \${k.color}28\`, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }`
);
console.log('Style: MH KPI cards upgraded');

// 6. Upgrade stat KPI card OLD style
src = src.replace(
  `{ background: '#0e0e12', border: \`1px solid \${card.color}22\`, borderRadius: '6px', padding: '0.65rem 0.85rem' }`,
  `{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: \`1px solid \${card.color}30\`, borderRadius: '10px', padding: '0.75rem 0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }`
);
console.log('Style: Stat KPI cards upgraded');

// 7. Fix stat card font sizes for more impact
src = src.replace(
  `{ fontSize: '0.5rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.2rem' }`,
  `{ fontSize: '0.48rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.3rem' }`
);
src = src.replace(
  `{ fontSize: '1.15rem', fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums' }`,
  `{ fontSize: '1.3rem', fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em' }`
);
src = src.replace(
  `{ fontSize: '0.56rem', color: '#52525b', marginTop: '0.15rem' }`,
  `{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.22rem', lineHeight: 1.3 }`
);
console.log('Style: Stat KPI text sizes upgraded');

// 8. MH KPI icon circle upgrade
src = src.replace(
  /\{ width: 28, height: 28, borderRadius: '50%', background: k\.bg, border: `1px solid \$\{k\.bdr\}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k\.color \}/g,
  `{ width: 28, height: 28, borderRadius: '8px', background: \`\${k.color}12\`, border: \`1px solid \${k.color}22\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }`
);
console.log('Style: MH KPI icon circles upgraded');

// Write result
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nSafe patch done! File:', fs.statSync(FILE).size, 'bytes');
