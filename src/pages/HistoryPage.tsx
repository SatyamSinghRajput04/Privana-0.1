import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Workspace, Page } from '../App';
import Chart from '../components/Chart';

interface P { ws:Workspace|null; activePage?:Page; }

export default function HistoryPage({ ws, activePage }:P) {
  const [queries, setQ]  = useState<any[]>([]);
  const [loading, setLd] = useState(true);
  const [sel,     setSel]= useState<any>(null);
  const [showSQL, setSQL]= useState(false);
  const [search,  setSch]= useState('');

  const load = useCallback(() => {
    if(!ws) return;
    setLd(true);
    privacyFetch(`/api/queries?workspace_id=${ws.id}`).then(r=>r.json()).then(d=>{ setQ(Array.isArray(d)?d:[]); setLd(false); }).catch(()=>setLd(false));
  }, [ws]);
  useEffect(load,[load]);

  // Reload when this page becomes active
  useEffect(() => {
    if (activePage === 'history') load();
  }, [activePage, load]);

  const del_ = async (id:number, e:React.MouseEvent) => {
    e.stopPropagation();
    await privacyFetch('/api/queries',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    setQ(q=>q.filter(x=>x.id!==id));
    if(sel?.id===id) setSel(null);
  };

  const fmtDate = (d:string) => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const filtered = queries.filter(q=>q.question.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Analysis History</div>
            <h1 className="ph-title">Query History</h1>
            <p className="ph-desc">All analyses you've run. Click any to re-view results.</p>
          </div>
          <span className="tag tag-blue">{queries.length} total</span>
        </div>
      </div>

      <div className="pb">
        <div style={{display:'grid',gridTemplateColumns:sel?'300px 1fr':'1fr',gap:'1.1rem',alignItems:'start'}}>
          {/* List */}
          <div>
            <input className="form-input" style={{marginBottom:'0.7rem'}} value={search} onChange={e=>setSch(e.target.value)} placeholder="Search queries..." />
            {loading
              ? <div>{[1,2,3,4].map(i=><div key={i} className="skel" style={{height:68,marginBottom:6,borderRadius:9}} />)}</div>
              : filtered.length===0
              ? <div className="empty"><div className="empty-icon">🕐</div><div className="empty-title">No queries yet</div></div>
              : <div className="hist-list">
                  {filtered.map((q,i)=>(
                    <motion.div key={q.id} className={`hist-item ${sel?.id===q.id?'sel':''}`}
                      onClick={()=>{setSel(q);setSQL(false);}} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}>
                      <div className="hist-q">{q.question}</div>
                      <div className="hist-meta">
                        <span className={`tag tag-${q.chart_type==='line'?'cyan':q.chart_type==='pie'?'purple':'blue'}`}>{q.chart_type||'bar'}</span>
                        <span className="tag tag-green">{q.row_count} rows</span>
                        <span style={{fontSize:'0.65rem',color:'var(--t4)',fontFamily:'var(--mono)',marginLeft:'auto'}}>{fmtDate(q.created_at)}</span>
                        <button className="btn btn-red btn-xs" onClick={e=>del_(q.id,e)}>✕</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
            }
          </div>

          {/* Detail */}
          {sel && (
            <motion.div className="result-wrap" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}}>
              <div className="result-hdr">
                <div className="result-q">"{sel.question}"</div>
                <div className="result-meta">
                  <span className={`tag tag-${sel.chart_type==='line'?'cyan':sel.chart_type==='pie'?'purple':'blue'}`}>{sel.chart_type}</span>
                  <span className="tag tag-green">{sel.row_count} rows</span>
                  <span className="tag tag-amber">{sel.execution_ms}ms</span>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setSQL(s=>!s)}>SQL</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setSel(null)}>✕</button>
                </div>
              </div>
              {showSQL && sel.generated_sql && (
                <div className="sql-panel"><div className="panel-lbl">SQL</div><div className="code-block">{sel.generated_sql}</div></div>
              )}
              {sel.result_data && Array.isArray(sel.result_data) && sel.result_data.length>0 && (
                <div className="chart-panel"><div className="panel-lbl">Chart</div><Chart data={sel.result_data} type={sel.chart_type||'bar'} /></div>
              )}
              {sel.insights && Array.isArray(sel.insights) && sel.insights.length>0 && (
                <div className="insights-panel"><div className="panel-lbl">🧠 Insights</div>{sel.insights.map((ins:string,i:number)=><div key={i} className="insight-row">{ins}</div>)}</div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
