// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ErrorView.tsx
// S10 ERROR VIEW — Renders runtime errors and panic information.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorViewProps {
  result: {
    status: 'error';
    message: string;
    debugId: string;
  };
}

export const ErrorView: React.FC<ErrorViewProps> = ({ result }) => {
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
          <AlertCircle size={22} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-400 mb-1">Internal Pipeline Error</h4>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            An unexpected error occurred while executing your query: {result.message}
          </p>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Debug ID: <code className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-800">{result.debugId}</code></span>
          </div>
        </div>
      </div>
    </div>
  );
};
