import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Workspace, Page } from '../App';
import Chart from '../components/Chart';
import { loadCSV, registerTable, executeSQL, getSqlTableName, generateLocalQuery, generateInsights, getTableSchema, isTableLoaded, getTableRowCount } from '../lib/sqlEngine';
import type { ColumnInfo } from '../lib/sqlEngine';

interface P { ws:Workspace|null; setPage:(p:Page)=>void; }

interface ChatMessage {
  id: string;
  question: string;
  sql: string;
  chartType: string;
  data: any[];
  rowCount: number;
  insights: string[];
  executionMs: number;
  intent: string;
  error?: string;
  queryId?: number;      // ID from viq_queries after auto-save
  savedAt?: string;      // timestamp when bookmarked
}

const SUGGESTIONS = [
  'Which platform_usage is most common?',
  'Show the count by gender',
  'What is the average age?',
  'Show breakdown by social_interaction',
  'Which gender has the highest stress_level?',
  'Show top 5 by anxiety_level',
  'Count by platform_usage',
  'Show me average sleep_hours by gender',
];

// Pre-seed sample datasets
const seedSamples = () => {
  if (isTableLoaded('sales_2024.csv')) return; // already seeded
  const sales = Array.from({ length: 150 }, (_, i) => ({
    region: ['North', 'East', 'South', 'West'][i % 4],
    category: ['Electronics', 'Furniture', 'Clothing', 'Office Supplies'][i % 4],
    revenue: Math.round(Math.random() * 5000 + 800 + (i % 4 === 1 ? 1200 : 0)),
    profit: Math.round((Math.random() * 5000 + 800) * (0.15 + (i % 4 === 0 ? 0.15 : 0.02))),
    date: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`
  }));
  registerTable('sales_2024.csv', sales);
};

export default function AnalyzePage({ ws, setPage }:P) {
  const [datasets, setDs] = useState<any[]>([]);
  const [selDs, setSelDs] = useState<any>(null);
  const [q, setQ] = useState('');
  const [loading, setLoad] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [showFields, setShowFields] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { seedSamples(); }, []);

  useEffect(() => {
    if(!ws) return;
    fetch(`/api/datasets?workspace_id=${ws.id}`)
      .then(r=>r.json())
      .then(d=>{
        if(Array.isArray(d)){ setDs(d); if(d.length && !selDs) setSelDs(d[0]); }
      })
      .catch(()=>{});
  },[ws]);

  // Check if dataset data is loaded in AlaSQL + update schema
  // Auto-load from localStorage if available
  useEffect(() => {
    if (!selDs) { setSchema([]); setDataLoaded(false); return; }

    const loaded = isTableLoaded(selDs.name);

    if (loaded) {
      setDataLoaded(true);
      const s = getTableSchema(selDs.name);
      if (s.length > 0) { setSchema(s); return; }
    }

    // NOT loaded — try auto-loading from localStorage
    if (!loaded) {
      const cachedCSV = localStorage.getItem('viq_csv_' + selDs.name);
      if (cachedCSV) {
        loadCSV(selDs.name, cachedCSV).then(() => {
          setDataLoaded(true);
          const s = getTableSchema(selDs.name);
          if (s.length > 0) setSchema(s);
        }).catch(() => {
          setDataLoaded(false);
        });
        return; // loadCSV is async, will update state when done
      }
    }

    // Fallback: build schema from columns_meta stored in Supabase
    setDataLoaded(false);
    const meta = selDs.columns_meta || [];
    setSchema(meta.map((c: any) => ({
      name: c.name,
      type: ['DECIMAL','INTEGER','BIGINT','FLOAT','NUMERIC'].includes(c.type?.toUpperCase()) ? 'number' as const : 'string' as const,
      sample: null
    })));
  }, [selDs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle CSV file load into AlaSQL memory
  const handleLoadCSV = (f: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const name = selDs?.name || f.name;
        await loadCSV(name, text);
        // Cache in localStorage for auto-load next time
        try { localStorage.setItem('viq_csv_' + name, text); } catch { /* storage full */ }
        setDataLoaded(true);
        const s = getTableSchema(name);
        if (s.length > 0) setSchema(s);
      } catch (err: any) {
        alert(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(f);
  };

  const run = async () => {
    if(!q.trim()||!ws) return;
    const currentQuestion = q;
    setQ('');
    setLoad(true);

    try {
      const start = performance.now();
      let finalData: any[] = [];
      let sql = '';
      let chartType = 'bar';
      let intent = 'unknown';
      let runtime = 0;

      // PRIMARY PATH: Local SQL execution against real data
      if (selDs && isTableLoaded(selDs.name)) {
        const query = generateLocalQuery(currentQuestion, selDs.name);
        sql = query.sql;
        chartType = query.chartType;
        intent = query.intent;

        try {
          finalData = executeSQL(sql);
          runtime = Math.round(performance.now() - start);
        } catch (localErr: any) {
          console.warn('Local SQL failed:', localErr.message);
        }
      }

      // FALLBACK: backend (but will still show fake data)
      if (finalData.length === 0) {
        try {
          const r = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: currentQuestion,
              dataset_id: selDs?.id,
              workspace_id: ws.id
            })
          });
          const d = await r.json();
          if (r.ok && d.data?.length > 0) {
            finalData = d.data;
            sql = sql || d.sql;
            chartType = d.chartType || chartType;
            intent = d.intent || intent;
            runtime = Math.round(performance.now() - start);
          }
        } catch { /* backend also failed */ }
      }

      if (finalData.length === 0) {
        throw new Error(
          !isTableLoaded(selDs?.name || '')
            ? 'CSV data is not loaded into memory. Please drop your CSV file on the "Load Data" zone above to enable local querying.'
            : 'Query returned no results. Try rephrasing your question.'
        );
      }

      const insights = generateInsights(finalData, intent);

      const msgId = Math.random().toString(36).substring(2, 9);
      const newMessage: ChatMessage = {
        id: msgId,
        question: currentQuestion,
        sql, chartType, intent,
        data: finalData,
        rowCount: finalData.length,
        insights,
        executionMs: runtime
      };
      setMessages(prev => [...prev, newMessage]);

      // Auto-save to history (fire-and-forget)
      try {
        const histRes = await fetch('/api/queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: ws.id,
            dataset_id: selDs?.id || null,
            question: currentQuestion,
            generated_sql: sql,
            result_data: finalData.slice(0, 50),
            chart_type: chartType,
            chart_config: {},
            insights,
            execution_ms: runtime,
            row_count: finalData.length
          })
        });
        const histData = await histRes.json();
        if (histData?.id) {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, queryId: histData.id } : m
          ));
        }
      } catch { /* history save failed silently */ }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        question: currentQuestion,
        sql: '', chartType: 'none', intent: 'error',
        data: [], rowCount: 0, insights: [],
        executionMs: 0, error: e.message
      }]);
    } finally {
      setLoad(false);
    }
  };

  // Bookmark/Save a query result
  const saveToBookmarks = async (msg: ChatMessage) => {
    if (!ws || savedIds.has(msg.id)) return;
    try {
      let qid = msg.queryId;

      // If no queryId yet, save to history first
      if (!qid) {
        const histRes = await fetch('/api/queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: ws.id,
            dataset_id: selDs?.id || null,
            question: msg.question,
            generated_sql: msg.sql,
            result_data: msg.data.slice(0, 50),
            chart_type: msg.chartType,
            chart_config: {},
            insights: msg.insights,
            execution_ms: msg.executionMs,
            row_count: msg.rowCount
          })
        });
        const histData = await histRes.json();
        if (histData?.id) {
          qid = histData.id;
          setMessages(prev => prev.map(m =>
            m.id === msg.id ? { ...m, queryId: qid } : m
          ));
        }
      }

      // Now save the bookmark
      const saveRes = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: ws.id,
          title: msg.question,
          query_id: qid || null,
          notes: `Chart: ${msg.chartType} | ${msg.rowCount} rows | ${msg.executionMs}ms`
        })
      });

      if (saveRes.ok) {
        setSavedIds(prev => new Set(prev).add(msg.id));
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, savedAt: new Date().toISOString() } : m
        ));
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const dsIcon = (t:string) => t==='parquet'?'🟧':t==='xlsx'?'🟩':t==='json'?'🟨':'📄';
  const totalRows = selDs ? getTableRowCount(selDs.name) || selDs.row_count || 0 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>

      {/* Power BI Ribbon */}
      <div className="pbi-ribbon">
        <div className="pbi-ribbon-left">
          <span className="pbi-ribbon-logo">V</span>
          <div className="pbi-ribbon-tabs">
            <button className="pbi-tab active">Report</button>
            <button className="pbi-tab" onClick={()=>setPage('datasets')}>Data</button>
            <button className="pbi-tab" onClick={()=>setPage('settings')}>Model</button>
          </div>
        </div>
        <div className="pbi-ribbon-center">
          {selDs && (
            <div className="pbi-dataset-pill">
              <span>{dsIcon(selDs.file_type)}</span>
              <span style={{fontWeight:700}}>{selDs.name}</span>
              <span className="pbi-pill-meta">{totalRows.toLocaleString()} rows</span>
              {dataLoaded
                ? <span className="pbi-pill-live">● LIVE</span>
                : <span style={{fontFamily:'var(--mono)',fontSize:'0.55rem',color:'var(--amber3)',fontWeight:700}}>⚠ NOT LOADED</span>
              }
            </div>
          )}
        </div>
        <div className="pbi-ribbon-right">
          <button className="pbi-btn" onClick={()=>setShowFields(f=>!f)}>{showFields ? 'Hide' : 'Show'} Fields</button>
          <div className="pbi-privacy-badge">🔒 0 bytes sent</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Canvas */}
        <div className="pbi-canvas">

          {/* Dataset selector strip */}
          {datasets.length > 0 && (
            <div className="pbi-ds-strip">
              {datasets.map(ds => (
                <button key={ds.id}
                  className={`pbi-ds-chip ${selDs?.id===ds.id ? 'active' : ''}`}
                  onClick={() => setSelDs(ds)}>
                  {dsIcon(ds.file_type)} {ds.name}
                  {isTableLoaded(ds.name) && <span style={{color:'var(--green3)',marginLeft:4}}>●</span>}
                </button>
              ))}
            </div>
          )}

          {/* DATA LOAD ZONE — shown when CSV data not in memory */}
          {selDs && !dataLoaded && (
            <div
              className="pbi-load-zone"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleLoadCSV(f); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLoadCSV(f); }} />
              <div style={{fontSize:'1.5rem'}}>📁</div>
              <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--amber3)'}}>
                CSV data not in memory — Drop your file here to load it
              </div>
              <div style={{fontSize:'0.68rem',color:'var(--t4)',maxWidth:400}}>
                Drop <strong>{selDs.name}</strong> here to enable accurate local SQL queries. The file stays on your machine — 0 bytes leave your laptop.
              </div>
            </div>
          )}

          {/* Success indicator when data loaded */}
          {selDs && dataLoaded && (
            <div className="pbi-loaded-banner">
              ✅ <strong>{selDs.name}</strong> loaded in local DB — {totalRows.toLocaleString()} rows · {schema.length} columns · Ready for queries
            </div>
          )}

          {/* Query input */}
          <div className="pbi-query-section">
            <div className="pbi-query-bar">
              <textarea ref={taRef} className="pbi-query-input" value={q}
                onChange={e=>setQ(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); run(); }}}
                placeholder={selDs ? (dataLoaded ? `Ask about ${selDs.name}...` : 'Load your CSV first (drop above)...') : 'Select a dataset to begin...'}
                disabled={!selDs||loading} rows={1} />
              <button className="pbi-run-btn" onClick={run} disabled={!q.trim()||!selDs||loading}>
                {loading ? '⏳' : '▶'} {loading ? 'Running...' : 'Run'}
              </button>
            </div>
            <div className="pbi-suggestions">
              {SUGGESTIONS.map((s,i) => (
                <button key={i} className="pbi-suggest-chip" disabled={!selDs||loading} onClick={()=>setQ(s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Results area */}
          <div className="pbi-results-scroll">
            {messages.length === 0 && !loading ? (
              <div className="pbi-empty">
                <div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📊</div>
                <div style={{fontWeight:700,fontSize:'1rem',marginBottom:4}}>Power BI-Style Analytics</div>
                <div style={{fontSize:'0.75rem',color:'var(--t3)',maxWidth:340}}>
                  {dataLoaded
                    ? 'Your data is loaded! Type a question or click a suggestion to start analyzing.'
                    : 'Drop your CSV file above to load it, then ask questions about your data.'
                  }
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div key={msg.id} className="pbi-result-card"
                  initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>

                  <div className="pbi-result-header">
                    <div className="pbi-result-question">
                      <span className="pbi-q-icon">Q</span>
                      {msg.question}
                    </div>
                    <div className="pbi-result-badges">
                      <span className="pbi-badge pbi-badge-green">🔒 Local DB</span>
                      <span className="pbi-badge pbi-badge-blue">{msg.rowCount} rows</span>
                      <span className="pbi-badge pbi-badge-amber">{msg.executionMs}ms</span>
                      <span className="pbi-badge pbi-badge-purple">{msg.intent}</span>
                      {!msg.error && (
                        <button
                          className={`pbi-save-btn ${msg.savedAt ? 'saved' : ''}`}
                          onClick={() => saveToBookmarks(msg)}
                          disabled={!!msg.savedAt}
                          title={msg.savedAt ? 'Saved to bookmarks' : 'Save to bookmarks'}
                        >
                          {msg.savedAt ? '★ Saved' : '☆ Save'}
                        </button>
                      )}
                      {msg.queryId && <span className="pbi-badge pbi-badge-green" style={{fontSize:'0.48rem'}}>✓ in history</span>}
                    </div>
                  </div>

                  {msg.error ? (
                    <div className="pbi-error">⚠️ {msg.error}</div>
                  ) : (
                    <>
                      {/* KPI Cards */}
                      {msg.data.length > 0 && (() => {
                        const keys = Object.keys(msg.data[0]);
                        const numK = keys.filter(k => typeof msg.data[0][k] === 'number');
                        if (!numK.length) return null;
                        const vk = numK[0];
                        const total = msg.data.reduce((s,r) => s + (r[vk]||0), 0);
                        const avg = total / msg.data.length;
                        const max = Math.max(...msg.data.map(r => r[vk]||0));
                        return (
                          <div className="pbi-kpi-row">
                            <div className="pbi-kpi"><div className="pbi-kpi-label">Total ({vk})</div><div className="pbi-kpi-value">{total.toLocaleString()}</div></div>
                            <div className="pbi-kpi"><div className="pbi-kpi-label">Average</div><div className="pbi-kpi-value">{Math.round(avg).toLocaleString()}</div></div>
                            <div className="pbi-kpi"><div className="pbi-kpi-label">Max</div><div className="pbi-kpi-value">{max.toLocaleString()}</div></div>
                            <div className="pbi-kpi"><div className="pbi-kpi-label">Records</div><div className="pbi-kpi-value">{msg.rowCount}</div></div>
                          </div>
                        );
                      })()}

                      {/* Viz + Table Grid */}
                      <div className="pbi-viz-grid">
                        <div className="pbi-viz-tile">
                          <div className="pbi-tile-header">
                            <span>📊 Visualization</span>
                            <span className="pbi-tile-type">{msg.chartType}</span>
                          </div>
                          <div style={{height:220,padding:'0.5rem'}}>
                            <Chart data={msg.data} type={msg.chartType} />
                          </div>
                        </div>
                        <div className="pbi-viz-tile">
                          <div className="pbi-tile-header">
                            <span>📋 Data Grid</span>
                            <span className="pbi-tile-type">{msg.data.length} rows</span>
                          </div>
                          <div className="pbi-table-wrap">
                            <table className="pbi-table">
                              <thead>
                                <tr>{Object.keys(msg.data[0]||{}).map(k => <th key={k}>{k}</th>)}</tr>
                              </thead>
                              <tbody>
                                {msg.data.slice(0,15).map((row,idx) => (
                                  <tr key={idx}>
                                    {Object.values(row).map((val: any, ci) => (
                                      <td key={ci}>{typeof val === 'number' ? val.toLocaleString() : String(val ?? '')}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* SQL */}
                      <details className="pbi-sql-details">
                        <summary className="pbi-sql-summary">⚙️ Generated SQL</summary>
                        <pre className="pbi-sql-code">{msg.sql}</pre>
                      </details>

                      {/* Insights */}
                      {msg.insights.length > 0 && (
                        <div className="pbi-insights">
                          <div className="pbi-insights-title">💡 Key Insights</div>
                          {msg.insights.map((ins, i) => (
                            <div key={i} className="pbi-insight-row">{ins}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ))
            )}
            {loading && (
              <div className="pbi-loading">
                <div className="dots"><div className="dot"/><div className="dot"/><div className="dot"/></div>
                <span>Executing local SQL query...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Fields Pane */}
        <AnimatePresence>
        {showFields && (
          <motion.div className="pbi-fields-pane"
            initial={{width:0,opacity:0}} animate={{width:220,opacity:1}} exit={{width:0,opacity:0}}>
            <div className="pbi-fields-header">Fields</div>
            <div className="pbi-fields-dataset">
              {selDs ? `📁 ${selDs.name}` : 'No dataset'}
              {dataLoaded && <span style={{color:'var(--green3)',marginLeft:6,fontSize:'0.55rem'}}>● loaded</span>}
            </div>
            <div className="pbi-fields-list">
              {schema.map(col => (
                <div key={col.name} className="pbi-field-item"
                  onClick={() => setQ(prev => prev ? `${prev} ${col.name}` : col.name)}>
                  <span className={`pbi-field-icon ${col.type === 'number' ? 'num' : col.type === 'date' ? 'date' : 'str'}`}>
                    {col.type === 'number' ? 'Σ' : col.type === 'date' ? '📅' : 'Aa'}
                  </span>
                  <span className="pbi-field-name">{col.name}</span>
                </div>
              ))}
              {schema.length === 0 && (
                <div style={{padding:'1rem',fontSize:'0.7rem',color:'var(--t4)',textAlign:'center'}}>
                  Upload a CSV to see fields
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
