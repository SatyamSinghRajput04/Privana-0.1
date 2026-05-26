import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Workspace, Page } from '../App';

const WS_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];

interface P { ws:Workspace|null; workspaces:Workspace[]; setWS:(w:Workspace[])=>void; setWs:(w:Workspace)=>void; setPage:(p:Page)=>void; }

export default function HomePage({ ws, workspaces, setWS, setWs, setPage }:P) {
  const [stats, setStats] = useState({datasets:0,queries:0,saved:0});
  const [recent, setRecent] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nm, setNm] = useState(''); const [nd, setNd] = useState(''); const [nmode, setNmode] = useState('solo');
  const [creating, setCreating] = useState(false);

  useEffect(()=>{
    if(!ws) return;
    Promise.all([
      privacyFetch(`/api/datasets?workspace_id=${ws.id}`).then(r=>r.json()),
      privacyFetch(`/api/queries?workspace_id=${ws.id}&limit=5`).then(r=>r.json()),
      privacyFetch(`/api/saved?workspace_id=${ws.id}`).then(r=>r.json()),
    ]).then(([ds,qs,sv])=>{
      setStats({datasets:Array.isArray(ds)?ds.length:0, queries:Array.isArray(qs)?qs.length:0, saved:Array.isArray(sv)?sv.length:0});
      setRecent(Array.isArray(qs)?qs.slice(0,5):[]);
    }).catch(()=>{});
  },[ws]);

  const create = async () => {
    if(!nm.trim()) return;
    setCreating(true);
    try {
      const r = await privacyFetch('/api/workspaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nm,description:nd,mode:nmode})});
      const w = await r.json();
      setWS([...workspaces,w]); setWs(w); setShowNew(false); setNm(''); setNd('');
    } finally { setCreating(false); }
  };

  const STATS = [
    {icon:'📁',l:'Datasets',v:stats.datasets,s:'Uploaded files'},
    {icon:'🔍',l:'Analyses', v:stats.queries, s:'Queries run'},
    {icon:'📌',l:'Saved',    v:stats.saved,   s:'Saved analyses'},
    {icon:'🔒',l:'Privacy',  v:'100%',        s:'Zero bytes sent'},
  ];

  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Dashboard</div>
            <h1 className="ph-title">{ws?.name||'Welcome to Privana'}</h1>
            <p className="ph-desc">{ws?.description||'Select or create a workspace to get started'}</p>
          </div>
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
            <button className="btn btn-ghost" onClick={()=>setShowNew(true)}>+ New Workspace</button>
            <button className="btn btn-primary" onClick={()=>setPage('analyze')}>🔍 Analyze Data</button>
          </div>
        </div>
      </div>

      <div className="pb">
        {/* Stats */}
        <div className="stats-row">
          {STATS.map((s,i)=>(
            <motion.div key={i} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}>
              <div style={{fontSize:'1.4rem',marginBottom:'0.2rem'}}>{s.icon}</div>
              <div className="stat-lbl" style={{ color: 'var(--t3)' }}>{s.l}</div>
              <div className="stat-val" style={{ fontSize: '1.6rem', color: 'var(--t1)', fontWeight: 800 }}>{s.v}</div>
              <div className="stat-sub" style={{ color: 'var(--t4)' }}>{s.s}</div>
            </motion.div>
          ))}
        </div>

        <div className="g2">
          {/* Workspaces */}
          <div>
            <div className="sec-row">
              <div className="sec-title" style={{ gap: '6px' }}>🗂 Workspaces</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowNew(true)}>+ New</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
              {workspaces.map((w,i)=>(
                <motion.div key={w.id} className="card card-hover" style={ws?.id===w.id?{borderColor:'var(--blue2)',background:'rgba(239, 68, 68, 0.05)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)'}:{}}
                  onClick={()=>setWs(w)} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.7rem'}}>
                    <div style={{width:9,height:9,borderRadius:'50%',background:WS_COLORS[i%WS_COLORS.length],flexShrink:0}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div className="card-title" style={{margin:0, fontSize: '0.85rem'}}>{w.name}</div>
                      <div className="card-desc" style={{margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap', fontSize: '0.72rem'}}>{w.description}</div>
                    </div>
                    <span className={`tag tag-${w.mode==='team'?'purple':'blue'}`} style={{ textTransform: 'uppercase', fontSize: '0.52rem' }}>{w.mode}</span>
                  </div>
                </motion.div>
              ))}
              {workspaces.length===0 && (
                <div className="empty"><div className="empty-icon">🗂</div><div className="empty-title">No workspaces</div><button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>Create one</button></div>
              )}
            </div>
          </div>

          {/* Recent */}
          <div>
            <div className="sec-row">
              <div className="sec-title" style={{ gap: '6px' }}>🕐 Recent Analyses</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage('history')}>View all</button>
            </div>
            {recent.length===0
              ? <div className="empty"><div className="empty-icon">🔍</div><div className="empty-title">No analyses yet</div><div className="empty-desc">Run your first analysis to see it here</div><button className="btn btn-primary btn-sm" onClick={()=>setPage('analyze')}>Start Analyzing</button></div>
              : <div className="hist-list">
                  {recent.map((q,i)=>(
                    <motion.div key={q.id} className="hist-item" style={{ border: '1.5px solid var(--rim)', borderRadius: '16px', background: 'var(--panel)', padding: '0.85rem 1rem' }} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} onClick={()=>setPage('history')}>
                      <div className="hist-q" style={{ fontSize: '0.82rem', fontWeight: 600 }}>{q.question}</div>
                      <div className="hist-meta" style={{ marginTop: '0.4rem' }}>
                        <span className={`tag tag-${q.chart_type==='line'?'cyan':q.chart_type==='pie'?'purple':'blue'}`} style={{ fontSize: '0.52rem' }}>{q.chart_type||'bar'}</span>
                        <span className="tag tag-green" style={{ fontSize: '0.52rem' }}>{q.row_count} rows</span>
                        <span style={{fontSize:'0.68rem',color:'var(--t4)',fontFamily:'var(--mono)',marginLeft:'auto'}}>{q.execution_ms}ms</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Privacy banner */}
        <motion.div style={{marginTop:'1.25rem',background:'rgba(239, 68, 68, 0.02)',border:'1px solid var(--rim)',borderRadius:16,padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap',backdropFilter:'blur(8px)'}}
          initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <div className="offline-dot" />
            <span style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--green3)',fontWeight:700}}>FULLY OFFLINE</span>
          </div>
          {['0 bytes sent to any server','All processing on your machine','DuckDB in-memory engine','Local LLM via Ollama','Ed25519 audit log active'].map((t,i)=>(
            <span key={i} style={{fontSize:'0.73rem',color:'var(--t2)',display:'flex',alignItems:'center',gap:'4px'}}><span style={{color:'var(--green2)'}}>✓</span>{t}</span>
          ))}
        </motion.div>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={()=>setShowNew(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Create Workspace</div>
            <div className="modal-desc">A workspace organizes your datasets and analyses.</div>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={nm} onChange={e=>setNm(e.target.value)} placeholder="e.g. Sales Analytics" autoFocus /></div>
            <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={nd} onChange={e=>setNd(e.target.value)} placeholder="What data does this workspace contain?" /></div>
            <div className="form-group"><label className="form-label">Mode</label>
              <select className="form-input form-select" value={nmode} onChange={e=>setNmode(e.target.value)}>
                <option value="solo">Solo — Personal workspace</option>
                <option value="team">Team — Shared workspace</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={creating||!nm.trim()}>{creating?'Creating...':'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
