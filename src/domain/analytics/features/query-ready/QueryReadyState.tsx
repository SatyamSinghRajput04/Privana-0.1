import { Sparkles, Database, Layers, Shield, Lock, Fingerprint } from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
}

interface SuggestedQuestion {
  title: string;
  desc: string;
  query: string;
}

interface QueryReadyStateProps {
  datasetName: string;
  rowCount: number;
  columns: ColumnInfo[];
  suggestedQuestions: SuggestedQuestion[];
  onSelectField: (fieldName: string) => void;
  onSelectQuestion: (question: string) => void;
}

export function QueryReadyState({
  datasetName,
  rowCount,
  columns,
  suggestedQuestions,
  onSelectField,
  onSelectQuestion
}: QueryReadyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '0 0.15rem'
    }}>
      {/* 1. WELCOME COCKPIT PANEL (Black glass with glowing micro-borders and red/coral accents) */}
      <div style={{
        background: 'linear-gradient(135deg, #0e0e12 0%, #080405 100%)',
        border: '1.5px solid #1f1f23',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.01), 0 4px 20px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow effect in background */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '-50px',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.04) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1.5px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          flexShrink: 0,
          boxShadow: '0 0 15px rgba(239, 68, 68, 0.15)'
        }}>
          <Sparkles size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            color: '#f4f4f5',
            letterSpacing: '-0.02em',
            margin: '0 0 0.2rem 0'
          }}>
            Ask a question to generate your first analysis
          </h2>
          <p style={{
            color: '#71717a',
            fontSize: '0.72rem',
            lineHeight: 1.45,
            margin: 0,
            maxWidth: '540px'
          }}>
            Draft a question in the search bar above or choose a preset analysis card below. 
            Clicking column chips below will append them to your query.
          </p>
        </div>
      </div>

      {/* 2. DATASET METRICS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.55rem',
        flexShrink: 0
      }}>
        {[
          { label: 'DATASET', value: datasetName.replace(/\.[^/.]+$/, "").replace(/_/g, " "), sub: datasetName, color: '#ef4444', icon: <Database size={13} /> },
          { label: 'RECORDS COUNT', value: rowCount.toLocaleString(), sub: 'In-memory rows active', color: '#a1a1aa', icon: <Layers size={13} /> },
          { label: 'SCHEMA FIELDS', value: columns.length, sub: 'Queryable metrics', color: '#a1a1aa', icon: <Fingerprint size={13} /> },
          { label: 'ENGINE STATUS', value: 'SQLite Local', sub: 'In-browser SQLite', color: '#10b981', icon: <Shield size={13} /> }
        ].map((k, ki) => (
          <div key={ki} style={{
            background: 'linear-gradient(135deg, #0e0e12 0%, #080405 100%)',
            border: `1.5px solid ${k.color === '#ef4444' ? 'rgba(239, 68, 68, 0.18)' : k.color === '#10b981' ? 'rgba(16, 185, 129, 0.18)' : '#1f1f23'}`,
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: k.color === '#ef4444' ? 'rgba(239, 68, 68, 0.05)' : k.color === '#10b981' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)',
              border: `1.5px solid ${k.color === '#ef4444' ? 'rgba(239, 68, 68, 0.15)' : k.color === '#10b981' ? 'rgba(16, 185, 129, 0.15)' : '#27272a'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: k.color === '#ef4444' ? '#ef4444' : k.color === '#10b981' ? '#10b981' : '#71717a',
              flexShrink: 0
            }}>
              {k.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '0.52rem',
                color: '#52525b',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {k.label}
              </div>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: k.color === '#ef4444' ? '#ef4444' : k.color === '#10b981' ? '#10b981' : '#f4f4f5',
                lineHeight: 1.1,
                margin: '1px 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {k.value}
              </div>
              <div style={{
                fontSize: '0.54rem',
                color: '#71717a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '120px'
              }}>
                {k.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. ROW 2: AVAILABLE FIELDS (LEFT) + SUGGESTED ANALYSES (RIGHT) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.6fr',
        gap: '0.6rem',
        flexShrink: 0
      }}>
        {/* A. AVAILABLE FIELDS DIRECTORY */}
        <div style={{
          background: 'linear-gradient(180deg, #0e0e12 0%, #080405 100%)',
          border: '1.5px solid #1f1f23',
          borderRadius: '12px',
          padding: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '0.62rem',
              color: '#f4f4f5',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Available Fields ({columns.length})
            </span>
            <span style={{ fontSize: '0.54rem', color: '#71717a' }}>Append to Q&A</span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            maxHeight: '260px',
            overflowY: 'auto',
            paddingRight: '0.15rem'
          }}>
            {columns.map((col) => {
              const isNum = col.type === 'number' || ['DECIMAL', 'INTEGER', 'BIGINT', 'FLOAT'].includes((col.type || '').toUpperCase());
              return (
                <div
                  key={col.name}
                  onClick={() => onSelectField(col.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.4rem 0.55rem',
                    borderRadius: '6px',
                    background: '#09090c',
                    border: '1px solid #1a1a20',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                    e.currentTarget.style.background = '#110a0d';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#1a1a20';
                    e.currentTarget.style.background = '#09090c';
                  }}
                >
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    width: 14,
                    color: isNum ? '#ef4444' : '#3b82f6',
                    textAlign: 'center'
                  }}>
                    {isNum ? '#' : 'Aa'}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    color: '#e4e4e7',
                    flex: 1,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {col.name}
                  </span>
                  <span style={{
                    fontSize: '0.52rem',
                    color: '#52525b',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase'
                  }}>
                    {(col.type || 'str').toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. DYNAMIC SUGGESTED ANALYSES */}
        <div style={{
          background: 'linear-gradient(180deg, #0e0e12 0%, #080405 100%)',
          border: '1.5px solid #1f1f23',
          borderRadius: '12px',
          padding: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <span style={{
            fontSize: '0.62rem',
            color: '#f4f4f5',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Suggested Analyses (Auto-Run)
          </span>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.5rem',
            flex: 1
          }}>
            {suggestedQuestions.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectQuestion(item.query)}
                style={{
                  background: '#09090c',
                  border: '1px solid #1a1a20',
                  borderRadius: '10px',
                  padding: '0.75rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  e.currentTarget.style.background = '#110a0d';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#1a1a20';
                  e.currentTarget.style.background = '#09090c';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '5px',
                    background: 'rgba(239, 68, 68, 0.04)',
                    border: '1px solid rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '0.62rem' }}>📊</span>
                  </div>
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#f4f4f5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.title}
                  </div>
                </div>

                <div style={{
                  fontSize: '0.6rem',
                  color: '#71717a',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '0.35rem',
                  flex: 1
                }}>
                  {item.query}
                </div>

                <div style={{
                  fontSize: '0.52rem',
                  color: '#ef4444',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '0.4rem',
                  textAlign: 'right'
                }}>
                  Execute Query →
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. LOCAL SECURITY COCKPIT FOOTER STATUS */}
      <div style={{
        background: '#0a0a0d',
        border: '1.5px solid #14141a',
        borderRadius: '10px',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '0.6rem',
        flexShrink: 0
      }}>
        {[
          { icon: <Shield size={14} />, text: 'Private Local Execution Active', desc: 'No remote APIs or data transfer', color: '#10b981' },
          { icon: <Lock size={14} />, text: 'PII In-Memory Auto-Redaction', desc: 'Sensitive data scrubbed automatically', color: '#10b981' },
          { icon: <Fingerprint size={14} />, text: 'SQLite Zero-Trust Sandbox', desc: 'Queries run client-side inside memory', color: '#10b981' }
        ].map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{ color: item.color, display: 'flex', alignItems: 'center' }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#e4e4e7' }}>{item.text}</div>
              <div style={{ fontSize: '0.54rem', color: '#52525b', marginTop: '0.05rem' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
