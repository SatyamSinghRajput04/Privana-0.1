/**
 * Privana AnalyzePage.tsx - Surgical patch script
 * Applies all accuracy + Power BI redesign changes
 */
const fs = require('fs');
const FILE = 'C:\\Users\\dell\\NewProject\\.vscode\\Project\\Privana\\src\\pages\\AnalyzePage.tsx';

let src = fs.readFileSync(FILE, 'utf8');

let changes = 0;
function replace(from, to, label) {
  if (!src.includes(from)) {
    console.warn('  WARN: pattern not found:', label);
    return;
  }
  src = src.split(from).join(to);
  changes++;
  console.log('  PATCHED:', label);
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Top 5 — real label column instead of generic rank
// ─────────────────────────────────────────────────────────────────────────────
replace(
`      // Top 5 records by cntCol
      const topRows = [...rows]
        .sort((a, b) => Number(b[cntCol]) - Number(a[cntCol]))
        .slice(0, 5)
        .map((r, i) => ({
          rank: \`#\${i+1}\`,
          value: Number(r[cntCol]),
          extra: Object.fromEntries(allCols.map(c => [c, r[c]])) as Record<string, unknown>
        }));`,
`      // Top 5 records by cntCol — use best identifier column as label
      const _idPriority = ['student_id','id','name','title','label','student','employee_id','user_id'];
      const _labelCol = allCols.find(c => _idPriority.includes(c.toLowerCase()))
        || allCols.find(c => {
          if (c === cntCol || c === valCol) return false;
          const samp = rows.find((r: Record<string,unknown>) => r[c] !== null && r[c] !== undefined && r[c] !== '');
          return samp ? isNaN(Number(samp[c])) : false;
        }) || null;
      const topRows = [...rows]
        .sort((a, b) => Number(b[cntCol]) - Number(a[cntCol]))
        .slice(0, 5)
        .map((r, i) => ({
          rank: _labelCol
            ? String(r[_labelCol as string]).slice(0, 14)
            : \`\${valCol}=\${Number(r[valCol]).toFixed(1)}\`,
          value: Number(r[cntCol]),
          xValue: Number(r[valCol]),
          extra: Object.fromEntries(allCols.map(c => [c, r[c]])) as Record<string, unknown>
        }));`,
  'Top 5 real label col'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: KPI card subtitles — clean symbols
// ─────────────────────────────────────────────────────────────────────────────
replace(
`        { label: 'Pearson r', value: pearsonR.toFixed(4), sub: pearsonR >= 0 ? '▲ positive' : '▼ negative', color: '#ef4444' },`,
`        { label: 'Pearson r', value: pearsonR.toFixed(4), sub: pearsonR >= 0 ? '▲ positive correlation' : '▼ negative correlation', color: pearsonR >= 0 ? '#22c55e' : '#ef4444' },`,
  'KPI pearson sub'
);
replace(
`        { label: 'R²', value: regR2.toFixed(4), sub: \`\${(regR2 * 100).toFixed(1)}% variance explained\`, color: '#8b5cf6' },`,
`        { label: 'R² (Fit)', value: regR2.toFixed(4), sub: \`\${(regR2 * 100).toFixed(1)}% variance explained\`, color: '#8b5cf6' },`,
  'KPI R2 label'
);
replace(
`        { label: \`Mean \${valCol}\`, value: xStats.mean.toFixed(2), sub: \`σ = \${xStats.std.toFixed(2)}\`, color: '#3b82f6' },`,
`        { label: \`Mean \${valCol}\`, value: xStats.mean.toFixed(2), sub: \`σ = \${xStats.std.toFixed(2)}  |  n = \${n}\`, color: '#3b82f6' },`,
  'KPI x stats sub'
);
replace(
`        { label: \`Mean \${cntCol}\`, value: yStats.mean.toFixed(2), sub: \`σ = \${yStats.std.toFixed(2)}\`, color: '#10b981' },`,
`        { label: \`Mean \${cntCol}\`, value: yStats.mean.toFixed(2), sub: \`σ = \${yStats.std.toFixed(2)}  |  min \${yStats.min.toFixed(1)}\`, color: '#10b981' },`,
  'KPI y stats sub'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Scatter formula line — clean R², ŷ, ·
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                            <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#3f3f46', marginTop: '0.25rem', fontFamily: 'var(--mono)' }}>
                              R² = {analyticalContext.regR2.toFixed(4)} · ŷ = {analyticalContext.regSlope.toFixed(4)}x + {analyticalContext.regIntercept.toFixed(4)}
                            </div>`,
`                            <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#52525b', marginTop: '0.35rem', fontFamily: 'var(--mono)', letterSpacing: '0.02em' }}>
                              R² = <span style={{ color: '#a855f7', fontWeight: 700 }}>{analyticalContext.regR2.toFixed(4)}</span>
                              {'  ·  '}
                              ŷ = <span style={{ color: '#ef4444', fontWeight: 600 }}>{analyticalContext.regSlope.toFixed(4)}</span>x
                              {analyticalContext.regIntercept >= 0 ? ' + ' : ' − '}
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>{Math.abs(analyticalContext.regIntercept).toFixed(4)}</span>
                            </div>`,
  'Scatter formula line'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: Statistical Summary table — add more stats
// ─────────────────────────────────────────────────────────────────────────────
// Find the stat summary rendering and enhance it
// Current renders: Mean X, Std X, Mean Y, Std Y, Pearson r, R², Slope, Intercept
// Add: Min X, Max X, Min Y, Max Y, n
const OLD_STAT_TABLE = `                          {analyticalContext && [
                            { label: \`Mean \${analyticalContext.valCol}\`, value: analyticalContext.xStats.mean.toFixed(4) },
                            { label: \`Std \${analyticalContext.valCol}\`, value: analyticalContext.xStats.std.toFixed(4) },
                            { label: \`Mean \${analyticalContext.cntCol}\`, value: analyticalContext.yStats.mean.toFixed(4) },
                            { label: \`Std \${analyticalContext.cntCol}\`, value: analyticalContext.yStats.std.toFixed(4) },
                            { label: 'Pearson r', value: analyticalContext.kpiCards[0]?.value },
                            { label: 'R²', value: analyticalContext.regR2.toFixed(4) },
                            { label: 'Slope', value: analyticalContext.regSlope.toFixed(4) },
                            { label: 'Intercept', value: analyticalContext.regIntercept.toFixed(4) },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #1a1a24' }}>
                              <td style={{ padding: '0.35rem 0.5rem', color: '#71717a', fontSize: '0.65rem' }}>{row.label}</td>
                              <td style={{ padding: '0.35rem 0.5rem', color: '#f4f4f5', fontSize: '0.65rem', fontWeight: 700, textAlign: 'right', fontFamily: 'var(--mono)' }}>{row.value}</td>
                            </tr>
                          ))}`;

const NEW_STAT_TABLE = `                          {analyticalContext && (() => {
                            const ac = analyticalContext;
                            const pearsonVal = Number(ac.kpiCards[0]?.value ?? 0);
                            const rows = [
                              { label: \`Mean \${ac.valCol}\`, value: ac.xStats.mean.toFixed(4), color: '#3b82f6' },
                              { label: \`Std \${ac.valCol}\`, value: ac.xStats.std.toFixed(4), color: '#52525b' },
                              { label: \`Mean \${ac.cntCol}\`, value: ac.yStats.mean.toFixed(4), color: '#10b981' },
                              { label: \`Std \${ac.cntCol}\`, value: ac.yStats.std.toFixed(4), color: '#52525b' },
                              { label: 'Pearson r', value: ac.kpiCards[0]?.value, color: pearsonVal >= 0 ? '#22c55e' : '#ef4444' },
                              { label: 'R²', value: ac.regR2.toFixed(4), color: '#8b5cf6' },
                              { label: 'Slope', value: ac.regSlope.toFixed(4), color: '#f97316' },
                              { label: 'Intercept', value: ac.regIntercept.toFixed(4), color: '#f97316' },
                              { label: \`Min \${ac.valCol}\`, value: ac.xStats.min.toFixed(2), color: '#52525b' },
                              { label: \`Max \${ac.valCol}\`, value: ac.xStats.max.toFixed(2), color: '#52525b' },
                              { label: \`Min \${ac.cntCol}\`, value: ac.yStats.min.toFixed(2), color: '#52525b' },
                              { label: \`Max \${ac.cntCol}\`, value: ac.yStats.max.toFixed(2), color: '#52525b' },
                              { label: 'Sample n', value: String(ac.scatterPairs.length), color: '#71717a' },
                            ];
                            return rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #111118' }}>
                                <td style={{ padding: '0.3rem 0.5rem', color: '#71717a', fontSize: '0.63rem' }}>{row.label}</td>
                                <td style={{ padding: '0.3rem 0.5rem', color: row.color, fontSize: '0.65rem', fontWeight: 700, textAlign: 'right', fontFamily: 'var(--mono)' }}>{row.value}</td>
                              </tr>
                            ));
                          })()}`;

replace(OLD_STAT_TABLE, NEW_STAT_TABLE, 'Statistical Summary table enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: Power BI Shell — Redesign KPI cards with hover elevation
// ─────────────────────────────────────────────────────────────────────────────
// Replace the KPI cards row container with glassmorphism + hover
replace(
`                  {/* ── KPI Cards Row ─────────────────────────────────────────────────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem', flexShrink: 0 }}>
                    {analyticalContext
                      ? /* Stat-specific KPI cards from computation */
                        analyticalContext.kpiCards.map((card, ci) => (
                          <div key={ci} style={{ background: '#0e0e12', border: \`1px solid \${card.color}22\`, borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontSize: '0.5rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{card.label}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
                            <div style={{ fontSize: '0.56rem', color: '#52525b', marginTop: '0.15rem' }}>{card.sub}</div>
                          </div>
                        ))`,
`                  {/* ── KPI Cards Row ─────────────────────────────────────────────────────────────────────── */}
                  <style dangerouslySetInnerHTML={{__html:\`
                    .pv-kpi:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; border-color: rgba(255,255,255,0.1) !important; }
                    .pv-kpi { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important; }
                    .pv-card:hover { border-color: rgba(255,255,255,0.08) !important; }
                    .pv-card { transition: border-color 0.2s ease !important; }
                  \`}} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', flexShrink: 0 }}>
                    {analyticalContext
                      ? /* Stat-specific KPI cards — computed from real data */
                        analyticalContext.kpiCards.map((card, ci) => (
                          <div key={ci} className="pv-kpi" style={{ background: 'linear-gradient(135deg, #0e0e12 0%, #111117 100%)', border: \`1px solid \${card.color}30\`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: \`radial-gradient(circle, \${card.color}08 0%, transparent 70%)\`, borderRadius: '0 10px 0 0' }} />
                            <div style={{ fontSize: '0.48rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{card.label}</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{card.value}</div>
                            <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.2rem', lineHeight: 1.3 }}>{card.sub}</div>
                          </div>
                        ))`,
  'KPI cards glassmorphism redesign'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 6: KPI cards default MH row — same style
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                        : /* Default MH KPI cards — or generic for non-MH datasets */
                        isMentalHealthSchema && kpis.records > 0
                        ? [
                            { icon: <Moon size={14} />, label: 'AVG SLEEP HOURS', value: kpis.sleep, sub: 'Average sleep per night', color: '#eab308', bg: 'rgba(234,179,8,0.06)', bdr: 'rgba(234,179,8,0.15)' },
                            { icon: <Users size={14} />, label: 'AVG AGE', value: kpis.age, sub: 'Average age (years)', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', bdr: 'rgba(59,130,246,0.15)' },
                            { icon: <Heart size={14} />, label: 'AVG STRESS', value: kpis.stress, sub: 'Average stress level', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', bdr: 'rgba(239,68,68,0.15)' },
                            { icon: <Database size={14} />, label: 'RECORDS', value: kpis.records.toLocaleString(), sub: 'Total rows', color: '#a855f7', bg: 'rgba(168,85,247,0.06)', bdr: 'rgba(168,85,247,0.15)' },
                          ].map((k, ki) => (
                            <div key={ki} style={{ background: '#0e0e12', border: '1px solid #3c1417', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: k.bg, border: \`1px solid \${k.bdr}\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
                              <div>
                                <div style={{ fontSize: '0.52rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{k.label}</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: k.color, lineHeight: 1.1, margin: '1px 0' }}>{k.value}</div>
                                <div style={{ fontSize: '0.54rem', color: '#71717a' }}>{k.sub}</div>
                              </div>
                            </div>
                          ))`,
`                        : /* Default MH KPI cards — computed from real data queries */
                        isMentalHealthSchema && kpis.records > 0
                        ? [
                            { icon: <Moon size={16} />, label: 'AVG SLEEP HOURS', value: kpis.sleep, sub: 'hrs · per night average', color: '#eab308' },
                            { icon: <Users size={16} />, label: 'AVG AGE', value: kpis.age, sub: 'years · from dataset', color: '#3b82f6' },
                            { icon: <Heart size={16} />, label: 'AVG STRESS', value: kpis.stress, sub: 'level 1–10 scale', color: '#ef4444' },
                            { icon: <Database size={16} />, label: 'TOTAL RECORDS', value: kpis.records.toLocaleString(), sub: 'rows in active filter', color: '#a855f7' },
                          ].map((k, ki) => (
                            <div key={ki} className="pv-kpi" style={{ background: 'linear-gradient(135deg, #0e0e12 0%, #111117 100%)', border: \`1px solid \${k.color}28\`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', top: 0, right: 0, width: 56, height: 56, background: \`radial-gradient(circle, \${k.color}08 0%, transparent 70%)\`, borderRadius: '0 10px 0 0' }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                <div style={{ width: 26, height: 26, borderRadius: '6px', background: \`\${k.color}12\`, border: \`1px solid \${k.color}25\`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0 }}>{k.icon}</div>
                                <div style={{ fontSize: '0.48rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{k.label}</div>
                              </div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</div>
                              <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.2rem' }}>{k.sub}</div>
                            </div>
                          ))`,
  'MH KPI cards redesign'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 7: Primary chart card — proper chart header bar
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                      {/* PRIMARY CHART */}
                      <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', minHeight: 220 }}>`,
`                      {/* PRIMARY CHART */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', padding: '0', minHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Primary Analysis</span>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {['#3f3f46','#3f3f46','#3f3f46'].map((c,i) => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />)}
                          </div>
                        </div>
                        <div style={{ padding: '0.7rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>`,
  'Primary chart card redesign'
);

// Close the extra div we opened in primary chart
replace(
`                        ) : (
                          /* Generic dataset: empty primary slot */
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: '0.6rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46' }}>
                              <TrendingUp size={16} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#3f3f46', textAlign: 'center', lineHeight: 1.4 }}>
                              Run a query to populate<br />this chart
                            </div>
                          </div>
                        )}
                      </div>`,
`                        ) : (
                          /* Generic dataset: empty primary slot with hint */
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: '0.75rem' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46' }}>
                              <TrendingUp size={18} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.68rem', color: '#52525b', fontWeight: 600, marginBottom: '0.25rem' }}>No active query</div>
                              <div style={{ fontSize: '0.6rem', color: '#3f3f46', lineHeight: 1.5 }}>Ask a question above to<br />generate analysis charts</div>
                            </div>
                          </div>
                        )}
                        </div>
                      </div>`,
  'Primary chart empty state'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 8: Secondary + Tertiary chart cards — same glassmorphism header
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                        {/* SECONDARY CHART */}
                        <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120 }}>`,
`                        {/* SECONDARY CHART */}
                        <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', flex: 1, minHeight: 120, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Distribution</span>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {['#2a2a35','#2a2a35','#2a2a35'].map((c,i) => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: c }} />)}
                            </div>
                          </div>
                          <div style={{ padding: '0.5rem 0.6rem', flex: 1 }}>`,
  'Secondary chart header'
);

replace(
`                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate this chart</div>
                            </div>
                          )}
                        </div>

                        {/* TERTIARY CHART */}
                        <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', flex: 1, minHeight: 120 }}>`,
`                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.6rem', color: '#2a2a35', textAlign: 'center' }}>Run a query to see distribution</div>
                            </div>
                          )}
                          </div>
                        </div>

                        {/* TERTIARY CHART */}
                        <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', flex: 1, minHeight: 120, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Distribution Y</span>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {['#2a2a35','#2a2a35','#2a2a35'].map((c,i) => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: c }} />)}
                            </div>
                          </div>
                          <div style={{ padding: '0.5rem 0.6rem', flex: 1 }}>`,
  'Tertiary chart header'
);

// Close tertiary chart inner div
replace(
`                          ) : isMentalHealthSchema && screenTimeStressData.length > 0 ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Screen Time vs Stress</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <LineChart data={screenTimeStressData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                  <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#52525b' }} />
                                  <YAxis tick={{ fontSize: 8, fill: '#52525b' }} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} />
                                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate this panel</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}`,
`                          ) : isMentalHealthSchema && screenTimeStressData.length > 0 ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Screen Time vs Stress</div>
                              <ResponsiveContainer width="100%" height={115}>
                                <LineChart data={screenTimeStressData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                  <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#52525b' }} />
                                  <YAxis tick={{ fontSize: 8, fill: '#52525b' }} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} />
                                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.6rem', color: '#2a2a35', textAlign: 'center' }}>Run a query to see trend</div>
                            </div>
                          )}
                          </div>
                        </div>
                      </div>
                    ) : null}`,
  'Tertiary chart close'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 9: Bottom row 3 cards — redesign with headers
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                  {/* ── Bottom Row: Stat Summary + Gender Table + Top 5 / Anxiety ─── */}
                  {(analyticalContext || isMentalHealthSchema) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', flexShrink: 0 }}>`,
`                  {/* ── Bottom Row: Stat Summary + Gender Table + Top 5 / Anxiety ─── */}
                  {(analyticalContext || isMentalHealthSchema) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', flexShrink: 0, minHeight: 0 }}>`,
  'Bottom row grid fix'
);

// Redesign bottom-left stat summary card
replace(
`                      {/* BOTTOM LEFT — Statistical Summary / Line Chart */}
                      <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Statistical Summary</div>`,
`                      {/* BOTTOM LEFT — Statistical Summary / Line Chart */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Statistical Summary</span>
                          <span style={{ fontSize: '0.5rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>LIVE</span>
                        </div>
                        <div style={{ padding: '0.5rem 0.65rem', flex: 1, overflow: 'auto' }}>`,
  'Bottom left card redesign'
);

// Redesign bottom-center gender table card
replace(
`                      {/* BOTTOM CENTER — Gender Summary / Screen Time line */}
                      <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Gender Summary Report</div>`,
`                      {/* BOTTOM CENTER — Gender Summary / Screen Time line */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Gender Summary Report</span>
                        </div>
                        <div style={{ padding: '0.5rem 0.65rem', flex: 1, overflow: 'auto' }}>`,
  'Bottom center card redesign'
);

// Redesign bottom-right Top 5 / anxiety card
replace(
`                      {/* BOTTOM RIGHT — Top 5 / Anxiety / Screen Time */}
                      <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', overflow: 'hidden' }}>`,
`                      {/* BOTTOM RIGHT — Top 5 / Anxiety / Screen Time */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0c0c10 100%)', border: '1.5px solid #1e1e2a', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: '1px solid #151520', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            {analyticalContext && analyticalContext.topRows.length > 0 ? \`Top 5 by \${analyticalContext.cntCol}\` : 'Anxiety Distribution'}
                          </span>
                        </div>
                        <div style={{ padding: '0.5rem 0.65rem', flex: 1 }}>`,
  'Bottom right card redesign'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 10: Status footer — add dataset info bar
// ─────────────────────────────────────────────────────────────────────────────
// Find the bottom tab bar and add a status line above it
replace(
`          {/* Bottom sheet page tabs */}`,
`          {/* Status Bar */}
          {selectedDataset && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', borderTop: '1px solid #111118', flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.55rem', color: '#52525b', fontFamily: 'var(--mono)' }}>
                Local Power BI-style report
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', color: '#3b82f6', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                {(kpis.records > 0 ? kpis.records : selectedDataset.row_count ?? 0).toLocaleString()} rows
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', color: '#52525b', fontFamily: 'var(--mono)' }}>
                {selectedDataset.name?.split('.').pop()?.toUpperCase() ?? 'CSV'} loaded
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', padding: '0px 5px', borderRadius: '3px', fontWeight: 700 }}>
                🔒 Local sandbox
              </span>
              {analyticalContext && (
                <>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.55rem', color: '#8b5cf6', fontFamily: 'var(--mono)' }}>
                    {analyticalContext.type} · n={analyticalContext.scatterPairs.length}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Bottom sheet page tabs */}`,
  'Status footer bar'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 11: Top 5 chart — show real label in Top 5 bar chart rendering
// ─────────────────────────────────────────────────────────────────────────────
// The topRows now has .rank as the real label (id/name or x=value)
// The existing chart code uses r.rank for Y axis — that's already correct.
// But make Y axis wider to show full labels
replace(
`                                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#a1a1aa' }} width={28} />`,
`                                <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fill: '#a1a1aa' }} width={55} />`,
  'Top 5 Y axis wider'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 12: Insight banner — improved design
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                    return (
                      <div style={{
                        background: 'rgba(239,68,68,0.03)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.9rem',
                        display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: '0.8rem', flexShrink: 0, marginTop: '0.05rem' }}>📐</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                            Insight — {analyticalContext.type.charAt(0).toUpperCase() + analyticalContext.type.slice(1)} Analysis
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#a1a1aa', lineHeight: 1.5 }}>{summary}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, marginTop: '0.05rem' }}>
                          <span style={{ fontSize: '0.55rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>LOCAL</span>
                          <span style={{ fontSize: '0.55rem', color: '#3f3f46' }}>n = {analyticalContext.scatterPairs.length} pts</span>
                        </div>
                      </div>
                    );`,
`                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, rgba(139,92,246,0.03) 100%)',
                        border: '1px solid rgba(239,68,68,0.18)',
                        borderRadius: '10px',
                        padding: '0.65rem 1rem',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        flexShrink: 0,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.85rem' }}>📐</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.18rem' }}>
                            Insight — {analyticalContext.type.charAt(0).toUpperCase() + analyticalContext.type.slice(1)} Analysis
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#a1a1aa', lineHeight: 1.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.52rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>LOCAL</span>
                          <span style={{ fontSize: '0.52rem', color: '#3f3f46', fontFamily: 'var(--mono)' }}>n = {analyticalContext.scatterPairs.length} pts</span>
                        </div>
                      </div>
                    );`,
  'Insight banner redesign'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 13: Gender table rows — better styling with color-coded total
// ─────────────────────────────────────────────────────────────────────────────
replace(
`                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1.5px solid #1a1a24', color: '#71717a' }}>
                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: 600, fontSize: '0.58rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>gender</th>
                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: 600, fontSize: '0.58rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>avg sleep</th>
                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: 600, fontSize: '0.58rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>avg age</th>
                                  <th style={{ padding: '0.3rem 0.4rem', fontWeight: 600, fontSize: '0.58rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {genderSummaryTable.map((row, idx) => {
                                  const isTotal = row.gender === 'Total';
                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #111118', fontWeight: isTotal ? 700 : 400, background: isTotal ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                                      <td style={{ padding: '0.4rem 0.4rem', color: isTotal ? '#ef4444' : '#e4e4e7' }}>{row.gender}</td>
                                      <td style={{ padding: '0.4rem 0.4rem', fontFamily: 'var(--mono)' }}>{row.avg_sleep_hours}</td>
                                      <td style={{ padding: '0.4rem 0.4rem', fontFamily: 'var(--mono)' }}>{row.avg_age}</td>
                                      <td style={{ padding: '0.4rem 0.4rem', fontFamily: 'var(--mono)', fontWeight: 700 }}>{row.count.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>`,
`                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.64rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #1a1a24', color: '#3f3f46' }}>
                                  <th style={{ padding: '0.28rem 0.4rem', fontWeight: 700, fontSize: '0.52rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>gender</th>
                                  <th style={{ padding: '0.28rem 0.4rem', fontWeight: 700, fontSize: '0.52rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>avg sleep</th>
                                  <th style={{ padding: '0.28rem 0.4rem', fontWeight: 700, fontSize: '0.52rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>avg age</th>
                                  <th style={{ padding: '0.28rem 0.4rem', fontWeight: 700, fontSize: '0.52rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {genderSummaryTable.map((row, idx) => {
                                  const isTotal = row.gender === 'Total';
                                  const gColor = row.gender === 'male' ? '#3b82f6' : row.gender === 'female' ? '#ec4899' : '#ef4444';
                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #0e0e14', fontWeight: isTotal ? 700 : 400, background: isTotal ? 'rgba(239,68,68,0.02)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)' }}>
                                      <td style={{ padding: '0.38rem 0.4rem', color: gColor, fontWeight: 600 }}>{row.gender}</td>
                                      <td style={{ padding: '0.38rem 0.4rem', color: '#e4e4e7', fontFamily: 'var(--mono)' }}>{row.avg_sleep_hours}</td>
                                      <td style={{ padding: '0.38rem 0.4rem', color: '#e4e4e7', fontFamily: 'var(--mono)' }}>{row.avg_age}</td>
                                      <td style={{ padding: '0.38rem 0.4rem', color: isTotal ? '#ef4444' : '#a1a1aa', fontFamily: 'var(--mono)', fontWeight: isTotal ? 700 : 500 }}>{row.count.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>`,
  'Gender table styling'
);

// ─────────────────────────────────────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, src, 'utf8');
console.log(`\nDone! ${changes} patches applied. File: ${fs.statSync(FILE).size} bytes`);
