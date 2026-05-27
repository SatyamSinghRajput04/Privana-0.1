// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ClarifyView.tsx
// S10 CLARIFY VIEW — Renders clickable pre-built query options.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { ClarificationChoice } from '../../types';

interface ClarifyViewProps {
  result: {
    status: 'clarify';
    clarification: {
      message: string;
      choices: ClarificationChoice[];
    };
  };
  onSelectChoice: (choice: ClarificationChoice) => void;
}

export const ClarifyView: React.FC<ClarifyViewProps> = ({ result, onSelectChoice }) => {
  return (
    <div 
      className="p-5 rounded-xl border border-amber-500/20 bg-amber-950/10 backdrop-blur-md"
      style={{
        background: 'rgba(245, 158, 11, 0.03)',
        borderColor: 'rgba(245, 158, 11, 0.15)',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
          <HelpCircle size={22} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-400 mb-1">Ambiguous Query</h4>
          <p className="text-sm text-zinc-300 mb-4">
            {result.clarification.message}
          </p>

          <div className="flex flex-col gap-2">
            {result.clarification.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => onSelectChoice(choice)}
                className="w-full flex items-center justify-between text-left p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-amber-500/30 transition-all duration-200 group text-zinc-200"
              >
                <div className="flex-1 pr-4">
                  <div className="text-sm font-medium leading-relaxed group-hover:text-zinc-100">
                    {choice.label}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 group-hover:text-zinc-400">
                    Query: "{choice.question}"
                  </div>
                </div>
                <ChevronRight 
                  size={16} 
                  className="text-zinc-600 group-hover:text-amber-400 transition-colors duration-200" 
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
