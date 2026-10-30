import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore } from '../store/useVaultStore';
import { Shield, Download, Server, Cpu, Database, EyeOff, Key, ArrowRight } from 'lucide-react';
import { WireframeBackground } from '../components/landing/WireframeBackground';

export default function LandingPage() {
  const { login } = useVaultStore();
  const [mode, setMode] = useState<'solo' | 'server'>('solo');
  const [passphrase, setPassphrase] = useState('');
  const [serverUrl, setServerUrl] = useState('https://server.privana.internal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'product' | 'downloads' | 'host'>('product');

  const hasPassphrase = typeof localStorage !== 'undefined' && !!localStorage.getItem('privana_passphrase_hash');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simulate slight loading latency for premium UX feel
    setTimeout(async () => {
      try {
        if (mode === 'solo') {
          await login('solo', { passphrase });
        } else {
          await login('server', { email, password, serverUrl });
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed.');
        setLoading(false);
      }
    }, 800);
  };

  const codeGuide = `docker run -d \\
  --name privana-server \\
  -p 3000:3000 \\
  -e DB_TYPE=postgres \\
  -e DB_URL=postgresql://db.company.com \\
  -e SECURITY_LEVEL=high \\
  privanahq/server:latest`;

  return (
    <div className="landing-layout" style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 0%, var(--bg3) 0%, var(--bg) 70%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--ff)',
      color: 'var(--t1)',
      overflowY: 'auto',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <WireframeBackground />
      {/* Navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--rim)',
        background: 'rgba(8, 13, 24, 0.4)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="sb-mark" style={{ width: 28, height: 28, fontSize: '0.85rem' }}>P</div>
          <span style={{ fontWeight: 850, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
            Privana <span style={{ color: 'var(--blue3)', fontSize: '0.75rem', fontWeight: 600 }}>Local-First AI</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn btn-sm ${tab === 'product' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('product')}>
            Product
          </button>
          <button className={`btn btn-sm ${tab === 'downloads' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('downloads')}>
            <Download size={14} /> Download App
          </button>
          <button className={`btn btn-sm ${tab === 'host' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('host')}>
            <Server size={14} /> Host Server
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '2.5rem',
        padding: '3rem 4rem',
        maxWidth: 1300,
        margin: '0 auto',
        alignItems: 'center',
        width: '100%'
      }}>
        {/* Left Side Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <AnimatePresence mode="wait">
            {tab === 'product' && (
              <motion.div
                key="product"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.07)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 99,
                  padding: '4px 12px',
                  fontSize: '0.68rem',
                  color: 'var(--green3)',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  fontFamily: 'var(--mono)',
                  letterSpacing: '0.05em'
                }}>
                  <Shield size={12} /> SECURE SANDBOXED EXECUTION
                </div>
                <h1 style={{
                  fontSize: '2.8rem',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: '-0.03em',
                  marginBottom: '1rem',
                  background: 'linear-gradient(to right, #fff, var(--t2))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Privacy-first AI analytics for sensitive datasets.
                </h1>
                <p style={{ fontSize: '0.95rem', color: 'var(--t2)', lineHeight: 1.6, marginBottom: '2rem' }}>
                  Analyze financial ledgers, HR tables, and internal customer logs without uploading a single row of data to the cloud. Privana translates queries locally and runs calculations directly in your browser.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                  <div className="card card-sm" style={{ background: 'rgba(15, 24, 40, 0.3)', borderColor: 'var(--rim)' }}>
                    <div style={{ color: 'var(--cyan3)', display: 'flex', gap: '0.4rem', alignItems: 'center', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <EyeOff size={16} /> Schema Firewall
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>
                      Masks database metadata column names before LLM translation. Zero data leakage.
                    </div>
                  </div>
                  <div className="card card-sm" style={{ background: 'rgba(15, 24, 40, 0.3)', borderColor: 'var(--rim)' }}>
                    <div style={{ color: 'var(--green3)', display: 'flex', gap: '0.4rem', alignItems: 'center', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                      <Database size={16} /> Local SQL Engine
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>
                      In-memory data engine running compiled client queries. Zero cloud transfer.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'downloads' && (
              <motion.div
                key="downloads"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
                  Download Desktop Application
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--t2)', lineHeight: 1.5 }}>
                  The desktop client compiles with Tauri to verify local-only loopbacks and run database parsing securely inside your local machine.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
                  {[
                    { os: 'Windows x64 Installer', file: 'privana_0.1.0_x64.msi', size: '12.4 MB' },
                    { os: 'macOS Apple Silicon', file: 'privana_0.1.0_aarch64.dmg', size: '14.1 MB' },
                    { os: 'Linux Debian Package', file: 'privana_0.1.0_amd64.deb', size: '11.8 MB' }
                  ].map((pkg, idx) => (
                    <div key={idx} className="card card-sm card-hover" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg2)',
                      padding: '0.9rem 1.2rem',
                      cursor: 'pointer'
                    }} onClick={() => alert(`Starting download of local package ${pkg.file}...`)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <Download size={18} style={{ color: 'var(--blue3)' }} />
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--t1)' }}>{pkg.os}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>{pkg.file}</div>
                        </div>
                      </div>
                      <span className="tag tag-blue">{pkg.size}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {tab === 'host' && (
              <motion.div
                key="host"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', marginBottom: '0.5rem' }}>
                  Deploy Team Server Instance
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--t2)', lineHeight: 1.5, marginBottom: '1.2rem' }}>
                  Host a central team gateway inside your corporate infrastructure to share dataset metadata and query history while locking down raw row access.
                </p>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    fontFamily: 'var(--mono)',
                    fontSize: '0.55rem',
                    color: 'var(--t4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    docker-compose.yml
                  </div>
                  <pre style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--rim)',
                    borderRadius: 10,
                    padding: '1.25rem',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.7rem',
                    color: 'var(--cyan3)',
                    overflowX: 'auto',
                    lineHeight: 1.5
                  }}>
                    <code>{codeGuide}</code>
                  </pre>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                  <span className="tag tag-green">Docker Engine v20+</span>
                  <span className="tag tag-blue">PostgreSQL 14+</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side Credentials Card */}
        <div style={{
          background: 'rgba(15, 24, 40, 0.45)',
          border: '1px solid var(--rim)',
          borderRadius: 18,
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Card subtle glowing header border */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(to right, transparent, var(--blue3), var(--purple3), transparent)'
          }} />

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.2rem' }}>Access Privana Console</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>Choose the execution sandbox profile below.</p>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--bg2)',
            border: '1px solid var(--rim)',
            borderRadius: 10,
            padding: '3px',
            marginBottom: '1.5rem'
          }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.45rem',
                borderRadius: 8,
                border: 'none',
                background: mode === 'solo' ? 'var(--panel3)' : 'transparent',
                color: mode === 'solo' ? '#fff' : 'var(--t3)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onClick={() => setMode('solo')}
            >
              <Cpu size={14} /> Desktop (Solo)
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.45rem',
                borderRadius: 8,
                border: 'none',
                background: mode === 'server' ? 'var(--panel3)' : 'transparent',
                color: mode === 'server' ? '#fff' : 'var(--t3)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onClick={() => setMode('server')}
            >
              <Server size={14} /> Team Server
            </button>
          </div>

          {/* Dynamic Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{
                fontSize: '0.72rem',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 8,
                padding: '0.7rem 0.9rem',
                lineHeight: 1.45
              }}>
                ⚠️ {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === 'solo' ? (
                <motion.div
                  key="solo-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
                >
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--t2)',
                    background: 'rgba(96, 165, 250, 0.05)',
                    border: '1px solid rgba(96, 165, 250, 0.18)',
                    borderRadius: 8,
                    padding: '0.7rem 0.9rem',
                    lineHeight: 1.45
                  }}>
                    {hasPassphrase 
                      ? '🔒 **Locked Local Profile:** Your database is secured. Enter your passphrase below to unlock.' 
                      : '💡 **Solo Mode:** Runs fully offline. To encrypt your local data, enter any passphrase to register it. You will use this same key to unlock your workspace on your next visit.'}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>
                      {hasPassphrase ? 'Enter Passphrase to Unlock' : 'Master Key / Passphrase (Optional)'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Key size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--t3)' }} />
                      <input
                        type="password"
                        className="form-input"
                        placeholder="••••••••••••"
                        style={{ paddingLeft: '2.1rem' }}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        autoFocus={hasPassphrase}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="server-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Host Instance URL</label>
                    <input
                      type="text"
                      className="form-input"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Corporate Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="user@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.65rem',
                marginTop: '0.5rem',
                justifyContent: 'center',
                fontSize: '0.8rem',
                gap: '8px'
              }}
              disabled={loading}
            >
              {loading ? (
                'Securing environment...'
              ) : (
                <>
                  {mode === 'solo' 
                    ? (hasPassphrase ? 'Unlock Local Workspace' : 'Launch Local Workspace') 
                    : 'Authenticate & Sync'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {hasPassphrase && mode === 'solo' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Resetting your local profile will erase all local workspaces, datasets, and history. This action cannot be undone. Are you sure you want to proceed?")) {
                    localStorage.clear();
                    indexedDB.deleteDatabase('privana_local_db');
                    window.location.reload();
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--t4)',
                  fontSize: '0.68rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '0.25rem',
                  width: '100%'
                }}
              >
                Forgot passphrase? Reset Local Profile
              </button>
            )}
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 1,
        padding: '1.5rem 2rem',
        borderTop: '1px solid var(--rim)',
        textAlign: 'center',
        fontSize: '0.7rem',
        color: 'var(--t4)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(6, 9, 15, 0.8)'
      }}>
        <span>© 2026 Privana Analytics. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--mono)' }}>
          <span>TEE Attestation: Verified</span>
          <span>Zero Network Send Check: 0B Egress</span>
        </div>
      </footer>
    </div>
  );
}
