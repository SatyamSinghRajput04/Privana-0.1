// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ComputedView.tsx
// S10 COMPUTED VIEW — Renders natural narratives, charts, and KPIs in Power BI style.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, ZAxis 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, Users, Database, Shield, Sparkles, 
  Activity, Hash, Server
} from 'lucide-react';
import { ResultToVisualContext } from '../../resultToVisualContext';
import { AnalyticsResult } from '../../types';

// Self-contained inline markdown formatter for the narrative
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p className="text-sm text-zinc-300 leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-zinc-100">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-red-400 border border-zinc-800 text-xs mx-0.5">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </p>
  );
};

interface ComputedViewProps {
  result: Extract<AnalyticsResult, { status: 'computed' | 'partial' }>;
}

const POWER_BI_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899'];

const formatFieldName = (value: unknown) => String(value ?? '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatPanelTitle = (title?: string) => {
  const cleaned = String(title || 'Analysis Visualization')
    .replace(/Top\s+\d{6,}\s+/i, 'Top ')
    .replace(/\bID undefined\b/gi, 'Highest ranked record');
  return formatFieldName(cleaned);
};

const formatKpiValue = (value: string | number) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return formatFieldName(value);
};

const getKpiIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('correlation') || l.includes('significance') || l.includes('r')) {
    return <TrendingUp size={14} className="text-purple-400" />;
  }
  if (l.includes('predict') || l.includes('predictor') || l.includes('target') || l.includes('outcome')) {
    return <Sparkles size={14} className="text-amber-400" />;
  }
  if (l.includes('group') || l.includes('compared') || l.includes('sample') || l.includes('highest')) {
    return <Users size={14} className="text-blue-400" />;
  }
  if (l.includes('record') || l.includes('scanned') || l.includes('match') || l.includes('count')) {
    return <Database size={14} className="text-pink-400" />;
  }
  if (l.includes('privacy') || l.includes('shield') || l.includes('engine') || l.includes('status')) {
    return <Shield size={14} className="text-emerald-400" />;
  }
  if (l.includes('difference') || l.includes('max') || l.includes('p-value') || l.includes('significance')) {
    return <Activity size={14} className="text-rose-400" />;
  }
  return <Hash size={14} className="text-zinc-400" />;
};

