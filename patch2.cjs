/**
 * Final comprehensive patch — reads file, patches by exact content inspection
 */
const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';
let src = fs.readFileSync(FILE, 'utf8');
let lines = src.split('\n');

console.log('Total lines:', lines.length);

// Helper: find line index containing exact text
function findLine(text, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(text)) return i;
  }
  return -1;
}

// Helper: replace a range of lines with new content
function replaceLines(startIdx, endIdx, newLines) {
  lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
  console.log('  Replaced lines', startIdx+1, '-', endIdx+1);
}

// ─── FIX 1: Top 5 label detection ───────────────────────────────────────────
{
  const start = findLine('// Top 5 records by cntCol');
  const end = findLine('}));', start);
  if (start >= 0 && end >= 0) {
    replaceLines(start, end, [
      `      // Top 5 records by cntCol \u2014 use real identifier column as label`,
      `      const _idPrio = ['student_id','id','name','title','label','student','employee_id','user_id'];`,
      `      const _labelCol = allCols.find(c => _idPrio.includes(c.toLowerCase()))`,
      `        || allCols.find(c => {`,
      `          if (c === cntCol || c === valCol) return false;`,
      `          const s = rows.find((r) => r[c] !== null && r[c] !== undefined && r[c] !== '');`,
      `          return s ? isNaN(Number(s[c])) : false;`,
      `        }) || null;`,
      `      const topRows = [...rows]`,
      `        .sort((a, b) => Number(b[cntCol]) - Number(a[cntCol]))`,
      `        .slice(0, 5)`,
      `        .map((r, i) => ({`,
      `          rank: _labelCol`,
      `            ? String(r[_labelCol]).slice(0, 14)`,
      `            : \`\${valCol}=\${Number(r[valCol]).toFixed(1)}\`,`,
      `          value: Number(r[cntCol]),`,
      `          xValue: Number(r[valCol]),`,
      `          extra: Object.fromEntries(allCols.map(c => [c, r[c]])) as Record<string, unknown>`,
      `        }));`,
    ]);
    console.log('FIXED: Top 5 labels');
  } else { console.warn('MISS: Top 5 block'); }
}

// Re-split after changes
src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 2: KPI cards array — clean symbols ──────────────────────────────────
{
  const idx = findLine("{ label: 'Pearson r', value: pearsonR.toFixed(4)");
  if (idx >= 0) {
    // Find the 4 kpiCards lines
    const end = findLine('];', idx);
    if (end >= 0 && end - idx < 10) {
      replaceLines(idx - 1, end, [
        `      const kpiCards = [`,
        `        { label: 'Pearson r', value: pearsonR.toFixed(4), sub: pearsonR >= 0 ? '\u25b2 positive' : '\u25bc negative', color: pearsonR >= 0 ? '#22c55e' : '#ef4444' },`,
        `        { label: 'R\u00b2 (Fit)', value: regR2.toFixed(4), sub: \`\${(regR2 * 100).toFixed(1)}% variance explained\`, color: '#8b5cf6' },`,
        `        { label: \`Mean \${valCol}\`, value: xStats.mean.toFixed(2), sub: \`\u03c3 = \${xStats.std.toFixed(2)}  \u00b7  n=\${n}\`, color: '#3b82f6' },`,
        `        { label: \`Mean \${cntCol}\`, value: yStats.mean.toFixed(2), sub: \`\u03c3 = \${yStats.std.toFixed(2)}  \u00b7  min \${yStats.min.toFixed(1)}\`, color: '#10b981' },`,
        `      ];`,
      ]);
      console.log('FIXED: KPI cards symbols');
    }
  } else { console.warn('MISS: kpiCards array'); }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 3: Pie slice range names — em dash ──────────────────────────────────
// Find the pieAccum array and fix the dash character in name template
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pieAccum') && lines[i].includes('name:') && lines[i].includes('toFixed(1)')) {
    const orig = lines[i];
    // Replace whatever dash character is there with proper en dash
    const fixed = orig.replace(/name:\s*`[^`]*`/, 
      "name: `${(xStats.min + i * sw).toFixed(1)}\u2013${(xStats.min + (i+1) * sw).toFixed(1)}`"
    );
    if (fixed !== orig) {
      lines[i] = fixed;
      console.log('FIXED: Pie slice en dash at line', i+1);
    }
    break;
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 4: title encoding — × character ─────────────────────────────────────
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let title =') && lines[i].includes('valCol') && lines[i].includes('cntCol')) {
    const orig = lines[i];
    lines[i] = lines[i].replace(/`\$\{valCol\}[^`]*\$\{cntCol\}`/, '`${valCol} \u00d7 ${cntCol}`');
    if (lines[i] !== orig) console.log('FIXED: title × at line', i+1);
    break;
  }
}

