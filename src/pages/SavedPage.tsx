import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Workspace, Page } from '../App';
import { useVaultStore } from '../store/useVaultStore';
import { privacyFetch } from '../infrastructure/firewall/privacyFetch';

interface P { ws:Workspace|null; activePage?:Page; }

export default function SavedPage({ ws, activePage }:P) {
  const { authMode, saved, loadSaved, deleteBookmark } = useVaultStore();
  const [loading, setLd] = useState(true);

  const load = useCallback(async () => {
    if (!ws) return;
    setLd(true);
    try {
      await loadSaved(ws.id);
    } catch (e) {
      console.error('Failed to load saved:', e);
    }
    setLd(false);
  }, [ws, loadSaved]);

  useEffect(() => { load(); }, [load]);

  // Reload when this page becomes active
  useEffect(() => {
    if (activePage === 'saved') load();
  }, [activePage, load]);

  const pin = async (item: any) => {
    if (authMode === 'solo') {
      // Toggle pin in IndexedDB
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open('privana_local_db', 2);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction('saved', 'readwrite');
      const store = tx.objectStore('saved');
      const getReq = store.get(item.id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.pinned = !record.pinned;
          store.put(record);
        }
      };
      await new Promise<void>(res => { tx.oncomplete = () => res(); });
      db.close();
      await load();
    } else {
      await privacyFetch('/api/saved', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, pinned: !item.pinned }) });
      await load();
    }
  };

  const del_ = async (id: number) => {
    try {
      await deleteBookmark(id);
    } catch (e) {
      console.error('Failed to delete bookmark:', e);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Sort: pinned items first, then by date descending
  const sorted = [...saved].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
          : sorted.length===0
          ? <div className="empty"><div className="empty-icon">📌</div><div className="empty-title">No saved analyses</div><div className="empty-desc">Save an analysis from the Analyze page to see it here</div></div>
          : <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
              {sorted.map((item,i)=>(
                <motion.div key={item.id} className="card card-hover" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                  style={item.pinned?{borderColor:'var(--blue2)',background:'rgba(239, 68, 68, 0.05)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)'}:{}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.9rem'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginBottom:'0.2rem'}}>
                        {item.pinned && <span style={{color:'var(--amber3)'}}>📌</span>}
                        <div className="card-title" style={{margin:0}}>{item.title}</div>
                      </div>
                      {item.notes && <div className="card-desc">{item.notes}</div>}
                      <div style={{marginTop:'0.45rem',display:'flex',gap:'0.35rem',flexWrap:'wrap',alignItems:'center'}}>
                        {/* Server mode: shows viq_queries join; Solo mode: shows saved query meta directly */}
                        {(item.viq_queries || item.chart_type) && (
                          <>
                            <span className={`tag tag-${(item.viq_queries?.chart_type || item.chart_type)==='line'?'cyan':(item.viq_queries?.chart_type || item.chart_type)==='pie'?'purple':'blue'}`}>
                              {item.viq_queries?.chart_type || item.chart_type || 'bar'}
                            </span>
                            {(item.viq_queries?.execution_ms != null || item.execution_ms != null) && (
                              <span className="tag tag-amber">{item.viq_queries?.execution_ms ?? item.execution_ms}ms</span>
                            )}
                            {(item.viq_queries?.row_count != null || item.row_count != null) && (
                              <span className="tag tag-green">{item.viq_queries?.row_count ?? item.row_count} rows</span>
                            )}
                          </>
                        )}
                        <span style={{fontSize:'0.65rem',color:'var(--t4)',fontFamily:'var(--mono)'}}>Saved {fmtDate(item.created_at)}</span>
                      </div>
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
