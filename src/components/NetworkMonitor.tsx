import { useState, useEffect, useRef, useCallback } from 'react';
import { localDB, type AuditLog } from '../lib/indexedDb';
import { useVaultStore } from '../store/useVaultStore';

type LType = 'INFO' | 'ALLOW' | 'WARN' | 'ALERT' | 'BLOCK';
type Entry = { id: number; time: string; type: LType; proc: string; msg: string; bytes: number; };

interface Props { compact?: boolean; onAlert?: () => void; }

const formatBytes = (b: number) => {
  if (b === 0) return '0 bytes';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function NetworkMonitor({ compact, onAlert }: Props) {
  const { ws, egressStats } = useVaultStore();
  const [on, setOn] = useState(true); // Default active in background to show live security audit log
  const [logs, setLogs] = useState<Entry[]>([]);
  const [sent, setSent] = useState(0);
  const [up, setUp] = useState(0);
  const [alrt, setAlrt] = useState(false);
  const [alertEntry, setAlertEntry] = useState<Entry | null>(null);
  const utmr = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const reloadLogs = useCallback(async () => {
    if (!ws) return;
    try {
      const dbLogs = await localDB.getAuditLogs(ws.id);
      
      // Map database logs to standard UI structures
      const formatted: Entry[] = dbLogs.slice(0, 100).map(log => ({
        id: log.id || Math.random(),
        time: new Date(log.created_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        type: log.event_type,
        proc: log.process_name,
        msg: log.message_label,
        bytes: log.bytes_external > 0 ? log.bytes_external : log.bytes_loopback > 0 ? log.bytes_loopback : log.bytes_audit_sync
      }));
      
      setLogs(formatted);
      
      let extBytes = 0;
      let hasBlockAlert = false;
      let firstBlock: AuditLog | null = null;
      
      dbLogs.forEach(log => {
        extBytes += log.bytes_external || 0;
        if (log.event_type === 'BLOCK' || log.event_type === 'ALERT') {
          hasBlockAlert = true;
          if (!firstBlock) firstBlock = log;
        }
      });
      
      setSent(extBytes);
      
      if (hasBlockAlert && firstBlock) {
        setAlrt(true);
        setAlertEntry({
          id: (firstBlock as AuditLog).id || 999,
          time: new Date((firstBlock as AuditLog).created_at).toLocaleTimeString('en-US', { hour12: false }),
          type: (firstBlock as AuditLog).event_type,
          proc: (firstBlock as AuditLog).process_name,
          msg: (firstBlock as AuditLog).message_label,
          bytes: (firstBlock as AuditLog).bytes_external
        });
        onAlert?.();
      }
    } catch (e) {
      console.error('Failed to load audit logs in network monitor', e);
    }
  }, [ws, onAlert]);

  // Uptime ticker
  useEffect(() => {
    if (on) {
      utmr.current = setInterval(() => setUp(u => u + 1), 1000);
    }
    return () => {
      if (utmr.current) clearInterval(utmr.current);
    };
  }, [on]);

  // Event-driven reactive listener
  useEffect(() => {
    reloadLogs();
    
    const handleLogAdded = () => {
      reloadLogs();
    };
    
    window.addEventListener('privana:audit-log-added', handleLogAdded);
    return () => {
      window.removeEventListener('privana:audit-log-added', handleLogAdded);
    };
  }, [reloadLogs]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const start = () => {
    setOn(true);
    setUp(0);
    reloadLogs();
  };

  const stop = () => {
    setOn(false);
    if (utmr.current) clearInterval(utmr.current);
  };

  const status = !on ? 'OFFLINE' : alrt ? '⚠ SECURITY AUDIT ALERT' : 'FULLY OFFLINE (0 Egress)';
  const dotCls = !on ? 'x' : alrt ? 'r' : 'g';
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="nm">
      <div className="nm-hdr">
        <div className={`nm-dot ${dotCls}`} />
        <span className="nm-title">🔒 PRIVANA EGRESS AUDIT — {status}</span>
        {on && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--t4)' }}>{pad(Math.floor(up / 60))}:{pad(up % 60)}</span>}
      </div>

      <div className="nm-metrics">
        {[
          { l: 'EXTERNAL DATA EGRESS', v: sent === 0 ? '0 bytes' : `${sent} B`, c: sent === 0 ? 'g' : 'r' },
          { l: 'LOCAL LOOPBACK', v: formatBytes(egressStats.loopback), c: 'b' },
          { l: 'AUDIT SYNC', v: formatBytes(egressStats.auditSync), c: 'b' },
          { l: 'STATUS', v: !on ? 'OFFLINE' : alrt ? 'ALERT' : 'PRIVATE', c: !on ? 'b' : alrt ? 'r' : 'g' },
        ].map((m, i) => (
          <div key={i} className="nm-m">
            <div className="nm-m-lbl">{m.l}</div>
            <div className={`nm-m-val ${m.c}`}>{m.v}</div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="nm-log" ref={logRef}>
          {logs.length === 0
            ? <div className="nm-empty">{on ? 'Awaiting audit events...' : 'Egress audit is currently offline'}</div>
            : logs.map(e => (
              <div key={e.id} className="nm-row" style={e.type === 'ALERT' || e.type === 'BLOCK' ? { background: 'rgba(239,68,68,0.06)' } : {}}>
                <span className="nm-t">{e.time}</span>
                <span className={`nm-type ${e.type}`}>[{e.type}]</span>
                <span className="nm-proc">{e.proc}</span>
                <span className="nm-msg">{e.msg}</span>
                {e.bytes > 0 && <span style={{ color: e.type === 'ALERT' || e.type === 'BLOCK' ? 'var(--red3)' : 'var(--t4)', flexShrink: 0 }}>{e.bytes}B</span>}
              </div>
            ))
          }
        </div>
      )}

      <div className="nm-foot">
        {!on
          ? <button className="btn btn-green btn-sm" onClick={start}>▶ Start Audit</button>
          : <button className="btn btn-ghost btn-sm" onClick={stop}>⏹ Stop</button>
        }
        <button className="btn btn-ghost btn-sm" disabled={!on}>📄 Export PDF</button>
        <button className="btn btn-ghost btn-sm" disabled={!on}>🔬 Export Audit Trail</button>
      </div>

      {alrt && alertEntry && (
        <div className="modal-overlay">
          <div className="modal" style={{ borderColor: 'var(--red2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🚨</span>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--red3)', letterSpacing: '0.1em', marginBottom: 2 }}>SECURITY EVENT</div>
                <div className="modal-title">Egress Block Interception</div>
              </div>
            </div>
            <div className="code-block" style={{ marginBottom: '1rem' }}>
{`Process : ${alertEntry.proc}
Time    : ${alertEntry.time}
Event   : ${alertEntry.msg}
Action  : BLOCKED / Redacted`}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--t2)', lineHeight: 1.65, marginBottom: '1.25rem' }}>
              Privana's active egress firewall intercepted and blocked a connection matching an unauthorized pattern. Your local session remains completely <strong style={{ color: 'var(--green3)' }}>secure</strong>.
            </p>
            <div className="modal-actions">
              <button className="btn btn-green" onClick={() => setAlrt(false)}>Close Warning</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
