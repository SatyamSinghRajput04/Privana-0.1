// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/BlockedView.tsx
// S10 BLOCKED VIEW — Renders safety, PII, and privacy blockers.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface BlockedViewProps {
  result: {
    status: 'blocked';
    reason: string;
    bypassAllowed?: boolean;
    provenance: {
      question: string;
      executionTimeMs: number;
    };
  };
  onBypass?: () => void;
}

export const BlockedView: React.FC<BlockedViewProps> = ({ result, onBypass }) => {
  return (
    <div 
      className="p-5 rounded-xl border border-red-500/20 bg-red-950/10 backdrop-blur-md"
      style={{
        background: 'rgba(239, 68, 68, 0.05)',
        borderColor: 'rgba(239, 68, 68, 0.15)',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
          <ShieldAlert size={24} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-400 mb-1">Query Blocked</h4>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            {result.reason}
          </p>

          {result.bypassAllowed && onBypass && (
            <button
              onClick={onBypass}
              className="mb-3 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded text-xs hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            >
              ⚠️ Analyze Anyway
            </button>
          )}

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Scan Time: {result.provenance.executionTimeMs}ms</span>
            <span>•</span>
            <span className="font-mono bg-red-500/5 px-2 py-0.5 rounded text-red-400/80 border border-red-500/10">
              SafeCompute Policy Guard Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
