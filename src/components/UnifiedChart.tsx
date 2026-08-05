import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ZAxis
} from 'recharts';
import { VisualContract } from '../domain/analytics/types';
import { verifyContract } from '../domain/analytics/verifyContract';
import { formatFieldName } from '../domain/analytics/schemaLookup';

// Hard ceiling for scatter SVG elements. Even if an upstream executor
// skips downsampling, we never push more than this many <circle> nodes.
const MAX_RENDER_POINTS = 2_000;

const PALETTE = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1'
];

const TT_STYLE = {
  contentStyle: {
    background: '#0f1828',
    border: '1px solid #1b2e4a',
    borderRadius: 8,
    fontSize: '0.7rem',
    color: '#eef2ff',
    padding: '6px 10px',
  },
  labelStyle: { color: '#8ba4c8', marginBottom: 2 },
};

const AXIS_STYLE = { fontSize: 9, fill: '#4d6a8a' };
const GRID_STYLE = { strokeDasharray: '3 3', stroke: '#141418' };

export { formatFieldName };

export function formatNumber(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '');
  if (isNaN(v) || !Number.isFinite(v)) return '-';
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export interface UnifiedChartProps {
  contract?: VisualContract;
  data?: Record<string, any>[];
  chartType?: string;
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKeys?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  title?: string;
  height?: number;
}

function EmptyState({ reason, height }: { reason: string; height: number | string }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--t4)',
        fontFamily: 'var(--mono)',
        fontSize: '0.72rem',
        textAlign: 'center',
        padding: '1rem',
      }}
    >
      {reason}
    </div>
  );
}

/**
 * UnifiedChart: Pure renderer for VisualContracts.
 * Computes NO schema types or keys via Object.keys() introspection.
 */