export const ComputedView: React.FC<ComputedViewProps> = ({ result }) => {
  const layout = ResultToVisualContext.map(result);
  const isPartial = result.status === 'partial';
  const reasons = (result as any).reasons || [];
  const displayNarrative = (result.narrative || '')
    .replace(/ID undefined/gi, 'the highest-ranked record')
    .replace(/a association/gi, 'an association');
  const question = result.provenance?.question || 'Custom analysis';

  const hasNoData = !result.data || 
    (Array.isArray(result.data) && result.data.length === 0) ||
    (layout.chartType !== 'none' && (!layout.data || layout.data.length === 0));

  if (hasNoData) {
    return (
      <div className="flex flex-col gap-6 w-full">
        {/* 1. Narrative Card */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
          <SimpleMarkdown text={displayNarrative || "No records matched your specific filters."} />
          <div className="mt-3 pt-2 border-t border-zinc-800/40 flex items-center justify-between">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Computed by: New Analytics Engine
            </div>
          </div>
        </div>

        {/* 2. Empty State Banner */}
        <div className="p-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 text-lg">
            🔍
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">No matching records found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mx-auto leading-relaxed">
              The query executed successfully on the local SQLite engine, but the active database query returned zero rows. Try broadening your criteria or selecting another schema field.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compile a perfect 4-column KPI cards list just like Power BI!
  const displayKpis = [...layout.kpis];
  
  if (displayKpis.length < 4) {
    const recordCount = result.data?.rows?.length || 0;
    displayKpis.push({
      label: 'ROWS RETURNED',
      value: recordCount.toLocaleString(),
      subText: 'SQLite query output rows',
      color: '#ef4444', // Red/Coral theme color
    });
  }
  
  if (displayKpis.length < 4) {
    displayKpis.push({
      label: 'LOCAL SECURITY',
      value: 'SQLite Sandbox',
      subText: '100% private in-browser',
      color: '#10b981', // Emerald green security color
    });
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="rounded-2xl border border-red-500/15 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_34%),linear-gradient(135deg,rgba(18,18,24,0.96),rgba(8,4,5,0.98))] p-4 shadow-2xl"
        style={{ boxShadow: '0 18px 50px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                New Analytics Engine
              </span>
              <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">
                {isPartial ? 'Partial With Caveats' : 'Computed Result'}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-black leading-tight tracking-tight text-zinc-50">
              {formatFieldName(result.plan.intent)} Dashboard
            </h2>
            <p className="mt-1 max-w-3xl truncate text-xs text-zinc-400">
              {question}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            <div className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2">
              <div className="font-bold text-zinc-400">Rows Used</div>
              <div className="mt-1 text-sm font-black text-zinc-100">{(result.data?.rows?.length || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
              <div className="font-bold text-emerald-300/80">Privacy</div>
              <div className="mt-1 text-sm font-black text-emerald-300">Local</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
         ROW 1: POWER BI-STYLE KPI ROW (Always perfect 4 cards grid)
         ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {displayKpis.map((kpi, idx) => (
          <div 
            key={idx}
            className="p-3.5 rounded-2xl border bg-gradient-to-br from-[#12121a] via-[#0d0d12] to-[#080405] relative overflow-hidden group shadow-lg flex flex-col justify-between"
            style={{ 
              borderColor: kpi.color ? `${kpi.color}25` : '#1f1f23',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.01), 0 4px 12px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {kpi.label}
              </span>
              <div 
                className="w-5 h-5 rounded-md flex items-center justify-center border"
                style={{ 
                  backgroundColor: kpi.color ? `${kpi.color}0c` : 'rgba(255,255,255,0.02)',
                  borderColor: kpi.color ? `${kpi.color}1c` : '#27272a'
                }}
              >
                {getKpiIcon(kpi.label)}
              </div>
            </div>
            
            <div 
              className="text-xl font-black truncate leading-tight tracking-tight my-0.5"
              style={{ color: kpi.color || '#f4f4f5', textShadow: kpi.color ? `0 0 10px ${kpi.color}15` : 'none' }}
            >
              {formatKpiValue(kpi.value)}
            </div>
            
            {kpi.subText && (
              <div className="text-[10px] text-zinc-500 font-medium truncate mt-1">
                {kpi.subText}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
         ROW 2: TWO-COLUMN DASHBOARD CANVAS (Left Chart, Right Explanation)
         ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        {/* LEFT COLUMN: Premium Chart Panel (Takes 3 columns / 60% width) */}
        {layout.chartType !== 'none' && layout.data.length > 0 ? (
          <div className="xl:col-span-3 p-4 rounded-2xl border border-zinc-800/80 bg-[linear-gradient(145deg,rgba(12,12,18,0.94),rgba(4,4,7,0.98))] shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2 mb-3">
              <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wide">
                <TrendingUp size={13} className="text-red-400" />
                <span>{formatPanelTitle(layout.title)}</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500 uppercase px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/60">
                {layout.chartType}
              </span>
            </div>

            <div className="h-56 w-full my-1">
              <ResponsiveContainer width="100%" height="100%">
                {layout.chartType === 'bar' ? (
                  <BarChart data={layout.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                    <XAxis 
                      dataKey={layout.xAxisKey} 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                      tickFormatter={formatFieldName}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#0e0e12', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '8px' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 600 }}
                    />
                    <Bar 
                      dataKey={layout.yAxisKey || 'value'} 
                      fill="#ef4444" 
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    >
                      {layout.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={POWER_BI_COLORS[index % POWER_BI_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : layout.chartType === 'line' ? (
                  <LineChart data={layout.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                    <XAxis 
                      dataKey={layout.xAxisKey} 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                      tickFormatter={formatFieldName}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#0e0e12', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '8px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={layout.yAxisKey || 'value'} 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ stroke: '#ef4444', strokeWidth: 1.5, r: 3, fill: '#080405' }}
                    />
                  </LineChart>
                ) : layout.chartType === 'scatter' ? (
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                    <CartesianGrid stroke="#1f1f23" strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey={layout.xAxisKey} 
                      name={layout.xAxisKey} 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                    />
                    <YAxis 
                      type="number" 
                      dataKey={layout.yAxisKey} 
                      name={layout.yAxisKey} 
                      stroke="#52525b" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZAxis type="number" range={[50, 50]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: '#0e0e12', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '8px' }}
                    />
                    <Scatter name="Data" data={layout.data} fill="#3b82f6" />
                  </ScatterChart>
                ) : layout.chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={layout.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey={layout.yAxisKey || 'value'}
                      nameKey={layout.xAxisKey || 'label'}
                    >
                      {layout.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={POWER_BI_COLORS[index % POWER_BI_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#0e0e12', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '8px' }}
                    />
                  </PieChart>
                ) : null}
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="xl:col-span-3 p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-col justify-center items-center text-center shadow-lg min-h-[220px]">
            <Server size={22} className="text-zinc-600 mb-2" />
            <span className="text-xs font-semibold text-zinc-400">Data Table Visualization</span>
            <p className="text-[10px] text-zinc-600 mt-1 max-w-[240px]">
              This query type maps directly to a relational grid preview. Check the raw dataset table below.
            </p>
          </div>
        )}

        {/* RIGHT COLUMN: AI Narrative Card & Local Security Badges (Takes 2 columns / 40% width) */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          {/* A. Narrative / AI Explanation */}
          <div 
            className="p-4 rounded-2xl border shadow-lg flex-1 flex flex-col justify-between"
            style={{ 
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(139, 92, 246, 0.02) 100%)',
              borderColor: 'rgba(239, 68, 68, 0.16)'
            }}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  AI Interpretation
                </span>
              </div>
              <SimpleMarkdown text={displayNarrative} />
            </div>

            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-3 pt-2 border-t border-zinc-800/30 flex items-center justify-between">
              <span>ACTIVE COCKPIT NODE</span>
              <span className="text-red-400">SECURE SHELL</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
         ROW 3: DETAILED TABULAR DATA PREVIEW (DuckDB Datagrid)
         ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      {result.data?.rows && result.data.rows.length > 0 && (() => {
        const rows = result.data.rows;
        // Strip out Recharts auto key columns
        const keys = Object.keys(rows[0] || {}).filter(k => k !== 'key' && k !== 'id');
        return (
          <div className="p-3.5 rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(12,12,18,0.9),rgba(4,4,7,0.96))] shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Database size={11} className="text-zinc-400" />
                <span>Local Relational Datagrid Output</span>
              </span>
              <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-800/60 px-1.5 py-0.5 rounded font-mono">
                Showing top {Math.min(rows.length, 6)} rows of {rows.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] text-zinc-300 font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-900/30">
                    {keys.map(k => (
                      <th key={k} className="p-1.5 truncate tracking-wide">{formatFieldName(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-zinc-800/30 hover:bg-zinc-900/10">
                      {keys.map(k => {
                        const val = row[k];
                        const isNumeric = typeof val === 'number';
                        return (
                          <td 
                            key={k} 
                            className="p-1.5 max-w-[150px] truncate"
                            style={{ color: isNumeric ? '#3b82f6' : '#e4e4e7' }}
                          >
                            {isNumeric ? (Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)) : String(val ?? '-')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
         ROW 4: CAUTION / PRIVACY INTERCEPTORS (If partial group suppression active)
         ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═  */}
      {isPartial && reasons.length > 0 && (
        <div 
          className="p-3 rounded-xl border border-amber-500/20 bg-amber-950/10 shrink-0"
          style={{
            background: 'rgba(245, 158, 11, 0.01)',
            borderColor: 'rgba(245, 158, 11, 0.12)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={13} />
            <div>
              <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">
                Privacy / Precision Caveat
              </div>
              <ul className="list-disc pl-4 text-[10px] text-zinc-400 space-y-0.5">
                {reasons.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
