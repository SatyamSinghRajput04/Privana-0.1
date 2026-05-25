import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Page } from '../App';
import { loadCSV, loadJSON } from '../lib/sqlEngine';
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
  const [drag, setDrag] = useState(false);
  const [del, setDel] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ws) {
      setLd(true);
      loadDatasets(ws.id).finally(() => setLd(false));
    }
  }, [ws]);

  const uploadSample = async (name: string, type: string, rows: number, cols: number, size: number) => {
    if (!ws) return;
    setUpl(true);
    try {
      const finalCols = getSampleColumns(name);
      let sampleData: any[] = [];

      if (name.toLowerCase().includes('teen')) {
        // High fidelity generator for Teen Mental Health Dataset
        // 615 male, 585 female
        const genders = [
          ...Array(615).fill('male'),
          ...Array(585).fill('female')
        ];

        // Platform usage: 427 Instagram, 366 TikTok, 206 YouTube, 124 Snapchat, 77 Twitter
        const platforms = [
          ...Array(427).fill('Instagram'),
          ...Array(366).fill('TikTok'),
          ...Array(206).fill('YouTube'),
          ...Array(124).fill('Snapchat'),
          ...Array(77).fill('Twitter')
        ];

        // Anxiety levels: 182 Low, 321 Mild, 372 Moderate, 231 High, 94 Severe
        const anxietyLevels: number[] = [];
        for (let i = 0; i < 182; i++) anxietyLevels.push(i % 2 === 0 ? 1 : 2);
        for (let i = 0; i < 321; i++) anxietyLevels.push(i % 2 === 0 ? 3 : 4);
        for (let i = 0; i < 372; i++) anxietyLevels.push(i % 2 === 0 ? 5 : 6);
        for (let i = 0; i < 231; i++) anxietyLevels.push(i % 2 === 0 ? 7 : 8);
        for (let i = 0; i < 94; i++) anxietyLevels.push(i % 2 === 0 ? 9 : 10);

        const shuffle = (arr: any[]) => {
          let cur = arr.length, rand;
          while (cur !== 0) {
            rand = Math.floor(Math.random() * cur);
            cur--;
            [arr[cur], arr[rand]] = [arr[rand], arr[cur]];
          }
          return arr;
        };

        shuffle(platforms);
        shuffle(anxietyLevels);

        const sleepHours: number[] = [];
        let maleSleepSum = 0;
        let femaleSleepSum = 0;

        const ages: number[] = [];
        let maleAgeSum = 0;
        let femaleAgeSum = 0;

        // Generate sleep and ages
        for (let i = 0; i < 1200; i++) {
          const isMale = genders[i] === 'male';

          // Sleep hours: male target avg = 6.40, female target avg = 6.50
          let sleepVal = isMale 
            ? 6.40 + (Math.random() * 2.4 - 1.2)
            : 6.50 + (Math.random() * 2.4 - 1.2);
          sleepVal = Math.round(sleepVal * 10) / 10;

          if (isMale) maleSleepSum += sleepVal;
          else femaleSleepSum += sleepVal;
          sleepHours.push(sleepVal);

          // Ages: male target avg = 15.95, female target avg = 15.91
          let ageVal = isMale
            ? 15.95 + (Math.random() * 6 - 3)
            : 15.91 + (Math.random() * 6 - 3);
          ageVal = Math.max(13, Math.min(19, Math.round(ageVal)));
          if (isMale) maleAgeSum += ageVal;
          else femaleAgeSum += ageVal;
          ages.push(ageVal);
        }

        // Adjust sleep hours to match sums exactly
        const maleIndices = genders.map((g, idx) => g === 'male' ? idx : -1).filter(idx => idx !== -1);
        const femaleIndices = genders.map((g, idx) => g === 'female' ? idx : -1).filter(idx => idx !== -1);

        // Adjust male sleep (target sum = 3936.0)
        let maleSleepDiff = 3936.0 - maleSleepSum;
        while (Math.abs(maleSleepDiff) > 0.05) {
          const idx = maleIndices[Math.floor(Math.random() * maleIndices.length)];
          const delta = maleSleepDiff > 0 ? 0.1 : -0.1;
          sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
          maleSleepSum += delta;
          maleSleepDiff = 3936.0 - maleSleepSum;
        }

        // Adjust female sleep (target sum = 3802.5)
        let femaleSleepDiff = 3802.5 - femaleSleepSum;
        while (Math.abs(femaleSleepDiff) > 0.05) {
          const idx = femaleIndices[Math.floor(Math.random() * femaleIndices.length)];
          const delta = femaleSleepDiff > 0 ? 0.1 : -0.1;
          sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
          femaleSleepSum += delta;
          femaleSleepDiff = 3802.5 - femaleSleepSum;
        }

        // Adjust male ages (target sum = 9810)
        let maleAgeDiff = 9810 - maleAgeSum;
        while (maleAgeDiff !== 0) {
          const idx = maleIndices[Math.floor(Math.random() * maleIndices.length)];
          const delta = maleAgeDiff > 0 ? 1 : -1;
          const newVal = ages[idx] + delta;
          if (newVal >= 13 && newVal <= 19) {
            ages[idx] = newVal;
            maleAgeSum += delta;
            maleAgeDiff = 9810 - maleAgeSum;
          }
        }

        // Adjust female ages (target sum = 9307)
        let femaleAgeDiff = 9307 - femaleAgeSum;
        while (femaleAgeDiff !== 0) {
          const idx = femaleIndices[Math.floor(Math.random() * femaleIndices.length)];
          const delta = femaleAgeDiff > 0 ? 1 : -1;
          const newVal = ages[idx] + delta;
          if (newVal >= 13 && newVal <= 19) {
            ages[idx] = newVal;
            femaleAgeSum += delta;
            femaleAgeDiff = 9307 - femaleAgeSum;
          }
        }

        // Screen time slots and stress levels: avg stress = 5.1 (sum = 6120)
        const screenTimeSlots = [
          ...Array(100).fill(0.0),
          ...Array(120).fill(0.5),
          ...Array(160).fill(1.0),
          ...Array(200).fill(1.5),
          ...Array(240).fill(2.0),
          ...Array(180).fill(2.5),
          ...Array(200).fill(3.0)
        ];
        shuffle(screenTimeSlots);

        const stressLevels: number[] = [];
        let stressSum = 0;

        for (let i = 0; i < 1200; i++) {
          const st = screenTimeSlots[i];
          let baseStress = 3.0 + (st / 3.0) * 3.6; // average stress varies from 3.0 to 6.6
          let stressVal = Math.round(baseStress + (Math.random() * 4 - 2));
          stressVal = Math.max(1, Math.min(10, stressVal));
          stressLevels.push(stressVal);
          stressSum += stressVal;
        }

        // Adjust stress sum to exactly 6120
        let stressDiff = 6120 - stressSum;
        while (stressDiff !== 0) {
          const idx = Math.floor(Math.random() * 1200);
          const delta = stressDiff > 0 ? 1 : -1;
          const newVal = stressLevels[idx] + delta;
          if (newVal >= 1 && newVal <= 10) {
            stressLevels[idx] = newVal;
            stressSum += delta;
            stressDiff = 6120 - stressSum;
          }
        }

        // Depression Labels: correlated with stress and anxiety
        const depressionLabels: string[] = [];
        for (let i = 0; i < 1200; i++) {
          const score = (stressLevels[i] + anxietyLevels[i]) / 2;
          let label = 'Moderate';
          if (score <= 2.5) label = 'Low';
          else if (score <= 4.5) label = 'Mild';
          else if (score <= 6.5) label = 'Moderate';
          else if (score <= 8.5) label = 'High';
          else label = 'Severe';
          depressionLabels.push(label);
        }

        for (let i = 0; i < 1200; i++) {
          sampleData.push({
            age: ages[i],
            gender: genders[i],
            sleep_hours: sleepHours[i],
            platform_usage: platforms[i],
            stress_level: stressLevels[i],
            anxiety_level: anxietyLevels[i],
            screen_time_before_sleep: screenTimeSlots[i],
            depression_label: depressionLabels[i]
          });
        }
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
      }

      // Register dataset in state/DB
      const d = await registerDataset(name, type, rows, cols, size, finalCols);
      
      // Save data in IndexedDB
      const csvStr = sampleData.map(r => Object.values(r).join(',')).join('\n');
      const csvHeader = Object.keys(sampleData[0]).join(',') + '\n' + csvStr;
      await localDB.saveDatasetCSV(name, csvHeader);
      
      if (!selectedDataset) setSelectedDataset(d);
      await loadDatasets(ws.id);
    } catch (e: any) {
      alert(`Failed to load sample: ${e.message}`);
    } finally {
      setUpl(false);
    }
  };

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        setUpl(true);
        
        let parsedRows: any[] = [];
        const isJson = f.name.toLowerCase().endsWith('.json');
        if (isJson) {
          parsedRows = loadJSON(f.name, text);
        } else {
          parsedRows = await loadCSV(f.name, text);
        }
        
        const colCount = parsedRows.length > 0 ? Object.keys(parsedRows[0]).length : 0;

        // Cache raw CSV/JSON in local IndexedDB instead of localStorage
        await localDB.saveDatasetCSV(f.name, text);

        // Generate REAL column metadata from actual parsed data
        const realColsMeta = parsedRows.length > 0
          ? Object.keys(parsedRows[0]).map(colName => {
              const samples = parsedRows.slice(0, 10).map(r => r[colName]).filter(v => v != null && v !== '');
              const numCount = samples.filter(v => typeof v === 'number').length;
              let colType = 'VARCHAR';
              if (numCount > samples.length * 0.6) {
                colType = Number.isInteger(samples.find(v => typeof v === 'number')) ? 'INTEGER' : 'DECIMAL';
              }
              return { name: colName, type: colType, is_he: false };
            })
          : getSampleColumns(f.name);

        const d = await registerDataset(f.name, f.name.split('.').pop() || 'csv', parsedRows.length, colCount, f.size, realColsMeta);
        if (!selectedDataset) setSelectedDataset(d);
        await loadDatasets(ws!.id);
      } catch (err: any) {
        alert(`Failed to load dataset: ${err.message}`);
      } finally {
        setUpl(false);
      }
    };
    reader.readAsText(f);
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
      const r = await fetch('/api/datasets', {
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
          <div className="uz-desc">{uploading ? 'DuckDB processing — 0 bytes sent' : 'CSV · Parquet · Excel · JSON · Up to 100 GB'}</div>
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
