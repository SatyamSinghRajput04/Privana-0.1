import React from 'react';
import { Search } from 'lucide-react';

interface QueryPanelProps {
  qaLoading: boolean;
  hasResponse: boolean;
  hasContextualCard: boolean;
  onSearch: (query: string) => void;
  onReset: () => void;
  qaInput: string;
  setQaInput: (val: string) => void;
}

export default function QueryPanel({
  qaLoading,
  hasResponse,
  hasContextualCard,
  onSearch,
  onReset,
  qaInput,
  setQaInput
}: QueryPanelProps) {
  const [localVal, setLocalVal] = React.useState(qaInput);

  React.useEffect(() => {
    setLocalVal(qaInput);
  }, [qaInput]);

  const handleSearchSubmit = () => {
    const trimmed = localVal.trim();
    if (trimmed) {
      setQaInput(trimmed);
      onSearch(trimmed);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.55rem', flex: 1 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: 9.5, color: '#52525b' }} />
        <input
          type="text"
          placeholder="e.g., average sleep hours for female TikTok users aged 14 to 16..."
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
          style={{
            width: '100%',
            height: '32px',
            background: '#080405',
            border: '1.5px solid var(--rim)',
            borderRadius: '8px',
            paddingLeft: '2.1rem',
            paddingRight: '1rem',
            fontSize: '0.75rem',
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.15s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#ef4444'}
          onBlur={(e) => e.target.style.borderColor = 'var(--rim)'}
        />
      </div>
      
      <button
        onClick={handleSearchSubmit}
        disabled={qaLoading || !localVal.trim()}
        style={{
          height: '32px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '0 1.25rem',
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: (qaLoading || !localVal.trim()) ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          transition: 'all 0.15s'
        }}
      >
        {qaLoading ? 'Thinking...' : 'Ask AI'}
      </button>

      {(localVal.trim() || hasResponse || hasContextualCard) && (
        <button
          onClick={() => {
            setLocalVal('');
            setQaInput('');
            onReset();
          }}
          style={{
            height: '32px',
            background: 'transparent',
            color: '#71717a',
            border: '1.5px solid var(--rim)',
            borderRadius: '8px',
            padding: '0 0.85rem',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#71717a';
            e.currentTarget.style.borderColor = 'var(--rim)';
          }}
          title="Clear query and reset view"
        >
          Reset
        </button>
      )}
    </div>
  );
}
