import { useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';

export default function OllamaDiagnostics() {
  const { ollamaStatus, ollamaModels, checkOllama } = useVaultStore();

  useEffect(() => {
    checkOllama();
  }, []);

  const getStatusColor = () => {
    if (ollamaStatus === 'online') return 'var(--green3)';
    if (ollamaStatus === 'offline') return 'var(--red3)';
    return 'var(--amber3)';
  };

  const getStatusBg = () => {
    if (ollamaStatus === 'online') return 'rgba(16,185,129,0.06)';
    if (ollamaStatus === 'offline') return 'rgba(239,68,68,0.06)';
    return 'rgba(245,158,11,0.06)';
  };

  const getStatusBorder = () => {
    if (ollamaStatus === 'online') return 'rgba(16,185,129,0.18)';
    if (ollamaStatus === 'offline') return 'rgba(239,68,68,0.18)';
    return 'rgba(245,158,11,0.18)';
  };

  return (
    <div className="card" style={{ background: getStatusBg(), borderColor: getStatusBorder(), padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: getStatusColor(),
            boxShadow: `0 0 8px ${getStatusColor()}`
          }} />
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--t1)' }}>
            Ollama Local AI Engine
          </span>
        </div>
        <button 
          className="btn btn-ghost btn-xs" 
          onClick={checkOllama} 
          disabled={ollamaStatus === 'checking'}
        >
          {ollamaStatus === 'checking' ? 'Checking...' : '🔄 Re-check'}
        </button>
      </div>

      {ollamaStatus === 'online' ? (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: '0.65rem' }}>
            Connection verified successfully at <code style={{ color: 'var(--blue3)', fontFamily: 'var(--mono)' }}>http://localhost:11434</code>. 
            All AI processing is active and sandboxed.
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: '0.35rem', fontWeight: 700 }}>
            Available Models ({ollamaModels.length}):
          </div>
          {ollamaModels.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {ollamaModels.map((model) => (
                <span key={model} className="tag tag-blue" style={{ fontFamily: 'var(--mono)' }}>
                  {model}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.7rem', color: 'var(--red3)', background: 'rgba(239,68,68,0.05)', padding: '0.5rem', borderRadius: 6 }}>
              ⚠️ No models found in Ollama. Run <code style={{ fontFamily: 'var(--mono)', color: 'var(--t1)' }}>ollama pull codellama:7b</code> in your terminal.
            </div>
          )}
        </div>
      ) : ollamaStatus === 'offline' ? (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Unable to connect to Ollama at <code style={{ color: 'var(--red3)', fontFamily: 'var(--mono)' }}>localhost:11434</code>. 
            To analyze data locally, please complete the following steps:
          </div>
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1.5px solid var(--rim)',
            borderRadius: 14,
            padding: '0.85rem 1.1rem',
            marginBottom: '0.75rem',
            fontFamily: 'var(--mono)',
            fontSize: '0.68rem',
            color: 'var(--t2)',
            lineHeight: 1.6
          }}>
            <div style={{ color: 'var(--t4)', marginBottom: 4 }}># 1. Download & install Ollama (Free)</div>
            <div>https://ollama.com</div>
            <div style={{ color: 'var(--t4)', margin: '6px 0 4px' }}># 2. Run local code model in terminal</div>
            <div style={{ color: 'var(--cyan3)' }}>ollama run codellama:7b</div>
            <div style={{ color: 'var(--t4)', margin: '6px 0 4px' }}># 3. Keep terminal open and click Re-check above</div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--t4)' }}>
            🔒 Privana never uses external APIs, guaranteeing zero cloud exposure for your schema.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>
          Pinging local interfaces...
        </div>
      )}
    </div>
  );
}
