import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  ZAxis,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  BarChart3,
  Database,
  LockKeyhole,
  Rows3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ResultToVisualContext } from '../../resultToVisualContext';
import { AnalyticsResult } from '../../types';

interface ComputedViewProps {
  result: Extract<AnalyticsResult, { status: 'computed' | 'partial' }>;
}

type KpiCard = {
  label: string;
  value: string | number;
  subText?: string;
  color?: string;
};

const CHART_COLORS = ['#fb4d55', '#2f80ed', '#17b890', '#9b5cf6', '#f5a524', '#ec4899'];
const CARD_BACKGROUNDS = [
  'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 100%)',
  'linear-gradient(135deg, #ecfeff 0%, #dbeafe 100%)',
  'linear-gradient(135deg, #f0fdf4 0%, #ccfbf1 100%)',
  'linear-gradient(135deg, #faf5ff 0%, #fce7f3 100%)',
];

const formatFieldName = (value: unknown) => String(value ?? '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const cleanNarrative = (value: string) => value
  .replace(/ID undefined/gi, 'the highest-ranked record')
  .replace(/a association/gi, 'an association')
  .trim();

const formatNumber = (value: number) => (
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
);

const formatValue = (value: string | number) => {
  if (typeof value === 'number') return formatNumber(value);
  if (/^\d+(\.\d+)?$/.test(value)) return value;
  return formatFieldName(value);
};

const formatChartTitle = (title?: string) => {
  const cleaned = String(title || 'Analysis Visualization')
    .replace(/Top\s+\d{6,}\s+/i, 'Top ')
    .replace(/\bID undefined\b/gi, 'Highest ranked record');
  return formatFieldName(cleaned);
};

const markdownParts = (text: string) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

const NarrativeText: React.FC<{ text: string; tone?: 'light' | 'dark' }> = ({ text, tone = 'dark' }) => (
  <p className={tone === 'light' ? 'text-sm leading-7 text-slate-700' : 'text-sm leading-7 text-zinc-100'}>
    {markdownParts(text).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className={tone === 'light' ? 'font-black text-slate-950' : 'font-black text-white'}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="mx-1 rounded-md bg-slate-950/90 px-1.5 py-0.5 font-mono text-[11px] text-rose-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    })}
  </p>
);

const kpiIcon = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes('security') || lower.includes('privacy')) return <ShieldCheck size={18} />;
  if (lower.includes('row') || lower.includes('record') || lower.includes('sample')) return <Rows3 size={18} />;
  if (lower.includes('correlation') || lower.includes('significance')) return <TrendingUp size={18} />;
  if (lower.includes('group') || lower.includes('predictor') || lower.includes('target')) return <Sparkles size={18} />;
  return <Activity size={18} />;
};

const MetricTile: React.FC<{ kpi: KpiCard; index: number }> = ({ kpi, index }) => (
  <div
    className="relative overflow-hidden rounded-[22px] border border-white/70 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.10)]"
    style={{ background: CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length] }}
  >
    <div className="absolute -right-5 -top-8 h-20 w-20 rounded-full bg-white/45" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {kpi.label}
        </div>
        <div
          className="mt-2 truncate text-2xl font-black leading-none tracking-tight"
          style={{ color: kpi.color || '#111827' }}
        >
          {formatValue(kpi.value)}
        </div>
        {kpi.subText && (
          <div className="mt-2 truncate text-xs font-semibold text-slate-500">
            {kpi.subText}
          </div>
        )}
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/65 shadow-sm"
        style={{ color: kpi.color || '#ef4444' }}
      >
        {kpiIcon(kpi.label)}
      </div>
    </div>
  </div>
);