// ─── FIX 5: Insight banner — fix remaining mojibake in typeMap ───────────────
src = lines.join('\n');
// Fix the insight banner text strings
src = src.replace(/â€"/g, '\u2014');  // em dash
src = src.replace(/â†'/g, '\u2192');  // right arrow
src = src.replace(/Ã—/g, '\u00d7');  // times
src = src.replace(/Â²/g, '\u00b2');  // superscript 2
src = src.replace(/Ïƒ/g, '\u03c3'); // sigma
src = src.replace(/â–²/g, '\u25b2'); // up triangle
src = src.replace(/â–¼/g, '\u25bc'); // down triangle
src = src.replace(/Å·/g, '\u0177');  // y-hat
src = src.replace(/Â·/g, '\u00b7');  // middle dot
src = src.replace(/â"€/g, '\u2500'); // box horizontal
src = src.replace(/â•/g, '\u2550');  // box double horizontal
src = src.replace(/âœ•/g, '\u2715'); // cross
src = src.replace(/â† /g, '\u2190 '); // left arrow
console.log('FIXED: remaining mojibake in typeMap');

lines = src.split('\n');

// ─── FIX 6: Power BI Card Redesign — KPI stat cards (analyticalContext) ──────
{
  const startIdx = findLine("analyticalContext.kpiCards.map((card, ci) => (");
  const endIdx = findLine("</div>\n                        ))\n                      :", startIdx);
  // More targeted: find and replace the KPI card div
  const cardStart = findLine("<div key={ci} style={{ background: '#0e0e12', border:", startIdx);
  if (cardStart >= 0) {
    const cardEnd = findLine('</div>\n                        ))', cardStart);
    if (cardEnd < 0 || cardEnd - cardStart > 15) {
      // Find single card div end
      let depth = 0, cEnd = cardStart;
      for (let i = cardStart; i < Math.min(cardStart + 15, lines.length); i++) {
        depth += (lines[i].match(/<div/g)||[]).length;
        depth -= (lines[i].match(/<\/div>/g)||[]).length;
        if (depth <= 0 && i > cardStart) { cEnd = i; break; }
      }
      replaceLines(cardStart, cEnd, [
        `                          <div key={ci} className="pv-kpi" style={{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: \`1px solid \${card.color}30\`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>`,
        `                            <div style={{ position: 'absolute', top: 0, right: 0, width: 55, height: 55, background: \`radial-gradient(circle,\${card.color}08 0%,transparent 70%)\`, borderRadius: '0 10px 0 0', pointerEvents: 'none' }} />`,
        `                            <div style={{ fontSize: '0.48rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{card.label}</div>`,
        `                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{card.value}</div>`,
        `                            <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.22rem', lineHeight: 1.3 }}>{card.sub}</div>`,
        `                          </div>`,
      ]);
      console.log('FIXED: Stat KPI cards redesign');
    }
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 7: MH KPI cards redesign ────────────────────────────────────────────
{
  const idx = findLine("{ icon: <Moon size={14} />, label: 'AVG SLEEP HOURS'");
  if (idx >= 0) {
    // Find end: the closing )) of the .map
    let endIdx = idx + 1;
    while (endIdx < idx + 30 && !lines[endIdx].includes('))')) endIdx++;
    replaceLines(idx - 1, endIdx, [
      `                          [`,
      `                            { icon: <Moon size={16} />, label: 'AVG SLEEP HOURS', value: kpis.sleep, sub: 'hrs \u00b7 per night average', color: '#eab308' },`,
      `                            { icon: <Users size={16} />, label: 'AVG AGE', value: kpis.age, sub: 'years \u00b7 from dataset', color: '#3b82f6' },`,
      `                            { icon: <Heart size={16} />, label: 'AVG STRESS', value: kpis.stress, sub: 'level 1\u201310 scale', color: '#ef4444' },`,
      `                            { icon: <Database size={16} />, label: 'TOTAL RECORDS', value: kpis.records.toLocaleString(), sub: 'rows in active filter', color: '#a855f7' },`,
      `                          ].map((k, ki) => (`,
      `                            <div key={ki} className="pv-kpi" style={{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: \`1px solid \${k.color}28\`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>`,
      `                              <div style={{ position: 'absolute', top: 0, right: 0, width: 50, height: 50, background: \`radial-gradient(circle,\${k.color}08 0%,transparent 70%)\`, borderRadius: '0 10px 0 0', pointerEvents: 'none' }} />`,
      `                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>`,
      `                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: \`\${k.color}12\`, border: \`1px solid \${k.color}22\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0 }}>{k.icon}</div>`,
      `                                <div style={{ fontSize: '0.46rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{k.label}</div>`,
      `                              </div>`,
      `                              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</div>`,
      `                              <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.2rem' }}>{k.sub}</div>`,
      `                            </div>`,
      `                          ))`,
    ]);
    console.log('FIXED: MH KPI cards redesign');
  } else { console.warn('MISS: MH KPI cards'); }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 8: CSS for hover animations — add to existing style block ────────────
{
  const styleIdx = findLine('@keyframes spin');
  if (styleIdx >= 0) {
    // Find the closing backtick+}} of this style block
    let closeIdx = styleIdx + 1;
    while (closeIdx < styleIdx + 20 && !lines[closeIdx].includes('`}} />')) closeIdx++;
    if (lines[closeIdx].includes('`}} />')) {
      // Insert before closing
      lines.splice(closeIdx, 0,
        `                    .pv-kpi { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: default; }`,
        `                    .pv-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.45); border-color: rgba(255,255,255,0.09) !important; }`,
        `                    .pv-card { transition: border-color 0.2s ease; }`,
        `                    .pv-card:hover { border-color: #252535 !important; }`,
      );
      console.log('FIXED: hover CSS injected');
    }
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 9: Statistical Summary — add min/max and full stats ─────────────────
{
  const statStart = findLine("{ label: `Mean ${analyticalContext.valCol}`, value: analyticalContext.xStats.mean.toFixed(4) }");
  if (statStart >= 0) {
    let endIdx = statStart;
    while (endIdx < statStart + 20 && !lines[endIdx].includes('.map((row, idx) =>')) endIdx++;
    const mapStart = endIdx;
    let mapEnd = mapStart;
    while (mapEnd < mapStart + 15 && !lines[mapEnd].includes('</tr>')) mapEnd++;
    // We'll replace from statStart to the end of the array declaration
    let arrEnd = statStart;
    while (arrEnd < statStart + 20 && !lines[arrEnd].includes('].map(')) arrEnd++;
    
    replaceLines(statStart, arrEnd - 1, [
      `                          { label: \`Mean \${analyticalContext.valCol}\`, value: analyticalContext.xStats.mean.toFixed(4) },`,
      `                          { label: \`Std \${analyticalContext.valCol}\`, value: analyticalContext.xStats.std.toFixed(4) },`,
      `                          { label: \`Min / Max \${analyticalContext.valCol}\`, value: \`\${analyticalContext.xStats.min.toFixed(2)} / \${analyticalContext.xStats.max.toFixed(2)}\` },`,
      `                          { label: \`Mean \${analyticalContext.cntCol}\`, value: analyticalContext.yStats.mean.toFixed(4) },`,
      `                          { label: \`Std \${analyticalContext.cntCol}\`, value: analyticalContext.yStats.std.toFixed(4) },`,
      `                          { label: \`Min / Max \${analyticalContext.cntCol}\`, value: \`\${analyticalContext.yStats.min.toFixed(2)} / \${analyticalContext.yStats.max.toFixed(2)}\` },`,
      `                          { label: 'Pearson r', value: analyticalContext.kpiCards[0]?.value },`,
      `                          { label: 'R\u00b2 (Fit)', value: analyticalContext.regR2.toFixed(4) },`,
      `                          { label: 'Slope (\u03b2\u2081)', value: analyticalContext.regSlope.toFixed(4) },`,
      `                          { label: 'Intercept (\u03b2\u2080)', value: analyticalContext.regIntercept.toFixed(4) },`,
      `                          { label: 'Sample n', value: String(analyticalContext.scatterPairs.length) },`,
    ]);
    console.log('FIXED: Statistical Summary table enhanced');
  } else { console.warn('MISS: stat summary array'); }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 10: Scatter formula line ────────────────────────────────────────────
{
  const formulaIdx = findLine("R\u00b2 = {analyticalContext.regR2.toFixed(4)}");
  if (formulaIdx >= 0) {
    lines[formulaIdx] = lines[formulaIdx]
      .replace(
        /R.*?regR2\.toFixed\(4\).*?ŷ.*?regSlope\.toFixed\(4\).*?regIntercept\.toFixed\(4\)\}/,
        `R\u00b2 = <span style={{color:'#a855f7',fontWeight:700}}>{analyticalContext.regR2.toFixed(4)}</span>{'  \u00b7  '}ŷ = <span style={{color:'#ef4444',fontWeight:700}}>{analyticalContext.regSlope.toFixed(4)}</span>x {analyticalContext.regIntercept >= 0 ? '+ ' : '\u2212 '}<span style={{color:'#ef4444',fontWeight:700}}>{Math.abs(analyticalContext.regIntercept).toFixed(4)}</span>`
      );
    console.log('FIXED: Scatter formula line');
  }
}

src = lines.join('\n');
lines = src.split('\n');

// ─── FIX 11: Gender table coloring ───────────────────────────────────────────
{
  const rowIdx = findLine("const isTotal = row.gender === 'Total';");
  if (rowIdx >= 0) {
    // Insert gColor after isTotal line
    lines.splice(rowIdx + 1, 0, 
      `                                  const gColor = row.gender === 'male' ? '#60a5fa' : row.gender === 'female' ? '#f472b6' : '#ef4444';`
    );
    // Update td color
    const tdIdx = findLine("color: isTotal ? '#ef4444' : '#e4e4e7'", rowIdx);
    if (tdIdx >= 0) {
      lines[tdIdx] = lines[tdIdx].replace(
        "color: isTotal ? '#ef4444' : '#e4e4e7'",
        "color: gColor, fontWeight: 600"
      );
    }
    console.log('FIXED: Gender table color');
  }
}

// ─── Write final file ─────────────────────────────────────────────────────────
src = lines.join('\n');
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nAll patches done. File:', fs.statSync(FILE).size, 'bytes,', src.split('\n').length, 'lines');
