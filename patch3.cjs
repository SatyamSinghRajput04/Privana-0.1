/**
 * Power BI Visual Shell Patch — upgrades chart cards and dashboard header
 */
const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
let src = fs.readFileSync(FILE, 'utf8');
let lines = src.split('\n');
let count = 0;

function findLine(text, from = 0, to = lines.length) {
  for (let i = from; i < to; i++) {
    if (lines[i].includes(text)) return i;
  }
  return -1;
}

function setLine(idx, newContent) {
  lines[idx] = newContent;
  count++;
}

// ─── 1. Dashboard shell — improve outer container ────────────────────────────
{
  const idx = findLine("display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, minHeight: 0, overflowY: 'auto'");
  if (idx >= 0) {
    setLine(idx, `                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0.15rem' }}>`);
    console.log('FIXED: Dashboard outer container');
  }
}

// ─── 2. Insight banner — full redesign ───────────────────────────────────────
{
  const bannerStart = findLine("background: 'rgba(239,68,68,0.03)',");
  if (bannerStart >= 0) {
    // Find the return block: line with `return (`
    const retLine = findLine('return (', bannerStart - 3, bannerStart + 5);
    const retClose = findLine('    );', bannerStart, bannerStart + 40);
    if (retLine >= 0 && retClose >= 0) {
      const newBanner = [
        `                    return (`,
        `                      <div style={{`,
        `                        background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, rgba(139,92,246,0.03) 100%)',`,
        `                        border: '1px solid rgba(239,68,68,0.2)',`,
        `                        borderRadius: '10px',`,
        `                        padding: '0.6rem 0.9rem',`,
        `                        display: 'flex', alignItems: 'center', gap: '0.75rem',`,
        `                        flexShrink: 0,`,
        `                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)'`,
        `                      }}>`,
        `                        <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>`,
        `                          <span style={{ fontSize: '0.9rem' }}>📐</span>`,
        `                        </div>`,
        `                        <div style={{ flex: 1, minWidth: 0 }}>`,
        `                          <div style={{ fontSize: '0.57rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.15rem' }}>`,
        `                            Insight — {analyticalContext.type.charAt(0).toUpperCase() + analyticalContext.type.slice(1)} Analysis`,
        `                          </div>`,
        `                          <div style={{ fontSize: '0.69rem', color: '#a1a1aa', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>`,
        `                        </div>`,
        `                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>`,
        `                          <span style={{ fontSize: '0.5rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>LOCAL</span>`,
        `                          <span style={{ fontSize: '0.5rem', color: '#3f3f46', fontFamily: 'var(--mono)' }}>n={analyticalContext.scatterPairs.length}</span>`,
        `                        </div>`,
        `                      </div>`,
        `                    );`,
      ];
      lines.splice(retLine, retClose - retLine + 1, ...newBanner);
      count++;
      console.log('FIXED: Insight banner redesign');
    }
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── 3. Primary chart card — glassmorphism ───────────────────────────────────
{
  const idx = findLine("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', minHeight: 220");
  if (idx >= 0) {
    lines[idx] = `                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', minHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>`;
    count++;
    console.log('FIXED: Primary chart card style');
    
    // Insert chart header bar right after
    lines.splice(idx + 1, 0,
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
    );
    count++;
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── 4. Primary chart empty state — close the extra divs we opened ────────────
{
  const emptyIdx = findLine("Run a query to populate<br />this chart");
  if (emptyIdx >= 0) {
    // Find the closing </div> of the empty state container
    let closeIdx = emptyIdx + 1;
    while (closeIdx < emptyIdx + 10 && !lines[closeIdx].includes('</div>')) closeIdx++;
    // After the state machine closes, we need to close: inner padding div + card div
    let outerClose = closeIdx + 1;
    while (outerClose < closeIdx + 10 && !lines[outerClose].includes('</div>')) outerClose++;
    lines.splice(outerClose + 1, 0,
      `                        </div>` // close inner padding div
    );
    count++;
    console.log('FIXED: Primary chart extra div close');
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── 5. Secondary chart card ─────────────────────────────────────────────────
{
  const idx = findLine("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120");
  if (idx >= 0) {
    lines[idx] = `                        <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', flex: 1, minHeight: 120, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>`;
    count++;
    lines.splice(idx + 1, 0,
      `                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>`,
      `                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>`,
      `                              <div style={{ width: 2, height: 10, borderRadius: 2, background: '#3b82f6' }} />`,
      `                              <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Distribution</span>`,
      `                            </div>`,
      `                            <div style={{ display: 'flex', gap: '0.25rem' }}>`,
      `                              {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#1e1e28' }} />)}`,
      `                            </div>`,
      `                          </div>`,
      `                          <div style={{ padding: '0.45rem 0.65rem', flex: 1, overflow: 'hidden' }}>`
    );
    count++;
    console.log('FIXED: Secondary chart card');
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── 6. Tertiary chart card ──────────────────────────────────────────────────
{
  // Find second occurrence (tertiary)
  let firstFound = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120")) {
      if (firstFound === -1) { firstFound = i; continue; }
      // Second occurrence = tertiary
      lines[i] = `                        <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', flex: 1, minHeight: 120, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>`;
      count++;
      lines.splice(i + 1, 0,
        `                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>`,
        `                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>`,
        `                              <div style={{ width: 2, height: 10, borderRadius: 2, background: '#10b981' }} />`,
        `                              <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Trend / Distribution</span>`,
        `                            </div>`,
        `                            <div style={{ display: 'flex', gap: '0.25rem' }}>`,
        `                              {[0,1,2].map(i2 => <div key={i2} style={{ width: 3, height: 3, borderRadius: '50%', background: '#1e1e28' }} />)}`,
        `                            </div>`,
        `                          </div>`,
        `                          <div style={{ padding: '0.45rem 0.65rem', flex: 1, overflow: 'hidden' }}>`
      );
      count++;
      console.log('FIXED: Tertiary chart card');
      break;
    }
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── 7. Bottom row 3 cards ───────────────────────────────────────────────────
// Bottom-left stat summary
{
  const idx = findLine("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden'");
  if (idx >= 0) {
    lines[idx] = `                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>`;
    count++;
    // Find "Statistical Summary" heading and replace
    const titleIdx = findLine("fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Statistical Summary", idx, idx + 5);
    if (titleIdx >= 0) {
      lines.splice(titleIdx, 1,
        `                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0 }}>`,
        `                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>`,
        `                            <div style={{ width: 2, height: 10, borderRadius: 2, background: '#8b5cf6' }} />`,
        `                            <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Statistical Summary</span>`,
        `                          </div>`,
        `                          <span style={{ fontSize: '0.48rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>LIVE</span>`,
        `                        </div>`,
        `                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'auto' }}>`
      );
      count++;
    }
    console.log('FIXED: Bottom-left stat card');
  }
}

src = lines.join('\n');
lines = src.split('\n');

// Bottom-center gender table
{
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden'")) {
      lines[i] = `                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>`;
      count++;
      const titleIdx = findLine("fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Gender Summary Report", i, i + 5);
      if (titleIdx >= 0) {
        lines.splice(titleIdx, 1,
          `                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0, gap: '0.4rem' }}>`,
          `                          <div style={{ width: 2, height: 10, borderRadius: 2, background: '#ec4899' }} />`,
          `                          <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Gender Summary</span>`,
          `                        </div>`,
          `                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'auto' }}>`
        );
        count++;
      }
      console.log('FIXED: Bottom-center gender card');
      break;
    }
  }
}

src = lines.join('\n');
lines = src.split('\n');

// Bottom-right top5/anxiety card
{
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden'")) {
      lines[i] = `                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>`;
      count++;
      // Insert header after
      lines.splice(i + 1, 0,
        `                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.7rem', borderBottom: '1px solid #14141e', flexShrink: 0, gap: '0.4rem' }}>`,
        `                          <div style={{ width: 2, height: 10, borderRadius: 2, background: '#eab308' }} />`,
        `                          <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>`,
        `                            {analyticalContext && analyticalContext.topRows?.length > 0 ? \`Top 5 by \${analyticalContext.cntCol}\` : 'Anxiety Distribution'}`,
        `                          </span>`,
        `                        </div>`,
        `                        <div style={{ padding: '0.4rem 0.6rem', flex: 1, overflow: 'hidden' }}>`
      );
      count++;
      console.log('FIXED: Bottom-right top5 card');
      break;
    }
  }
}

src = lines.join('\n');

// ─── 8. Fix remaining mojibake one more time ─────────────────────────────────
const mojiFixes = [
  ['\u00E2\u0080\u0094', '\u2014'], // em dash
  ['\u00E2\u0086\u0092', '\u2192'], // right arrow
  ['\u00C3\u0097', '\u00D7'],       // times
  ['\u00C2\u00B2', '\u00B2'],       // superscript 2
  ['\u00CF\u0083', '\u03C3'],       // sigma
  ['\u00E2\u0096\u00B2', '\u25B2'], // up triangle
  ['\u00E2\u0096\u00BC', '\u25BC'], // down triangle
  ['\u00C5\u00B7', '\u0177'],       // y-hat
  ['\u00C2\u00B7', '\u00B7'],       // middle dot
  ['\u00E2\u0094\u0080', '\u2500'], // box horizontal
  ['\u00E2\u0095\u0090', '\u2550'], // double horizontal
  ['\u00E2\u009C\u0095', '\u2715'], // cross
  ['\u00E2\u0086\u0090', '\u2190'], // left arrow
];
for (const [from, to] of mojiFixes) {
  src = src.split(from).join(to);
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('\nPower BI shell patch done!', count, 'changes. File:', fs.statSync(FILE).size, 'bytes');
