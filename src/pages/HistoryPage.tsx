import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Workspace, Page } from '../App';
import UnifiedChart from '../components/UnifiedChart';
import { useVaultStore } from '../store/useVaultStore';
import { privacyFetch } from '../infrastructure/firewall/privacyFetch';

interface P { ws:Workspace|null; activePage?:Page; }

export default function HistoryPage({ ws, activePage }:P) {
  const { authMode, queries, loadQueries } = useVaultStore();
  const [loading, setLd] = useState(true);
  const [sel,     setSel]= useState<any>(null);
  const [showSQL, setSQL]= useState(false);
  const [search,  setSch]= useState('');

  const load = useCallback(async () => {
    if (!ws) return;
    setLd(true);
    try {
      await loadQueries(ws.id);
    } catch (e) {
      console.error('Failed to load queries:', e);
    }
    setLd(false);
  }, [ws, loadQueries]);

  useEffect(() => { load(); }, [load]);

  // Reload when this page becomes active
  useEffect(() => {
    if (activePage === 'history') load();
  }, [activePage, load]);

  const del_ = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (authMode === 'solo') {
      // Delete directly from IndexedDB
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open('privana_local_db', 2);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction('queries', 'readwrite');
      tx.objectStore('queries').delete(id);
      // Reload after delete
      await new Promise<void>(res => { tx.oncomplete = () => res(); });
      db.close();
      await load();
    } else {
      await privacyFetch('/api/queries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      await load();
    }
    if (sel?.id === id) setSel(null);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const filtered = queries.filter(q => q.question?.toLowerCase().includes(search.toLowerCase()));

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
              ? <div className="empty"><div className="empty-icon">🕐</div><div className="empty-title">{queries.length === 0 ? 'No queries yet' : 'No matching queries'}</div><div className="empty-desc">{queries.length === 0 ? 'Run a query in the Analyze page to see it here' : 'Try a different search term'}</div></div>
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
                <div className="chart-panel">
                  <div className="panel-lbl">Chart</div>
                  <UnifiedChart
                    data={sel.result_data}
                    chartType={sel.chart_type||'bar'}
                    xAxisKey={sel.x_axis_key}
                    yAxisKey={sel.y_axis_key}
                    title={sel.chart_title}
                  />
                </div>
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
