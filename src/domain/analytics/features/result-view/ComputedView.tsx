// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ComputedView.tsx
// S10 COMPUTED VIEW — Renders natural narratives, charts, and KPIs.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, ZAxis 
} from 'recharts';
import { AlertTriangle, TrendingUp } from 'lucide-react';
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
            <code key={i} className="font-mono bg-zinc-950 px-1 py-0.5 rounded text-purple-400 border border-zinc-800 text-xs mx-0.5">
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

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#ef4444'];

export const ComputedView: React.FC<ComputedViewProps> = ({ result }) => {
  const layout = ResultToVisualContext.map(result);
  const isPartial = result.status === 'partial';
  const reasons = (result as any).reasons || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. Narrative Card */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
        <SimpleMarkdown text={result.narrative} />
        <div className="mt-3 pt-2 border-t border-zinc-800/40 flex items-center justify-between">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Computed by: New Analytics Engine
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Grid */}
      {layout.kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layout.kpis.map((kpi, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 relative overflow-hidden group"
            >
              <div 
                className="absolute top-0 left-0 w-1 h-full"
                style={{ backgroundColor: kpi.color || '#8b5cf6' }}
              />
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                {kpi.label}
              </div>
              <div 
                className="text-lg font-bold text-zinc-100 truncate"
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </div>
              {kpi.subText && (
                <div className="text-xs text-zinc-400 mt-1">
                  {kpi.subText}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Recharts Visualization Card */}
      {layout.chartType !== 'none' && layout.data.length > 0 && (
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-4">
            <div className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-400" />
              <span>{layout.title}</span>
            </div>
            <span className="text-xs font-mono text-zinc-500 uppercase">
              Chart type: {layout.chartType}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {layout.chartType === 'bar' ? (
                <BarChart data={layout.data} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey={layout.xAxisKey} 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa', fontWeight: 600 }}
                  />
                  <Bar 
                    dataKey={layout.yAxisKey || 'value'} 
                    fill="#8b5cf6" 
                    radius={[4, 4, 0, 0]}
                  >
                    {layout.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : layout.chartType === 'line' ? (
                <LineChart data={layout.data} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey={layout.xAxisKey} 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={layout.yAxisKey || 'value'} 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4, fill: '#09090b' }}
                  />
                </LineChart>
              ) : layout.chartType === 'scatter' ? (
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey={layout.xAxisKey} 
                    name={layout.xAxisKey} 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    type="number" 
                    dataKey={layout.yAxisKey} 
                    name={layout.yAxisKey} 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZAxis type="number" range={[60, 60]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  />
                  <Scatter name="Data" data={layout.data} fill="#8b5cf6" />
                </ScatterChart>
              ) : layout.chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={layout.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey={layout.yAxisKey || 'value'}
                    nameKey={layout.xAxisKey || 'label'}
                  >
                    {layout.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  />
                </PieChart>
              ) : null}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Partial Group Reasons/Suppressions */}
      {isPartial && reasons.length > 0 && (
        <div 
          className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10"
          style={{
            background: 'rgba(245, 158, 11, 0.02)',
            borderColor: 'rgba(245, 158, 11, 0.12)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div>
              <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">
                Privacy / Precision Caveat
              </div>
              <ul className="list-disc pl-4 text-xs text-zinc-400 space-y-1">
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
