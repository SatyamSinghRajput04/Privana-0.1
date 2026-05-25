import { useState, useEffect, useRef, useCallback } from 'react';

type LType = 'INFO'|'ALLOW'|'WARN'|'ALERT';
type Entry = { id:number; time:string; type:LType; proc:string; msg:string; bytes:number; };

const SYS = [
  { type:'ALLOW' as LType, proc:'privana:ipc',    msg:'IPC → 127.0.0.1:8742 (UI↔engine, loopback)', bytes:0 },
  { type:'ALLOW' as LType, proc:'privana:ollama', msg:'Ollama → 127.0.0.1:11434 (local LLM)', bytes:0 },
  { type:'INFO'  as LType, proc:'system:ntp',     msg:'NTP sync → pool.ntp.org (system clock)', bytes:48 },
  { type:'INFO'  as LType, proc:'system:dns',     msg:'DNS → time.apple.com (system)', bytes:64 },
];

let _id = 0;
const mk = (e:Omit<Entry,'id'|'time'>):Entry => ({
  ...e, id:++_id,
  time: new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}),
});

interface Props { compact?:boolean; onAlert?:()=>void; }

export default function NetworkMonitor({ compact, onAlert }:Props) {
  const [on,   setOn]   = useState(false);
  const [logs, setLogs] = useState<Entry[]>([]);
  const [sent, setSent] = useState(0);
  const [conn, setConn] = useState(0);
  const [up,   setUp]   = useState(0);
  const [alrt, setAlrt] = useState(false);
  const [alertEntry, setAlertEntry] = useState<Entry|null>(null);
  const tmr  = useRef<ReturnType<typeof setInterval>|null>(null);
  const utmr = useRef<ReturnType<typeof setInterval>|null>(null);
  const tick = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const add = useCallback((e:Omit<Entry,'id'|'time'>) => {
    setLogs(p=>[...p.slice(-80), mk(e)]);
  }, []);

  const start = useCallback(() => {
    setOn(true); setLogs([]); setSent(0); setConn(0); setUp(0); setAlrt(false); tick.current=0;
    add({type:'INFO',proc:'privana-monitor',msg:'Network monitor started — all interfaces captured',bytes:0});
    add({type:'INFO',proc:'privana-monitor',msg:'Ed25519 audit log initialized',bytes:0});
    tmr.current = setInterval(()=>{
      tick.current++;
      if (tick.current%4===0) add({type:'INFO',proc:'privana-monitor',msg:'Heartbeat ✓ — 0 Privana outbound connections',bytes:0});
      if (tick.current%7===0) add(SYS[Math.floor(Math.random()*SYS.length)]);
    }, 600);
    utmr.current = setInterval(()=>setUp(u=>u+1), 1000);
  }, [add]);

  const stop = useCallback(() => {
    setOn(false);
    if(tmr.current)  clearInterval(tmr.current);
    if(utmr.current) clearInterval(utmr.current);
    add({type:'INFO',proc:'privana-monitor',msg:'Monitor stopped — session log saved',bytes:0});
  }, [add]);

  const attack = useCallback(() => {
    setAlrt(true); setSent(b=>b+2048); setConn(c=>c+1);
    const e = mk({type:'ALERT',proc:'privana-engine',msg:'⚠ OUTBOUND → 142.250.80.46:443 (google.com)',bytes:2048});
    setLogs(p=>[...p.slice(-80),e]);
    setAlertEntry(e);
    onAlert?.();
  }, [add, onAlert]);

  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight; },[logs]);
  useEffect(()=>()=>{ if(tmr.current)clearInterval(tmr.current); if(utmr.current)clearInterval(utmr.current); },[]);

  const status = !on?'OFFLINE':alrt?'⚠ ALERT — OUTBOUND':'FULLY OFFLINE (Privana)';
  const dotCls = !on?'x':alrt?'r':'g';
  const pad = (n:number)=>String(n).padStart(2,'0');

  return (
    <div className="nm">
      <div className="nm-hdr">
        <div className={`nm-dot ${dotCls}`} />
        <span className="nm-title">🔒 NETWORK MONITOR — {status}</span>
        {on && <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:'0.58rem',color:'var(--t4)'}}>{pad(Math.floor(up/60))}:{pad(up%60)}</span>}
      </div>

      <div className="nm-metrics">
        {[
          {l:'PRIVANA OUTBOUND', v:sent===0?'0 bytes':`${sent}B`, c:sent===0?'g':'r'},
          {l:'EXT CONNECTIONS',  v:String(conn),                   c:conn===0?'g':'r'},
          {l:'UPTIME',           v:`${pad(Math.floor(up/60))}:${pad(up%60)}`, c:'b'},
          {l:'STATUS',           v:!on?'OFFLINE':alrt?'ALERT':'PRIVATE', c:!on?'b':alrt?'r':'g'},
        ].map((m,i)=>(
          <div key={i} className="nm-m">
            <div className="nm-m-lbl">{m.l}</div>
            <div className={`nm-m-val ${m.c}`}>{m.v}</div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="nm-log" ref={logRef}>
          {logs.length===0
            ? <div className="nm-empty">{on?'Monitoring...':'Click Start to begin capturing'}</div>
            : logs.map(e=>(
              <div key={e.id} className="nm-row" style={e.type==='ALERT'?{background:'rgba(239,68,68,0.06)'}:{}}>
                <span className="nm-t">{e.time}</span>
                <span className={`nm-type ${e.type}`}>[{e.type}]</span>
                <span className="nm-proc">{e.proc}</span>
                <span className="nm-msg">{e.msg}</span>
                {e.bytes>0 && <span style={{color:e.type==='ALERT'?'var(--red3)':'var(--t4)',flexShrink:0}}>{e.bytes}B</span>}
              </div>
            ))
          }
        </div>
      )}

      <div className="nm-foot">
        {!on
          ? <button className="btn btn-green btn-sm" onClick={start}>▶ Start Monitor</button>
          : <button className="btn btn-ghost btn-sm" onClick={stop}>⏹ Stop</button>
        }
        {on && <button className="btn btn-red btn-sm" onClick={attack}>⚡ Simulate Attack</button>}
        <button className="btn btn-ghost btn-sm" disabled={!on}>📄 Export PDF</button>
        <button className="btn btn-ghost btn-sm" disabled={!on}>🔬 Export .pcap</button>
      </div>

      {alrt && alertEntry && (
        <div className="modal-overlay">
          <div className="modal" style={{borderColor:'var(--red2)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1rem'}}>
              <span style={{fontSize:'1.8rem'}}>🚨</span>
              <div>
                <div style={{fontFamily:'var(--mono)',fontSize:'0.6rem',color:'var(--red3)',letterSpacing:'0.1em',marginBottom:2}}>CRITICAL ALERT</div>
                <div className="modal-title">Outbound Connection Detected</div>
              </div>
            </div>
            <div className="code-block" style={{marginBottom:'1rem'}}>
{`Process : ${alertEntry.proc}
Time    : ${alertEntry.time}
Event   : ${alertEntry.msg}
Bytes   : ${alertEntry.bytes}B`}
            </div>
            <p style={{fontSize:'0.8rem',color:'var(--t2)',lineHeight:1.65,marginBottom:'1.25rem'}}>
              Privana detected an outbound connection. Your session has been <strong style={{color:'var(--amber3)'}}>paused</strong>. This event is logged in the audit trail.
            </p>
            <div className="modal-actions">
              <button className="btn btn-red" onClick={()=>{stop();setAlrt(false);}}>🛑 Terminate Session</button>
              <button className="btn btn-ghost" onClick={()=>setAlrt(false)}>⚠ Acknowledge & Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
