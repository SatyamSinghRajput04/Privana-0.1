// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/UnsupportedView.tsx
// S10 UNSUPPORTED VIEW — Renders out-of-intent guidance & suggestion chips.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface UnsupportedViewProps {
  result: {
    status: 'unsupported';
    explanation: string;
    suggestedQuestions: string[];
  };
  onSelectQuestion: (question: string) => void;
}

export const UnsupportedView: React.FC<UnsupportedViewProps> = ({ result, onSelectQuestion }) => {
  return (
    <div 
      className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/20 backdrop-blur-md"
      style={{
        background: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-zinc-300 mb-1.5">Unsupported Query format</h4>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            {result.explanation}
          </p>

          {result.suggestedQuestions.length > 0 && (
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Try asking one of these questions instead:
              </div>
              <div className="flex flex-col gap-2">
                {result.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectQuestion(q)}
                    className="flex items-center gap-2 text-left text-sm text-zinc-300 bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700/80 px-3 py-2.5 rounded-lg transition-all duration-150 group"
                  >
                    <ArrowRight 
                      size={14} 
                      className="text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" 
                    />
                    <span className="flex-1 font-medium">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