export const ComputedView: React.FC<ComputedViewProps> = ({ result }) => {
  const layout = ResultToVisualContext.map(result);
  const isPartial = result.status === 'partial';
  const reasons = (result as any).reasons || [];
  const rows = result.data?.rows || [];
  const narrative = cleanNarrative(result.narrative || 'The analysis completed successfully.');
  const question = result.provenance?.question || 'Custom analysis';
  const boardTitle = `${formatFieldName(result.plan.intent)} Analysis`;

  const hasNoData = !result.data ||
    rows.length === 0 ||
    (layout.chartType !== 'none' && (!layout.data || layout.data.length === 0));

  const displayKpis: KpiCard[] = layout.kpis.slice(0, 4);
  if (displayKpis.length === 0) {
    displayKpis.push({
      label: 'Rows Returned',
      value: rows.length,
      subText: 'Local query output',
      color: '#fb4d55',
    });
  }

  const renderChart = () => {
    if (layout.chartType === 'bar') {
      return (
        <BarChart data={layout.data} margin={{ top: 14, right: 18, bottom: 10, left: -12 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey={layout.xAxisKey} stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={formatFieldName} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#111827', border: '0', borderRadius: 14, color: '#fff', fontSize: 12 }} />
          <Bar dataKey={layout.yAxisKey || 'value'} radius={[10, 10, 3, 3]} barSize={34}>
            {layout.data.map((_, index) => (
              <Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    if (layout.chartType === 'line') {
      return (
        <LineChart data={layout.data} margin={{ top: 14, right: 18, bottom: 10, left: -12 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey={layout.xAxisKey} stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={formatFieldName} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#111827', border: '0', borderRadius: 14, color: '#fff', fontSize: 12 }} />
          <Line type="monotone" dataKey={layout.yAxisKey || 'value'} stroke="#fb4d55" strokeWidth={3} dot={{ r: 4, fill: '#fb4d55' }} />
        </LineChart>
      );
    }

    if (layout.chartType === 'scatter') {
      return (
        <ScatterChart margin={{ top: 14, right: 18, bottom: 10, left: -12 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
          <XAxis type="number" dataKey={layout.xAxisKey} name={layout.xAxisKey} stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis type="number" dataKey={layout.yAxisKey} name={layout.yAxisKey} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <ZAxis type="number" range={[54, 54]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#111827', border: '0', borderRadius: 14, color: '#fff', fontSize: 12 }} />
          <Scatter name="Data" data={layout.data} fill="#2f80ed" />
        </ScatterChart>
      );
    }

    if (layout.chartType === 'pie') {
      return (
        <PieChart>
          <Pie
            data={layout.data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={4}
            dataKey={layout.yAxisKey || 'value'}
            nameKey={layout.xAxisKey || 'label'}
          >
            {layout.data.map((_, index) => (
              <Cell key={`pie-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: '#111827', border: '0', borderRadius: 14, color: '#fff', fontSize: 12 }} />
        </PieChart>
      );
    }

    return null;
  };

  if (hasNoData) {
    return (
      <div className="rounded-[30px] border border-white/70 bg-[#f7f2ea] p-6 text-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/75 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-100 text-rose-500">
            <Database size={24} />
          </div>
          <h3 className="mt-5 text-xl font-black tracking-tight">No matching records found</h3>
          <div className="mx-auto mt-3 max-w-xl">
            <NarrativeText text={narrative || 'The query ran locally, but no rows matched the current criteria.'} tone="light" />
          </div>
        </div>
      </div>
    );
  }

  const tableKeys = Object.keys(rows[0] || {}).filter((key) => key !== 'key' && key !== 'id');

  return (
    <div className="w-full rounded-[32px] border border-white/70 bg-[#f7f2ea] p-4 text-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:p-6">
      <div className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[28px] bg-[#111827] p-5 text-white shadow-[0_18px_55px_rgba(15,23,42,0.22)]">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-rose-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-12 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                New Analytics Engine
              </span>
              <span className="rounded-full bg-rose-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-100">
                {isPartial ? 'Partial Result' : 'Computed Result'}
              </span>
            </div>
            <h2 className="mt-5 max-w-2xl text-2xl font-black leading-[0.98] tracking-tight md:text-3xl">
              {boardTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {question}
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rows Used</div>
              <Rows3 size={18} className="text-rose-500" />
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{rows.length.toLocaleString()}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Returned from the local executor</div>
          </div>
          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Local Security</div>
              <LockKeyhole size={18} className="text-emerald-600" />
            </div>
            <div className="mt-3 text-2xl font-black tracking-tight text-emerald-700">SQLite Sandbox</div>
            <div className="mt-1 text-xs font-semibold text-emerald-700/70">Private in-browser execution</div>
          </div>
        </section>
      </div>

      <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {displayKpis.map((kpi, index) => (
          <MetricTile key={`${kpi.label}-${index}`} kpi={kpi} index={index} />
        ))}
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">
                <BarChart3 size={15} />
                Primary Visual
              </div>
              <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                {formatChartTitle(layout.title)}
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {layout.chartType}
            </span>
          </div>
          <div className="mt-5 h-[320px] w-full">
            {layout.chartType !== 'none' && layout.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 text-center">
                <Database size={28} className="text-slate-400" />
                <div className="mt-3 text-sm font-black text-slate-700">Table result</div>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">This query is best represented as rows rather than a chart.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-[28px] bg-[#17111a] p-5 text-white shadow-[0_18px_55px_rgba(15,23,42,0.16)]">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
            <Sparkles size={15} />
            Interpretation
          </div>
          <div className="mt-5">
            <NarrativeText text={narrative} />
          </div>
          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Computed By</div>
            <div className="mt-2 text-sm font-black text-emerald-300">New Analytics Engine</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">No legacy fallback text. No cloud data transfer.</div>
          </div>
        </aside>
      </section>

      {tableKeys.length > 0 && (
        <section className="mt-5 rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              <Database size={15} />
              Result Datagrid
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">
              Showing {Math.min(rows.length, 6)} of {rows.length}
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-xs">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {tableKeys.map((key) => (
                    <th key={key} className="px-3 py-3">{formatFieldName(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100 text-slate-700">
                    {tableKeys.map((key) => {
                      const value = row[key];
                      const isNumeric = typeof value === 'number';
                      return (
                        <td key={key} className="px-3 py-3 font-semibold">
                          <span className={isNumeric ? 'text-blue-600' : 'text-slate-800'}>
                            {isNumeric ? formatNumber(value) : String(value ?? '-')}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isPartial && reasons.length > 0 && (
        <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Precision Caveat</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-semibold leading-5 text-amber-900/80">
                {reasons.map((reason: string, index: number) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
