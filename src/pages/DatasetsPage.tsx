import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Page } from '../App';
import { loadCSV, loadJSON, setTableOwner, registerDuckDBFile, getSqlTableName, setDuckDBSample, normalizeDuckDBType } from '../lib/sqlEngine';
import { getDuckDBConnection } from '../domain/compute/duckdb/duckdbWorker';
import { DatasetValidator } from '../domain/validator/validator';
import { useVaultStore } from '../store/useVaultStore';
import { localDB } from '../lib/indexedDb';

interface P { 
  setPage: (p: Page) => void; 
}

const SAMPLES = [
  { name: 'Teen_Mental_Health_Dataset.csv', type: 'csv', rows: 1200, cols: 8, size: 45056 },
  { name: 'sales_2024.csv', type: 'csv', rows: 150, cols: 5, size: 8192 },
  { name: 'customers.csv', type: 'csv', rows: 200, cols: 5, size: 10240 },
  { name: 'claims_data.csv', type: 'csv', rows: 120, cols: 5, size: 6144 }
];

const FT = [
  { ext: 'csv', icon: '📄', color: 'blue' },
  { ext: 'parquet', icon: '🟧', color: 'amber' },
  { ext: 'xlsx', icon: '🟩', color: 'green' },
  { ext: 'json', icon: '🟨', color: 'amber' }
];

const dsIcon = (t: string) => FT.find(f => f.ext === t)?.icon || '📄';
const dsColor = (t: string) => FT.find(f => f.ext === t)?.color || 'blue';
const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

const getSampleColumns = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('teen')) {
    return [
      { name: 'age', type: 'INTEGER', is_he: false },
      { name: 'gender', type: 'VARCHAR', is_he: false },
      { name: 'sleep_hours', type: 'DECIMAL', is_he: false },
      { name: 'platform_usage', type: 'VARCHAR', is_he: false },
      { name: 'stress_level', type: 'INTEGER', is_he: false },
      { name: 'anxiety_level', type: 'INTEGER', is_he: false },
      { name: 'screen_time_before_sleep', type: 'DECIMAL', is_he: false },
      { name: 'depression_label', type: 'VARCHAR', is_he: false },
    ];
  }
  if (n.includes('sales')) {
    return [
      { name: 'region', type: 'VARCHAR', is_he: false },
      { name: 'category', type: 'VARCHAR', is_he: false },
      { name: 'revenue', type: 'DECIMAL', is_he: false },
      { name: 'profit', type: 'DECIMAL', is_he: false },
      { name: 'date', type: 'DATE', is_he: false },
    ];
  }
  if (n.includes('customer')) {
    return [
      { name: 'name', type: 'VARCHAR', is_he: false },
      { name: 'email', type: 'VARCHAR', is_he: false },
      { name: 'spend', type: 'DECIMAL', is_he: false },
      { name: 'country', type: 'VARCHAR', is_he: false },
      { name: 'created_at', type: 'DATE', is_he: false },
    ];
  }
  if (n.includes('claim')) {
    return [
      { name: 'claim_id', type: 'INTEGER', is_he: false },
      { name: 'policy_type', type: 'VARCHAR', is_he: false },
      { name: 'claim_amount', type: 'DECIMAL', is_he: false },
      { name: 'status', type: 'VARCHAR', is_he: false },
      { name: 'date', type: 'DATE', is_he: false },
    ];
  }
  return [
    { name: 'value', type: 'DECIMAL', is_he: false },
    { name: 'count', type: 'INTEGER', is_he: false },
    { name: 'category', type: 'VARCHAR', is_he: false },
    { name: 'date', type: 'DATE', is_he: false },
  ];
};

// Polyfill BigInt JSON serialization so JSON.stringify never crashes on BigInts
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    const n = Number(this);
    return Number.isSafeInteger(n) ? n : this.toString();
  };
}

/**
 * Safely converts an Apache Arrow Table into an array of plain JavaScript objects,
 * guaranteeing BigInt values are converted to safe numbers/strings without throwing.
 */
