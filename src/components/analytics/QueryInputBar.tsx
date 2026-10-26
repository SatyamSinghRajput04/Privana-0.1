import React, { useRef } from 'react';
import { Search, Sparkles, X, ArrowRight, Loader2 } from 'lucide-react';

export interface SuggestedQuery {
  title: string;
  desc?: string;
  query: string;
}

export interface QueryInputBarProps {
  qaInput: string;
  setQaInput: (val: string) => void;
  qaLoading: boolean;
  loadingStage?: number;
  onSearch: (query: string) => void;
  onReset: () => void;
  hasResult: boolean;
  suggestedQueries?: SuggestedQuery[];
}

const STAGE_LABELS = [
  'Planning analytical intent...',
  'Compiling parameterized query...',
  'Executing in local engine...',
  'Synthesizing verified narrative...'
];

export default function QueryInputBar({
  qaInput,
  setQaInput,
  qaLoading,
  loadingStage = 0,
  onSearch,
  onReset,
  hasResult,
  suggestedQueries = []
}: QueryInputBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = qaInput.trim();
    if (trimmed && !qaLoading) {
      onSearch(trimmed);
    }
  };

  const handleSelectSuggestion = (query: string) => {
    setQaInput(query);
    onSearch(query);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.55rem', width: '100%', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#71717a'
            }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask anything about your data (e.g., 'correlation between sleep and stress', 'average revenue by region')..."
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            disabled={qaLoading}
            style={{
              width: '100%',
              height: '36px',
              background: '#09090b',
              border: '1.5px solid #27272a',
              borderRadius: '8px',
              paddingLeft: '2.4rem',
              paddingRight: hasResult || qaInput ? '2.4rem' : '1rem',
              fontSize: '0.78rem',
              color: '#fff',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#ef4444';
              e.target.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#27272a';
              e.target.style.boxShadow = 'none';
            }}
          />
          {(qaInput || hasResult) && !qaLoading && (
            <button
              type="button"
              onClick={() => {
                setQaInput('');
                onReset();
                inputRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              title="Clear query"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={qaLoading || !qaInput.trim()}
          style={{
            height: '36px',
            background: qaLoading || !qaInput.trim() ? '#27272a' : '#ef4444',
            color: qaLoading || !qaInput.trim() ? '#71717a' : '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0 1.25rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: qaLoading || !qaInput.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background 0.15s',
            flexShrink: 0
          }}
        >
          {qaLoading ? (
            <>
              <Loader2 size={13} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Ask AI</span>
            </>
          )}
        </button>
      </form>

      {/* Staged Loading Indicator */}
      {qaLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.68rem',
          color: '#ef4444',
          fontFamily: 'var(--mono)',
          paddingLeft: '0.25rem'
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ef4444',
            display: 'inline-block',
            animation: 'pulse 1.5s infinite'
          }} />
          <span>{STAGE_LABELS[loadingStage] || STAGE_LABELS[0]}</span>
        </div>
      )}

      {/* Suggested Query Chips */}
      {!qaLoading && suggestedQueries.length > 0 && !hasResult && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' }}>
            Suggestions:
          </span>
          {suggestedQueries.slice(0, 4).map((sug, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectSuggestion(sug.query)}
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '999px',
                padding: '3px 10px',
                fontSize: '0.65rem',
                color: '#e4e4e7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.12s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
            >
              <span>{sug.query}</span>
              <ArrowRight size={10} style={{ color: '#ef4444' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
