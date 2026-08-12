// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/answer-workspace/AnswerWorkspaceView.tsx
// Renders one question's Answer Workspace: every chart shown here belongs to
// exactly this questionId, each tagged with its own planId. Reuses the
// existing mapToVisualContract + UnifiedChart renderer for every chart kind —
// no new visualization engine.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { AnswerWorkspaceState } from '../../../../store/useAnswerWorkspaceStore';
import { mapToVisualContract } from '../../resultToVisualContext';
import UnifiedChart from '../../../../components/UnifiedChart';
import { AnalyticsTable } from '../../../../components/AnalyticsTable';

interface AnswerWorkspaceViewProps {
  workspace: AnswerWorkspaceState;
  isCreatingChart: boolean;
  onCreateChart: (subQuestion: string) => void;
  onClear: () => void;
}

const formatTitle = (planId: string, chartTitle?: string) => {
  if (chartTitle) return chartTitle;
  return planId.replace(/^plan_/, '').replace(/_\d+$/, '').replace(/_/g, ' ');
};

export const AnswerWorkspaceView: React.FC<AnswerWorkspaceViewProps> = ({
  workspace,
  isCreatingChart,
  onCreateChart,
  onClear,
}) => {
  const [newChartInput, setNewChartInput] = React.useState('');

  const submitNewChart = () => {
    const q = newChartInput.trim();
    if (!q) return;
    onCreateChart(q);
    setNewChartInput('');
  };

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Question header */}
      <div
        className="cockpit-card cockpit-card--dualrim p-4 relative overflow-hidden"
        style={{
          border: '1px solid rgba(245,158,11,0.35)',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(120,53,15,0.04) 100%), var(--cockpit-glass-bg)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-400">
                💡 Answer Workspace
              </span>
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
                {workspace.entries.length} {workspace.entries.length === 1 ? 'chart' : 'charts'}
                {workspace.matchedPattern ? ` · ${workspace.matchedPattern.replace(/_/g, ' ')}` : ''}
              </span>
            </div>
            <p className="text-[11px] font-medium text-zinc-300 mt-0.5 truncate" title={workspace.question}>
              "{workspace.question}"
            </p>
          </div>
          <button
            onClick={onClear}
            className="text-[9px] font-extrabold font-mono border border-zinc-900 bg-zinc-950/80 px-2.5 py-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all cursor-pointer shrink-0"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      {/* Chart entries */}
      {workspace.entries.length === 0 ? (
        <div className="cockpit-card p-6 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
          Computing answer...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {workspace.entries.map((entry) => {
            const vc = mapToVisualContract(entry.result);
            const chartTitle = formatTitle(entry.planId, (entry.result as any).chart?.title);
            const isFullWidth = vc.kind === 'tableRows' || vc.kind === 'correlationSummary';

            return (
              <div
                key={entry.planId}
                className={`cockpit-card cockpit-card--dualrim p-4 flex flex-col relative overflow-hidden ${isFullWidth ? 'md:col-span-2' : ''}`}
                style={{ minHeight: 260 }}
              >
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2 mb-2">
                  <span className="text-[10px] font-extrabold text-zinc-300 uppercase tracking-wider truncate" title={chartTitle}>
                    {chartTitle}
                  </span>
                  <span className="text-[8px] font-mono text-zinc-600 shrink-0 ml-2" title={entry.planId}>
                    {entry.planId.split('_').slice(-1)[0]}
                  </span>
                </div>

                <div className="flex-1 min-h-[180px] flex flex-col">
                  {vc.kind === 'tableRows' ? (
                    <div className="w-full flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-900/60 rounded-lg p-3">
                        <span className="text-2xl font-black text-zinc-100 tabular-nums">
                          {(vc.rowCount ?? vc.data.length).toLocaleString()}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Total Records</span>
                      </div>
                      {vc.data.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border border-zinc-900/60 rounded-lg bg-zinc-950/40 p-1.5">
                          <AnalyticsTable rows={vc.data.slice(0, 10)} />
                        </div>
                      )}
                    </div>
                  ) : vc.kind === 'correlationSummary' ? (
                    <div className="grid grid-cols-3 gap-2 py-2">
                      <div className="flex flex-col items-center bg-zinc-950/60 border border-zinc-900/40 rounded-lg py-3 gap-1">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase">r</span>
                        <span className="text-lg font-black text-zinc-200 tabular-nums">{vc.rValue.toFixed(3)}</span>
                      </div>
                      <div className="flex flex-col items-center bg-zinc-950/60 border border-zinc-900/40 rounded-lg py-3 gap-1">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase">p</span>
                        <span className={`text-lg font-black tabular-nums ${vc.pValue < 0.05 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {vc.pValue < 0.001 ? '<0.001' : vc.pValue.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center bg-zinc-950/60 border border-zinc-900/40 rounded-lg py-3 gap-1">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase">n</span>
                        <span className="text-lg font-black text-zinc-200 tabular-nums">{(vc.sampleSize ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <UnifiedChart contract={vc} height={200} />
                  )}
                </div>

                {(entry.result as any).narrative && (
                  <p className="text-[9px] text-zinc-500 mt-2 pt-2 border-t border-zinc-900/50 leading-relaxed line-clamp-3">
                    {(entry.result as any).narrative.replace(/\*\*/g, '')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Key findings */}
      {workspace.entries.length > 1 && (
        <div className="cockpit-card p-4 flex flex-col gap-1.5">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Key Findings</span>
          {workspace.entries.map((entry) => {
            const narrative = (entry.result as any).narrative as string | undefined;
            if (!narrative) return null;
            const firstSentence = narrative.replace(/\*\*/g, '').split('. ')[0];
            return (
              <div key={entry.planId} className="flex items-start gap-2 text-[10px] text-zinc-400">
                <span className="text-amber-400 mt-0.5">✦</span>
                <span>{firstSentence}.</span>
              </div>
            );
          })}
        </div>
      )}

      {/* + Create another chart */}
      <div className="cockpit-card p-3 flex items-center gap-2">
        <input
          value={newChartInput}
          onChange={(e) => setNewChartInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitNewChart(); }}
          placeholder="+ Create another chart (e.g. average price by region)"
          disabled={isCreatingChart}
          className="flex-1 bg-zinc-950/60 border border-zinc-900/60 rounded-md px-3 py-2 text-[10px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/40"
        />
        <button
          onClick={submitNewChart}
          disabled={isCreatingChart || !newChartInput.trim()}
          className="text-[9px] font-extrabold font-mono border border-amber-500/30 bg-amber-500/10 px-3 py-2 rounded text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isCreatingChart ? '...' : '+ Add'}
        </button>
      </div>
    </div>
  );
};
