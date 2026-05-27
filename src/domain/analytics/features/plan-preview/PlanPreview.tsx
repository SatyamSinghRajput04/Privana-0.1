// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/plan-preview/PlanPreview.tsx
// S11 PLAN PREVIEW — Dev-only JSON plan overlay.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisPlan } from '../../types';

interface PlanPreviewProps {
  plan?: AnalysisPlan;
}

export const PlanPreview: React.FC<PlanPreviewProps> = ({ plan }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!plan) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-950/60 rounded-xl overflow-hidden backdrop-blur-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <Terminal size={14} className="text-purple-400" />
          <span>Execution Plan Preview (Dev Mode)</span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-zinc-500" />
        ) : (
          <ChevronDown size={14} className="text-zinc-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-zinc-800/60 bg-zinc-950 font-mono text-xs text-zinc-300 overflow-x-auto max-h-60">
          <pre>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
