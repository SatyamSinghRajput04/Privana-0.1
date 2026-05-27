// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/features/result-view/RefusedView.tsx
// S10 REFUSED VIEW — Renders schema verification failures.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface RefusedViewProps {
  result: {
    status: 'refused';
    errors: string[];
    reason?: string;
    missing?: string[];
    message?: string;
    suggestions?: string[];
    provenance: {
      question: string;
    };
  };
  onSelectQuestion?: (question: string) => void;
}

export const RefusedView: React.FC<RefusedViewProps> = ({ result, onSelectQuestion = () => {} }) => {
  const isMissingColumn = result.reason === 'missing_column';
  const missingTerm = result.missing?.[0];

  const handleSuggestionClick = (suggestion: string) => {
    if (missingTerm) {
      const originalQuestion = result.provenance.question;
      // Replace missing term with the suggestion in the query
      const newQuestion = originalQuestion.replace(new RegExp(missingTerm, 'gi'), suggestion);
      onSelectQuestion(newQuestion);
    }
  };

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
          <ShieldAlert size={22} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-400 mb-1">Query Refused</h4>
          
          {isMissingColumn && missingTerm ? (
            <div style={{ marginTop: '0.2rem', marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fca5a5' }}>
                Missing column: <code style={{ background: 'rgba(239,68,68,0.15)', padding: '2px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>{missingTerm}</code>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-300 mb-3">
              I couldn't run this query because it doesn't align with the schema of the active dataset:
            </p>
          )}

          <ul className="list-disc pl-5 mb-3 text-sm text-zinc-400 space-y-1">
            {result.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>

          {isMissingColumn && result.suggestions && result.suggestions.length > 0 && (
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(239,68,68,0.15)', paddingTop: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 600 }}>
                Available similar columns:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {result.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e4e4e7',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.color = '#e4e4e7';
                    }}
                  >
                    {suggestion}
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