export default function UnifiedChart({
  contract: rawContract,
  data: propsData,
  chartType: propsChartType,
  xAxisKey: propsXAxisKey,
  yAxisKey: propsYAxisKey,
  seriesKeys: propsSeriesKeys,
  xAxisLabel: propsXAxisLabel,
  yAxisLabel: propsYAxisLabel,
  height = 240
}: UnifiedChartProps) {

  // Build resolved contract
  let contract: VisualContract;

  if (rawContract) {
    contract = verifyContract(rawContract);
  } else if (propsData && propsData.length > 0) {
    const xKey = propsXAxisKey || 'category';
    const yKey = propsYAxisKey || 'value';
    const sKeys = propsSeriesKeys || [yKey];

    const chartKind = propsChartType || 'bar';

    if (chartKind === 'pie' || chartKind === 'donut') {
      contract = verifyContract({
        kind: 'pie',
        schemaVersion: 1,
        labelKey: xKey,
        valueKey: yKey,
        labelDisplay: propsXAxisLabel || formatFieldName(xKey),
        data: propsData,
        xAxisLabel: propsXAxisLabel,
        yAxisLabel: propsYAxisLabel,
      });
    } else if (chartKind === 'scatter') {
      contract = verifyContract({
        kind: 'scatter',
        schemaVersion: 1,
        xAxis: { key: xKey, label: propsXAxisLabel || formatFieldName(xKey), vizType: 'numeric' },
        yAxis: { key: yKey, label: propsYAxisLabel || formatFieldName(yKey), vizType: 'numeric' },
        data: propsData as any,
        xAxisLabel: propsXAxisLabel,
        yAxisLabel: propsYAxisLabel,
      });
    } else if (chartKind === 'line') {
      contract = verifyContract({
        kind: 'line',
        schemaVersion: 1,
        xAxis: { key: xKey, label: propsXAxisLabel || formatFieldName(xKey), vizType: 'date' },
        yAxis: { key: yKey, label: propsYAxisLabel || formatFieldName(yKey), vizType: 'numeric' },
        series: sKeys.map(k => ({ key: k, label: formatFieldName(k) })),
        data: propsData,
        xAxisLabel: propsXAxisLabel,
        yAxisLabel: propsYAxisLabel,
      });
    } else {
      contract = verifyContract({
        kind: 'bar',
        schemaVersion: 1,
        xAxis: { key: xKey, label: propsXAxisLabel || formatFieldName(xKey), vizType: 'category' },
        yAxis: { key: yKey, label: propsYAxisLabel || formatFieldName(yKey), vizType: 'numeric' },
        series: sKeys.map(k => ({ key: k, label: formatFieldName(k) })),
        data: propsData,
        xAxisLabel: propsXAxisLabel,
        yAxisLabel: propsYAxisLabel,
      });
    }
  } else {
    contract = verifyContract({ kind: 'empty', schemaVersion: 1, reason: 'No dataset records to display.' });
  }

  if (contract.kind === 'empty') {
    return <EmptyState reason={contract.reason} height={height} />;
  }

  // ── PIE / DONUT ────────────────────────────────────────────────────────────
  if (contract.kind === 'pie') {
    const pieData = (contract.data || []).map(row => ({
      name: formatFieldName(row[contract.labelKey]),
      value: Number(row[contract.valueKey] || 0)
    }));
    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return (
      <div style={{ width: '100%', height }} className="flex items-center justify-between relative">
        <div className="relative" style={{ width: '55%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={height * 0.18}
                outerRadius={height * 0.32}
                paddingAngle={2}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  (percent ?? 0) > 0.05 ? `${name?.slice(0, 10)} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                }
                labelLine={{ stroke: '#2d4560', strokeWidth: 1 }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip {...TT_STYLE} formatter={(v: unknown) => [formatNumber(v), '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-[12px] font-black text-zinc-100 leading-none">
              {formatNumber(total)}
            </div>
            <div className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
              Total
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1.5 pl-3 border-l border-zinc-900/60 max-h-[90%] overflow-y-auto">
          {pieData.map((item, idx) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={idx} className="flex items-center gap-2 text-[10px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[idx % PALETTE.length] }} />
                <span className="text-zinc-400 flex-1 truncate font-medium" title={item.name}>
                  {item.name}
                </span>
                <span className="font-bold text-zinc-200 tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── SCATTER ────────────────────────────────────────────────────────────────
  if (contract.kind === 'scatter' || contract.kind === 'correlationSummary') {
    const xKey = (contract as any).xAxis?.key || 'x';
    const yKey = (contract as any).yAxis?.key || 'y';
    const xLabel = (contract as any).xAxis?.label || contract.xAxisLabel || xKey;
    const yLabel = (contract as any).yAxis?.label || contract.yAxisLabel || yKey;
    const raw = (contract.data || []) as any[];
    const scatterData = raw.length > MAX_RENDER_POINTS ? raw.slice(0, MAX_RENDER_POINTS) : raw;

    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              type="number"
              dataKey={xKey}
              stroke="#3f3f46"
              fontSize={8}
              tickLine={false}
              name={formatFieldName(xLabel)}
              tickFormatter={formatNumber}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              stroke="#3f3f46"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              width={44}
              name={formatFieldName(yLabel)}
              tickFormatter={formatNumber}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={TT_STYLE.contentStyle}
              formatter={(value, name) => [formatNumber(value), formatFieldName(String(name ?? ''))]}
            />
            <Scatter data={scatterData} fill={PALETTE[0]} opacity={0.75} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── LINE / AREA ────────────────────────────────────────────────────────────
  if (contract.kind === 'line') {
    const xKey = contract.xAxis.key;
    const series = contract.series.length > 0 ? contract.series : [{ key: contract.yAxis.key, label: contract.yAxis.label }];
    const lineData = (contract.data || []) as any[];

    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData} margin={{ top: 8, right: 16, left: -25, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="#3f3f46"
              fontSize={8}
              tickLine={false}
              tickFormatter={formatFieldName}
            />
            <YAxis
              stroke="#3f3f46"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
              width={44}
            />
            <Tooltip {...TT_STYLE} formatter={(v: unknown) => [formatNumber(v), '']} />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color || PALETTE[i % PALETTE.length]}
                strokeWidth={1.5}
                dot={{ stroke: s.color || PALETTE[i % PALETTE.length], strokeWidth: 1.5, r: 2.5, fill: '#080405' }}
                activeDot={{ r: 4 }}
              />
            ))}
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: '0.68rem', color: '#4d6a8a' }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── BAR (Default & All Summary Kinds) ──────────────────────────────────────
  let xKey = 'category';
  let yKey = 'value';
  let series: Array<{ key: string; label: string }> = [];
  let barData: any[] = [];

  if (contract.kind === 'bar') {
    xKey = contract.xAxis.key;
    yKey = contract.yAxis.key;
    series = contract.series.length > 0 ? contract.series : [{ key: yKey, label: contract.yAxis.label }];
    barData = (contract.data || []) as any[];
  } else if (contract.kind === 'groupedAverages' || contract.kind === 'comparisonSummary' || contract.kind === 'rankingSummary') {
    xKey = 'category';
    yKey = 'value';
    series = [{ key: 'value', label: contract.yAxisLabel || 'Value' }];
    barData = (contract.data || []) as any[];
  } else if (contract.kind === 'featureImportance') {
    xKey = 'feature';
    yKey = 'association';
    series = [{ key: 'association', label: 'Association Strength' }];
    barData = (contract.data || []) as any[];
  } else if (contract.kind === 'distributionBins') {
    xKey = 'binRange';
    yKey = 'count';
    series = [{ key: 'count', label: contract.metricName || 'Count' }];
    barData = (contract.data || []) as any[];
  } else if (contract.kind === 'tableRows') {
    barData = (contract.data || []).slice(0, 15);
    xKey = contract.columns[0] || 'column';
    yKey = contract.columns[1] || contract.columns[0] || 'value';
    series = [{ key: yKey, label: formatFieldName(yKey) }];
  }

  const cleanBarData = barData.slice(0, 15);
  const isHoriz = cleanBarData.length > 8;
  const labelLength = cleanBarData.reduce((max, row) => Math.max(max, String(row[xKey] || '').length), 0);
  const rotationAngle = cleanBarData.length > 5 ? (labelLength > 10 ? -35 : -25) : 0;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={cleanBarData}
          layout={isHoriz ? 'vertical' : 'horizontal'}
          margin={{
            top: 8,
            right: 16,
            left: isHoriz ? Math.min(120, labelLength * 7) - 30 : -25,
            bottom: isHoriz ? 8 : (rotationAngle !== 0 ? Math.min(60, labelLength * 4) : 8)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
          {isHoriz ? (
            <>
              <XAxis type="number" tickFormatter={formatNumber} tick={AXIS_STYLE} tickLine={false} />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ ...AXIS_STYLE, fontSize: 8 }}
                tickLine={false}
                width={Math.min(120, labelLength * 7)}
                tickFormatter={formatFieldName}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ ...AXIS_STYLE, fontSize: 8 }}
                tickLine={false}
                angle={rotationAngle}
                textAnchor={rotationAngle !== 0 ? 'end' : 'middle'}
                height={rotationAngle !== 0 ? 35 : 20}
                tickFormatter={formatFieldName}
              />
              <YAxis
                tickFormatter={formatNumber}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={44}
              />
            </>
          )}
          <Tooltip {...TT_STYLE} formatter={(v: unknown) => [formatNumber(v), '']} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={PALETTE[i % PALETTE.length]}
              radius={isHoriz ? [0, 2, 2, 0] : [2, 2, 0, 0]}
              barSize={12}
            >
              {series.length === 1 && cleanBarData.map((_, j) => (
                <Cell key={j} fill={PALETTE[j % PALETTE.length]} />
              ))}
            </Bar>
          ))}
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: '0.68rem', color: '#4d6a8a' }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
