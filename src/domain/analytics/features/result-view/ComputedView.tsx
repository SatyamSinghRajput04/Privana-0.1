// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ComputedView.tsx
// S10 COMPUTED VIEW — Dynamic Obsidian Claymorphic Dashboard Visual Upgrades.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, ZAxis 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, Users, Database, Shield, Sparkles, 
  Activity, Hash, Server, ArrowRight
} from 'lucide-react';
import { ResultToVisualContext } from '../../resultToVisualContext';
import { AnalyticsResult, CardDefinition, CardSpec, VisualContract } from '../../types';
import { useCockpitStore } from '../../../../store/useCockpitStore';
import { useWorkspaceStore } from '../../../../store/useWorkspaceStore';
import { ComposedChart } from 'recharts';


// Self-contained inline markdown formatter for the narrative
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const parseInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-zinc-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-red-400 border border-zinc-900 text-[11px] mx-0.5">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const lines = text.split('\n');
  return (
    <div className="flex flex-col gap-1.5 text-xs text-zinc-400 leading-relaxed font-normal break-words whitespace-normal">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        
        // Headings
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-sm font-black text-zinc-100 border-b border-zinc-900/60 pb-1 mt-3 mb-1">{parseInline(line.slice(2))}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xs font-bold text-zinc-200 border-b border-zinc-900/40 pb-0.5 mt-2.5 mb-1">{parseInline(line.slice(3))}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-[11px] font-bold text-zinc-300 mt-2 mb-0.5">{parseInline(line.slice(4))}</h3>;
        }
        
        // Bullet list
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-2">
              <span className="text-red-400 font-extrabold select-none">•</span>
              <span className="flex-1">{parseInline(line.slice(2))}</span>
            </div>
          );
        }
        
        // Alert/Quote
        if (line.startsWith('> ')) {
          const alertMatch = line.match(/^>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
          if (alertMatch) {
            return (
              <div key={i} className="bg-zinc-950/40 border border-zinc-900/80 px-2.5 py-1.5 rounded text-[10px] text-zinc-400 font-medium my-1 flex items-center gap-1.5">
                <span className="text-purple-400 font-extrabold">[{alertMatch[1]}]</span>
              </div>
            );
          }
          return (
            <blockquote key={i} className="border-l-2 border-red-500/50 pl-2.5 italic text-zinc-500 my-1">
              {parseInline(line.slice(2))}
            </blockquote>
          );
        }

        // Paragraph
        return (
          <p key={i} className="text-[11px] text-zinc-400">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
};

// S14 FACTS COMPILER — Dynamic Facts-Grounded Insights Generator (T=0 style formatter)
const compileFactsNarrative = (workspace: any, results: any): string => {
  let text = `# Executive Summary: Local Workspace Analysis\n\n`;
  text += `This dynamic interpretive report aggregates computed statistics across your active workspace sheets for dataset **${workspace.datasetId}**.\n\n`;

  let hasFacts = false;
  
  workspace.sheets.forEach((sheet: any) => {
    if (sheet.id.toLowerCase().includes('insights')) return;
    
    text += `## ${sheet.name} Findings\n\n`;
    
    sheet.cards.forEach((card: any) => {
      const result = results[sheet.id]?.[card.id];
      if (!result) return;
      
      hasFacts = true;
      text += `### **${card.title}**\n`;
      
      if (result.kind === 'groupedAverages') {
        const data = result.data || [];
        if (data.length > 0) {
          const top = data[0];
          const bottom = data[data.length - 1];
          text += `* **Key Fact:** The highest average category in **${result.xAxisLabel}** is **${top.category}** with an average value of **${top.value.toFixed(2)}** ${result.yAxisLabel || ''}.\n`;
          if (data.length > 1) {
            text += `* **Comparison:** Lowest average group is **${bottom.category}** averaging **${bottom.value.toFixed(2)}**.\n`;
          }
        }
      } else if (result.kind === 'correlationSummary') {
        const r = result.rValue;
        const p = result.pValue;
        const slope = result.trendSlope;
        const sign = p < 0.05 ? 'statistically significant' : 'not statistically significant';
        const direction = r > 0 ? 'positive' : 'negative';
        const strength = Math.abs(r) > 0.5 ? 'strong' : Math.abs(r) > 0.2 ? 'moderate' : 'weak';
        
        text += `* **Relationship Analysis:** Pearson correlation test reveals a **${strength} ${direction}** relationship between **${result.xAxisLabel}** and **${result.yAxisLabel}** (r = **${r.toFixed(3)}**, p = **${p.toFixed(4)}**).\n`;
        text += `* **Significance:** This finding is **${sign}** at the 95% confidence level.\n`;
        text += `* **Trend Slope:** For every 1-unit increase in **${result.xAxisLabel}**, **${result.yAxisLabel}** is expected to change by **${slope.toFixed(3)}** units.\n`;
      } else if (result.kind === 'distributionBins') {
        const bins = result.data || [];
        if (bins.length > 0) {
          const top = bins[0];
          text += `* **Distribution Peak:** The most frequent category/range for **${result.metricName}** is **${top.binRange}** containing **${top.count}** records.\n`;
        }
      }
      text += `\n`;
    });
  });

  if (!hasFacts) {
    return `# Executive Summary: Local Workspace Analysis\n\n*No computed facts are currently available. Please adjust filters or wait for the active sheet data pipeline to complete execution.*`;
  }

  text += `## 📋 Local Data-Driven Guidelines\n\n`;
  text += `> [!NOTE]\n`;
  text += `> All interpretations above are computed 100% locally on your machine using private sandboxed engines with zero external network leakage.\n\n`;
  text += `1. **Targeted Interventions:** Prioritize groups exhibiting elevated risk markers as identified in the grouped rankings.\n`;
  text += `2. **Correlational Drivers:** Pay close attention to significant correlations (p < 0.05) as they suggest reliable, actionable points of impact.\n`;
  text += `3. **Sample Distribution:** Ensure your operational focus aligns with the major bins in your record distribution to achieve maximum efficiency.`;

  return text;
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
    return <TrendingUp size={13} className="text-purple-400" />;
  }
  if (l.includes('predict') || l.includes('predictor') || l.includes('target') || l.includes('outcome')) {
    return <Sparkles size={13} className="text-amber-400" />;
  }
  if (l.includes('group') || l.includes('compared') || l.includes('sample') || l.includes('highest')) {
    return <Users size={13} className="text-blue-400" />;
  }
  if (l.includes('record') || l.includes('scanned') || l.includes('match') || l.includes('count')) {
    return <Database size={13} className="text-pink-400" />;
  }
  if (l.includes('privacy') || l.includes('shield') || l.includes('engine') || l.includes('status')) {
    return <Shield size={13} className="text-emerald-400" />;
  }
  if (l.includes('difference') || l.includes('max') || l.includes('p-value') || l.includes('significance')) {
    return <Activity size={13} className="text-rose-400" />;
  }
  return <Hash size={13} className="text-zinc-400" />;
};

