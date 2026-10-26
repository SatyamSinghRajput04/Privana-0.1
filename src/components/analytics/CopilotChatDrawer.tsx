import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, RotateCcw, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  provenance?: {
    sql?: string;
    executionTimeMs?: number;
    intent?: string;
  };
}

export interface CopilotChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (query: string) => void;
  onResetChat: () => void;
  suggestedQueries?: string[];
  localAiKillSwitchActive?: boolean;
  onToggleKillSwitch?: () => void;
}

export default function CopilotChatDrawer({
  isOpen,
  onClose,
  messages,
  loading,
  onSendMessage,
  onResetChat,
  suggestedQueries = [
    'What is the correlation between variables?',
    'Show top 5 records by highest values',
    'Summarize dataset distribution'
  ],
  localAiKillSwitchActive = false,
  onToggleKillSwitch
}: CopilotChatDrawerProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 210 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '400px',
            maxWidth: '100vw',
            height: '100vh',
            background: 'rgba(9, 9, 12, 0.98)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1.5px solid #3c1417',
            boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #1a1a24',
            background: 'rgba(239, 68, 68, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={15} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                  Privana AI Copilot
                </span>
                <div style={{ fontSize: '0.56rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                  Local Engine (0 Bytes Egress)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {onToggleKillSwitch && (
                <button
                  onClick={onToggleKillSwitch}
                  style={{
                    background: localAiKillSwitchActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    border: localAiKillSwitchActive ? '1px solid #ef4444' : '1px solid #27272a',
                    borderRadius: '4px',
                    color: localAiKillSwitchActive ? '#ef4444' : '#a1a1aa',
                    fontSize: '0.56rem',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title={localAiKillSwitchActive ? 'Local AI Kill Switch active (firewall blocking LLMs)' : 'Toggle Local AI Kill Switch'}
                >
                  {localAiKillSwitchActive ? <ShieldAlert size={10} /> : <ShieldCheck size={10} />}
                  <span>{localAiKillSwitchActive ? 'Kill Switch ON' : 'AI Safe'}</span>
                </button>
              )}

              <button
                onClick={onResetChat}
                style={{
                  background: 'transparent',
                  border: '1px dashed rgba(239, 68, 68, 0.25)',
                  borderRadius: '4px',
                  color: '#f87171',
                  fontSize: '0.56rem',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
                title="Clear conversation history"
              >
                <RotateCcw size={10} />
                <span>Reset</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: 'none',
                  color: '#a1a1aa',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {messages.map((msg, idx) => {
              const isAI = msg.sender === 'ai';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isAI ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <div style={{
                    background: isAI ? '#121216' : 'rgba(239, 68, 68, 0.1)',
                    border: isAI ? '1px solid #1a1a24' : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: isAI ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.74rem',
                    color: '#e4e4e7',
                    lineHeight: 1.5,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    {isAI ? (
                      <MarkdownRenderer text={msg.text} />
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    )}

                    {/* SQL code snippet if available in provenance */}
                    {isAI && msg.provenance?.sql && (
                      <div style={{ marginTop: '0.5rem', borderTop: '1px solid #1f1f2e', paddingTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.55rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Local SQL Plan:
                        </span>
                        <pre style={{
                          margin: '0.2rem 0 0 0',
                          padding: '4px 6px',
                          background: '#07070a',
                          borderRadius: '4px',
                          fontSize: '0.62rem',
                          fontFamily: 'var(--mono, monospace)',
                          color: '#fca5a5',
                          overflowX: 'auto'
                        }}>
                          <code>{msg.provenance.sql}</code>
                        </pre>
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.52rem',
                    color: '#52525b',
                    alignSelf: isAI ? 'flex-start' : 'flex-end',
                    padding: '0 2px'
                  }}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.provenance?.executionTimeMs !== undefined && (
                      <span>• {msg.provenance.executionTimeMs}ms</span>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#121216',
                border: '1px solid #1a1a24',
                borderRadius: '12px 12px 12px 2px',
                padding: '0.65rem 0.85rem'
              }}>
                <Loader2 size={12} className="animate-spin" style={{ color: '#ef4444', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Analyzing in local secure enclave...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {suggestedQueries.length > 0 && !loading && (
            <div style={{
              padding: '0.45rem 1rem',
              borderTop: '1px solid #1a1a24',
              display: 'flex',
              gap: '0.35rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
              flexShrink: 0
            }}>
              {suggestedQueries.slice(0, 3).map((chipText, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(chipText)}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #27272a',
                    borderRadius: '999px',
                    padding: '3px 9px',
                    fontSize: '0.62rem',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    e.currentTarget.style.borderColor = '#ef4444';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = '#27272a';
                    e.currentTarget.style.color = '#a1a1aa';
                  }}
                >
                  {chipText}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid #1a1a24',
            background: '#09090b',
            display: 'flex',
            gap: '0.45rem',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <input
              type="text"
              placeholder="Ask copilot about your data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{
                flex: 1,
                height: 34,
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '0 0.75rem',
                fontSize: '0.74rem',
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = '#ef4444'}
              onBlur={e => e.target.style.borderColor = '#27272a'}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: loading || !input.trim() ? '#1f1f26' : '#ef4444',
                color: loading || !input.trim() ? '#52525b' : '#fff',
                border: 'none',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
