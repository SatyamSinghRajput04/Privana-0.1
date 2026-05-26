import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Workspace, Page } from '../App';

interface P { ws:Workspace|null; activePage?:Page; }

export default function SavedPage({ ws, activePage }:P) {
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLd]  = useState(true);

  const load = useCallback(() => {
    if(!ws) return;
    setLd(true);
    privacyFetch(`/api/saved?workspace_id=${ws.id}`).then(r=>r.json()).then(d=>{ setSaved(Array.isArray(d)?d:[]); setLd(false); }).catch(()=>setLd(false));
  }, [ws]);
  useEffect(load,[load]);

  // Reload when this page becomes active
  useEffect(() => {
    if (activePage === 'saved') load();
  }, [activePage, load]);

  const pin = async (item:any) => {
    await privacyFetch('/api/saved',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,pinned:!item.pinned})});
    load();
  };
  const del_ = async (id:number) => {
    await privacyFetch('/api/saved',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    setSaved(s=>s.filter(x=>x.id!==id));
  };

  const fmtDate = (d:string) => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Saved Analyses</div>
            <h1 className="ph-title">Saved</h1>
            <p className="ph-desc">Pinned and saved analyses for quick access and sharing.</p>
          </div>
          <span className="tag tag-blue">{saved.length} saved</span>
        </div>
      </div>

      <div className="pb">
        {loading
          ? <div>{[1,2,3].map(i=><div key={i} className="skel" style={{height:76,marginBottom:8,borderRadius:11}} />)}</div>
          : saved.length===0
          ? <div className="empty"><div className="empty-icon">📌</div><div className="empty-title">No saved analyses</div><div className="empty-desc">Save an analysis from the Analyze page to see it here</div></div>
          : <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
              {saved.map((item,i)=>(
                <motion.div key={item.id} className="card card-hover" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                  style={item.pinned?{borderColor:'var(--blue2)',background:'rgba(239, 68, 68, 0.05)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)'}:{}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.9rem'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginBottom:'0.2rem'}}>
                        {item.pinned && <span style={{color:'var(--amber3)'}}>📌</span>}
                        <div className="card-title" style={{margin:0}}>{item.title}</div>
                      </div>
                      {item.notes && <div className="card-desc">{item.notes}</div>}
                      {item.viq_queries && (
                        <div style={{marginTop:'0.45rem',display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
                          <span className={`tag tag-${item.viq_queries.chart_type==='line'?'cyan':item.viq_queries.chart_type==='pie'?'purple':'blue'}`}>{item.viq_queries.chart_type||'bar'}</span>
                          <span className="tag tag-amber">{item.viq_queries.execution_ms}ms</span>
                          <span style={{fontSize:'0.65rem',color:'var(--t4)',fontFamily:'var(--mono)'}}>Saved {fmtDate(item.created_at)}</span>
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:'0.35rem',flexShrink:0}}>
                      <button className="btn btn-ghost btn-xs" onClick={()=>pin(item)}>{item.pinned?'Unpin':'📌 Pin'}</button>
                      <button className="btn btn-red btn-xs" onClick={()=>del_(item.id)}>✕</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
