// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/ResultView.tsx
// S10 RESULT VIEW ROUTER — Routes AnalyticsResult to subcomponents.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { AnalyticsResult, ClarificationChoice } from '../../types';
import { ComputedView } from './ComputedView';
import { ClarifyView } from './ClarifyView';
import { BlockedView } from './BlockedView';
import { UnsupportedView } from './UnsupportedView';
import { RefusedView } from './RefusedView';
import { ErrorView } from './ErrorView';

interface ResultViewProps {
  result: AnalyticsResult;
  onSelectChoice?: (choice: ClarificationChoice) => void;
  onSelectQuestion?: (question: string) => void;
  onBypass?: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ 
  result, 
  onSelectChoice = () => {}, 
  onSelectQuestion = () => {},
  onBypass
}) => {
  switch (result.status) {
    case 'computed':
    case 'partial':
      return <ComputedView result={result} />;
    case 'clarify':
      return <ClarifyView result={result} onSelectChoice={onSelectChoice} />;
    case 'blocked':
      return <BlockedView result={result} onBypass={onBypass} />;
    case 'unsupported':
      return <UnsupportedView result={result} onSelectQuestion={onSelectQuestion} />;
    case 'refused':
      return <RefusedView result={result} onSelectQuestion={onSelectQuestion} />;
    case 'error':
      return <ErrorView result={result} />;
    default:
      return (
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          Unknown execution status
        </div>
      );
  }
};