function arrowTableToPlainObjects(table: any): any[] {
  if (!table || !table.numRows) return [];
  const fields = table.schema?.fields?.map((f: any) => f.name) || [];
  const rows: any[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const rowObj: Record<string, any> = {};
    for (const field of fields) {
      const val = table.getChild(field)?.get(i);
      if (typeof val === 'bigint') {
        rowObj[field] = (val <= Number.MAX_SAFE_INTEGER && val >= Number.MIN_SAFE_INTEGER)
          ? Number(val)
          : val.toString();
      } else {
        rowObj[field] = val;
      }
    }
    rows.push(rowObj);
  }
  return rows;
}

export default function DatasetsPage({ setPage }: P) {
  const { 
    ws, 
    datasets, 
    selectedDataset, 
    authMode,
    setSelectedDataset,
    loadDatasets,
    registerDataset,
    deleteDataset
  } = useVaultStore();

  const [loading, setLd] = useState(true);
  const [uploading, setUpl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [del, setDel] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ws) {
      setLd(true);
      loadDatasets(ws.id).finally(() => setLd(false));
    }
  }, [ws, loadDatasets]);

  const uploadSample = async (name: string, type: string, rows: number, cols: number, size: number) => {
    if (!ws) return;
    setUpl(true);
    try {
      const finalCols = getSampleColumns(name);
      let sampleData: any[] = [];

      if (name.toLowerCase().includes('teen')) {
        const { generateTeenMentalHealthDatasetCSV } = await import('../lib/datasetSeeder');
        const csvHeader = generateTeenMentalHealthDatasetCSV();
        
        // Register dataset in state/DB
        const d = await registerDataset(name, type, rows, cols, size, finalCols);
        setTableOwner(name, d.id);
        
        // Save data in IndexedDB
        await localDB.saveDatasetCSV(name, csvHeader);
        await localDB.saveDatasetBlob(name, new Blob([csvHeader], { type: 'text/csv' }), d.id, rows);
        
        if (!selectedDataset) setSelectedDataset(d);
        await loadDatasets(ws.id);
      } else {
        // Generic sample data generation
        sampleData = Array.from({ length: rows }, (_, i) => {
          const item: Record<string, any> = {};
          finalCols.forEach(col => {
            if (col.type === 'DECIMAL' || col.type === 'INTEGER') {
              item[col.name] = Math.round(Math.random() * 5000 + 200);
            } else if (col.type === 'DATE') {
              item[col.name] = `2024-${String((i % 12) + 1).padStart(2, '0')}-15`;
            } else {
              item[col.name] = ['Item A', 'Item B', 'Item C', 'Item D'][i % 4];
            }
          });
          return item;
        });

        // Register dataset in state/DB
        const d = await registerDataset(name, type, rows, cols, size, finalCols);
        setTableOwner(name, d.id);
        
        // Save data in IndexedDB
        const csvStr = sampleData.map(r => Object.values(r).join(',')).join('\n');
        const csvHeader = Object.keys(sampleData[0]).join(',') + '\n' + csvStr;
        await localDB.saveDatasetCSV(name, csvHeader);
        await localDB.saveDatasetBlob(name, new Blob([csvHeader], { type: 'text/csv' }), d.id, rows);
        
        if (!selectedDataset) setSelectedDataset(d);
        await loadDatasets(ws.id);
      }
    } catch (e: any) {
      alert(`Failed to load sample: ${e.message}`);
    } finally {
      setUpl(false);
    }
  };

  const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB strict cap

  const handleFile = async (f: File) => {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      alert(`File "${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum browser memory limit of 100 MB.\n\nPlease upload a file smaller than 100 MB.`);
      return;
    }

    try {
      setUpl(true);
      setUploadProgress(0);
      // Yield control to browser rendering loop so UI spinner displays immediately
      await new Promise(r => setTimeout(r, 20));

      const isJson = f.name.toLowerCase().endsWith('.json');
      let realColsMeta: any[] = [];
      let totalRowCount = 0;
      let sampleRows: any[] = [];

      if (isJson) {
        const rawText = await f.text();
        const parsedRows = loadJSON(f.name, rawText);
        totalRowCount = parsedRows.length;
        sampleRows = parsedRows.slice(0, 50);

        const profile = DatasetValidator.profile(parsedRows, f.name);
        if (profile.shape === 'metadata') {
          throw new Error(
            `"${f.name}" appears to be a dataset metadata / descriptor file. ` +
            `This file describes the dataset but contains NO actual data rows.\n\n` +
            `Please upload the real records dataset instead.`
          );
        }
        if (profile.shape === 'corrupted' || profile.shape === 'empty') {
          throw new Error(`Failed to load dataset: File is empty or has a corrupted shape.`);
        }

        realColsMeta = parsedRows.length > 0
          ? Object.keys(parsedRows[0]).map(colName => {
              const samples = parsedRows.slice(0, 10).map(r => r[colName]).filter(v => v != null && v !== '');
              const numCount = samples.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))).length;
              let colType = 'VARCHAR';
              if (numCount > samples.length * 0.6) {
                const firstNum = samples.find(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))));
                colType = firstNum !== undefined && Number.isInteger(Number(firstNum)) ? 'INTEGER' : 'DECIMAL';
              }
              return { name: colName, type: colType, is_he: false };
            })
          : getSampleColumns(f.name);

        if (f.size <= 20 * 1024 * 1024) {
          await localDB.saveDatasetCSV(f.name, rawText);
        }
      } else {
        // Zero-Heap DuckDB Ingestion for CSV / Parquet / Tabular files
        try {
          // 1. Register native File handle into DuckDB VFS (Streaming, zero main-thread string copy)
          await registerDuckDBFile(f.name, f);
          const conn = await getDuckDBConnection();
          const tbl = getSqlTableName(f.name);

          // 2. Query DuckDB directly for column schema, exact row count, and 50-row micro-sample
          const descRes = await conn.query(`DESCRIBE "${tbl}";`);
          const descRows = arrowTableToPlainObjects(descRes);

          const countRes = await conn.query(`SELECT COUNT(*)::BIGINT AS total FROM "${tbl}";`);
          const rawTotal = countRes.getChild('total')?.get(0);
          totalRowCount = typeof rawTotal === 'bigint' ? Number(rawTotal) : Number(rawTotal ?? 0);

          const previewRes = await conn.query(`SELECT * FROM "${tbl}" LIMIT 50;`);
          sampleRows = arrowTableToPlainObjects(previewRes);

          // 3. Profile and validate dataset shape/integrity on 50-row sample (< 1ms)
          const profile = DatasetValidator.profile(sampleRows, f.name);
          if (profile.shape === 'metadata') {
            throw new Error(
              `"${f.name}" appears to be a dataset metadata / descriptor file. ` +
              `This file describes the dataset but contains NO actual data rows.\n\n` +
              `Please upload the real records dataset instead.`
            );
          }
          if (profile.shape === 'corrupted' || (profile.shape === 'empty' && totalRowCount === 0)) {
            throw new Error(`Failed to load dataset: File is empty or has a corrupted shape.`);
          }

          // 4. Derive normalized columns metadata
          realColsMeta = descRows.map((col: any) => {
            const colName = String(col.column_name);
            const rawType = String(col.column_type);
            const normalizedType = normalizeDuckDBType(rawType);
            return { name: colName, type: normalizedType, is_he: false };
          });

          // 5. Store bounded sample in sqlEngine for metadata bridges
          setDuckDBSample(f.name, sampleRows, totalRowCount, realColsMeta);

          // 6. Save complete File binary in IndexedDB for deterministic hydration & full-dataset analytics
          await localDB.saveDatasetBlob(f.name, f, undefined, totalRowCount);
        } catch (duckErr: any) {
          console.warn('[DatasetsPage] DuckDB VFS ingestion failed:', duckErr);
          // If a file is over 20MB, NEVER fall back to PapaParse on the main thread!
          if (f.size > 20 * 1024 * 1024) {
            throw new Error(
              `DuckDB could not stream "${f.name}": ${duckErr.message || duckErr}. ` +
              `Main-thread fallback is disabled for files over 20MB to prevent browser freezing.`
            );
          }
          // Only small files (< 20MB) may use the fallback
          const parsedRows = await loadCSV(f.name, f, (frac) => setUploadProgress(frac));
          totalRowCount = parsedRows.length;
          sampleRows = parsedRows.slice(0, 50);

          const profile = DatasetValidator.profile(parsedRows, f.name);
          if (profile.shape === 'metadata') {
            throw new Error(`"${f.name}" appears to be a dataset metadata / descriptor file.`);
          }
          if (profile.shape === 'corrupted' || profile.shape === 'empty') {
            throw new Error(`Failed to load dataset: File is empty or has a corrupted shape.`);
          }

          realColsMeta = parsedRows.length > 0
            ? Object.keys(parsedRows[0]).map(colName => {
                const samples = parsedRows.slice(0, 10).map(r => r[colName]).filter(v => v != null && v !== '');
                const numCount = samples.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))).length;
                let colType = 'VARCHAR';
                if (numCount > samples.length * 0.6) {
                  const firstNum = samples.find(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))));
                  colType = firstNum !== undefined && Number.isInteger(Number(firstNum)) ? 'INTEGER' : 'DECIMAL';
                }
                return { name: colName, type: colType, is_he: false };
              })
            : getSampleColumns(f.name);
        }
      }

      const d = await registerDataset(f.name, f.name.split('.').pop() || 'csv', totalRowCount, realColsMeta.length, f.size, realColsMeta);
      setTableOwner(f.name, d.id);
      await localDB.saveDatasetBlob(f.name, f, d.id, totalRowCount);
      if (!selectedDataset) setSelectedDataset(d);
      await loadDatasets(ws!.id);
    } catch (err: any) {
      alert(`Failed to load dataset: ${err.message}`);
    } finally {
      setUpl(false);
      setUploadProgress(0);
    }
  };

  const del_ = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDel(id);
    try {
      await deleteDataset(id, name);
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    } finally {
      setDel(null);
    }
  };

  const toggleHE = async (columnName: string) => {
    if (!selectedDataset || !ws) return;
    const currentMeta = selectedDataset.columns_meta || getSampleColumns(selectedDataset.name);
    const updatedMeta = currentMeta.map((col: any) => {
      if (col.name === columnName) {
        return { ...col, is_he: !col.is_he };
      }
      return col;
    });

    if (authMode === 'solo') {
      const updated = { ...selectedDataset, columns_meta: updatedMeta };
      setSelectedDataset(updated);
      const dsList = datasets.map((x: any) => x.id === selectedDataset.id ? updated : x);
      localStorage.setItem(`privana_ds_meta_${ws.id}`, JSON.stringify(dsList));
      await loadDatasets(ws.id);
    } else {
      const r = await privacyFetch('/api/datasets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDataset.id, columns_meta: updatedMeta })
      });
      if (r.ok) {
        const updated = await r.json();
        setSelectedDataset(updated);
        await loadDatasets(ws.id);
      }
    }
  };

  const mockCiphertext = (val: string) => {
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = val.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hex = Math.abs(hash).toString(16).padEnd(8, 'f').slice(0, 8);
    return `[TenSEAL CKKS: 0x${hex}...]`;
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-row">
          <div>
            <div className="eyebrow">Data Management</div>
            <h1 className="ph-title">Datasets</h1>
            <p className="ph-desc">Upload files for local analysis. Data never leaves your machine.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className="tag tag-green">⚡ DuckDB Engine</span>
            <span className="tag tag-green">0 bytes to cloud</span>
          </div>
        </div>
      </div>

      <div className="pb">
        {/* Upload zone */}
        <div className={`upload-zone ${drag ? 'drag' : ''}`} style={{ marginBottom: '1.1rem' }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv,.parquet,.xlsx,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="uz-icon">{uploading ? '⏳' : '📂'}</div>
          <div className="uz-title">{uploading ? 'Processing locally...' : 'Drop file here or click to browse'}</div>
          <div className="uz-desc">
            {uploading
              ? `Parsing locally — 0 bytes sent${uploadProgress > 0 && uploadProgress < 1 ? ` · ${Math.round(uploadProgress * 100)}%` : ''}`
              : 'CSV · Parquet · Excel · JSON · Up to 100 MB'}
          </div>
          {!uploading && <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', marginTop: '0.6rem' }}>{FT.map(f => <span key={f.ext} className={`tag tag-${f.color}`}>{f.icon} {f.ext.toUpperCase()}</span>)}</div>}
        </div>

        {/* Samples */}
        <div style={{ marginBottom: '1.1rem' }}>
          <div className="sec-row"><div className="sec-title">📦 Load Sample Dataset</div></div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {SAMPLES.map((s, i) => (
              <button key={i} className="btn btn-ghost btn-sm" disabled={uploading}
                onClick={() => uploadSample(s.name, s.type, s.rows, s.cols, s.size)}>
                {dsIcon(s.type)} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="sec-row">
          <div className="sec-title">📁 Your Datasets <span style={{ color: 'var(--t4)', fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>({datasets.length})</span></div>
        </div>
        {loading
          ? <div className="ds-grid">{[1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 120 }} />)}</div>
          : datasets.length === 0
          ? <div className="empty"><div className="empty-icon">📁</div><div className="empty-title">No datasets yet</div><div className="empty-desc">Upload a CSV, Parquet, Excel, or JSON file</div></div>
          : <div className="ds-grid" style={{ marginBottom: '1.25rem' }}>
              {datasets.map((ds, i) => (
                <motion.div key={ds.id} className={`ds-card ${selectedDataset?.id === ds.id ? 'sel' : ''}`} 
                  onClick={() => setSelectedDataset(ds)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '1.4rem' }}>{dsIcon(ds.file_type)}</div>
                    <button className="btn btn-red btn-xs" onClick={(e) => del_(ds.id, ds.name, e)} disabled={del === ds.id}>{del === ds.id ? '…' : '✕'}</button>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--t1)', margin: '0.4rem 0 0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: '0.45rem' }}>{(ds.row_count || 0).toLocaleString()} rows · {ds.col_count || 0} cols · {fmtSize(ds.size_bytes || 0)}</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                    <span className={`tag tag-${dsColor(ds.file_type)}`}>{(ds.file_type || 'csv').toUpperCase()}</span>
                    <span className="tag tag-green">Local</span>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} 
                    onClick={(e) => { e.stopPropagation(); setSelectedDataset(ds); setPage('analyze'); }}>
                    🔍 Analyze
                  </button>
                </motion.div>
              ))}
            </div>
        }

        {/* Schema Inspector & TenSEAL Simulator */}
        {selectedDataset && (
          <motion.div className="card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rim)', paddingBottom: '0.75rem', marginBottom: '0.9rem' }}>
              <div>
                <span className="eyebrow">Schema Catalog & Security Layer</span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--t1)', marginTop: 2 }}>
                  🛡️ Homomorphic Encryption (TenSEAL) Simulator: {selectedDataset.name}
                </div>
              </div>
              <span className="tag tag-purple">TenSEAL Active</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--rim)' }}>
                    <th style={{ padding: '0.5rem' }}>Column Name</th>
                    <th style={{ padding: '0.5rem' }}>Data Type</th>
                    <th style={{ padding: '0.5rem' }}>Privacy Protection</th>
                    <th style={{ padding: '0.5rem' }}>Data Engine Preview (What the query reads)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDataset.columns_meta || getSampleColumns(selectedDataset.name)).map((col: any) => {
                    const canEncrypt = col.type === 'DECIMAL' || col.type === 'INTEGER';
                    const sampleValue = col.name === 'revenue' ? '$185,240.50' 
                                      : col.name === 'profit' ? '$45,820.00'
                                      : col.name === 'spend' ? '$3,200.00'
                                      : col.name === 'claim_amount' ? '$14,250.00'
                                      : col.name === 'claim_id' ? '4028'
                                      : 'Generic plaintext';
                    return (
                      <tr key={col.name} style={{ borderBottom: '1px solid var(--rim)' }}>
                        <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
                          {col.name}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <span className="tag tag-blue">{col.type}</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          {canEncrypt ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={!!col.is_he} 
                                onChange={() => toggleHE(col.name)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.72rem', color: col.is_he ? 'var(--purple3)' : 'var(--t3)', fontWeight: col.is_he ? 700 : 400 }}>
                                {col.is_he ? '🔒 Encrypted (TenSEAL)' : '🔓 Plaintext'}
                              </span>
                            </label>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--t4)' }}>
                              Non-numeric (Air-gap only)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--mono)', fontSize: '0.72rem', color: col.is_he ? 'var(--purple3)' : 'var(--t3)' }}>
                          {col.is_he ? mockCiphertext(col.name + sampleValue) : sampleValue}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--t4)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>💡</span>
              <span>
                Homomorphically encrypted columns are computed directly in their ciphertext form. Local admins or hardware scrapers only see the encrypted outputs.
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