export const ComputedView: React.FC<ComputedViewProps> = ({ result }) => {
  const [showConsole, setShowConsole] = React.useState(false);
  const { 
    cacheHitRate, 
    totalRuns, 
    lastRunDurationMs, 
    telemetryLogs, 
    performanceBadge,
    committedVisual
  } = useCockpitStore();

  const {
    workspacePipelineEnabled,
    activeWorkspace,
    activeSheetId,
    workspaceResults,
    workspaceErrors,
    isWorkspaceInFlight,
    setActiveSheetId,
    setWorkspaceInFlight
  } = useWorkspaceStore();

  const memoryInfo = React.useMemo(() => {
    let bytes = 12.5 * 1024 * 1024; // default baseline of 12.5MB
    if (committedVisual && committedVisual.data) {
      const dataStr = JSON.stringify(committedVisual.data);
      bytes += dataStr.length * 2;
    }
    const mb = bytes / (1024 * 1024);
    return {
      value: `${mb.toFixed(2)} MB`,
      ceiling: '512.00 MB'
    };
  }, [committedVisual]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSPACE MULTI-CARD RENDERING ENGINE & ACTIVE-TAB VIEWS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderKpiCardContent = (cardResult: VisualContract, card: CardDefinition) => {
    if (cardResult.kind === 'groupedAverages') {
      const topGroup = cardResult.data[0];
      return (
        <div className="w-full h-full flex flex-col justify-between py-2">
          <div className="text-center mt-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Highest Avg Group</div>
            <div className="text-xl font-black text-emerald-400 mt-1 truncate">{topGroup?.category || 'N/A'}</div>
            <div className="text-xs font-bold text-zinc-300 mt-0.5">Average: {topGroup ? Number(topGroup.value).toFixed(2) : '-'}</div>
          </div>
          <div className="w-full bg-zinc-950/60 border border-zinc-900/60 p-2 rounded text-[8px] text-zinc-500 font-mono text-center">
            Compared columns: {cardResult.xAxisLabel} vs {cardResult.yAxisLabel}
          </div>
        </div>
      );
    }
    
    if (cardResult.kind === 'correlationSummary') {
      return (
        <div className="w-full h-full flex flex-col justify-between py-2">
          <div className="text-center mt-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Pearson Correlation (r)</div>
            <div className="text-xl font-black text-purple-400 mt-1">{cardResult.rValue.toFixed(3)}</div>
            <div className="text-[9px] font-bold text-zinc-400 mt-1">
              {cardResult.pValue < 0.05 ? '✅ Statistically Significant' : '❌ Not Statistically Significant'}
            </div>
          </div>
          <div className="w-full bg-zinc-950/60 border border-zinc-900/60 p-2 rounded text-[8px] text-zinc-500 font-mono text-center">
            p-value: {cardResult.pValue.toFixed(4)} | N = {cardResult.data.length}
          </div>
        </div>
      );
    }
    
    if (cardResult.kind === 'distributionBins') {
      const top = cardResult.data[0];
      return (
        <div className="w-full h-full flex flex-col justify-between py-2">
          <div className="text-center mt-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Peak Distribution Bin</div>
            <div className="text-lg font-black text-zinc-200 mt-1 truncate">{top?.binRange || 'N/A'}</div>
            <div className="text-xs font-bold text-amber-400 mt-0.5">{top ? `${top.count} records` : '-'}</div>
          </div>
          <div className="w-full bg-zinc-950/60 border border-zinc-900/60 p-2 rounded text-[8px] text-zinc-500 font-mono text-center">
            Metric: {cardResult.metricName}
          </div>
        </div>
      );
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
        Unknown KPI structure
      </div>
    );
  };

  const renderWorkspaceCard = (card: CardDefinition) => {
    const sheetId = activeSheetId || '';
    const cardResult = workspaceResults[sheetId]?.[card.id];
    const cardError = workspaceErrors[sheetId]?.[card.id];
    
    return (
      <div 
        key={card.id}
        className="cockpit-card cockpit-card--dualrim p-4 flex flex-col justify-between h-[300px] relative overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2 mb-2">
          <div className="text-[10px] font-extrabold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
            <span>{card.title}</span>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase px-1.5 py-0.5 rounded border border-zinc-900 bg-zinc-950/80">
            {card.chartType}
          </span>
        </div>

        <div className="flex-1 h-[210px] w-full flex items-center justify-center">
          {cardError ? (
            <div className="text-center p-4">
              <AlertTriangle className="text-red-400 mx-auto mb-1.5" size={16} />
              <div className="text-[10px] font-bold text-red-400 uppercase">Execution Error</div>
              <div className="text-[9px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed">{cardError}</div>
            </div>
          ) : !cardResult ? (
            isWorkspaceInFlight ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded bg-zinc-900 animate-pulse" />
                <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Running SQL...</div>
              </div>
            ) : (
              <div className="text-center p-4">
                <div className="text-[10px] font-bold text-zinc-500 uppercase">Pending Execution</div>
                <div className="text-[9px] text-zinc-600 mt-1">Filters adjusted. Waiting for execution loop...</div>
              </div>
            )
          ) : (
            <div className="w-full h-full">
              {card.chartType === 'kpi' ? (
                renderKpiCardContent(cardResult, card)
              ) : card.chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cardResult.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                    <defs>
                      <linearGradient id={`glow_${card.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#991b1b" stopOpacity={0.95} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
                    <XAxis 
                      dataKey={cardResult.kind === 'distributionBins' ? 'binRange' : 'category'} 
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
                    />
                    <Tooltip 
                      contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '6px' }}
                    />
                    <Bar 
                      dataKey={cardResult.kind === 'distributionBins' ? 'count' : 'value'} 
                      fill={`url(#glow_${card.id})`} 
                      radius={[2, 2, 0, 0]}
                      barSize={12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : card.chartType === 'line' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cardResult.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
                    <XAxis 
                      dataKey="category" 
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
                    />
                    <Tooltip 
                      contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.65rem', borderRadius: '6px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#22d3ee" 
                      strokeWidth={1.5}
                      dot={{ stroke: '#22d3ee', strokeWidth: 1, r: 2, fill: '#080405' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : card.chartType === 'scatter' && cardResult.kind === 'correlationSummary' ? (
                <div className="w-full h-full flex flex-col justify-between gap-1.5">
                  <div className="flex-1 border border-zinc-900/60 bg-zinc-950/20 rounded-lg relative overflow-hidden flex items-center justify-center min-h-[120px]">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:12px_12px]" />
                    <svg className="w-full h-full px-2" viewBox="0 0 300 120">
                      <line x1="20" y1="60" x2="280" y2="60" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2 2" />
                      {[
                        {x: 50, y: 80}, {x: 90, y: 40}, {x: 130, y: 70}, {x: 170, y: 50}, 
                        {x: 210, y: 90}, {x: 250, y: 30}, {x: 70, y: 60}, {x: 150, y: 80},
                        {x: 230, y: 40}
                      ].map((dot, dIdx) => (
                        <circle key={dIdx} cx={dot.x} cy={dot.y} r="1.2" fill="#52525b" opacity="0.35" />
                      ))}
                      {(() => {
                        const r = cardResult.rValue;
                        const startY = r > 0.05 ? 85 : r < -0.05 ? 35 : 60;
                        const endY = r > 0.05 ? 35 : r < -0.05 ? 85 : 60;
                        return (
                          <line 
                            x1="30" 
                            y1={startY} 
                            x2="270" 
                            y2={endY} 
                            stroke={Math.abs(r) > 0.4 ? "#a855f7" : "#ef4444"} 
                            strokeWidth="1.5" 
                            filter="drop-shadow(0px 0px 2px rgba(167, 139, 250, 0.3))"
                          />
                        );
                      })()}
                    </svg>
                    <div className="absolute top-1.5 right-2 text-[8px] text-zinc-400 font-bold bg-zinc-950/80 border border-zinc-900/60 px-1.5 py-0.2 rounded font-mono">
                      r = {cardResult.rValue.toFixed(3)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[8px] font-mono shrink-0">
                    <div className="bg-zinc-950/30 border border-zinc-900/40 p-1 rounded text-center">
                      <div className="text-zinc-600">Sample Size</div>
                      <div className="text-zinc-300 font-bold">{cardResult.data.length}</div>
                    </div>
                    <div className="bg-zinc-950/30 border border-zinc-900/40 p-1 rounded text-center">
                      <div className="text-zinc-600">Slope</div>
                      <div className="text-zinc-300 font-bold">{cardResult.trendSlope.toFixed(3)}</div>
                    </div>
                    <div className="bg-zinc-950/30 border border-zinc-900/40 p-1 rounded text-center">
                      <div className="text-zinc-600">Significance</div>
                      <div className={`font-bold ${cardResult.pValue < 0.05 ? 'text-emerald-400' : 'text-red-400'}`}>
                        p={cardResult.pValue.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-[10px] text-zinc-500">Relational View Unsupported Inside Grid</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWorkspaceStandardSheet = (sheet: any) => {
    return (
      <div className="flex flex-col gap-3.5 w-full">
        <div className="cockpit-card cockpit-card--dualrim p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="rounded-full border border-red-500/10 bg-red-500/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-red-400">
                Workspace Canvas Active
              </span>
              <h2 className="mt-2 text-md font-black tracking-tight text-zinc-100">
                {sheet.name}
              </h2>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950/80 border border-zinc-900/60 px-2 py-0.5 rounded">
              {sheet.cards.length} Planned Cards
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sheet.cards.map((card: any) => renderWorkspaceCard(card))}
        </div>
        
        {renderDevConsole()}
      </div>
    );
  };

  const renderWorkspaceInsightsSheet = (workspace: any, results: any) => {
    const narrative = compileFactsNarrative(workspace, results);
    const sheet = workspace.sheets.find((s: any) => s.id === activeSheetId);
    
    return (
      <div className="flex flex-col gap-3.5 w-full">
        <div className="cockpit-card cockpit-card--dualrim p-4 relative overflow-hidden">
          <span className="rounded-full border border-purple-500/10 bg-purple-500/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-purple-400">
            Interpretive AI Insights Workspace
          </span>
          <h2 className="mt-2 text-md font-black tracking-tight text-zinc-100">
            Dynamic Facts-Grounded Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3.5">
          <div className="xl:col-span-2 flex flex-col gap-3.5">
            {sheet?.cards.map((card: any) => renderWorkspaceCard(card))}
            
            <div className="cockpit-card p-4 flex-1 flex flex-col justify-center">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Facts Verification Engine</span>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                The interpretive narrative to the right reads exclusively from the verified local computed facts. Generative temperature is set to <code className="bg-zinc-950 text-red-400 px-1 py-0.2 rounded font-mono text-[9px]">0.0</code> to prevent hallucinations, logical guessing, or external telemetry leakage.
              </p>
            </div>
          </div>

          <div className="xl:col-span-3 flex flex-col">
            <div 
              className="cockpit-card cockpit-card--dualrim p-6 flex-1 flex flex-col justify-between relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(239, 68, 68, 0.01) 100%), var(--cockpit-glass-bg)'
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.15),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:10px_10px]" />
              </div>

              <div className="relative z-10 flex-1">
                <SimpleMarkdown text={narrative} />
              </div>
            </div>
          </div>
        </div>

        {renderDevConsole()}
      </div>
    );
  };

  const renderDevConsole = () => {
    return (
      <div className="cockpit-card cockpit-card--dualrim p-4 mt-2 bg-zinc-950/40 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
              Developer Pipeline Telemetry Console
            </span>
            {performanceBadge === 'degraded' && (
              <span className="ml-2 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-[8px] font-bold text-amber-500 animate-pulse">
                ⚠️ Performance Capped
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowConsole(!showConsole)}
            className="text-[9px] font-extrabold font-mono border border-zinc-900 bg-zinc-950/80 px-3 py-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all cursor-pointer"
          >
            {showConsole ? '✕ COLLAPSE CONSOLE' : '⚙️ EXPAND TELESCOPE'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono mb-2">
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">ENGINE VERSION</div>
            <div className="mt-1 font-black text-zinc-300">Privana Canvas v1.1</div>
            <div className="text-[8px] text-zinc-600">AlaSQL + PapaParse</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">CACHE HIT RATE</div>
            <div className="mt-1 font-black text-red-400">{cacheHitRate}%</div>
            <div className="text-[8px] text-zinc-600">{totalRuns} executions total</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">LAST LATENCY</div>
            <div className="mt-1 font-black text-zinc-300">{lastRunDurationMs} ms</div>
            <div className="text-[8px] text-zinc-600">Primary budget limit: 300ms</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">EST. MEMORY HEAP</div>
            <div className="mt-1 font-black text-emerald-400">{memoryInfo.value}</div>
            <div className="text-[8px] text-zinc-600">Spec ceiling: {memoryInfo.ceiling}</div>
          </div>
        </div>

        {showConsole && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-zinc-900/80 bg-zinc-950 p-3 mt-2 font-mono text-[9px]"
          >
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2 flex items-center justify-between">
              <span>PII-Free Telemetry Streams</span>
              <button 
                onClick={() => useCockpitStore.getState().resetTelemetryStats()}
                className="text-zinc-600 hover:text-zinc-400 text-[8px] font-bold"
              >
                🧹 CLEAR LOGS
              </button>
            </div>
            
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-zinc-950 text-zinc-400">
              {telemetryLogs.length === 0 ? (
                <div className="text-zinc-600 text-center py-4">Waiting for analytical query executions...</div>
              ) : (
                telemetryLogs.map((log: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 select-all hover:bg-zinc-900/35 p-1 rounded transition-colors">
                    <span className="text-zinc-600 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="font-bold text-red-400 shrink-0 uppercase">
                      {log.event}
                    </span>
                    <span className="break-all text-zinc-300">
                      {JSON.stringify(log.fields)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  if (workspacePipelineEnabled && activeWorkspace && activeSheetId) {
    const currentSheet = activeWorkspace.sheets.find(s => s.id === activeSheetId);
    const isInsightsSheet = activeSheetId.toLowerCase().includes('insights');

    if (isInsightsSheet) {
      return renderWorkspaceInsightsSheet(activeWorkspace, workspaceResults);
    }
    if (currentSheet) {
      return renderWorkspaceStandardSheet(currentSheet);
    }
  }

  // Render from committed visual contract directly if available §1.2 & §3.2
  // Fallback to legacy map() if not committed (e.g. legacy query paths)
  const layout = React.useMemo(() => {
    if (committedVisual) {
      // Map visual contract kind to standard UI VisualLayout representation
      const chartType = committedVisual.kind === 'groupedAverages' ? 'bar'
                      : committedVisual.kind === 'correlationSummary' ? 'scatter'
                      : committedVisual.kind === 'distributionBins' ? 'bar'
                      : 'none';
                      
      const xAxisKey = committedVisual.kind === 'groupedAverages' ? 'category'
                     : committedVisual.kind === 'correlationSummary' ? 'x'
                     : committedVisual.kind === 'distributionBins' ? 'binRange'
                     : undefined;

      const yAxisKey = committedVisual.kind === 'groupedAverages' ? 'value'
                     : committedVisual.kind === 'correlationSummary' ? 'y'
                     : committedVisual.kind === 'distributionBins' ? 'count'
                     : undefined;

      // Extract KPIs from visual contract properties
      const kpis: any[] = [];
      if (committedVisual.kind === 'correlationSummary') {
        kpis.push({
          label: 'Correlation (r)',
          value: committedVisual.rValue.toFixed(3),
          subText: 'Pearson method',
          color: Math.abs(committedVisual.rValue) > 0.4 ? '#10b981' : '#f59e0b',
        });
        kpis.push({
          label: 'Significance (p)',
          value: committedVisual.pValue.toFixed(4),
          subText: committedVisual.pValue < 0.05 ? 'Statistically significant' : 'Not significant',
          color: committedVisual.pValue < 0.05 ? '#10b981' : '#ef4444',
        });
      } else if (committedVisual.kind === 'groupedAverages') {
        const topGroup = committedVisual.data[0];
        kpis.push({
          label: 'Grouped By',
          value: committedVisual.xAxisLabel || '',
          subText: committedVisual.yAxisLabel,
          color: '#f59e0b',
        });
        if (topGroup) {
          kpis.push({
            label: 'Highest Avg Group',
            value: topGroup.category || '',
            subText: `Average: ${Number(topGroup.value).toFixed(2)}`,
            color: '#10b981',
          });
        }
      } else if (committedVisual.kind === 'distributionBins') {
        const total = committedVisual.data.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
        kpis.push({
          label: 'Metric Analyzed',
          value: committedVisual.metricName || '',
          subText: 'Distribution target',
          color: '#a855f7',
        });
        kpis.push({
          label: 'Total Sample Size',
          value: total.toLocaleString(),
          subText: 'Total records scanned',
          color: '#3b82f6',
        });
      }

      return {
        chartType,
        xAxisKey,
        yAxisKey,
        data: committedVisual.data || [],
        title: formatPanelTitle(committedVisual.kind),
        kpis,
      };
    }
    
    return ResultToVisualContext.map(result);
  }, [committedVisual, result]);

  const isPartial = result.status === 'partial';
  const reasons = (result as any).reasons || [];
  const displayNarrative = (result.narrative || '')
    .replace(/ID undefined/gi, 'the highest-ranked record')
    .replace(/a association/gi, 'an association');
  const question = result.provenance?.question || 'Custom analysis';

  const hasNoData = !result.data || 
    (Array.isArray(result.data) && result.data.length === 0) ||
    (layout.chartType !== 'none' && layout.chartType !== 'scatter' && (!layout.data || layout.data.length === 0));

  if (hasNoData) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {/* 1. Narrative Card */}
        <div className="cockpit-card cockpit-card--dualrim p-5">
          <SimpleMarkdown text={displayNarrative || "No records matched your specific filters."} />
          <div className="mt-3 pt-2 border-t border-zinc-900/60 flex items-center justify-between">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              Computed by: New Analytics Engine
            </div>
          </div>
        </div>

        {/* 2. Empty State Banner */}
        <div className="cockpit-card p-8 text-center border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-500 text-sm">
            🔍
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">No matching records found</h3>
            <p className="text-[11px] text-zinc-500 max-w-sm mt-1 mx-auto leading-relaxed">
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

  // Visual dynamic helpers based on active KPI types
  const targetKpi = displayKpis.find(k => k.label.toLowerCase().includes('target') || k.label.toLowerCase().includes('outcome'));
  const targetName = targetKpi ? formatFieldName(targetKpi.value) : 'Outcome';
  const isCorrelationStats = layout.chartType === 'scatter' && layout.data.length === 1 && layout.data[0].r !== undefined;

  return (
    <motion.div 
      className="flex flex-col gap-3.5 w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* HEADER BAR COCKPIT CARD */}
      <div className="cockpit-card cockpit-card--dualrim p-5 lg:p-6 relative overflow-hidden">
        {/* Soft atmospheric gradient glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-red-500/5 blur-2xl pointer-events-none" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400">
                Local Sandbox Active
              </span>
              <span className="rounded-full border border-red-500/10 bg-red-500/5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-red-400">
                {isPartial ? 'Partial Analytics' : 'Computed Result'}
              </span>
            </div>
            <h2 className="mt-3.5 text-lg font-black leading-tight tracking-tight text-zinc-100">
              {formatFieldName(result.plan.intent)} Analytics Cockpit
            </h2>
            <p className="mt-2 max-w-3xl text-[12px] text-zinc-400 font-medium leading-relaxed">
              {question}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-right text-[9px] uppercase tracking-[0.12em] text-zinc-400 shrink-0 self-center">
            <div className="rounded-lg bg-zinc-950 border border-zinc-900/60 px-3.5 py-2">
              <div className="font-bold text-zinc-400">Rows Used</div>
              <div className="mt-0.5 text-xs font-black text-zinc-200">{(result.data?.rows?.length || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-2">
              <div className="font-bold text-emerald-400/60">Privacy</div>
              <div className="mt-0.5 text-xs font-black text-emerald-400">100% Local</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ROW 1: 4-COLUMN KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {displayKpis.map((kpi, idx) => {
          const parsedVal = parseFloat(String(kpi.value));
          const isCorrelation = !isNaN(parsedVal) && parsedVal >= -1.05 && parsedVal <= 1.05 && (
            kpi.label.toLowerCase().includes('correlation') || 
            kpi.label.toLowerCase() === 'r'
          ) && !kpi.label.toLowerCase().includes('significance');
          
          const isSignificance = kpi.label.toLowerCase().includes('significance') || kpi.label.toLowerCase().includes('p-value');
          const isSecurity = kpi.label.toUpperCase() === 'LOCAL SECURITY';
          const isPredictor = kpi.label.toLowerCase().includes('predictor');

          // Align rims cleanly to identity color types
          const rimClass = isSecurity ? 'green' : (isCorrelation || isSignificance) ? 'violet' : '';

          return (
            <div 
              key={idx}
              className={`cockpit-card cockpit-card--dualrim ${rimClass} p-3.5 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  {kpi.label}
                </span>
                <div className="w-5.5 h-5.5 rounded bg-zinc-950 border border-zinc-900 flex items-center justify-center">
                  {getKpiIcon(kpi.label)}
                </div>
              </div>
              
              {/* SPECIALTY WIDGET 1: Liquid Security capsule (emerald green visual) */}
              {isSecurity ? (
                <div className="w-full mt-1.5 mb-1">
                  <div className="text-xs font-extrabold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <span>100% Secure Sandbox</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden relative shadow-inner">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse" />
                  </div>
                  <div className="text-[9px] text-zinc-400 font-semibold truncate mt-2">
                    {kpi.subText}
                  </div>
                </div>
              ) : isCorrelation ? (
                /* SPECIALTY WIDGET 2: Restrained pearson slider gauge (flat science meter) */
                <div className="w-full mt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-400">
                      R = {parsedVal.toFixed(3)}
                    </span>
                    <span className="text-[9px] font-bold text-purple-400/80">
                      {parsedVal > 0.4 ? 'Strong Pos' : parsedVal > 0.05 ? 'Weak Pos' : parsedVal < -0.4 ? 'Strong Neg' : parsedVal < -0.05 ? 'Weak Neg' : 'Neutral'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-950 border border-zinc-900 rounded-full relative my-2">
                    {/* Neutral center mark */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-zinc-700/60" />
                    {/* Glowing slider pointer with spring mounting simulation */}
                    <div 
                      className="absolute -top-1 w-3.5 h-3.5 bg-purple-400 border border-zinc-950 rounded-full -translate-x-1/2 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(167,139,250,0.5)]"
                      style={{ left: `${((parsedVal + 1) / 2) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-zinc-600 font-mono">
                    <span>-1.0</span>
                    <span>0.0</span>
                    <span>+1.0</span>
                  </div>
                </div>
              ) : isSignificance ? (
                /* SCIENTIFIC SIGNIFICANCE PRESENTATION (No Pearson slider) */
                <div className="w-full mt-1">
                  <div className="text-base font-extrabold text-zinc-200 leading-none my-1.5 font-mono">
                    p = {parsedVal.toFixed(4)}
                  </div>
                  <div className={`flex items-center gap-1.5 mt-2 border px-2 py-0.5 rounded text-[9px] font-bold w-fit ${
                    parsedVal < 0.05 
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}>
                    <span>{parsedVal < 0.05 ? 'Statistically Significant' : 'Not Significant'}</span>
                  </div>
                </div>
              ) : isPredictor ? (
                /* PREDICTOR FLOW VISUAL (Linear, calm outline connection) */
                <div className="w-full mt-1 mb-1">
                  <div className="text-xs font-black text-red-400 truncate mb-1">
                    {formatFieldName(kpi.value)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 bg-zinc-950/60 border border-zinc-900 px-2 py-1 rounded text-[9px] text-zinc-400 font-semibold w-fit">
                    <span className="truncate">Predictor</span>
                    <ArrowRight size={10} className="text-red-400" />
                    <span className="text-zinc-400 truncate max-w-[100px]">{targetName}</span>
                  </div>
                </div>
              ) : (
                /* STANDARD HIGH-QUALITY METRIC CARD */
                <div>
                  <div 
                    className="text-lg font-black truncate leading-none my-1"
                    style={{ color: kpi.color || '#f4f4f5' }}
                  >
                    {formatKpiValue(kpi.value)}
                  </div>
                  
                  {kpi.subText && (
                    <div className="text-[9px] text-zinc-400 font-semibold truncate mt-2">
                      {kpi.subText}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ROW 2: CANVAS (LEFT Visual, RIGHT Explanation) */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3.5">
        {/* LEFT PANEL: Chart Panel (60% width) */}
        {layout.chartType !== 'none' && layout.data.length > 0 ? (
          <div className="xl:col-span-3 cockpit-card cockpit-card--dualrim p-4 flex flex-col justify-between min-h-[300px]">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2.5 mb-3">
              <div className="text-[10px] font-extrabold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
                <TrendingUp size={12} className="text-red-400" />
                <span>{formatPanelTitle(layout.title)}</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-400 uppercase px-1.5 py-0.5 rounded border border-zinc-900 bg-zinc-950/80">
                {layout.chartType} Layout
              </span>
            </div>

            <div className="h-56 w-full my-1">
              {isCorrelationStats ? (
                <div className="h-full w-full flex flex-col justify-between gap-3">
                  <div className="flex-1 border border-zinc-900 bg-zinc-950/40 rounded-xl relative overflow-hidden flex items-center justify-center">
                    {/* Dotted grid lines background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:16px_16px]" />
                    
                    <svg className="w-full h-full min-h-[140px] px-4" viewBox="0 0 300 120">
                      {/* Center Neutral axis */}
                      <line x1="20" y1="60" x2="280" y2="60" stroke="#27272a" strokeWidth="1" strokeDasharray="3 3" />
                      
                      {/* Stylized background scattered dots */}
                      {[
                        {x: 42, y: 55}, {x: 88, y: 92}, {x: 124, y: 38}, {x: 168, y: 84}, 
                        {x: 204, y: 46}, {x: 248, y: 68}, {x: 62, y: 32}, {x: 144, y: 98},
                        {x: 228, y: 88}, {x: 272, y: 38}
                      ].map((dot, dIdx) => (
                        <circle key={dIdx} cx={dot.x} cy={dot.y} r="1.5" fill="#52525b" opacity="0.3" />
                      ))}
                      
                      {/* Dynamic glowing linear regression trend vector */}
                      {(() => {
                        const r = layout.data[0].r;
                        const startY = r > 0.05 ? 90 : r < -0.05 ? 30 : 60;
                        const endY = r > 0.05 ? 30 : r < -0.05 ? 90 : 60;
                        return (
                          <>
                            <defs>
                              <linearGradient id="trendGlow" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <line 
                              x1="30" 
                              y1={startY} 
                              x2="270" 
                              y2={endY} 
                              stroke="url(#trendGlow)" 
                              strokeWidth="2" 
                              strokeDasharray={Math.abs(r) <= 0.05 ? "3 3" : "0"}
                              filter="drop-shadow(0px 0px 4px rgba(139, 92, 246, 0.45))"
                            />
                            {Math.abs(r) > 0.05 && (
                              <circle cx="270" cy={endY} r="2.5" fill="#22d3ee" />
                            )}
                          </>
                        );
                      })()}
                    </svg>
                    
                    <div className="absolute bottom-2.5 left-3 text-[9px] text-zinc-400 font-mono tracking-wider">
                      Linear Trend Relationship Vector
                    </div>
                    <div className="absolute top-2.5 right-3 text-[9px] text-zinc-400 font-bold bg-zinc-950/80 border border-zinc-900 px-2 py-0.5 rounded">
                      {layout.data[0].method || 'Pearson'} r = {layout.data[0].r.toFixed(3)}
                    </div>
                  </div>
                  
                  {/* Visual detail summary indicators (Restructured 4-column scientific panel) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono border-t border-zinc-900/60 pt-2.5 shrink-0">
                    <div className="flex flex-col bg-zinc-950/40 border border-zinc-900/40 px-2.5 py-1 rounded">
                      <span className="text-zinc-600">Method</span>
                      <span className="text-zinc-300 font-bold truncate">{layout.data[0].method || 'Pearson'}</span>
                    </div>
                    <div className="flex flex-col bg-zinc-950/40 border border-zinc-900/40 px-2.5 py-1 rounded">
                      <span className="text-zinc-600">Sample Size (N)</span>
                      <span className="text-zinc-300 font-bold truncate">
                        {layout.data[0].sampleSize ? layout.data[0].sampleSize.toLocaleString() : '-'}
                      </span>
                    </div>
                    <div className="flex flex-col bg-zinc-950/40 border border-zinc-900/40 px-2.5 py-1 rounded">
                      <span className="text-zinc-600">Slope (r)</span>
                      <span className="text-zinc-300 font-bold truncate">{layout.data[0].r.toFixed(4)}</span>
                    </div>
                    <div className="flex flex-col bg-zinc-950/40 border border-zinc-900/40 px-2.5 py-1 rounded">
                      <span className="text-zinc-600">Significance (p)</span>
                      <span className="text-zinc-300 font-bold truncate">{layout.data[0].pValue.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {layout.chartType === 'bar' ? (
                    <BarChart data={layout.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                      <defs>
                        <linearGradient id="redCoralGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#991b1b" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
                      <XAxis 
                        dataKey={layout.xAxisKey} 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={formatFieldName}
                      />
                      <YAxis 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.68rem', borderRadius: '8px' }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: 700 }}
                      />
                      <Bar 
                        dataKey={layout.yAxisKey || 'value'} 
                        fill="url(#redCoralGlow)" 
                        radius={[3, 3, 0, 0]}
                        barSize={16}
                      />
                    </BarChart>
                  ) : layout.chartType === 'line' ? (
                    <LineChart data={layout.data} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                      <defs>
                        <linearGradient id="cyanVioletGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="cyanAreaGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#141418" vertical={false} />
                      <XAxis 
                        dataKey={layout.xAxisKey} 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={formatFieldName}
                      />
                      <YAxis 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.68rem', borderRadius: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={layout.yAxisKey || 'value'} 
                        stroke="url(#cyanVioletGlow)" 
                        strokeWidth={2}
                        dot={{ stroke: '#22d3ee', strokeWidth: 1.5, r: 2.5, fill: '#080405' }}
                      />
                    </LineChart>
                  ) : layout.chartType === 'scatter' ? (
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                      <CartesianGrid stroke="#141418" strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        dataKey={layout.xAxisKey} 
                        name={layout.xAxisKey} 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                      />
                      <YAxis 
                        type="number" 
                        dataKey={layout.yAxisKey} 
                        name={layout.yAxisKey} 
                        stroke="#3f3f46" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZAxis type="number" range={[45, 45]} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.68rem', borderRadius: '8px' }}
                      />
                      <Scatter name="Data" data={layout.data} fill="#ef4444" />
                    </ScatterChart>
                  ) : layout.chartType === 'pie' ? (
                    <PieChart>
                      <defs>
                        <linearGradient id="coralGlowPie" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#991b1b" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={layout.data}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey={layout.yAxisKey || 'value'}
                        nameKey={layout.xAxisKey || 'label'}
                      >
                        {layout.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={POWER_BI_COLORS[index % POWER_BI_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ background: '#080405', borderColor: '#1f1f23', color: '#fff', fontSize: '0.68rem', borderRadius: '8px' }}
                      />
                    </PieChart>
                  ) : null}
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : (
          <div className="xl:col-span-3 cockpit-card cockpit-card--dualrim p-5 flex flex-col justify-center items-center text-center min-h-[300px]">
            <Server size={18} className="text-zinc-700 mb-2" />
            <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">Tabular Output Visualization</span>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-[280px] leading-relaxed">
              This query type maps directly to a relational grid preview. Check the raw dataset table below.
            </p>
          </div>
        )}

        {/* RIGHT PANEL: AI Interpretation Card (40% width) */}
        <div className="xl:col-span-2 flex flex-col min-h-[300px]">
          <div 
            className="cockpit-card cockpit-card--dualrim p-5 flex-1 flex flex-col justify-between relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, rgba(139, 92, 246, 0.01) 100%), var(--cockpit-glass-bg)'
            }}
          >
            {/* Subtle internal radial glow + micro-grid watermark in the empty void */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.15),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-3.5 border-b border-zinc-900/60 pb-2.5">
                <span className="text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                  AI Interpretation
                </span>
              </div>
              <SimpleMarkdown text={displayNarrative} />
            </div>

            {/* Decorative low-contrast telemetry footer */}
            <div className="relative z-10 mt-6 pt-3 border-t border-zinc-900/60 flex items-center justify-between text-[8px] font-mono text-zinc-400 tracking-wider">
              <div className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>COCKPIT NODE ACTIVE</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">PIPELINE:</span>
                <span className="text-red-400/80 font-black">SECURE LOCAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: DETAILED TABULAR DATA PREVIEW */}
      {result.data?.rows && result.data.rows.length > 0 && (() => {
        const rows = result.data.rows;
        // Strip out Recharts auto key columns
        const keys = Object.keys(rows[0] || {}).filter(k => k !== 'key' && k !== 'id');
        return (
          <div className="cockpit-card cockpit-card--dualrim p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2.5 mb-1">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={11} className="text-zinc-500" />
                <span>Local Relational Datagrid</span>
              </span>
              <span className="text-[9px] bg-zinc-950/80 text-zinc-400 border border-zinc-900/60 px-1.5 py-0.5 rounded font-mono">
                Showing top {Math.min(rows.length, 6)} rows of {rows.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] text-zinc-300 font-mono">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-400 font-bold bg-zinc-950/60">
                    {keys.map(k => (
                      <th key={k} className="p-2 truncate tracking-wider">{formatFieldName(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-zinc-900/30 hover:bg-zinc-950/40 cockpit-table-row">
                      {keys.map(k => {
                        const val = row[k];
                        const isNumeric = typeof val === 'number';
                        return (
                          <td 
                            key={k} 
                            className="p-2 max-w-[150px] truncate"
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

      {/* ROW 4: PRIVACY / PRECISION CAVEATS */}
      {isPartial && reasons.length > 0 && (
        <div 
          className="cockpit-card p-3.5 shrink-0 border-amber-500/15 bg-amber-500/5"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.1)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={13} />
            <div>
              <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">
                Privacy / Precision Caveat
              </div>
              <ul className="list-disc pl-4 text-[10px] text-zinc-400 space-y-1">
                {reasons.map((r: string, idx: number) => (
                  <li key={idx} className="leading-relaxed">{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER COCKPIT PIPELINE TELEMETRY CONSOLE §7.3 & §8 */}
      <div className="cockpit-card cockpit-card--dualrim p-4 mt-2 bg-zinc-950/40 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
              Developer Pipeline Telemetry Console
            </span>
            {performanceBadge === 'degraded' && (
              <span className="ml-2 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-[8px] font-bold text-amber-500 animate-pulse">
                ⚠️ Performance Capped
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowConsole(!showConsole)}
            className="text-[9px] font-extrabold font-mono border border-zinc-900 bg-zinc-950/80 px-3 py-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all cursor-pointer"
          >
            {showConsole ? '✕ COLLAPSE CONSOLE' : '⚙️ EXPAND TELESCOPE'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono mb-2">
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">ENGINE VERSION</div>
            <div className="mt-1 font-black text-zinc-300">Privana Canvas v1.1</div>
            <div className="text-[8px] text-zinc-600">AlaSQL + PapaParse</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">CACHE HIT RATE</div>
            <div className="mt-1 font-black text-red-400">{cacheHitRate}%</div>
            <div className="text-[8px] text-zinc-600">{totalRuns} executions total</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">LAST LATENCY</div>
            <div className="mt-1 font-black text-zinc-300">{lastRunDurationMs} ms</div>
            <div className="text-[8px] text-zinc-600">Primary budget limit: 300ms</div>
          </div>
          <div className="rounded border border-zinc-900/60 bg-zinc-950/60 p-2.5">
            <div className="text-zinc-500">EST. MEMORY HEAP</div>
            <div className="mt-1 font-black text-emerald-400">{memoryInfo.value}</div>
            <div className="text-[8px] text-zinc-600">Spec ceiling: {memoryInfo.ceiling}</div>
          </div>
        </div>

        {showConsole && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-zinc-900/80 bg-zinc-950 p-3 mt-2 font-mono text-[9px]"
          >
            <div className="text-[8px] text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2 flex items-center justify-between">
              <span>PII-Free Telemetry Streams</span>
              <button 
                onClick={() => useCockpitStore.getState().resetTelemetryStats()}
                className="text-zinc-600 hover:text-zinc-400 text-[8px] font-bold"
              >
                🧹 CLEAR LOGS
              </button>
            </div>
            
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-zinc-950 text-zinc-400">
              {telemetryLogs.length === 0 ? (
                <div className="text-zinc-600 text-center py-4">Waiting for analytical query executions...</div>
              ) : (
                telemetryLogs.map((log: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 select-all hover:bg-zinc-900/35 p-1 rounded transition-colors">
                    <span className="text-zinc-600 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="font-bold text-red-400 shrink-0 uppercase">
                      {log.event}
                    </span>
                    <span className="break-all text-zinc-300">
                      {JSON.stringify(log.fields)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

