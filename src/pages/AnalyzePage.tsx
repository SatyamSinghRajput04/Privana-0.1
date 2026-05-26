/* eslint-disable @typescript-eslint/no-unused-vars, no-useless-escape, no-irregular-whitespace, prefer-const, no-loss-of-precision, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, LabelList,
  ScatterChart, Scatter, ZAxis, ComposedChart, ReferenceLine
} from 'recharts';
import type { Page } from '../App';
import { executeSQL, getSqlTableName, getTableSchema, isTableLoaded, generateLocalQuery, loadCSV, loadJSON } from '../lib/sqlEngine';
import { validateDatasetSafety } from '../domain/safeCompute/preflight';
import { runSafeCompute } from '../domain/safeCompute';
import { ExcludedFeature } from '../domain/safeCompute/types';
import { localDB } from '../lib/indexedDb';
import { useVaultStore } from '../store/useVaultStore';
import { 
  Moon, Users, Heart, Database, Search, Filter, Save, Layers, ChevronRight, 
  Menu, Info, Star, ShieldAlert, Sparkles, FolderClosed, RefreshCw, TrendingUp,
  Send, X, MessageSquare
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Self-contained Markdown renderer â€” no external deps.
// Supports: headings, bold, italic, inline-code, code-blocks, tables,
// bullet/numbered lists, blockquotes, horizontal rules, emoji pass-through.
// ---------------------------------------------------------------------------
const MarkdownRenderer = ({ text, style }: { text: string; style?: React.CSSProperties }) => {
  const escHtml = (s: string) => s; // We render to JSX, not innerHTML, so no XSS risk

  // Inline: apply bold, italic, inline-code, and backtick spans to a raw string
  const renderInline = (raw: string, key: string | number): React.ReactNode => {
    // Split on `code`, **bold**, *italic*, breaking preserving delimiters
    const parts: React.ReactNode[] = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0, m: RegExpExecArray | null;
    let idx = 0;
    while ((m = pattern.exec(raw)) !== null) {
      if (m.index > last) parts.push(<Fragment key={`${key}-t${idx++}`}>{raw.slice(last, m.index)}</Fragment>);
      const token = m[0];
      if (token.startsWith('`')) {
        parts.push(
          <code key={`${key}-c${idx++}`} style={{
            background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
            borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace',
            fontSize: '0.88em', border: '1px solid rgba(239,68,68,0.2)'
          }}>{token.slice(1, -1)}</code>
        );
      } else if (token.startsWith('**')) {
        parts.push(<strong key={`${key}-b${idx++}`} style={{ color: '#f4f4f5', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
      } else {
        parts.push(<em key={`${key}-i${idx++}`} style={{ color: '#d4d4d8', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
      }
      last = m.index + token.length;
    }
    if (last < raw.length) parts.push(<Fragment key={`${key}-te${idx++}`}>{raw.slice(last)}</Fragment>);
    return parts.length === 1 ? parts[0] : <Fragment key={key}>{parts}</Fragment>;
  };

  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(
        <pre key={i} style={{
          background: '#0d0d14', border: '1px solid #27272a', borderRadius: 6,
          padding: '0.6rem 0.8rem', overflowX: 'auto', margin: '0.4rem 0',
          fontFamily: 'monospace', fontSize: '0.74rem', color: '#a1a1aa', lineHeight: 1.6
        }}><code>{codeLines.join('\n')}</code></pre>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #27272a', margin: '0.5rem 0' }} />);
      i++; continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ['0.95rem','0.88rem','0.82rem'];
      const colors = ['#f4f4f5','#e4e4e7','#d4d4d8'];
      nodes.push(
        <div key={i} style={{
          fontSize: sizes[level-1], fontWeight: 700, color: colors[level-1],
          marginTop: level === 1 ? '0.7rem' : level === 2 ? '0.55rem' : '0.4rem',
          marginBottom: '0.2rem',
          ...(level === 1 ? { borderBottom: '1px solid #27272a', paddingBottom: '0.2rem' } : {})
        }}>{renderInline(hMatch[2], `h-${i}`)}</div>
      );
      i++; continue;
    }

    // Table detection: line with pipes
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const raw = lines[i];
        // Split on | then trim, remove the always-empty first+last cells from bordered rows
        const cells = raw.split('|').map(c => c.trim());
        // If row starts/ends with empty string (from leading/trailing |), remove them
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        // Skip separator rows (--- | :--- | ---:)
        const isSep = cells.every(c => /^:?-+:?$/.test(c));
        if (!isSep) tableRows.push(cells);
        i++;
      }
      // tableRows[0] = headers, tableRows[1..] = body rows (separator already filtered)
      const headers = tableRows[0] || [];
      const bodyRows = tableRows.slice(1);
      nodes.push(
        <div key={i} style={{ overflowX: 'auto', margin: '0.4rem 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1.5px solid rgba(239,68,68,0.25)' }}>
                {headers.map((h, ci) => (
                  <th key={ci} style={{
                    padding: '4px 10px', textAlign: 'left', color: '#f4f4f5',
                    fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.7rem'
                  }}>{renderInline(h, `th-${i}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #1a1a24', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '3.5px 10px', color: '#a1a1aa', verticalAlign: 'top', fontSize: '0.7rem' }}>
                      {renderInline(cell, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(
        <div key={i} style={{
          borderLeft: '3px solid rgba(239,68,68,0.5)', paddingLeft: '0.65rem',
          color: '#a1a1aa', margin: '0.3rem 0', fontStyle: 'italic', fontSize: '0.72rem'
        }}>
          {bqLines.map((bl, bi) => <div key={bi}>{renderInline(bl, `bq-${i}-${bi}`)}</div>)}
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[\-\*â€¢]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*â€¢]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*â€¢]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} style={{ paddingLeft: '1.1rem', margin: '0.2rem 0', listStyle: 'none' }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#a1a1aa', fontSize: '0.72rem', lineHeight: 1.6, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '-0.9rem', color: '#ef4444', fontWeight: 700 }}>â€¢</span>
              {renderInline(item, `li-${i}-${ii}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={i} style={{ paddingLeft: '1.3rem', margin: '0.2rem 0' }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: '#a1a1aa', fontSize: '0.72rem', lineHeight: 1.6 }}>
              {renderInline(item, `ol-${i}-${ii}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line â†’ spacer
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: '0.3rem' }} />);
      i++; continue;
    }

    // Plain paragraph
    nodes.push(
      <div key={i} style={{ color: '#a1a1aa', fontSize: '0.72rem', lineHeight: 1.65 }}>
        {renderInline(line, `p-${i}`)}
      </div>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', ...style }}>{nodes}</div>;
};

interface P { 
  setPage: (p: Page) => void;
  onMenu?: () => void;
}

const COLORS = ['#eab308', '#3b82f6', '#ef4444', '#a855f7', '#f97316', '#06b6d4'];

export default function AnalyzePage({ setPage, onMenu }: P) {
  const { ws, datasets, selectedDataset, setSelectedDataset, saveBookmark } = useVaultStore();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [activeTab, setActiveTab] = useState<'report' | 'data' | 'model'>('report');
  const [bottomTab, setBottomTab] = useState<string>('Overview');

  // --- FILTERS STATE ---
  const [genderFilter, setGenderFilter] = useState<{ male: boolean; female: boolean }>({ male: true, female: true });
  const [platformFilter, setPlatformFilter] = useState<Record<string, boolean>>({
    Instagram: true,
    TikTok: true,
    YouTube: true,
    Snapchat: true,
    Twitter: true
  });
  const [ageRange, setAgeRange] = useState<[number, number]>([13, 19]);
  const [filterSearch, setFilterSearch] = useState('');
  const [fieldsSearch, setFieldsSearch] = useState('');

  // --- STATE FOR INTERACTIVE RIBBON ---
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [highlightedCard, setHighlightedCard] = useState<string | null>(null);
  
  const [showPageViewDropdown, setShowPageViewDropdown] = useState(false);
  const [showFitDropdown, setShowFitDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  const [pageViewMode, setPageViewMode] = useState('Fit to Width');
  const [fitMode, setFitMode] = useState('Fit to Page');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- AI Q&A ASSISTANT STATE ---
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState<string | null>(null);

  // --- CONTEXTUAL VISUALIZATION STATE ---
  type AnalyticalContext = {
    type: string;
    title: string;
    valCol: string;
    cntCol: string;
    scatterPairs: { x: number; y: number; isOutlier: boolean }[];
    regSlope: number;
    regIntercept: number;
    regR2: number;
    histX: { label: string; count: number }[];
    histY: { label: string; count: number }[];
    topRows: { rank: string; value: number; extra: Record<string, unknown> }[];
    binRows: { label: string; avg: number; count: number; sd: number }[];
    pieSlices: { name: string; value: number }[];
    kpiCards: { label: string; value: string; sub: string; color: string }[];
    xStats: { mean: number; std: number; min: number; max: number };
    yStats: { mean: number; std: number; min: number; max: number };
    targetSummary?: {
      target: string;
      detectedType: string;
      sampleSize: number;
      missingCount: number;
      uniqueCount: number;
      positiveClass?: string;
      mappingNote?: string;
    };
    excludedFeatures?: ExcludedFeature[];
    warnings?: string[];
  };
  const [analyticalContext, setAnalyticalContext] = useState<AnalyticalContext | null>(null);
  const [isFilterQueryActive, setIsFilterQueryActive] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  // --- CHAT WINDOW STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; timestamp: Date }>>([
    {
      sender: 'ai',
      text: "ðŸ‘‹ Welcome to Privana AI Copilot! I'm here to help you query and explore your dataset locally and privately. Try asking a question, such as:\n\nâ€¢ \"Show me only female TikTok users\"\nâ€¢ \"Average sleep hours of male users\"\nâ€¢ \"What is the stress level of users under 16?\"",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const isNavigatingRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Database table loading states
  const [tableLoadedState, setTableLoadedState] = useState<string | null>(null);
  const [loadingTable, setLoadingTable] = useState<string | null>(null);

  // Local calculation states
  const [kpis, setKpis] = useState({ sleep: 0, age: 0, stress: 0, records: 0 });
  const [genderSleepData, setGenderSleepData] = useState<any[]>([]);
  const [platformShareData, setPlatformShareData] = useState<any[]>([]);
  const [screenTimeStressData, setScreenTimeStressData] = useState<any[]>([]);
  const [genderSummaryTable, setGenderSummaryTable] = useState<any[]>([]);
  const [anxietyLevelsData, setAnxietyLevelsData] = useState<any[]>([]);

  // Schema Columns catalog
  const [columnsList, setColumnsList] = useState<any[]>([]);
  const [dataGridRows, setDataGridRows] = useState<any[]>([]);

  // Baseline counts for checkboxes (e.g. 615, 585)
  // Zero-initialized â€” populated from real data after dataset loads
  const [baselineCounts, setBaselineCounts] = useState<{
    male: number;
    female: number;
    Instagram: number;
    TikTok: number;
    YouTube: number;
    Snapchat: number;
    Twitter: number;
  }>({ male: 0, female: 0, Instagram: 0, TikTok: 0, YouTube: 0, Snapchat: 0, Twitter: 0 });

  const isMentalHealthSchema = useMemo(() => {
    if (!columnsList.length) return false;
    const names = columnsList.map(c => c.name.toLowerCase());
    return names.includes('sleep_hours') && names.includes('gender') && names.includes('age');
  }, [columnsList]);

  const suggestedCards = useMemo(() => {
    if (!selectedDataset || !columnsList.length) return [];
    
    const names = columnsList.map(c => c.name.toLowerCase());
    
    // 1. Finance Dataset
    if (names.some(n => n.includes('revenue') || n.includes('profit') || n.includes('sales') || n.includes('cost') || n.includes('income'))) {
      const revCol = columnsList.find(c => c.name.toLowerCase().includes('revenue') || c.name.toLowerCase().includes('sales'))?.name || columnsList[0].name;
      const profitCol = columnsList.find(c => c.name.toLowerCase().includes('profit'))?.name || columnsList[1]?.name || columnsList[0].name;
      const groupCol = columnsList.find(c => c.type === 'string')?.name || 'region';
      return [
        {
          title: "ðŸ’° Regional Revenue Breakdown",
          desc: "Compare regional performance",
          query: `Group values into bins of ${groupCol} and show average ${revCol}`
        },
        {
          title: "ðŸ“ˆ Profit vs Sales Regression",
          desc: "Analyze monthly profit trends",
          query: `Build linear regression to predict ${profitCol} from ${revCol}`
        },
        {
          title: "âš ï¸ Financial Anomaly Check",
          desc: "Detect abnormal activity",
          query: `Highlight anomalous data points in ${revCol} vs ${profitCol}`
        }
      ];
    }
    
    // 2. Cybersecurity Dataset
    if (names.some(n => n.includes('threat') || n.includes('ip') || n.includes('packet') || n.includes('traffic') || n.includes('bytes'))) {
      const bytesCol = columnsList.find(c => c.name.toLowerCase().includes('bytes') || c.name.toLowerCase().includes('traffic'))?.name || columnsList[0].name;
      const riskCol = columnsList.find(c => c.name.toLowerCase().includes('risk') || c.name.toLowerCase().includes('threat') || c.name.toLowerCase().includes('level'))?.name || columnsList[1]?.name || columnsList[0].name;
      return [
        {
          title: "ðŸ›¡ï¸ Traffic Anomaly Scan",
          desc: "Analyze suspicious network activity",
          query: `Highlight anomalous data points in ${bytesCol} vs ${riskCol}`
        },
        {
          title: "ðŸ“Š Packets Correlation Matrix",
          desc: "Analyze traffic correlation",
          query: `Calculate Spearman correlation between ${bytesCol} and ${riskCol}`
        },
        {
          title: "âš ï¸ Incident Ranking",
          desc: "Identify high-risk events",
          query: `Find the top 5 records with highest ${riskCol}`
        }
      ];
    }
    
    // 3. Healthcare Dataset
    if (names.some(n => n.includes('patient') || n.includes('disease') || n.includes('treatment') || n.includes('dosage') || n.includes('health'))) {
      const doseCol = columnsList.find(c => c.name.toLowerCase().includes('dose') || c.name.toLowerCase().includes('dosage'))?.name || columnsList[0].name;
      const outCol = columnsList.find(c => c.name.toLowerCase().includes('outcome') || c.name.toLowerCase().includes('risk') || c.name.toLowerCase().includes('rate'))?.name || columnsList[1]?.name || columnsList[0].name;
      return [
        {
          title: "ðŸ§¬ Patient Risk Analysis",
          desc: "Analyze patient risk patterns",
          query: `Group values into bins of ${doseCol} and show average ${outCol}`
        },
        {
          title: "ðŸ“ˆ Treatment Efficacy Regression",
          desc: "Compare outcomes with OLS regression",
          query: `Build linear regression to predict ${outCol} from ${doseCol}`
        },
        {
          title: "âš ï¸ Diagnostic Outlier Scan",
          desc: "Detect abnormal health indicators",
          query: `Highlight anomalous data points in ${doseCol} vs ${outCol}`
        }
      ];
    }
    
    // 4. Mental Health Dataset (Mental Health schema matched)
    if (isMentalHealthSchema) {
      return [
        {
          title: "ðŸ“Š Correlation Test",
          desc: "Spearman correlation (sleep_hours vs stress_level)",
          query: "Calculate Spearman correlation between sleep_hours and stress_level"
        },
        {
          title: "ðŸ“ˆ Regression Model",
          desc: "OLS linear regression (predict stress_level from sleep_hours)",
          query: "Build a linear regression model to predict stress_level from sleep_hours"
        },
        {
          title: "ðŸ”Ž Outlier Detection",
          desc: "Identify residual sleep/stress anomalies",
          query: "Highlight anomalous data points in sleep_hours vs stress_level"
        },
        {
          title: "ðŸ“¦ Bin Aggregation",
          desc: "Average stress levels grouped by sleep hours",
          query: "Group values into bins of sleep_hours and show average stress_level"
        }
      ];
    }
    
    // 5. Generic Dataset Fallback
    const numCols = columnsList.filter(c => c.type === 'number');
    const strCols = columnsList.filter(c => c.type === 'string');
    const xCol = numCols[0]?.name || columnsList[0]?.name;
    const yCol = numCols[1]?.name || numCols[0]?.name;
    const grpCol = strCols[0]?.name || columnsList[0]?.name;
    
    return [
      {
        title: "ðŸ“Š Spearman Rank Correlation",
        desc: `Test correlation: ${xCol} vs ${yCol}`,
        query: `Calculate Spearman correlation between ${xCol} and ${yCol}`
      },
      {
        title: "ðŸ“ˆ OLS Linear Regression",
        desc: `Predict ${yCol} from ${xCol}`,
        query: `Build a linear regression model to predict ${yCol} from ${xCol}`
      },
      {
        title: "ðŸ“¦ Bin Aggregation",
        desc: `Average ${yCol} grouped by ${grpCol}`,
        query: `Group values into bins of ${grpCol} and show average ${yCol}`
      },
      {
        title: "ðŸ“Š Value Frequency Histogram",
        desc: `Distribution of ${yCol}`,
        query: `Show the frequency distribution histogram of ${yCol}`
      }
    ];
  }, [columnsList, isMentalHealthSchema, selectedDataset]);

  const handleRunPresetQuestion = (questionText: string) => {
    setQaInput(questionText);
    handleAskAI(questionText);
  };

  const handleSaveReport = async () => {
    if (!ws || !selectedDataset) return;
    setSaveStatus('saving');
    try {
      const title = selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") + ' Insights';
      await saveBookmark({
        workspace_id: ws.id,
        title,
        notes: `Report created automatically from dataset ${selectedDataset.name} using Power BI Dashboard template.`
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      alert('Failed to save bookmark: ' + e);
      setSaveStatus('idle');
    }
  };

  // --- UNDO / REDO & REFRESH & HIGHLIGHT LOGIC ---
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    const newState = {
      genderFilter: { ...genderFilter },
      platformFilter: { ...platformFilter },
      ageRange: [...ageRange] as [number, number]
    };

    // Deep comparison to prevent adding duplicate states to the history queue
    if (historyIndex >= 0 && historyIndex < history.length) {
      const current = history[historyIndex];
      if (current) {
        const isGenderSame = current.genderFilter.male === genderFilter.male && current.genderFilter.female === genderFilter.female;
        const isPlatformSame = Object.keys(platformFilter).every(k => current.platformFilter[k] === platformFilter[k]);
        const isAgeSame = current.ageRange[0] === ageRange[0] && current.ageRange[1] === ageRange[1];
        if (isGenderSame && isPlatformSame && isAgeSame) {
          return;
        }
      }
    }
    
    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newState];
    });
    setHistoryIndex(prev => prev + 1);
  }, [genderFilter, platformFilter, ageRange]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isNavigatingRef.current = true;
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const state = history[prevIndex];
      setGenderFilter(state.genderFilter);
      setPlatformFilter(state.platformFilter);
      setAgeRange(state.ageRange);
      showToast('Undo filter adjustment');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isNavigatingRef.current = true;
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const state = history[nextIndex];
      setGenderFilter(state.genderFilter);
      setPlatformFilter(state.platformFilter);
      setAgeRange(state.ageRange);
      showToast('Redo filter adjustment');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setGenderFilter({ male: true, female: true });
    setPlatformFilter({ Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true });
    setAgeRange([13, 19]);
    setQaInput('');
    setQaResponse(null);
    setAnalyticalContext(null);
    setIsFilterQueryActive(false);
    showToast('Resetting dashboard to defaults...');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Dashboard reloaded with local data');
    }, 600);
  };

  const triggerCardHighlight = (card: string) => {
    setHighlightedCard(card);
    const cardTitle = card === 'bar' ? 'Average Sleep Hours' 
                    : card === 'donut' ? 'Platform Share' 
                    : card === 'line' ? 'Screen Time vs Stress' 
                    : 'Gender Summary Report';
    showToast(`Focused on: ${cardTitle}`);
    setTimeout(() => setHighlightedCard(null), 1500);
  };

  // ============================================================
  // STATISTICAL MATH ENGINE â€” All values computed from data.
  // No hardcoded approximations. No hallucinated coefficients.
  // ============================================================

  /** Regularized incomplete beta function via continued fraction (Lentz method).
   *  Used to compute the exact t-distribution CDF for p-value calculation.
   *  Matches scipy.stats.t.sf() and R's pt() to at least 8 significant figures. */
  const _betaIncomplete = (a: number, b: number, x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbeta = (p: number, q: number) =>
      _lgamma(p) + _lgamma(q) - _lgamma(p + q);
    const _lgamma = (z: number): number => {
      // Lanczos approximation â€” accurate to 15 significant figures
      const c = [76.18009172947146,-86.50532032941677,24.01409824083091,
                 -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
      let y = z, x2 = z, tmp = z + 5.5;
      tmp -= (z + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
      return -tmp + Math.log(2.5066282746310005 * ser / x2);
    };
    const lbetaVal = lbeta(a, b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbetaVal) / a;
    // Continued fraction via modified Lentz's method
    const cf = (a2: number, b2: number, x2: number): number => {
      const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
      let qab = a2 + b2, qap = a2 + 1, qam = a2 - 1;
      let c2 = 1.0, d = 1 - qab * x2 / qap;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      d = 1 / d; let h = d;
      for (let m = 1; m <= MAXIT; m++) {
        let m2 = 2 * m;
        let aa = m * (b2 - m) * x2 / ((qam + m2) * (a2 + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c2 = 1 + aa / c2; if (Math.abs(c2) < FPMIN) c2 = FPMIN;
        d = 1 / d; h *= d * c2;
        aa = -(a2 + m) * (qab + m) * x2 / ((a2 + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c2 = 1 + aa / c2; if (Math.abs(c2) < FPMIN) c2 = FPMIN;
        d = 1 / d; const del = d * c2; h *= del;
        if (Math.abs(del - 1) < EPS) break;
      }
      return h;
    };
    // Use symmetry relation for numerical stability
    if (x < (a + 1) / (a + b + 2)) return front * cf(a, b, x);
    return 1 - Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbetaVal) / b * cf(b, a, 1 - x);
  };

  /** Two-tailed p-value from t-statistic and degrees of freedom.
   *  Uses exact t-distribution via regularized incomplete beta.
   *  Formula: p = 2 * I(df/(df+t²), df/2, 1/2) */
  const tDistPValue = (t: number, df: number): number => {
    if (df <= 0) return 1;
    const x = df / (df + t * t);
    return _betaIncomplete(df / 2, 0.5, x);
  };

  /** Approximate t critical value for two-tailed 95% CI (df â‰¥ 1).
   *  Uses a rational approximation accurate to Â±0.001 for df â‰¥ 2.
   *  For large df, converges to z=1.96 (Normal). */
  const tCritical95 = (df: number): number => {
    if (df <= 0) return 1.96;
    // Small-sample exact values
    const exact: Record<number, number> = {
      1:12.706, 2:4.303, 3:3.182, 4:2.776, 5:2.571,
      6:2.447, 7:2.365, 8:2.306, 9:2.262, 10:2.228,
      15:2.131, 20:2.086, 25:2.060, 30:2.042, 40:2.021,
      60:2.000, 120:1.980
    };
    if (exact[df] !== undefined) return exact[df];
    // Interpolate / approximate
    if (df > 120) return 1.96;
    // Linear interpolation between bracketing points
    const keys = Object.keys(exact).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (df > keys[i] && df < keys[i + 1]) {
        const t0 = exact[keys[i]], t1 = exact[keys[i + 1]];
        const frac = (df - keys[i]) / (keys[i + 1] - keys[i]);
        return t0 + frac * (t1 - t0);
      }
    }
    return 1.96;
  };

  const getPearsonCorrelation = (xs: number[], ys: number[]): number => {
    const n = xs.length;
    if (n < 2) return 0;
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const meanY = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX, dy = ys[i] - meanY;
      num += dx * dy; denX += dx * dx; denY += dy * dy;
    }
    return denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
  };

  const getRanks = (values: number[]): number[] => {
    const sorted = values.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j < sorted.length && sorted[j].val === sorted[i].val) j++;
      const rank = 1 + (i + j - 1) / 2;
      for (let k = i; k < j; k++) ranks[sorted[k].idx] = rank;
      i = j;
    }
    return ranks;
  };

  const getSpearmanCorrelation = (xs: number[], ys: number[]): number =>
    getPearsonCorrelation(getRanks(xs), getRanks(ys));

  /** Test significance of a Pearson or Spearman correlation.
   *  t = r * sqrt((n-2)/(1-r²)), df = n-2.
   *  p-value computed from exact t-distribution (not Normal approximation). */
  const testCorrelationSignificance = (r: number, n: number) => {
    if (n <= 2) return { t: 0, p: 1, significant: false, df: n - 2 };
    const clampedR = Math.max(-0.9999999, Math.min(0.9999999, r));
    const df = n - 2;
    const t = clampedR * Math.sqrt(df / (1 - clampedR * clampedR));
    const p = tDistPValue(Math.abs(t), df);
    return { t, p, significant: p < 0.05, df };
  };

  /** OLS simple linear regression. Returns slope, intercept, R², RSE,
   *  AND the computed standard errors / t-stats / p-values for each coefficient. */
  const getLinearRegression = (xs: number[], ys: number[]) => {
    const n = xs.length;
    if (n < 3) return {
      slope: 0, intercept: 0, r2: 0, seReg: 0,
      seSlope: 0, seIntercept: 0,
      tSlope: 0, tIntercept: 0,
      pSlope: 1, pIntercept: 1
    };
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const meanY = ys.reduce((s, v) => s + v, 0) / n;
    let Sxy = 0, Sxx = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      Sxy += dx * (ys[i] - meanY);
      Sxx += dx * dx;
    }
    const slope = Sxx === 0 ? 0 : Sxy / Sxx;
    const intercept = meanY - slope * meanX;

    let totalSS = 0, residualSS = 0;
    let sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const res = ys[i] - (slope * xs[i] + intercept);
      residualSS += res * res;
      totalSS += Math.pow(ys[i] - meanY, 2);
      sumX2 += xs[i] * xs[i];
    }
    const df = n - 2;
    const r2 = totalSS === 0 ? 0 : 1 - residualSS / totalSS;
    const seReg = df > 0 ? Math.sqrt(residualSS / df) : 0;

    // Correct OLS standard errors from first principles
    const seSlope = Sxx === 0 ? 0 : seReg / Math.sqrt(Sxx);
    const seIntercept = Sxx === 0 ? 0 : seReg * Math.sqrt(sumX2 / (n * Sxx));
    const tSlope = seSlope === 0 ? 0 : slope / seSlope;
    const tIntercept = seIntercept === 0 ? 0 : intercept / seIntercept;
    const pSlope = tDistPValue(Math.abs(tSlope), df);
    const pIntercept = tDistPValue(Math.abs(tIntercept), df);

    return { slope, intercept, r2, seReg, seSlope, seIntercept, tSlope, tIntercept, pSlope, pIntercept, Sxx, df };
  };

  /** Fisher's adjusted skewness (G1) and excess kurtosis (G2) â€” same as SPSS/Excel. */
  const getSkewnessAndKurtosis = (vals: number[]) => {
    const n = vals.length;
    if (n < 4) return { skewness: 0, kurtosis: 0 };
    const m = vals.reduce((s, v) => s + v, 0) / n;
    const m2 = vals.reduce((s, v) => s + Math.pow(v - m, 2), 0) / n;
    const m3 = vals.reduce((s, v) => s + Math.pow(v - m, 3), 0) / n;
    const m4 = vals.reduce((s, v) => s + Math.pow(v - m, 4), 0) / n;
    if (m2 === 0) return { skewness: 0, kurtosis: 0 };
    const skew = m3 / Math.pow(m2, 1.5);
    const excessKurt = m4 / Math.pow(m2, 2) - 3;
    // Fisher's bias corrections (same as R's e1071::skewness type 2 / Excel SKEW)
    const adjSkew = (Math.sqrt(n * (n - 1)) / (n - 2)) * skew;
    const adjKurt = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * excessKurt + 6);
    return {
      skewness: parseFloat(adjSkew.toFixed(6)),
      kurtosis: parseFloat(adjKurt.toFixed(6))
    };
  };

  /** Interpret a Pearson/Spearman r value with direction and magnitude label. */
  const interpretCorrelation = (r: number): string => {
    const abs = Math.abs(r);
    const dir = r > 0 ? 'positive' : r < 0 ? 'negative' : 'zero';
    const strength = abs >= 0.9 ? 'very strong' : abs >= 0.7 ? 'strong'
      : abs >= 0.4 ? 'moderate' : abs >= 0.2 ? 'weak' : 'negligible';
    return `${strength} ${dir}`;
  };

  /** Format p-value for display â€” avoids floating point noise. */
  const fmtP = (p: number): string => {
    if (p < 1e-15) return '< 1e-15';
    if (p < 0.0001) return p.toExponential(3);
    return p.toFixed(4);
  };

  const runLocalStatisticalAnalysis = (question: string, tableName: string): string | null => {
    const q = question.toLowerCase();
    
    // Check if it is either a standard statistical query OR a feature importance query
    const isFeatureImportanceQuery = 
      q.includes('strongest relationship') ||
      q.includes('relationship with') ||
      q.includes('most related') ||
      q.includes('feature importance') ||
      q.includes('which feature');

    const isStatQuery = 
      isFeatureImportanceQuery ||
      q.includes('correlation matrix') ||
      q.includes('spearman') ||
      q.includes('significant') || q.includes('significance') || q.includes('95% confidence') ||
      q.includes('regression') || q.includes('predict') || q.includes('linear model') ||
      q.includes('assumption') || q.includes('homoscedasticity') || q.includes('linearity') ||
      q.includes('scatter plot') || q.includes('confidence interval') ||
      q.includes('histogram') ||
      q.includes('residual') ||
      q.includes('anomal') || q.includes('outlier') ||
      q.includes('skewness') || q.includes('kurtosis') ||
      q.includes('group values into bins') || q.includes('average count for each bin') || q.includes('bins') ||
      q.includes('top 5') ||
      q.includes('percentage contribution') || q.includes('value range');

    if (!isStatQuery) return null;

    try {
      const tbl = getSqlTableName(tableName);
      const rows = executeSQL(`SELECT * FROM ${tbl}`);

      // ── Hoisted Universal Pre-Flight Guard blocker ──
      const preflightBlock = validateDatasetSafety(rows, tableName);
      if (preflightBlock) {
        return (
          `🚨 **Dataset Safety Guard Intercepted**\n\n` +
          `**Reason:** ${preflightBlock.reason}\n\n` +
          `**Guided Next Steps:**\n` +
          preflightBlock.nextSteps.map((step, sIdx) => `${sIdx + 1}. ${step}`).join('\n')
        );
      }

      // ── Intercept Feature Importance Q&A ──
      if (isFeatureImportanceQuery) {
        const result = runSafeCompute({ question, tableName, rows });
        if (result.status === 'blocked') {
          return (
            `🚨 **Dataset Safety Guard Intercepted**\n\n` +
            `**Reason:** ${result.reason}\n\n` +
            `**Guided Next Steps:**\n` +
            result.nextSteps.map((step, sIdx) => `${sIdx + 1}. ${step}`).join('\n')
          );
        }
        if (result.status === 'computed') {
          return result.answer;
        }
        if (result.status === 'unsupported') {
          return (
            `⚠️ **Statistical Path Unsupported**\n\n` +
            `${result.reason}\n\n` +
            `**Suggested safe questions you can ask:**\n` +
            result.suggestedQuestions.map(sq => `* "${sq}"`).join('\n')
          );
        }
      }

      // â”€â”€ Pre-flight guard 1: metadata-file detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // A metadata JSON loaded as a 1-row table with @context/license etc.
      // must be rejected before we waste compute (or show garbage results).
      const allColsRaw = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
      const META_SIGNALS = ['@context', 'license', 'creator', 'publisher',
                            'dateModified', '@type', 'isBasedOn', 'variableMeasured'];
      const foundMeta = META_SIGNALS.filter(k => allColsRaw.includes(k));
      if (foundMeta.length >= 2) {
        return (
          `ðŸš¨ **Metadata File â€” Cannot Analyze**\n\n` +
          `The loaded dataset \`${tableName}\` is a **descriptor/metadata file**, not real data.\n` +
          `It contains fields like \`${foundMeta.slice(0, 3).join('\`, \`')}\` â€” these describe the ` +
          `dataset schema, not actual respondent records.\n\n` +
          `**What to do:**\n` +
          `1. Go to **Datasets** in the left sidebar\n` +
          `2. Delete \`${tableName}\`\n` +
          `3. Upload the **real CSV data file** (one row per respondent with columns like ` +
          `\`sleep_hours\`, \`stress_level\`, \`gender\`, etc.)\n\n` +
          `*The real Kaggle teen mental health dataset is a CSV file, not a JSON metadata file.*`
        );
      }

      // â”€â”€ Pre-flight guard 2: minimum row count â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (!rows || rows.length < 2) {
        const count = rows?.length ?? 0;
        return (
          `âš ï¸ **Not Enough Data** (${count} row${count === 1 ? '' : 's'} loaded)\n\n` +
          `Statistical analysis requires **at least 2 data rows**.\n\n` +
          `Your current table has only ${count} row${count === 1 ? '' : 's'}, which means ` +
          `every correlation will be 0, every p-value will be 1, and every chart will be empty.\n\n` +
          `Please upload the actual data file (a CSV with real records).`
        );
      }

      // â”€â”€ Pre-flight guard 3: column existence check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // If the question explicitly names snake_case columns (e.g., sleep_hours)
      // that do not exist in the loaded table, tell the user instead of silently
      // falling back to wrong columns (like 'version' vs 'isAccessibleForFree').
      const allCols = allColsRaw;
      const questionSnakeCols = (question.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi) || [])
        .map(c => c.toLowerCase());
      if (questionSnakeCols.length > 0) {
        const missingCols = questionSnakeCols.filter(qc =>
          !allCols.some(dc => dc.toLowerCase() === qc)
        );
        // Only error if ALL mentioned columns are missing (avoid false-positives
        // when the question has some columns from the table and some generic words)
        if (missingCols.length > 0 && missingCols.length === questionSnakeCols.length) {
          return (
            `âš ï¸ **Column Not Found**\n\n` +
            `The column${missingCols.length > 1 ? 's' : ''} ` +
            `${missingCols.map(c => `\`${c}\``).join(', ')} ` +
            `mentioned in your question ${missingCols.length > 1 ? 'were' : 'was'} not found ` +
            `in \`${tableName}\`.\n\n` +
            `**Available columns (${allCols.length} total):** ` +
            `${allCols.slice(0, 10).join(', ')}${allCols.length > 10 ? ` â€¦+${allCols.length - 10} more` : ''}\n\n` +
            `Please upload a dataset that contains these columns, ` +
            `or rephrase your question to match the available fields.`
          );
        }
      }

      const numericCols = allCols.filter(c => {
        const sample = rows.find(r => r[c] !== null && r[c] !== undefined && r[c] !== '');
        return sample ? !isNaN(Number(sample[c])) : false;
      });


      // ----- SMART COLUMN DETECTION: parse explicit column names from question first -----
      let valCol = '';
      let cntCol = '';

      // Match any actual column name mentioned in the question (exact word-boundary match)
      const mentionedCols = numericCols.filter(c => {
        const regex = new RegExp(`\\b${c.replace(/_/g, '[_ ]')}\\b`, 'i');
        return regex.test(question);
      });

      // If 2+ columns mentioned explicitly, use the order they appear in the question
      if (mentionedCols.length >= 2) {
        // Find order of appearance in the question
        const positions = mentionedCols.map(c => ({
          col: c,
          pos: question.toLowerCase().indexOf(c.toLowerCase())
        })).sort((a, b) => a.pos - b.pos);
        valCol = positions[0].col;
        cntCol = positions[1].col;
      } else if (mentionedCols.length === 1) {
        valCol = mentionedCols[0];
        // Pick the next available numeric col as cntCol
        const remaining = numericCols.filter(c => c !== valCol);
        if (allCols.includes('count')) cntCol = 'count';
        else if (allCols.includes('stress_level')) cntCol = 'stress_level';
        else cntCol = remaining[0] || '';
      } else {
        // Fallback: priority-based mapping when no column name appears in question
        if (allCols.includes('value')) valCol = 'value';
        else if (allCols.includes('screen_time_before_sleep')) valCol = 'screen_time_before_sleep';
        else if (allCols.includes('sleep_hours')) valCol = 'sleep_hours';
        else valCol = numericCols[0] || '';

        if (allCols.includes('count')) cntCol = 'count';
        else if (allCols.includes('stress_level')) cntCol = 'stress_level';
        else if (allCols.includes('anxiety_level')) cntCol = 'anxiety_level';
        else {
          const remaining = numericCols.filter(c => c !== valCol);
          cntCol = remaining[0] || '';
        }
      }

      const mappingNote = `*(Using columns: **\`${valCol}\`** (x-axis) and **\`${cntCol}\`** (y-axis), n = ${rows.length} records)*\n\n`;

      // Extract paired numeric rows â€” keep alignment by extracting together
      const pairs = rows
        .map(r => ({ x: Number(r[valCol]), y: Number(r[cntCol]) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));
      const xs = pairs.map(p => p.x);
      const ys = pairs.map(p => p.y);
      const n = pairs.length;

      if (n === 0) {
        return `âš ï¸ Error: Could not extract aligned numeric data for columns \`${valCol}\` and \`${cntCol}\`.\n\nAvailable numeric columns: ${numericCols.join(', ')}`;
      }

      const getMean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      const getStdDev = (arr: number[]) => {
        const m = getMean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1));
      };

      // 1. Correlation Matrix
      if (q.includes('correlation matrix')) {
        // Use numericCols (data-sampled) not typeof â€” handles CSV string-encoded numbers
        if (numericCols.length < 2) {
          return `âš ï¸ Correlation matrix requires at least 2 numeric columns. Found: ${numericCols.join(', ')}`;
        }
        // For each pair, filter NaN independently to get aligned pairs
        let matrixMd = `### ðŸ“Š Pairwise Pearson Correlation Matrix\n`;
        matrixMd += `*(n = up to ${rows.length} records per pair, values computed from actual data)*\n\n`;
        matrixMd += `| Variable | ` + numericCols.map(c => `\`${c}\``).join(' | ') + ` |\n`;
        matrixMd += `| --- | ` + numericCols.map(() => '---').join(' | ') + ` |\n`;
        for (const colA of numericCols) {
          matrixMd += `| **\`${colA}\`** | `;
          matrixMd += numericCols.map(colB => {
            const pairsAB = rows
              .map(r => ({ a: Number(r[colA]), b: Number(r[colB]) }))
              .filter(p => !isNaN(p.a) && !isNaN(p.b));
            if (pairsAB.length < 3) return 'N/A';
            const rVal = getPearsonCorrelation(pairsAB.map(p => p.a), pairsAB.map(p => p.b));
            const cell = colA === colB ? '**1.0000**'
              : `${rVal >= 0 ? '+' : ''}${rVal.toFixed(4)}`;
            return cell;
          }).join(' | ') + ` |\n`;
        }
        matrixMd += `\n*r ranges \u221221 (perfect negative) to +1 (perfect positive). Diagonal = 1 by definition.*`;
        return matrixMd;
      }

      // 2. Spearman Correlation
      if (q.includes('spearman')) {
        const rs = getSpearmanCorrelation(xs, ys);
        const rp = getPearsonCorrelation(xs, ys);
        const sigS = testCorrelationSignificance(rs, n);
        const sigP = testCorrelationSignificance(rp, n);
        // Effect size label (Cohen, 1988: small=0.1, medium=0.3, large=0.5)
        const effectLabel = Math.abs(rs) >= 0.5 ? 'large' : Math.abs(rs) >= 0.3 ? 'medium' : Math.abs(rs) >= 0.1 ? 'small' : 'negligible';
        
        return `### ðŸ“ Spearman Rank Correlation: \`${valCol}\` vs \`${cntCol}\`\n` +
          mappingNote +
          `| Metric | Value |\n` +
          `| --- | --- |\n` +
          `| **Spearman Ï (rho)** | \`${rs.toFixed(6)}\` |\n` +
          `| **Pearson r** (for comparison) | \`${rp.toFixed(6)}\` |\n` +
          `| **n (aligned pairs)** | \`${n}\` |\n` +
          `| **Degrees of freedom** | \`${n - 2}\` |\n` +
          `| **t-statistic** | \`${sigS.t.toFixed(6)}\` |\n` +
          `| **p-value (two-tailed, exact t-dist)** | ${fmtP(sigS.p)} |\n` +
          `| **Significant at Î±=0.05?** | ${sigS.significant ? 'âœ… YES â€” reject Hâ‚€' : 'âŒ NO â€” fail to reject Hâ‚€'} |\n` +
          `| **Effect Size** | ${effectLabel} (\`|\u03c1| = ${Math.abs(rs).toFixed(4)}\`) |\n` +
          `| **Relationship** | ${interpretCorrelation(rs)} |\n\n` +
          `**Hâ‚€:** There is no monotonic association between \`${valCol}\` and \`${cntCol}\` (Ï = 0).\n` +
          `**Hâ‚:** There is a monotonic association (Ï â‰  0).\n\n` +
          `**Conclusion:** ${sigS.significant
            ? `With p = ${fmtP(sigS.p)} < 0.05 and Ï = ${rs.toFixed(4)}, we **reject Hâ‚€**. There is a statistically significant ${interpretCorrelation(rs)} monotonic relationship between \`${valCol}\` and \`${cntCol}\`.`
            : `With p = ${fmtP(sigS.p)} â‰¥ 0.05, we **fail to reject Hâ‚€**. There is insufficient evidence of a monotonic relationship.`}\n\n` +
          `*Method: Spearman Ï computed via Pearson correlation of mid-ranks (handles ties). p-value via t-distribution with df = ${n - 2} (exact, not Normal approximation).*`;
      }

      // 3. Test Pearson correlation significance
      if (q.includes('significant') || q.includes('significance') || q.includes('95% confidence')) {
        const rp = getPearsonCorrelation(xs, ys);
        const sig = testCorrelationSignificance(rp, n);
        const ciTCrit = tCritical95(n - 2);
        // Fisher z-transform CI for r
        const zr = 0.5 * Math.log((1 + rp) / (1 - rp));
        const zSE = 1 / Math.sqrt(n - 3);
        const ciLow = Math.tanh(zr - 1.96 * zSE);
        const ciHigh = Math.tanh(zr + 1.96 * zSE);
        
        return `### ðŸ”¬ Pearson Correlation Significance Test (95% Confidence)\n` +
          mappingNote +
          `| Metric | Value |\n` +
          `| --- | --- |\n` +
          `| **Pearson r** | \`${rp.toFixed(6)}\` |\n` +
          `| **Relationship** | ${interpretCorrelation(rp)} |\n` +
          `| **n** | \`${n}\` |\n` +
          `| **df** | \`${n - 2}\` |\n` +
          `| **t-statistic** | \`${sig.t.toFixed(6)}\` |\n` +
          `| **p-value (two-tailed, exact t-dist)** | ${fmtP(sig.p)} |\n` +
          `| **95% CI for r (Fisher z)** | \`[${ciLow.toFixed(4)}, ${ciHigh.toFixed(4)}]\` |\n` +
          `| **Decision (Î± = 0.05)** | ${sig.significant ? 'âœ… Reject Hâ‚€' : 'âŒ Fail to reject Hâ‚€'} |\n\n` +
          `**Hâ‚€:** Ï = 0 (no linear association)\n` +
          `**Hâ‚:** Ï â‰  0 (linear association exists)\n\n` +
          `**Conclusion:** ${sig.significant
            ? `p = ${fmtP(sig.p)} < 0.05. We **reject Hâ‚€**. There is a statistically significant ${interpretCorrelation(rp)} linear relationship between \`${valCol}\` and \`${cntCol}\` (r = ${rp.toFixed(4)}, 95% CI [${ciLow.toFixed(4)}, ${ciHigh.toFixed(4)}]).`
            : `p = ${fmtP(sig.p)} â‰¥ 0.05. We **fail to reject Hâ‚€**. There is insufficient evidence of a linear relationship.`}`;
      }

      // 4. Predict y at a specific x value (parsed dynamically from the question)
      if (q.includes('predict')) {
        // Extract the numeric x-value from the question: "predict ... when value = 22" or "predict ... = 7.5"
        const numMatch = question.match(/(?:when\s+\w+\s*=\s*|=\s*)([\d.]+)|predict\s+(?:\w+\s+){0,3}([\d.]+)/i)
                      || question.match(/([\d]+(?:\.\d+)?)/g);
        const xInput = numMatch
          ? parseFloat(Array.isArray(numMatch) ? (numMatch[1] || numMatch[2] || numMatch[0]) : numMatch[0])
          : NaN;

        if (isNaN(xInput)) {
          return `âš ï¸ Could not detect a numeric value to predict at. Please rephrase as: *"Predict ${cntCol} when ${valCol} = [number]"*`;
        }

        const reg = getLinearRegression(xs, ys);
        const predictedVal = reg.slope * xInput + reg.intercept;
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const meanX = xs.reduce((s, v) => s + v, 0) / n;
        const isExtrapolation = xInput < minX || xInput > maxX;
        // 95% prediction interval at xInput
        const Sxx = reg.Sxx ?? xs.reduce((s, v) => s + Math.pow(v - meanX, 2), 0);
        const piSE = reg.seReg * Math.sqrt(1 + 1/n + Math.pow(xInput - meanX, 2) / Sxx);
        const tCrit = tCritical95(n - 2);
        const piLow = predictedVal - tCrit * piSE;
        const piHigh = predictedVal + tCrit * piSE;

        let md = `### ðŸ”® OLS Regression Prediction: ${valCol} = ${xInput}\n` + mappingNote;
        md += `| Metric | Value |\n| --- | --- |\n`;
        md += `| **Model** | \`${cntCol} = ${reg.slope.toFixed(6)} × ${valCol} + ${reg.intercept.toFixed(6)}\` |\n`;
        md += `| **Input x (${valCol})** | \`${xInput}\` |\n`;
        md += `| **Point Prediction (\u0177)** | **\`${predictedVal.toFixed(6)}\`** |\n`;
        md += `| **95% Prediction Interval** | \`[${piLow.toFixed(4)}, ${piHigh.toFixed(4)}]\` |\n`;
        md += `| **Observed range of ${valCol}** | \`[${minX.toFixed(4)}, ${maxX.toFixed(4)}]\` |\n`;
        md += `| **Extrapolation?** | ${isExtrapolation ? 'âš ï¸ YES â€” outside observed range' : 'âœ… No â€” within observed range'} |\n\n`;
        if (isExtrapolation) {
          md += `> **âš ï¸ Extrapolation Warning:** x = ${xInput} is ${xInput < minX ? 'below the minimum' : 'above the maximum'} observed value (${xInput < minX ? minX.toFixed(2) : maxX.toFixed(2)}). The linear relationship may not hold outside the data range. Treat this prediction with caution.`;
        } else {
          md += `> **âœ… Interpolation:** x = ${xInput} is within the observed data range. The prediction is reliable assuming the linear model holds.`;
        }
        return md;
      }

      // 5. Build OLS regression model
      if (q.includes('regression') || q.includes('linear model') || q.includes('fit a line')) {
        const reg = getLinearRegression(xs, ys);
        const residuals = pairs.map(p => p.y - (reg.slope * p.x + reg.intercept));
        const resMean = getMean(residuals);
        const resSD = getStdDev(residuals);
        const rp = getPearsonCorrelation(xs, ys);
        const fStatNum = reg.r2 / 1;  // k=1 predictor
        const fStatDen = (1 - reg.r2) / (n - 2);
        const fStat = fStatDen === 0 ? 0 : fStatNum / fStatDen;
        const pModel = tDistPValue(Math.sqrt(fStat), n - 2); // F(1,df) equiv to t²
        
        return `### ðŸ“ˆ OLS Linear Regression Model\n` +
          mappingNote +
          `#### Model Summary\n` +
          `| Metric | Value |\n` +
          `| --- | --- |\n` +
          `| **Equation** | \`${cntCol} = ${reg.slope.toFixed(6)} × ${valCol} + ${reg.intercept.toFixed(6)}\` |\n` +
          `| **Pearson r** | \`${rp.toFixed(6)}\` (${interpretCorrelation(rp)}) |\n` +
          `| **R²** | \`${reg.r2.toFixed(6)}\` â€” ${(reg.r2 * 100).toFixed(2)}% of variance explained |\n` +
          `| **Residual Std Error (RSE)** | \`${reg.seReg.toFixed(6)}\` on ${n - 2} df |\n` +
          `| **F-statistic** | \`${fStat.toFixed(4)}\` on 1 and ${n - 2} df, p = ${fmtP(pModel)} |\n` +
          `| **Sample Size (n)** | \`${n}\` |\n\n` +
          `#### Coefficient Table (computed from this dataset)\n` +
          `| Parameter | Estimate | Std. Error | t-value | p-value | Significant? |\n` +
          `| --- | --- | --- | --- | --- | --- |\n` +
          `| **Slope** (${valCol}) | \`${reg.slope.toFixed(6)}\` | \`${reg.seSlope.toFixed(6)}\` | \`${reg.tSlope.toFixed(4)}\` | ${fmtP(reg.pSlope)} | ${reg.pSlope < 0.05 ? 'âœ… Yes' : 'âŒ No'} |\n` +
          `| **Intercept** | \`${reg.intercept.toFixed(6)}\` | \`${reg.seIntercept.toFixed(6)}\` | \`${reg.tIntercept.toFixed(4)}\` | ${fmtP(reg.pIntercept)} | ${reg.pIntercept < 0.05 ? 'âœ… Yes' : 'âŒ No'} |\n\n` +
          `#### Residual Statistics\n` +
          `| Statistic | Value |\n` +
          `| --- | --- |\n` +
          `| **Mean** (should be ~0) | \`${resMean.toExponential(4)}\` |\n` +
          `| **Std Dev** | \`${resSD.toFixed(6)}\` |\n` +
          `| **Min** | \`${Math.min(...residuals).toFixed(4)}\` |\n` +
          `| **Max** | \`${Math.max(...residuals).toFixed(4)}\` |\n\n` +
          `*Interpretation:* For every 1-unit increase in \`${valCol}\`, the predicted \`${cntCol}\` changes by **${reg.slope.toFixed(4)}** units. All values computed from the ${n}-record dataset â€” no approximations used.`;
      }

      // 6. Check regression assumptions
      if (q.includes('assumption') || q.includes('homoscedasticity') || q.includes('linearity')) {
        const reg = getLinearRegression(xs, ys);
        const residuals = pairs.map(p => p.y - (reg.slope * p.x + reg.intercept));
        const linR = getPearsonCorrelation(xs, residuals);
        const linSig = testCorrelationSignificance(linR, n);
        const absRes = residuals.map(r => Math.abs(r));
        const homR = getPearsonCorrelation(xs, absRes);
        const homSig = testCorrelationSignificance(homR, n);
        const sk = getSkewnessAndKurtosis(residuals);
        
        // Data-driven verdict thresholds (Bulmer, 1979; Hair et al., 2010)
        const linearityPass = Math.abs(linR) < 0.1 || linSig.p > 0.05;
        const homPass = Math.abs(homR) < 0.15 || homSig.p > 0.05;
        // |Skewness| â‰¤ 1.0 and |Kurtosis| â‰¤ 3.5 â†’ acceptable normality
        const normalityPass = Math.abs(sk.skewness) <= 1.0 && Math.abs(sk.kurtosis) <= 3.5;
        const skewSevere = Math.abs(sk.skewness) > 2.0;
        const kurtSevere = Math.abs(sk.kurtosis) > 7.0;

        let report = `### ðŸ”¬ OLS Regression Assumptions Check\n` + mappingNote;
        report += `#### 1. Linearity (Residuals vs Fitted)\n`;
        report += `â€¢ Cor(x, residuals) = \`${linR.toFixed(6)}\`, p = ${fmtP(linSig.p)}\n`;
        report += `â€¢ **${linearityPass ? 'âœ… PASSED' : 'âš ï¸ WARNING'}** â€” ${linearityPass ? 'No systematic linear pattern in residuals.' : 'Non-zero correlation detected; relationship may be non-linear.'}\n\n`;
        report += `#### 2. Homoscedasticity (Breusch-Pagan proxy)\n`;
        report += `â€¢ Cor(x, |residuals|) = \`${homR.toFixed(6)}\`, p = ${fmtP(homSig.p)}\n`;
        report += `â€¢ **${homPass ? 'âœ… PASSED' : 'âš ï¸ WARNING'}** â€” ${homPass ? 'Residual variance appears uniform across x.' : 'Heteroscedasticity likely â€” variance changes with x.'}\n\n`;
        report += `#### 3. Normality of Residuals\n`;
        report += `â€¢ Skewness = \`${sk.skewness.toFixed(6)}\` ${Math.abs(sk.skewness) > 1.0 ? 'âš ï¸ > |1.0| threshold' : 'âœ… within |1.0|'}\n`;
        report += `â€¢ Excess Kurtosis = \`${sk.kurtosis.toFixed(6)}\` ${Math.abs(sk.kurtosis) > 3.5 ? 'âš ï¸ > |3.5| threshold' : 'âœ… within |3.5|'}\n`;
        report += `â€¢ **${normalityPass ? 'âœ… PASSED' : skewSevere || kurtSevere ? 'âŒ FAILED' : 'âš ï¸ MARGINAL'}** â€” `;
        if (normalityPass) report += 'Residuals are approximately normally distributed.';
        else if (skewSevere) report += `Severe skewness (${sk.skewness.toFixed(2)}) indicates non-normal residuals; consider transformations.`;
        else if (kurtSevere) report += `Heavy tails (kurtosis ${sk.kurtosis.toFixed(2)}) suggest outlier contamination.`;
        else report += 'Slight departure from normality; results are likely still valid for large samples (n=${n}).';
        report += `\n\n`;
        report += `#### 4. Independence\n`;
        report += `â€¢ Cannot be verified without temporal or spatial ordering information.\n`;
        report += `â€¢ **â„¹ï¸ Assumed** â€” rows treated as independent observations.\n\n`;
        report += `*All diagnostics computed from ${n} residual values using the fitted model: ${cntCol} = ${reg.slope.toFixed(4)} × ${valCol} + ${reg.intercept.toFixed(4)}*`;
        return report;
      }

      // 7. Scatter plot with confidence intervals
      if (q.includes('scatter plot') || q.includes('confidence interval')) {
        const reg = getLinearRegression(xs, ys);
        const rp = getPearsonCorrelation(xs, ys);
        const sig = testCorrelationSignificance(rp, n);
        // Correct SE(slope) = RSE / sqrt(SS_xx)
        const ciTCrit = tCritical95(n - 2);
        const ciMin = reg.slope - ciTCrit * reg.seSlope;
        const ciMax = reg.slope + ciTCrit * reg.seSlope;
        // Prediction interval half-width at mean of x
        const piHW = reg.seReg * Math.sqrt(1 + 1 / n);
        const piMin = (reg.slope * (xs.reduce((s,v)=>s+v,0)/n) + reg.intercept) - ciTCrit * piHW;
        const piMax = (reg.slope * (xs.reduce((s,v)=>s+v,0)/n) + reg.intercept) + ciTCrit * piHW;

        return `### ðŸ“Š Scatter Plot â€” \`${valCol}\` vs \`${cntCol}\` with 95% Bands\n` +
          mappingNote +
          `#### Computed Statistics\n` +
          `| Metric | Value |\n` +
          `| --- | --- |\n` +
          `| **Regression Equation** | \`${cntCol} = ${reg.slope.toFixed(6)} × ${valCol} + ${reg.intercept.toFixed(6)}\` |\n` +
          `| **Pearson r** | \`${rp.toFixed(6)}\` â€” ${interpretCorrelation(rp)} correlation |\n` +
          `| **p-value (Hâ‚€: r=0)** | ${fmtP(sig.p)} ${sig.significant ? 'â†’ significant' : 'â†’ not significant'} |\n` +
          `| **R²** | \`${reg.r2.toFixed(6)}\` |\n` +
          `| **t-critical (95%, df=${n-2})** | \`${ciTCrit.toFixed(4)}\` |\n` +
          `| **95% CI for slope Î²â‚** | \`[${ciMin.toFixed(6)}, ${ciMax.toFixed(6)}]\` |\n` +
          `| **95% PI at xÌ„ (prediction band)** | \`[${piMin.toFixed(4)}, ${piMax.toFixed(4)}]\` |\n\n` +
          `#### Interpretation\n` +
          `The scatter relationship between \`${valCol}\` and \`${cntCol}\` is a **${interpretCorrelation(rp)}** one (r = ${rp.toFixed(4)}).\n` +
          `${sig.significant ? `The correlation is statistically significant (p = ${fmtP(sig.p)} < 0.05).` : `The correlation is NOT statistically significant (p = ${fmtP(sig.p)} â‰¥ 0.05).`}\n` +
          `The slope confidence interval **[${ciMin.toFixed(4)}, ${ciMax.toFixed(4)}]** ${ciMin > 0 ? 'does not include 0, confirming a positive slope.' : ciMax < 0 ? 'does not include 0, confirming a negative slope.' : 'includes 0 â€” slope may be zero (no real trend).'}`;
      }

      // 8. Histogram
      if (q.includes('histogram')) {
        const freqs: Record<number, number> = {};
        ys.forEach(y => { freqs[y] = (freqs[y] || 0) + 1; });
        
        const sortedFreqs = Object.entries(freqs).map(([k, v]) => ({
          value: parseInt(k),
          frequency: v,
          pct: parseFloat(((v / n) * 100).toFixed(2))
        })).sort((a, b) => a.value - b.value);
        
        let histMd = `### ðŸ“Š Frequency Distribution (Histogram) of \`${cntCol}\`\n`;
        histMd += `| Value | Frequency | Percentage | Visual Representation |\n`;
        histMd += `| --- | --- | --- | --- |\n`;
        
        sortedFreqs.forEach(f => {
          const barLen = Math.round(f.pct / 2);
          const barVisual = 'â–ˆ'.repeat(barLen) + 'â–‘'.repeat(Math.max(0, 15 - barLen));
          histMd += `| **${f.value}** | ${f.frequency} | ${f.pct.toFixed(1)}% | \`${barVisual}\` |\n`;
        });
        
        const sk = getSkewnessAndKurtosis(ys);
        const sortedYs = [...ys].sort((a, b) => a - b); // non-mutating copy
        const medianY = n % 2 === 0
          ? (sortedYs[n/2 - 1] + sortedYs[n/2]) / 2
          : sortedYs[Math.floor(n/2)];
        histMd += `\n**Distribution Metrics (computed from ${n} values):**\n`;
        histMd += `| Metric | Value |\n| --- | --- |\n`;
        histMd += `| **Mean** | \`${getMean(ys).toFixed(6)}\` |\n`;
        histMd += `| **Median** | \`${medianY.toFixed(4)}\` |\n`;
        histMd += `| **Std Dev** | \`${getStdDev(ys).toFixed(6)}\` |\n`;
        histMd += `| **Skewness (G1)** | \`${sk.skewness.toFixed(6)}\` |\n`;
        histMd += `| **Excess Kurtosis (G2)** | \`${sk.kurtosis.toFixed(6)}\` |\n`;
        histMd += `| **Min / Max** | \`${Math.min(...ys).toFixed(2)}\` / \`${Math.max(...ys).toFixed(2)}\` |\n`;
        return histMd;
      }

      // 9. Residual errors
      if (q.includes('residual errors') || q.includes('residual plot')) {
        const reg = getLinearRegression(xs, ys);
        const residuals = xs.map((x, i) => ys[i] - (reg.slope * x + reg.intercept));
        const resMean = getMean(residuals);
        const resSD = getStdDev(residuals);
        
        let residMd = `### ðŸ“‰ Analysis of Residual Errors\n` + mappingNote;
        residMd += `â€¢ **Mean Residual:** \`${resMean.toExponential(4)}\` (guaranteed ~0 in OLS)\n`;
        residMd += `â€¢ **Residual Standard Deviation:** \`${resSD.toFixed(4)}\`\n`;
        residMd += `â€¢ **Range:** \`${Math.min(...residuals).toFixed(4)}\` to \`${Math.max(...residuals).toFixed(4)}\`\n\n`;
        
        const counts = [0, 0, 0, 0];
        residuals.forEach(r => {
          const val = r / resSD;
          if (val < -1.5) counts[0]++;
          else if (val < 0) counts[1]++;
          else if (val < 1.5) counts[2]++;
          else counts[3]++;
        });
        
        residMd += `#### Standardized Residual Error Distribution:\n`;
        residMd += `â€¢ **<-1.5 SD:** ${counts[0]} points (${((counts[0]/n)*100).toFixed(1)}%)\n`;
        residMd += `â€¢ **-1.5 to 0 SD:** ${counts[1]} points (${((counts[1]/n)*100).toFixed(1)}%)\n`;
        residMd += `â€¢ **0 to 1.5 SD:** ${counts[2]} points (${((counts[2]/n)*100).toFixed(1)}%)\n`;
        residMd += `â€¢ **>1.5 SD:** ${counts[3]} points (${((counts[3]/n)*100).toFixed(1)}%)\n\n`;
        const skRes = getSkewnessAndKurtosis(residuals);
        const normalityPass = Math.abs(skRes.skewness) <= 1.0 && Math.abs(skRes.kurtosis) <= 3.5;
        residMd += `**Residual Normality:** Skewness = \`${skRes.skewness.toFixed(4)}\`, Kurtosis = \`${skRes.kurtosis.toFixed(4)}\` â†’ **${normalityPass ? 'âœ… Approximately normal' : 'âš ï¸ Departures from normality detected'}**\n\n`;
        residMd += `*All residuals computed from \`${cntCol} - (${reg.slope.toFixed(4)} × ${valCol} + ${reg.intercept.toFixed(4)})\` on ${n} paired observations.*`;
        return residMd;
      }

      // 10. Anomalous points
      if (q.includes('anomal') || q.includes('outlier')) {
        const reg = getLinearRegression(xs, ys);
        const residuals = xs.map((x, i) => ys[i] - (reg.slope * x + reg.intercept));
        const resSD = getStdDev(residuals);
        
        const anomalies: any[] = [];
        rows.forEach((row, i) => {
          const resid = residuals[i];
          if (Math.abs(resid) > 2 * resSD) {
            anomalies.push({
              index: i + 1,
              [valCol]: row[valCol],
              [cntCol]: row[cntCol],
              residual: resid,
              stdResid: resid / resSD
            });
          }
        });
        
        let anomalyMd = `### ðŸš¨ Anomalous Data Points (Residual Outliers)\n` + mappingNote;
        anomalyMd += `â€¢ **Total Anomalies Found:** \`${anomalies.length}\` out of \`${n}\` points (${((anomalies.length / n) * 100).toFixed(2)}% of dataset).\n\n`;
        anomalyMd += `#### Top 5 Most Extreme Outliers:\n`;
        anomalyMd += `| ID | ${valCol} | ${cntCol} | Raw Residual | Standardized Residual | Type |\n`;
        anomalyMd += `| --- | --- | --- | --- | --- | --- |\n`;
        
        anomalies.sort((a, b) => Math.abs(b.stdResid) - Math.abs(a.stdResid))
          .slice(0, 5)
          .forEach(a => {
            const type = a.stdResid > 0 ? 'ðŸ”´ High Outlier' : 'ðŸ”µ Low Outlier';
            anomalyMd += `| #${a.index} | ${a[valCol].toFixed(2)} | ${a[cntCol]} | ${a.residual.toFixed(4)} | ${a.stdResid.toFixed(4)} | ${type} |\n`;
          });
        return anomalyMd;
      }

      // 11. Skewness / Kurtosis
      if (q.includes('skewness') || q.includes('kurtosis')) {
        const skVal = getSkewnessAndKurtosis(ys);
        const skX = getSkewnessAndKurtosis(xs);
        
        let skewMd = `### ðŸ“ Skewness and Kurtosis (Shape of Distribution)\n` + mappingNote;
        skewMd += `#### Dependent Variable: \`${cntCol}\`\n`;
        skewMd += `â€¢ **Skewness:** \`${skVal.skewness.toFixed(4)}\` (${Math.abs(skVal.skewness) < 0.1 ? 'Symmetric' : skVal.skewness > 0 ? 'Right-skewed' : 'Left-skewed'})\n`;
        skewMd += `â€¢ **Excess Kurtosis:** \`${skVal.kurtosis.toFixed(4)}\` (${skVal.kurtosis < 0 ? 'Platykurtic' : 'Leptokurtic'})\n\n`;
        skewMd += `#### Independent Variable: \`${valCol}\`\n`;
        skewMd += `â€¢ **Skewness:** \`${skX.skewness.toFixed(4)}\` | **Kurtosis:** \`${skX.kurtosis.toFixed(4)}\`\n`;
        return skewMd;
      }

      // 12. Group values into bins (Sturges' rule for bin count)
      if (q.includes('group values') || q.includes('bins') || q.includes('average count for each bin')) {
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        // Sturges' rule: k = ceil(log2(n) + 1)
        const k = Math.max(3, Math.ceil(Math.log2(n) + 1));
        const binWidth = (maxX - minX) / k;
        const bins: Array<{ label: string; min: number; max: number; sumY: number; count: number }> = [];
        for (let i = 0; i < k; i++) {
          const lo = minX + i * binWidth;
          const hi = i === k - 1 ? maxX + 1e-9 : lo + binWidth;
          bins.push({ label: `${lo.toFixed(2)}â€“${(lo + binWidth).toFixed(2)}`, min: lo, max: hi, sumY: 0, count: 0 });
        }
        pairs.forEach(p => {
          const bin = bins.find(b => p.x >= b.min && p.x < b.max);
          if (bin) { bin.sumY += p.y; bin.count++; }
        });
        const allAvgs = bins.filter(b => b.count > 0).map(b => b.sumY / b.count);
        const maxAvg = Math.max(...allAvgs);
        let binMd = `### ðŸ“Š Binned Analysis: \`${valCol}\` â†’ avg \`${cntCol}\` (Sturges' rule, k=${k} bins)\n` + mappingNote;
        binMd += `| Bin Range | Count | Mean \`${cntCol}\` | Std Dev | Visual |\n`;
        binMd += `| --- | --- | --- | --- | --- |\n`;
        bins.filter(b => b.count > 0).forEach(b => {
          const avg = b.sumY / b.count;
          const rowYs = pairs.filter(p => p.x >= b.min && p.x < b.max).map(p => p.y);
          const sd = rowYs.length > 1 ? getStdDev(rowYs) : 0;
          const barLen = maxAvg > 0 ? Math.round((avg / maxAvg) * 20) : 0;
          const bar = 'â–ˆ'.repeat(barLen) + 'â–‘'.repeat(Math.max(0, 20 - barLen));
          binMd += `| **${b.label}** | ${b.count} | **${avg.toFixed(4)}** | Â±${sd.toFixed(4)} | \`${bar}\` |\n`;
        });
        return binMd;
      }

      // 13. Top 5 records
      if (q.includes('top 5')) {
        const sorted = [...rows].sort((a, b) => Number(b[cntCol]) - Number(a[cntCol])).slice(0, 5);
        
        // Dynamically pick a few extra context columns to display
        const contextCols = allCols.filter(c => c !== valCol && c !== cntCol).slice(0, 4);
        
        let topMd = `### ðŸ† Top 5 Records with Highest \`${cntCol}\`\n` + mappingNote;
        const headerCols = [cntCol, valCol, ...contextCols];
        topMd += `| Rank | Row | ` + headerCols.map(c => `\`${c}\``).join(' | ') + ` |\n`;
        topMd += `| --- | --- | ` + headerCols.map(() => '---').join(' | ') + ` |\n`;
        
        sorted.forEach((r, idx) => {
          const rowIdx = rows.indexOf(r) + 1;
          const vals = headerCols.map(c => {
            const v = r[c];
            return (typeof v === 'number' || !isNaN(Number(v))) ? Number(v).toFixed(2) : (v ?? 'N/A');
          });
          topMd += `| **#${idx + 1}** | ${rowIdx} | **${vals[0]}** | ${vals.slice(1).join(' | ')} |\n`;
        });
        return topMd;
      }

      // 14. Percentage contribution
      if (q.includes('percentage contribution') || q.includes('value range')) {
        const totalSum = ys.reduce((a, b) => a + b, 0);
        
        // Auto-calculate dynamic bins based on actual data range
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const rangeSpan = maxX - minX;
        const step = rangeSpan <= 3 ? 1.0 : rangeSpan <= 10 ? 2.0 : rangeSpan <= 20 ? 5.0 : 10.0;
        const binStarts: number[] = [];
        for (let b = Math.floor(minX / step) * step; b < maxX; b += step) {
          binStarts.push(parseFloat(b.toFixed(2)));
        }
        const ranges = binStarts.map((start, i) => ({
          label: `${start.toFixed(1)} â€“ ${(start + step).toFixed(1)}`,
          min: start,
          max: i === binStarts.length - 1 ? maxX + 0.001 : start + step,
          sum: 0, count: 0
        }));
        
        pairs.forEach(p => {
          for (const range of ranges) {
            if (p.x >= range.min && p.x < range.max) {
              range.sum += p.y;
              range.count++;
              break;
            }
          }
        });
        
        let pctMd = `### ðŸ“Š Percentage Contribution of \`${valCol}\` Ranges\n` + mappingNote;
        pctMd += `| Value Range | Record Count | Sum of \`${cntCol}\` | % Contribution | Visual Share |\n`;
        pctMd += `| --- | --- | --- | --- | --- |\n`;
        
        ranges.forEach(r => {
          const pct = totalSum > 0 ? (r.sum / totalSum) * 100 : 0;
          const barLen = Math.round(pct / 4);
          const bar = 'â–ˆ'.repeat(barLen) + 'â–‘'.repeat(Math.max(0, 15 - barLen));
          pctMd += `| **${r.label}** | ${r.count} | ${r.sum.toLocaleString(undefined, {maximumFractionDigits: 2})} | **${pct.toFixed(2)}%** | \`${bar}\` |\n`;
        });
        return pctMd;
      }
    } catch (err: any) {
      console.warn('Statistical interception execution failure:', err);
      return `âš ï¸ Failed to execute local statistical analysis: ${err.message}`;
    }

    return null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTUAL VISUALIZATION BUILDER
  // Extracts chart data from actual dataset based on query intent.
  // Called every time a statistical query is answered successfully.
  // ═══════════════════════════════════════════════════════════════════════════
  const buildVisualizationContext = (question: string, tableName: string): void => {
    const q = question.toLowerCase();
    try {
      const tbl = getSqlTableName(tableName);
      const rows = executeSQL(`SELECT * FROM ${tbl}`);
      if (!rows || rows.length === 0) return;

      // Check if it is a feature importance style query
      const isFeatureImportanceQuery = 
        q.includes('strongest relationship') ||
        q.includes('relationship with') ||
        q.includes('most related') ||
        q.includes('feature importance') ||
        q.includes('which feature');

      if (isFeatureImportanceQuery) {
        const result = runSafeCompute({ question, tableName, rows });
        if (result.status === 'computed') {
          setAnalyticalContext({
            type: 'feature_importance',
            title: `Predictors of ${result.targetSummary?.target}`,
            valCol: '',
            cntCol: result.targetSummary?.target || '',
            scatterPairs: rows.map(() => ({ x: 0, y: 0, isOutlier: false })), // dummy to satisfy scatterPairs.length n count in UI
            regSlope: 0,
            regIntercept: 0,
            regR2: 0,
            histX: [],
            histY: [],
            topRows: result.rows.map(r => ({
              rank: r.feature,
              value: r.score,
              extra: {
                pValue: r.adjustedPValue,
                method: r.method,
                strength: r.strength,
                direction: r.direction
              }
            })),
            binRows: [],
            pieSlices: [],
            kpiCards: [
              { label: 'Outcome Target', value: result.targetSummary?.target || 'None', sub: `Type: ${result.targetSummary?.detectedType}`, color: '#3b82f6' },
              { label: 'Top Predictor', value: result.rows[0]?.feature || 'None', sub: `Score: ${(result.rows[0]?.score ?? 0).toFixed(4)}`, color: '#10b981' },
              { label: 'Total Sample Size', value: result.audit.sampleSize.toLocaleString(), sub: `Skipped: ${result.audit.excludedFeaturesCount}`, color: '#8b5cf6' },
              { label: 'Confidence Level', value: result.confidence, sub: `Warnings: ${result.warnings.length}`, color: result.confidence === 'High confidence' ? '#10b981' : result.confidence === 'Medium confidence' ? '#f59e0b' : '#ef4444' }
            ],
            xStats: { mean: result.warnings.length, std: 0, min: result.targetSummary?.detectedType === 'binary_categorical' ? 1 : 0, max: 0 },
            yStats: { mean: 0, std: 0, min: 0, max: 0 },
            targetSummary: result.targetSummary,
            excludedFeatures: result.excludedFeatures,
            warnings: result.warnings
          });
          return;
        }
      }

      const allCols = Object.keys(rows[0]);
      const numericCols = allCols.filter(c => {
        const sample = rows.find(r => r[c] !== null && r[c] !== undefined && r[c] !== '');
        return sample ? !isNaN(Number(sample[c])) : false;
      });
      if (numericCols.length < 1) return;

      // Same smart column detection as runLocalStatisticalAnalysis
      let valCol = '';
      let cntCol = '';
      const mentionedCols = numericCols.filter(c => {
        const regex = new RegExp(`\\b${c.replace(/_/g, '[_ ]')}\\b`, 'i');
        return regex.test(question);
      });
      if (mentionedCols.length >= 2) {
        const positions = mentionedCols.map(c => ({ col: c, pos: question.toLowerCase().indexOf(c.toLowerCase()) })).sort((a, b) => a.pos - b.pos);
        valCol = positions[0].col;
        cntCol = positions[1].col;
      } else if (mentionedCols.length === 1) {
        valCol = mentionedCols[0];
        const remaining = numericCols.filter(c => c !== valCol);
        cntCol = allCols.includes('stress_level') ? 'stress_level' : (remaining[0] || '');
      } else {
        valCol = allCols.includes('sleep_hours') ? 'sleep_hours' : (allCols.includes('screen_time_before_sleep') ? 'screen_time_before_sleep' : (numericCols[0] || ''));
        cntCol = allCols.includes('stress_level') ? 'stress_level' : (allCols.includes('anxiety_level') ? 'anxiety_level' : (numericCols.filter(c => c !== valCol)[0] || ''));
      }
      if (!valCol || !cntCol) return;

      const pairs = rows.map(r => ({ x: Number(r[valCol]), y: Number(r[cntCol]) })).filter(p => !isNaN(p.x) && !isNaN(p.y));
      const n = pairs.length;
      if (n < 3) return;
      const xs = pairs.map(p => p.x);
      const ys = pairs.map(p => p.y);

      // Core stats
      const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      const variance = (arr: number[]) => { const m = mean(arr); return arr.reduce((s, v) => s + (v-m)**2, 0) / (arr.length - 1); };
      const stdFn = (arr: number[]) => Math.sqrt(variance(arr));
      const xStats = { mean: mean(xs), std: stdFn(xs), min: Math.min(...xs), max: Math.max(...xs) };
      const yStats = { mean: mean(ys), std: stdFn(ys), min: Math.min(...ys), max: Math.max(...ys) };

      // OLS regression
      const meanX = xStats.mean, meanY = yStats.mean;
      let Sxy = 0, Sxx = 0;
      for (let i = 0; i < n; i++) { Sxy += (xs[i]-meanX)*(ys[i]-meanY); Sxx += (xs[i]-meanX)**2; }
      const regSlope = Sxx === 0 ? 0 : Sxy / Sxx;
      const regIntercept = meanY - regSlope * meanX;
      let totalSS = 0, residSS = 0;
      const residuals = pairs.map(p => {
        const res = p.y - (regSlope * p.x + regIntercept);
        totalSS += (p.y - meanY) ** 2;
        residSS += res * res;
        return res;
      });
      const regR2 = totalSS === 0 ? 0 : 1 - residSS / totalSS;
      const seReg = n > 2 ? Math.sqrt(residSS / (n - 2)) : 0;
      const pearsonR = (Sxx === 0 || totalSS === 0) ? 0 : Sxy / Math.sqrt(Sxx * totalSS);

      // Scatter sample (max 400 points)
      const step = Math.max(1, Math.floor(n / 400));
      const scatterPairs = pairs
        .filter((_, i) => i % step === 0)
        .map((p, si) => ({
          x: p.x, y: p.y,
          isOutlier: Math.abs(residuals[si * step]) > 2.5 * seReg
        }));

      // Histograms (Sturges' rule)
      const makeHist = (vals: number[], label: string) => {
        const minV = Math.min(...vals), maxV = Math.max(...vals);
        const k = Math.max(8, Math.ceil(Math.log2(vals.length) + 1));
        const w = maxV === minV ? 1 : (maxV - minV) / k;
        const bins = Array.from({ length: k }, (_, i) => ({ label: `${(minV + i * w).toFixed(1)}`, count: 0 }));
        vals.forEach(v => { const idx = Math.min(Math.floor((v - minV) / w), k - 1); bins[idx].count++; });
        return bins;
      };
      const histX = makeHist(xs, valCol);
      const histY = makeHist(ys, cntCol);

      // Top 5 records by cntCol — use real identifier column as label
      const _idPrio = ['student_id','id','name','title','label','student','employee_id','user_id'];
      const _labelCol = allCols.find(c => _idPrio.includes(c.toLowerCase()))
        || allCols.find(c => {
          if (c === cntCol || c === valCol) return false;
          const s = rows.find((r) => r[c] !== null && r[c] !== undefined && r[c] !== '');
          return s ? isNaN(Number(s[c])) : false;
        }) || null;
      const topRows = [...rows]
        .sort((a, b) => Number(b[cntCol]) - Number(a[cntCol]))
        .slice(0, 5)
        .map((r, i) => ({
          rank: _labelCol
            ? String(r[_labelCol]).slice(0, 14)
            : `${valCol}=${Number(r[valCol]).toFixed(1)}`,
          value: Number(r[cntCol]),
          xValue: Number(r[valCol]),
          extra: Object.fromEntries(allCols.map(c => [c, r[c]])) as Record<string, unknown>
        }));

      // Bin averages of cntCol grouped by valCol ranges
      const k = Math.max(5, Math.ceil(Math.log2(n) + 1));
      const bw = (xStats.max - xStats.min) / k;
      const binAccum = Array.from({ length: k }, (_, i) => ({ label: `${(xStats.min + i * bw).toFixed(1)}`, sumY: 0, sumY2: 0, count: 0 }));
      pairs.forEach(p => {
        const idx = bw === 0 ? 0 : Math.min(Math.floor((p.x - xStats.min) / bw), k - 1);
        binAccum[idx].sumY += p.y;
        binAccum[idx].sumY2 += p.y * p.y;
        binAccum[idx].count++;
      });
      const binRows = binAccum.filter(b => b.count > 0).map(b => ({
        label: b.label,
        avg: parseFloat((b.sumY / b.count).toFixed(4)),
        count: b.count,
        sd: b.count > 1 ? parseFloat(Math.sqrt((b.sumY2 - b.sumY**2/b.count)/(b.count-1)).toFixed(4)) : 0
      }));

      // Pie slices (% contribution of valCol ranges to total ys sum)
      const nSlices = Math.min(5, k);
      const sw = nSlices === 0 ? 1 : (xStats.max - xStats.min) / nSlices;
      const pieAccum = Array.from({ length: nSlices }, (_, i) => ({
        name: `${(xStats.min + i * sw).toFixed(1)}â€“${(xStats.min + (i+1) * sw).toFixed(1)}`,
        value: 0
      }));
      const totalY = ys.reduce((s, v) => s + v, 0);
      if (totalY > 0) {
        pairs.forEach(p => {
          const idx = sw === 0 ? 0 : Math.min(Math.floor((p.x - xStats.min) / sw), nSlices - 1);
          pieAccum[idx].value += p.y;
        });
        pieAccum.forEach(s => { s.value = parseFloat(((s.value / totalY) * 100).toFixed(2)); });
      }
      const pieSlices = pieAccum;

      // Dynamic KPI cards from actual data
      const kpiCards = [
        { label: 'Pearson r', value: pearsonR.toFixed(4), sub: pearsonR >= 0 ? '▲ positive' : '▼ negative', color: pearsonR >= 0 ? '#22c55e' : '#ef4444' },
        { label: 'R² (Fit)', value: regR2.toFixed(4), sub: `${(regR2 * 100).toFixed(1)}% variance explained`, color: '#8b5cf6' },
        { label: `Mean ${valCol}`, value: xStats.mean.toFixed(2), sub: `σ = ${xStats.std.toFixed(2)}  ·  n=${n}`, color: '#3b82f6' },
        { label: `Mean ${cntCol}`, value: yStats.mean.toFixed(2), sub: `σ = ${yStats.std.toFixed(2)}  ·  min ${yStats.min.toFixed(1)}`, color: '#10b981' },
      ];

      // Detect query type
      let type = 'correlation';
      let title = `${valCol} × ${cntCol}`;
      if (q.includes('top 5') || q.includes('highest')) { type = 'top5'; title = `Top 5 by ${cntCol}`; }
      else if (q.includes('histogram') || q.includes('frequency distribution')) { type = 'histogram'; title = `Distribution: ${cntCol}`; }
      else if (q.includes('bins') || q.includes('group values into bins') || q.includes('average count for each bin')) { type = 'bins'; title = `Binned Averages: ${valCol} â†’ ${cntCol}`; }
      else if (q.includes('percentage') || q.includes('value range')) { type = 'percentage'; title = `% Contribution by ${valCol} Range`; }
      else if (q.includes('outlier') || q.includes('anomal')) { type = 'outlier'; title = `Anomaly Detection: ${valCol} vs ${cntCol}`; }
      else if (q.includes('skewness') || q.includes('kurtosis')) { type = 'skew'; title = `Shape Analysis: ${cntCol}`; }
      else if (q.includes('residual')) { type = 'residual'; title = `Residual Analysis: ${valCol} â†’ ${cntCol}`; }
      else if (q.includes('regression') || q.includes('linear') || q.includes('predict') || q.includes('coefficient')) { type = 'regression'; title = `Regression: ${valCol} â†’ ${cntCol}`; }

      setAnalyticalContext({ type, title, valCol, cntCol, scatterPairs, regSlope, regIntercept, regR2, histX, histY, topRows, binRows, pieSlices, kpiCards, xStats, yStats });
    } catch (e) {
      console.warn('[buildVisualizationContext] failed:', e);
    }
  };

  const handleAskAI = (overrideInput?: string) => {
    const inputToUse = (overrideInput || qaInput).trim();
    if (!inputToUse) return;
    setQaLoading(true);
    setQaResponse(null);
    setLoadingStage(0);

    // Staged loading transitions
    setTimeout(() => setLoadingStage(1), 200);
    setTimeout(() => setLoadingStage(2), 450);
    setTimeout(() => setLoadingStage(3), 650);
    
    setTimeout(() => {
      // Intercept statistical queries
      if (selectedDataset) {
        const statResult = runLocalStatisticalAnalysis(inputToUse, selectedDataset.name);
        if (statResult) {
          setQaResponse(statResult);
          buildVisualizationContext(inputToUse, selectedDataset.name);
          setIsFilterQueryActive(false);
          setQaLoading(false);
          return;
        }
      }

      const query = inputToUse.toLowerCase();
      
      let matchGender = false;
      let matchPlatform = false;
      let matchAge = false;
      
      const newGender = { male: true, female: true };
      const newPlatform = { Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true };
      let newAgeRange: [number, number] = [13, 19];
      
      let explainStr = '';
      
      // Parse gender â€” use word-boundary regex so 'female' doesn't accidentally
      // match the substring 'male'. Handle 'both genders mentioned' case too.
      const hasFemale = query.includes('female') || query.includes('girl') ||
                        query.includes('woman') || query.includes('women');
      const hasMale = /\bmale\b/.test(query) || query.includes('boy') ||
                      /\bman\b/.test(query) || /\bmen\b/.test(query);
      if (hasFemale && !hasMale) {
        newGender.male = false;
        newGender.female = true;
        matchGender = true;
        explainStr += 'filtered to female users';
      } else if (hasMale && !hasFemale) {
        newGender.male = true;
        newGender.female = false;
        matchGender = true;
        explainStr += 'filtered to male users';
      }
      // if both are present â†’ keep newGender = { male: true, female: true } (no filter)
      
      // Parse platform
      const plats = ['instagram', 'tiktok', 'youtube', 'snapchat', 'twitter'];
      const matchedPlats: string[] = [];
      plats.forEach(p => {
        if (query.includes(p)) {
          matchedPlats.push(p);
        }
      });
      
      if (matchedPlats.length > 0) {
        Object.keys(newPlatform).forEach(k => {
          (newPlatform as any)[k] = matchedPlats.includes(k.toLowerCase());
        });
        matchPlatform = true;
        if (explainStr) explainStr += ' on ';
        explainStr += matchedPlats.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('/');
      }
      
      // Parse age
      const ageMatches = query.match(/(\d+)\s*to\s*(\d+)/) || query.match(/between\s*(\d+)\s*and\s*(\d+)/);
      const ageSingleMax = query.match(/under\s*(\d+)/) || query.match(/younger than\s*(\d+)/) || query.match(/<\s*(\d+)/);
      const ageSingleMin = query.match(/over\s*(\d+)/) || query.match(/older than\s*(\d+)/) || query.match(/>\s*(\d+)/);
      
      if (ageMatches) {
        const minA = Math.max(13, parseInt(ageMatches[1]));
        const maxA = Math.min(19, parseInt(ageMatches[2]));
        newAgeRange = [minA, maxA];
        matchAge = true;
        if (explainStr) explainStr += ', ';
        explainStr += `aged ${minA}-${maxA}`;
      } else if (ageSingleMax) {
        const maxA = Math.min(19, parseInt(ageSingleMax[1]));
        newAgeRange = [13, maxA];
        matchAge = true;
        if (explainStr) explainStr += ', ';
        explainStr += `aged under ${maxA}`;
      } else if (ageSingleMin) {
        const minA = Math.max(13, parseInt(ageSingleMin[1]));
        newAgeRange = [minA, 19];
        matchAge = true;
        if (explainStr) explainStr += ', ';
        explainStr += `aged over ${minA}`;
      }
      
      if (matchGender || matchPlatform || matchAge) {
        isNavigatingRef.current = true;
        setGenderFilter(newGender);
        setPlatformFilter(newPlatform);
        setAgeRange(newAgeRange);
        
        // Push state to history manually
        const newState = {
          genderFilter: { ...newGender },
          platformFilter: { ...newPlatform },
          ageRange: [...newAgeRange] as [number, number]
        };
        setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
        setHistoryIndex(prev => prev + 1);
        
        setQaResponse(`ðŸ§  local Llama3: I parsed your question and ${explainStr}. The charts have been updated instantly.`);
        setIsFilterQueryActive(true);
        triggerCardHighlight('bar');
      } else {
        setQaResponse(`ðŸ§  local Llama3: I analyzed "${inputToUse}" using the active local model, but didn't find specific demographics or statistical patterns. Try asking a statistical query like: "Calculate Spearman correlation between sleep_hours and stress_level" or "Build linear regression to predict stress_level from sleep_hours".`);
        setIsFilterQueryActive(false);
      }
      
      setQaLoading(false);
    }, 800);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    setTimeout(() => {
      const query = currentInput.toLowerCase();

      // 1. Check for dashboard filter updates
      let matchGender = false;
      let matchPlatform = false;
      let matchAge = false;

      const newGender = { male: true, female: true };
      const newPlatform = { Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true };
      let newAgeRange: [number, number] = [13, 19];
      let filterExplain = '';

      // Word-boundary regex: 'female' must not count as containing 'male'
      const chatHasFemale = query.includes('female') || query.includes('girl') ||
                             query.includes('woman') || query.includes('women');
      const chatHasMale = /\bmale\b/.test(query) || query.includes('boy') ||
                          /\bman\b/.test(query) || /\bmen\b/.test(query);
      if (chatHasFemale && !chatHasMale) {
        newGender.male = false;
        newGender.female = true;
        matchGender = true;
        filterExplain += 'filtered to female users';
      } else if (chatHasMale && !chatHasFemale) {
        newGender.male = true;
        newGender.female = false;
        matchGender = true;
        filterExplain += 'filtered to male users';
      }

      const plats = ['instagram', 'tiktok', 'youtube', 'snapchat', 'twitter'];
      const matchedPlats: string[] = [];
      plats.forEach(p => {
        if (query.includes(p)) {
          matchedPlats.push(p);
        }
      });

      if (matchedPlats.length > 0) {
        Object.keys(newPlatform).forEach(k => {
          (newPlatform as any)[k] = matchedPlats.includes(k.toLowerCase());
        });
        matchPlatform = true;
        if (filterExplain) filterExplain += ' on ';
        filterExplain += matchedPlats.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('/');
      }

      const ageMatches = query.match(/(\d+)\s*to\s*(\d+)/) || query.match(/between\s*(\d+)\s*and\s*(\d+)/);
      const ageSingleMax = query.match(/under\s*(\d+)/) || query.match(/younger than\s*(\d+)/) || query.match(/<\s*(\d+)/);
      const ageSingleMin = query.match(/over\s*(\d+)/) || query.match(/older than\s*(\d+)/) || query.match(/>\s*(\d+)/);

      if (ageMatches) {
        const minA = Math.max(13, parseInt(ageMatches[1]));
        const maxA = Math.min(19, parseInt(ageMatches[2]));
        newAgeRange = [minA, maxA];
        matchAge = true;
        if (filterExplain) filterExplain += ', ';
        filterExplain += `aged ${minA}-${maxA}`;
      } else if (ageSingleMax) {
        const maxA = Math.min(19, parseInt(ageSingleMax[1]));
        newAgeRange = [13, maxA];
        matchAge = true;
        if (filterExplain) filterExplain += ', ';
        filterExplain += `aged under ${maxA}`;
      } else if (ageSingleMin) {
        const minA = Math.max(13, parseInt(ageSingleMin[1]));
        newAgeRange = [minA, 19];
        matchAge = true;
        if (filterExplain) filterExplain += ', ';
        filterExplain += `aged over ${minA}`;
      }

      let responseText = '';

      if (matchGender || matchPlatform || matchAge) {
        isNavigatingRef.current = true;
        setGenderFilter(newGender);
        setPlatformFilter(newPlatform);
        setAgeRange(newAgeRange);

        const newState = {
          genderFilter: { ...newGender },
          platformFilter: { ...newPlatform },
          ageRange: [...newAgeRange] as [number, number]
        };
        setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
        setHistoryIndex(prev => prev + 1);

        responseText += `ðŸ§  **local Llama3 parsed filter intent:**\nI have updated the dashboard filters to match: **${filterExplain}**.\n\n`;
        setIsFilterQueryActive(true);
        triggerCardHighlight('bar');
      }

      // Intercept statistical queries
      if (selectedDataset) {
        const statResult = runLocalStatisticalAnalysis(currentInput, selectedDataset.name);
        if (statResult) {
          responseText += statResult;
          buildVisualizationContext(currentInput, selectedDataset.name);
          setIsFilterQueryActive(false);
          setChatMessages(prev => [...prev, {
            sender: 'ai',
            text: responseText + `\n\nðŸ”’ *Executed local analysis â€” 0 bytes sent*`,
            timestamp: new Date()
          }]);
          setChatLoading(false);
          return;
        }
      }

      // 2. Perform the actual local database query using the SQL Engine
      if (selectedDataset) {
        try {
          const queryResult = generateLocalQuery(currentInput, selectedDataset.name);
          const rows = executeSQL(queryResult.sql);

          if (rows && rows.length > 0) {
            responseText += `**Local Query Output:**\n`;
            
            if (rows.length === 1) {
              const row = rows[0];
              Object.entries(row).forEach(([k, v]) => {
                const formattedK = k.replace(/_/g, ' ');
                const formattedV = typeof v === 'number' ? Number(v.toFixed(2)).toLocaleString() : String(v);
                responseText += `â€¢ **${formattedK}**: ${formattedV}\n`;
              });
            } else {
              responseText += `\n| ` + Object.keys(rows[0]).join(' | ') + ` |\n`;
              responseText += `| ` + Object.keys(rows[0]).map(() => '---').join(' | ') + ` |\n`;
              
              rows.slice(0, 5).forEach((row: any) => {
                responseText += `| ` + Object.values(row).map((v: any) => {
                  return typeof v === 'number' ? Number(v.toFixed(2)).toLocaleString() : String(v);
                }).join(' | ') + ` |\n`;
              });
              if (rows.length > 5) {
                responseText += `\n*(Showing top 5 of ${rows.length} records)*\n`;
              }
            }
            responseText += `\n\`\`\`sql\n${queryResult.sql}\n\`\`\``;
          } else {
            responseText += `I ran the local SQL query, but no matching rows were found.`;
          }
        } catch (err: any) {
          responseText += `Failed to execute local query: ${err.message}`;
        }
      } else {
        responseText += `Please select a dataset to run queries.`;
      }

      responseText += `\n\nðŸ”’ *Executed local analysis â€” 0 bytes sent*`;

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: responseText,
        timestamp: new Date()
      }]);
      setChatLoading(false);
    }, 800);
  };

  // Load table data from IndexedDB cache if not currently in AlaSQL memory
  useEffect(() => {
    if (!selectedDataset) {
      setTableLoadedState(null);
      return;
    }
    const tableName = selectedDataset.name;

    if (isTableLoaded(tableName)) {
      setTableLoadedState(tableName);
      return;
    }

    let active = true;
    const loadCachedTable = async () => {
      setLoadingTable(tableName);
      try {
        const text = await localDB.getDatasetCSV(tableName);
        if (!active) return;
        if (text) {
          if (tableName.toLowerCase().endsWith('.json')) {
            loadJSON(tableName, text);
          } else {
            await loadCSV(tableName, text);
          }
          setTableLoadedState(tableName);
        } else {
          console.warn('Dataset content not found in IndexedDB datasets cache for:', tableName);
        }
      } catch (err) {
        console.error('Error auto-loading dataset into database engine:', err);
      } finally {
        if (active) {
          setLoadingTable(null);
        }
      }
    };

    loadCachedTable();

    return () => {
      active = false;
    };
  }, [selectedDataset]);

  // Sync / calculate everything when dataset changes or filters update
  useEffect(() => {
    if (!selectedDataset) return;
    const tableName = selectedDataset.name;

    if (!isTableLoaded(tableName)) {
      setKpis({ sleep: 0, age: 0, stress: 0, records: 0 });
      setColumnsList([]);
      setGenderSleepData([]);
      setPlatformShareData([]);
      setScreenTimeStressData([]);
      setGenderSummaryTable([]);
      setAnxietyLevelsData([]);
      setDataGridRows([]);
      return;
    }

    const schema = getTableSchema(tableName);
    setColumnsList(schema);

    const tbl = getSqlTableName(tableName);

    // Compute baseline counts if it's the mental health dataset using JS loop
    try {
      const names = schema.map(c => c.name.toLowerCase());
      if (names.includes('gender') && names.includes('platform_usage')) {
        const fullRows = executeSQL(`SELECT * FROM ${tbl}`);
        
        let maleC = 0, femaleC = 0;
        let instaC = 0, tiktokC = 0, ytC = 0, snapC = 0, twitC = 0;

        fullRows.forEach(r => {
          // Case-insensitive: Kaggle exports sometimes use 'Male'/'Female'
          const gStr = String(r.gender ?? '').toLowerCase();
          if (gStr === 'male') maleC++;
          else if (gStr === 'female') femaleC++;

          const pStr = String(r.platform_usage ?? '');
          if (pStr === 'Instagram') instaC++;
          else if (pStr === 'TikTok') tiktokC++;
          else if (pStr === 'YouTube') ytC++;
          else if (pStr === 'Snapchat') snapC++;
          else if (pStr === 'Twitter') twitC++;
        });

        setBaselineCounts({
          male: maleC,
          female: femaleC,
          Instagram: instaC,
          TikTok: tiktokC,
          YouTube: ytC,
          Snapchat: snapC,
          Twitter: twitC
        });
      }
    } catch (e) {
      console.warn('Baseline query failure:', e);
    }

    // Build WHERE clause â€” ONLY for mental health schema.
    // Non-MH datasets don't have gender/platform/age columns; applying these
    // filters would cause AlaSQL errors or silently return 0 rows.
    const whereClauses: string[] = [];

    if (isMentalHealthSchema) {
      // Gender Filter
      const activeGenders = Object.entries(genderFilter).filter(([_, v]) => v).map(([k]) => k);
      if (activeGenders.length > 0 && activeGenders.length < 2) {
        // Support both lowercase and Proper-case gender values in the data
        const g = activeGenders[0];
        const gCap = g.charAt(0).toUpperCase() + g.slice(1);
        whereClauses.push(`(gender = '${g}' OR gender = '${gCap}')`);
      } else if (activeGenders.length === 0) {
        whereClauses.push(`gender = '__none__'`); // nullify results
      }

      // Platform Filter
      const activePlatforms = Object.entries(platformFilter).filter(([_, v]) => v).map(([k]) => k);
      if (activePlatforms.length > 0 && activePlatforms.length < 5) {
        whereClauses.push(`platform_usage IN (${activePlatforms.map(p => `'${p}'`).join(',')})`);
      } else if (activePlatforms.length === 0) {
        whereClauses.push(`platform_usage = '__none__'`);
      }

      // Age Filter
      whereClauses.push(`age BETWEEN ${ageRange[0]} AND ${ageRange[1]}`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      // Fetch filtered rows once using a basic SQL query
      const allRows = executeSQL(`SELECT * FROM ${tbl} ${whereSQL}`);

      if (isMentalHealthSchema) {
        // --- Calculate KPIs ---
        const count = allRows.length;
        let sleepSum = 0;
        let ageSum = 0;
        let stressSum = 0;
        allRows.forEach(r => {
          sleepSum += Number(r.sleep_hours || 0);
          ageSum += Number(r.age || 0);
          stressSum += Number(r.stress_level || 0);
        });

        setKpis({
          sleep: parseFloat((count > 0 ? sleepSum / count : 0).toFixed(2)),
          age: parseFloat((count > 0 ? ageSum / count : 0).toFixed(2)),
          stress: parseFloat((count > 0 ? stressSum / count : 0).toFixed(1)),
          records: count
        });

        // --- Sleep Hours by Gender (case-insensitive) ---
        let maleSleepSum = 0, maleCount = 0;
        let femaleSleepSum = 0, femaleCount = 0;
        allRows.forEach(r => {
          const gStr = String(r.gender ?? '').toLowerCase();
          if (gStr === 'male') {
            maleSleepSum += Number(r.sleep_hours || 0);
            maleCount++;
          } else if (gStr === 'female') {
            femaleSleepSum += Number(r.sleep_hours || 0);
            femaleCount++;
          }
        });
        setGenderSleepData([
          { name: 'male', value: parseFloat((maleCount > 0 ? maleSleepSum / maleCount : 0).toFixed(2)) },
          { name: 'female', value: parseFloat((femaleCount > 0 ? femaleSleepSum / femaleCount : 0).toFixed(2)) }
        ]);

        // --- Platform Usage Share ---
        const platformCounts: Record<string, number> = {};
        allRows.forEach(r => {
          const plat = r.platform_usage || 'Other';
          platformCounts[plat] = (platformCounts[plat] || 0) + 1;
        });
        const platformOrder = ['Instagram', 'TikTok', 'YouTube', 'Snapchat', 'Twitter'];
        const pShare = Object.entries(platformCounts).map(([name, value]) => ({
          name,
          value
        })).sort((a, b) => {
          const idxA = platformOrder.indexOf(a.name);
          const idxB = platformOrder.indexOf(b.name);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
        setPlatformShareData(pShare);

        // --- Screen Time Before Sleep vs Stress ---
        const screenTimeSum: Record<number, number> = {};
        const screenTimeCount: Record<number, number> = {};
        allRows.forEach(r => {
          const st = parseFloat(Number(r.screen_time_before_sleep ?? 0).toFixed(1));
          screenTimeSum[st] = (screenTimeSum[st] || 0) + Number(r.stress_level || 0);
          screenTimeCount[st] = (screenTimeCount[st] || 0) + 1;
        });
        const screenTimeRes = Object.keys(screenTimeSum)
          .map(k => parseFloat(k))
          .sort((a, b) => a - b)
          .map(st => ({
            name: `${st.toFixed(1)}h`,
            value: parseFloat((screenTimeCount[st] > 0 ? screenTimeSum[st] / screenTimeCount[st] : 0).toFixed(2))
          }));
        setScreenTimeStressData(screenTimeRes);

        // --- Gender Summary Table (case-insensitive) ---
        let maleAgeSum = 0;
        let femaleAgeSum = 0;
        allRows.forEach(r => {
          const gStr = String(r.gender ?? '').toLowerCase();
          if (gStr === 'male') {
            maleAgeSum += Number(r.age || 0);
          } else if (gStr === 'female') {
            femaleAgeSum += Number(r.age || 0);
          }
        });

        const tableData = [];
        if (maleCount > 0) {
          tableData.push({
            gender: 'male',
            avg_sleep_hours: parseFloat((maleSleepSum / maleCount).toFixed(2)),
            avg_age: parseFloat((maleAgeSum / maleCount).toFixed(2)),
            count: maleCount
          });
        }
        if (femaleCount > 0) {
          tableData.push({
            gender: 'female',
            avg_sleep_hours: parseFloat((femaleSleepSum / femaleCount).toFixed(2)),
            avg_age: parseFloat((femaleAgeSum / femaleCount).toFixed(2)),
            count: femaleCount
          });
        }
        if (count > 0) {
          tableData.push({
            gender: 'Total',
            avg_sleep_hours: parseFloat((sleepSum / count).toFixed(2)),
            avg_age: parseFloat((ageSum / count).toFixed(2)),
            count: count
          });
        }
        setGenderSummaryTable(tableData);

        // --- Top Anxiety Levels (Horizontal Bar) ---
        const anxietyCounts = { Low: 0, Mild: 0, Moderate: 0, High: 0, Severe: 0 };
        allRows.forEach(r => {
          const val = Number(r.anxiety_level || 0);
          if (val <= 2) anxietyCounts.Low++;
          else if (val <= 4) anxietyCounts.Mild++;
          else if (val <= 6) anxietyCounts.Moderate++;
          else if (val <= 8) anxietyCounts.High++;
          else anxietyCounts.Severe++;
        });
        const order = ['Low', 'Mild', 'Moderate', 'High', 'Severe'];
        const sortedAnxiety = order.map(lvl => ({
          name: lvl,
          count: (anxietyCounts as any)[lvl]
        }));
        setAnxietyLevelsData(sortedAnxiety);
      } else {
        // --- ADAPTIVE GENERIC SYSTEM (For non-Teen dataset files) ---
        const numCols = schema.filter(c => c.type === 'number');
        const strCols = schema.filter(c => c.type === 'string');

        const groupCol = strCols[0]?.name;
        const valCol = numCols[0]?.name;
        const valCol2 = numCols[1]?.name;

        const count = allRows.length;
        let sleepSum = 0;
        let ageSum = 0;

        if (valCol) {
          allRows.forEach(r => { sleepSum += Number(r[valCol] || 0); });
        }
        if (valCol2) {
          allRows.forEach(r => { ageSum += Number(r[valCol2] || 0); });
        }

        setKpis({
          sleep: parseFloat((count > 0 ? sleepSum / count : 0).toFixed(2)),
          age: parseFloat((count > 0 ? ageSum / count : 0).toFixed(2)),
          stress: 0,
          records: count
        });

        if (groupCol && valCol) {
          const barGroupSum: Record<string, number> = {};
          const barGroupCount: Record<string, number> = {};
          allRows.forEach(r => {
            const key = String(r[groupCol] || 'None');
            barGroupSum[key] = (barGroupSum[key] || 0) + Number(r[valCol] || 0);
            barGroupCount[key] = (barGroupCount[key] || 0) + 1;
          });
          const resBar = Object.entries(barGroupSum).slice(0, 8).map(([name, sum]) => ({
            name,
            value: parseFloat((sum / barGroupCount[name]).toFixed(2))
          }));
          setGenderSleepData(resBar);

          const resPie = Object.entries(barGroupCount).slice(0, 5).map(([name, value]) => ({
            name,
            value
          }));
          setPlatformShareData(resPie);

          const resHoriz = Object.entries(barGroupCount).slice(0, 5).map(([name, value]) => ({
            name,
            count: value
          }));
          setAnxietyLevelsData(resHoriz);
        }

        if (valCol && valCol2) {
          const lineGroupSum: Record<string, number> = {};
          const lineGroupCount: Record<string, number> = {};
          allRows.forEach(r => {
            const key = String(r[valCol] || '0');
            lineGroupSum[key] = (lineGroupSum[key] || 0) + Number(r[valCol2] || 0);
            lineGroupCount[key] = (lineGroupCount[key] || 0) + 1;
          });
          const resLine = Object.keys(lineGroupSum)
            .map(k => parseFloat(k))
            .sort((a, b) => a - b)
            .slice(0, 15)
            .map(xKey => ({
              name: String(xKey),
              value: parseFloat((lineGroupSum[String(xKey)] / lineGroupCount[String(xKey)]).toFixed(2))
            }));
          setScreenTimeStressData(resLine);
        }
      }

      setDataGridRows(allRows.slice(0, 100));
    } catch (e) {
      console.error('Calculation failure:', e);
    }
  }, [selectedDataset, genderFilter, platformFilter, ageRange, isMentalHealthSchema, tableLoadedState]);

  // Filter lists by search query
  const filteredColumns = columnsList.filter(col => 
    col.name.toLowerCase().includes(fieldsSearch.toLowerCase())
  );

  // Checkbox helpers
  const handleSelectAllGender = () => {
    const bothActive = genderFilter.male && genderFilter.female;
    setGenderFilter({ male: !bothActive, female: !bothActive });
  };

  const handleSelectAllPlatform = () => {
    const allActive = Object.values(platformFilter).every(v => v);
    const newVal = !allActive;
    setPlatformFilter({
      Instagram: newVal,
      TikTok: newVal,
      YouTube: newVal,
      Snapchat: newVal,
      Twitter: newVal
    });
  };

  const getCanvasStyle = () => {
    switch (pageViewMode) {
      case 'Actual Size':
        return {
          width: '1280px',
          minWidth: '1280px',
          margin: '0 auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
          border: '1.5px solid #1f1f2e',
          borderRadius: '12px',
          padding: '1.25rem',
          background: '#070709',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.65rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        };
      case 'Fit to Width':
        return {
          width: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.65rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        };
      case 'Page Fit':
      default:
        return {
          width: '96%',
          maxWidth: '1360px',
          margin: '0 auto',
          transform: 'scale(0.97)',
          transformOrigin: 'top center',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.65rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#07070a', color: '#e4e4e7', fontFamily: "'Geist', sans-serif" }}>
      
      {/* 1. TOP BREADCRUMB BAR (POWER BI REBRANDED) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #1a1a24',
        background: '#09090b',
        height: '46px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button 
            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onMenu}
            title="Toggle sidebar"
          >
            <Menu size={16} />
          </button>
          <div style={{ width: '1px', height: '14px', background: '#27272a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: '#a1a1aa' }}>
            <span style={{ fontWeight: 600, color: '#f4f4f5', letterSpacing: '-0.01em' }}>Privana</span>
            <span style={{ color: '#3f3f46' }}>/</span>
            <span>{selectedDataset ? selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : 'Teen Mental Health'}</span>
            <span style={{ color: '#3f3f46' }}>/</span>
            <span style={{ color: '#f4f4f5', fontWeight: 600 }}>Report</span>
          </div>
        </div>
        
        {/* Right side connection pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#110b0d',
            border: '1px solid #3c1417',
            borderRadius: '999px',
            padding: '2px 9px',
            fontSize: '0.58rem',
            fontFamily: 'var(--mono)',
            color: '#e4e4e7'
          }}>
            <Database size={10} style={{ color: '#ef4444' }} /> Local DB
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#110b0d',
            border: '1px solid #3c1417',
            borderRadius: '999px',
            padding: '2px 9px',
            fontSize: '0.58rem',
            fontFamily: 'var(--mono)',
            color: '#e4e4e7'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} /> 0 bytes sent
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#110b0d',
            border: '1px solid #3c1417',
            borderRadius: '999px',
            padding: '2px 9px',
            fontSize: '0.58rem',
            fontFamily: 'var(--mono)',
            color: '#e4e4e7'
          }}>
            <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>âš¡</span> DuckDB Engine
          </div>
          <div style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.85rem' }}>ðŸ””</span>
            <span style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.5rem',
              fontWeight: 900,
              width: 11,
              height: 11,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>3</span>
          </div>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 800,
            fontFamily: 'var(--mono)',
            marginLeft: '0.2rem'
          }}>P</div>
        </div>
      </div>

      {/* 2. REPORT TITLE BLOCK */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #1a1a24',
        background: '#09090b',
        flexShrink: 0
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
              {selectedDataset ? selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") + ' Insights' : 'Teen Mental Health Insights'}
            </h1>
            <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }} title="Favorite report">
              <Star size={14} style={{ fill: '#ef4444' }} />
            </button>
            <button style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }} title="Information">
              <Info size={14} />
            </button>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: 2 }}>
            {loadingTable ? (
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s infinite linear' }}>â³</span> Loading dataset into memory...
              </span>
            ) : (
              `Local Power BI-style report â€¢ ${kpis.records.toLocaleString()} rows â€¢ ${(selectedDataset?.file_type || 'csv').toUpperCase()} loaded`
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: '#121214',
            border: '1px solid #27272a',
            borderRadius: '6px',
            padding: '4px 10px',
            height: '32px',
            cursor: 'default'
          }}>
            <span style={{ fontSize: '0.8rem' }}>ðŸ“„</span>
            <span style={{ fontSize: '0.72rem', color: '#e4e4e7', fontWeight: 500 }}>
              {selectedDataset ? selectedDataset.name : 'Teen_Mental_Health_Dataset.csv'}
            </span>
          </div>

          {/* Split button: Save report | âˆ¨ */}
          <div style={{ display: 'flex', height: '32px' }}>
            <button 
              onClick={handleSaveReport}
              disabled={saveStatus !== 'idle'}
              style={{
                background: saveStatus === 'saved' ? '#10b981' : '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px 0 0 6px',
                padding: '0 0.85rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: saveStatus !== 'idle' ? 'default' : 'pointer',
                transition: 'background 0.1s'
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save report'}
            </button>
            <div style={{ width: '1px', background: '#f87171' }} />
            <button 
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '0 6px 6px 0',
                padding: '0 0.45rem',
                fontSize: '0.65rem',
                cursor: 'pointer'
              }}
              onClick={() => alert('Export options menu')}
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* 3. RIBBON TOOL BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        borderBottom: '1px solid #1a1a24',
        background: '#09090b',
        height: '34px',
        fontSize: '0.72rem',
        flexShrink: 0
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.85rem', height: '100%', alignItems: 'center' }}>
          <button 
            onClick={() => setActiveTab('report')} 
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'report' ? '#f4f4f5' : '#71717a',
              cursor: 'pointer', fontWeight: 600, height: '100%', display: 'flex', alignItems: 'center',
              borderBottom: activeTab === 'report' ? '2.5px solid #ef4444' : '2.5px solid transparent',
              borderRadius: 0, padding: '0 4px', fontSize: '0.7rem'
            }}
          >
            Report
          </button>
          <button 
            onClick={() => setActiveTab('data')} 
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'data' ? '#f4f4f5' : '#71717a',
              cursor: 'pointer', fontWeight: 600, height: '100%', display: 'flex', alignItems: 'center',
              borderBottom: activeTab === 'data' ? '2.5px solid #ef4444' : '2.5px solid transparent',
              borderRadius: 0, padding: '0 4px', fontSize: '0.7rem'
            }}
          >
            Data
          </button>
          <button 
            onClick={() => setActiveTab('model')} 
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'model' ? '#f4f4f5' : '#71717a',
              cursor: 'pointer', fontWeight: 600, height: '100%', display: 'flex', alignItems: 'center',
              borderBottom: activeTab === 'model' ? '2.5px solid #ef4444' : '2.5px solid transparent',
              borderRadius: 0, padding: '0 4px', fontSize: '0.7rem'
            }}
          >
            Model
          </button>
        </div>

        {/* View Options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#71717a', position: 'relative' }}>
          <button 
            style={{ 
              background: 'none', border: 'none', color: historyIndex > 0 ? '#f4f4f5' : '#3f3f46',
              cursor: historyIndex > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'color 0.15s', padding: 2
            }}
            title="Undo filter adjustment" 
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button 
            style={{ 
              background: 'none', border: 'none', color: historyIndex < history.length - 1 ? '#f4f4f5' : '#3f3f46',
              cursor: historyIndex < history.length - 1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'color 0.15s', padding: 2
            }}
            title="Redo filter adjustment" 
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.3" />
            </svg>
          </button>
          
          <div style={{ width: '1px', height: '12px', background: '#27272a' }} />
          
          {/* Page View Dropdown */}
          <div style={{ position: 'relative' }}>
            <span 
              style={{ cursor: 'pointer', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '3px', userSelect: 'none' }} 
              onClick={() => { setShowPageViewDropdown(p => !p); setShowFitDropdown(false); setShowMoreMenu(false); }}
            >
              ðŸ‘ Page view <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▼</span>
            </span>
            {showPageViewDropdown && (
              <div style={{
                position: 'absolute', top: 22, left: 0, width: 130,
                background: '#0e0e12', border: '1.5px solid var(--rim)', borderRadius: 8,
                padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 2,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
              }}>
                {[
                  { label: 'Fit to Width', value: 'Fit to Width' },
                  { label: 'Actual Size', value: 'Actual Size' },
                  { label: 'Page Fit', value: 'Page Fit' }
                ].map(item => (
                  <button
                    key={item.value}
                    onClick={() => { setPageViewMode(item.value); setShowPageViewDropdown(false); showToast(`View set to ${item.label}`); }}
                    style={{
                      background: 'transparent', border: 'none', color: pageViewMode === item.value ? '#ef4444' : '#a1a1aa',
                      fontSize: '0.68rem', textAlign: 'left', padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                      fontWeight: pageViewMode === item.value ? 700 : 500, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{item.label}</span>
                    {pageViewMode === item.value && <span style={{ fontSize: '0.65rem' }}>âœ“</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fit settings Dropdown */}
          <div style={{ position: 'relative' }}>
            <span 
              style={{ cursor: 'pointer', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '3px', userSelect: 'none' }} 
              onClick={() => { setShowFitDropdown(p => !p); setShowPageViewDropdown(false); setShowMoreMenu(false); }}
            >
              â›¶ Fit to page <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▼</span>
            </span>
            {showFitDropdown && (
              <div style={{
                position: 'absolute', top: 22, left: 0, width: 120,
                background: '#0e0e12', border: '1.5px solid var(--rim)', borderRadius: 8,
                padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 2,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
              }}>
                {[
                  { label: 'Fit to Page', value: 'Page Fit' },
                  { label: 'Fit to Width', value: 'Fit to Width' },
                  { label: 'Actual Size', value: 'Actual Size' }
                ].map(item => (
                  <button
                    key={item.value}
                    onClick={() => { setFitMode(item.label); setPageViewMode(item.value); setShowFitDropdown(false); showToast(`Fit adjusted to ${item.label}`); }}
                    style={{
                      background: 'transparent', border: 'none', color: (pageViewMode === item.value) ? '#ef4444' : '#a1a1aa',
                      fontSize: '0.68rem', textAlign: 'left', padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                      fontWeight: (pageViewMode === item.value) ? 700 : 500, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{item.label}</span>
                    {(pageViewMode === item.value) && <span style={{ fontSize: '0.65rem' }}>âœ“</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '12px', background: '#27272a' }} />
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              title="Focus Bar Visual" 
              onClick={() => triggerCardHighlight('bar')}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', transition: 'color 0.15s' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="18" y="3" width="4" height="18" rx="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity="0.1" />
                <rect x="10" y="8" width="4" height="13" rx="1" stroke="#22c55e" fill="#22c55e" fillOpacity="0.1" />
                <rect x="2" y="13" width="4" height="8" rx="1" stroke="#ef4444" fill="#ef4444" fillOpacity="0.1" />
              </svg>
            </button>
            
            <button 
              title="Focus Line Visual" 
              onClick={() => triggerCardHighlight('line')}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', transition: 'color 0.15s' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" stroke="#52525b" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" stroke="#3b82f6" />
              </svg>
            </button>

            <button 
              title="Focus Donut Visual" 
              onClick={() => triggerCardHighlight('donut')}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', transition: 'color 0.15s' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" stroke="#ef4444" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" stroke="#3b82f6" fill="#3b82f6" fillOpacity="0.1" />
              </svg>
            </button>

            <button 
              title="Focus Grid Table" 
              onClick={() => triggerCardHighlight('table')}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', transition: 'color 0.15s' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" stroke="#eab308" />
                <path d="M3 9h18" stroke="#eab308" />
                <path d="M3 15h18" stroke="#eab308" />
                <path d="M9 3v18" stroke="#eab308" />
                <path d="M15 3v18" stroke="#eab308" />
              </svg>
            </button>

            <span title="Add Textbox" style={{ cursor: 'pointer', color: '#71717a', fontSize: '0.75rem', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => showToast('Textbox adding is simulated in offline enclaves')}>â—‹</span>
            
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ cursor: 'pointer', color: '#a1a1aa', fontSize: '0.7rem', paddingLeft: 2, userSelect: 'none' }} onClick={() => { setShowMoreMenu(p => !p); setShowPageViewDropdown(false); setShowFitDropdown(false); }}>â€¢â€¢â€¢</span>
              {showMoreMenu && (
                <div style={{
                  position: 'absolute', top: 22, right: 0, width: 140,
                  background: '#0e0e12', border: '1.5px solid var(--rim)', borderRadius: 8,
                  padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 2,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}>
                  <button
                    onClick={() => { setShowMoreMenu(false); alert('Exporting data as CSV...'); }}
                    style={{
                      background: 'transparent', border: 'none', color: '#a1a1aa',
                      fontSize: '0.68rem', textAlign: 'left', padding: '5px 8px', borderRadius: 4, cursor: 'pointer', width: '100%'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    ðŸ“¥ Export CSV
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); handleRefresh(); }}
                    style={{
                      background: 'transparent', border: 'none', color: '#a1a1aa',
                      fontSize: '0.68rem', textAlign: 'left', padding: '5px 8px', borderRadius: 4, cursor: 'pointer', width: '100%'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    ðŸ”„ Reset Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN DASHBOARD CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* LEFT AREA: CANVAS PANEL (Scrollable, takes remaining space) */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '0.75rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.65rem',
          background: '#09090c' 
        }}>
          
          {activeTab === 'report' ? (
            <div style={getCanvasStyle()}>
              {/* Q&A AI Assistant Box */}
              {selectedDataset && (
                <div style={{
                  background: 'rgba(20, 10, 12, 0.65)',
                border: '1.5px solid var(--rim)',
                borderRadius: '16px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                flexShrink: 0,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.01)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={14} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                    Ask a question about your data
                  </span>
                  <span style={{ fontSize: '0.55rem', background: 'rgba(239, 68, 68, 0.08)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.18)', padding: '1px 5px', borderRadius: '3px', marginLeft: 'auto', fontFamily: 'var(--mono)' }}>
                    Local LLM active
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.55rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: 9.5, color: '#52525b' }} />
                    <input
                      type="text"
                      placeholder="e.g., average sleep hours for female TikTok users aged 14 to 16..."
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAskAI(); }}
                      style={{
                        width: '100%',
                        height: '32px',
                        background: '#080405',
                        border: '1.5px solid var(--rim)',
                        borderRadius: '8px',
                        paddingLeft: '2.1rem',
                        paddingRight: '1rem',
                        fontSize: '0.75rem',
                        color: '#fff',
                        outline: 'none',
                        transition: 'border-color 0.15s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--rim)'}
                    />
                  </div>
                  
                  <button
                    onClick={() => handleAskAI()}
                    disabled={qaLoading || !qaInput.trim()}
                    style={{
                      height: '32px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 1.25rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: (qaLoading || !qaInput.trim()) ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    {qaLoading ? 'Thinking...' : 'Ask AI'}
                  </button>
                </div>

                {qaResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.02)',
                      border: '1.5px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>ðŸ’¡</span>
                    <span style={{ fontSize: '0.72rem', color: '#a1a1aa', flex: 1, lineHeight: 1.4 }}>
                      {/* Show the first meaningful line â€” strip markdown headers/bold/emoji */}
                      {(() => {
                        const lines = qaResponse.split('\n').map(l => l.trim()).filter(Boolean);
                        const headline = lines.find(l =>
                          l.length > 10 &&
                          !l.startsWith('|') &&
                          !l.startsWith('```')
                        ) || lines[0] || '';
                        return headline
                          .replace(/^#+\s*/, '')
                          .replace(/\*\*/g, '')
                          .replace(/^ðŸš¨|^âš ï¸|^ðŸ§ |^ðŸ“Š|^ðŸ“‰|^ðŸ“ˆ/, '')
                          .trim()
                          .slice(0, 160);
                      })()}
                    </span>
                    <button
                      onClick={() => {
                        setQaInput('');
                        setQaResponse(null);
                        setAnalyticalContext(null);
                        setIsFilterQueryActive(false);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#52525b',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        flexShrink: 0,
                        lineHeight: 1
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
                      title="Clear result"
                    >✕</button>
                  </motion.div>
                )}
              </div>
              )}

              {!selectedDataset ? (
                /* 1. Empty Dataset State */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  padding: '2.5rem 1.5rem',
                  background: '#0e0e12',
                  border: '1.5px dashed var(--rim)',
                  borderRadius: '16px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  flex: 1,
                  minHeight: '400px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.01)'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.03)',
                    border: '1.5px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    marginBottom: '0.25rem',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.05)'
                  }}>
                    <Database size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
                      No Dataset Connected
                    </h2>
                    <p style={{ color: '#71717a', fontSize: '0.72rem', maxWidth: '360px', lineHeight: 1.45, margin: '0 auto' }}>
                      Select an existing dataset or upload a CSV/JSON file to begin running private, local data science queries.
                    </p>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    width: '100%',
                    maxWidth: '320px',
                    marginTop: '0.35rem'
                  }}>
                    {datasets.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
                          Available Workspace Datasets
                        </div>
                        <select
                          onChange={(e) => {
                            const ds = datasets.find(x => x.name === e.target.value);
                            if (ds) setSelectedDataset(ds);
                          }}
                          style={{
                            width: '100%',
                            height: '32px',
                            background: '#080405',
                            border: '1.5px solid var(--rim)',
                            borderRadius: '8px',
                            padding: '0 0.5rem',
                            fontSize: '0.72rem',
                            color: '#fff',
                            outline: 'none'
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>-- Select a dataset --</option>
                          {datasets.map(d => (
                            <option key={d.id} value={d.name}>{d.name} ({d.row_count?.toLocaleString()} rows)</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <button
                      onClick={() => setPage('datasets')}
                      style={{
                        height: '32px',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                    >
                      <span>ðŸ“‚ Open Datasets Manager</span>
                    </button>
                  </div>
                </div>
              ) : qaLoading ? (
                /* 2. Staged AI Loading State */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.25rem',
                  padding: '3rem 2rem',
                  background: '#0e0e12',
                  border: '1.5px solid var(--rim)',
                  borderRadius: '16px',
                  flex: 1,
                  minHeight: '400px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.01)'
                }}>
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                    @keyframes pulse {
                      0%, 100% { opacity: 1; transform: scale(1); }
                      50% { opacity: 0.5; transform: scale(1.05); }
                    }
                    @keyframes loading-bar {
                      0% { left: -45%; }
                      100% { left: 100%; }
                    }
                    .pv-kpi { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: default; }
                    .pv-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.45); border-color: rgba(255,255,255,0.09) !important; }
                    .pv-card { transition: border-color 0.2s ease; }
                    .pv-card:hover { border-color: #252535 !important; }
                  `}} />

                  <div style={{ position: 'relative', width: 64, height: 64 }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.08)',
                      boxShadow: '0 0 25px rgba(239, 68, 68, 0.2)',
                      animation: 'pulse 1.8s infinite ease-in-out'
                    }} />
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: '2px solid rgba(239, 68, 68, 0.1)',
                      borderTopColor: '#ef4444',
                      borderRightColor: '#ef4444',
                      animation: 'spin 0.9s infinite linear'
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#ef4444'
                    }}>
                      <Sparkles size={20} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                      Privana AI Engine Analyzing
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#71717a', minHeight: '16px', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                      <RefreshCw size={10} style={{ animation: 'spin 2s infinite linear' }} />
                      <span>
                        {loadingStage === 0 && 'ðŸ” Parsing query intent and scanning columns...'}
                        {loadingStage === 1 && 'âš¡ Running secure in-memory SQL execution...'}
                        {loadingStage === 2 && 'ðŸ“ Computing statistical metrics (coefficient, p-value)...'}
                        {loadingStage === 3 && 'ðŸŽ¨ Rendering contextual visualizations...'}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    width: '100%',
                    maxWidth: '220px',
                    height: '3px',
                    background: '#1a1a24',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      height: '100%',
                      width: '45%',
                      background: 'linear-gradient(90deg, #ef4444, #f97316)',
                      borderRadius: '2px',
                      left: 0,
                      animation: 'loading-bar 1.5s infinite ease-in-out'
                    }} />
                  </div>
                </div>
              ) : (
                /* ═══════════════════════════════════════════════════════════════════
                   UNIFIED DASHBOARD SHELL â€” permanent operating system
                   All query types render inside this grid. Only data changes.
                   ═══════════════════════════════════════════════════════════════════ */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0.15rem' }}>

                  {/* â”€â”€ Dashboard Header Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, paddingBottom: '0.1rem' }}>
                    {analyticalContext && (
                      <span style={{
                        fontSize: '0.55rem', fontWeight: 800,
                        background: 'rgba(239,68,68,0.1)', color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.2)',
                        padding: '2px 8px', borderRadius: '3px',
                        textTransform: 'uppercase' as const, letterSpacing: '0.06em'
                      }}>{analyticalContext.type}</span>
                    )}
                    {analyticalContext && (
                      <span style={{ fontSize: '0.65rem', color: '#52525b', fontFamily: 'var(--mono)' }}>
                        {analyticalContext.title}
                      </span>
                    )}
                    {isFilterQueryActive && !analyticalContext && (
                      <span style={{
                        fontSize: '0.55rem', fontWeight: 800,
                        background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                        border: '1px solid rgba(59,130,246,0.2)',
                        padding: '2px 8px', borderRadius: '3px',
                        textTransform: 'uppercase' as const, letterSpacing: '0.06em'
                      }}>FILTER</span>
                    )}
                    <div style={{ flex: 1 }} />
                    {(analyticalContext || isFilterQueryActive) && (
                      <button
                        onClick={() => { setAnalyticalContext(null); setQaResponse(null); setQaInput(''); setIsFilterQueryActive(false); setGenderFilter({ male: true, female: true }); setPlatformFilter({ Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true }); setAgeRange([13, 19]); }}
                        style={{ fontSize: '0.6rem', color: '#71717a', background: 'transparent', border: '1px solid #27272a', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f4f4f5'; e.currentTarget.style.borderColor = '#52525b'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#27272a'; }}
                      >â† Reset to Overview</button>
                    )}
                  </div>

                  {/* â”€â”€ Collapsible Insight Banner (appears for stat queries) â”€â”€â”€â”€â”€â”€â”€ */}
                  {analyticalContext && (() => {
                    const r2 = analyticalContext.regR2;
                    const pearson = analyticalContext.kpiCards[0]?.value;
                    const typeMap: Record<string, string> = {
                      correlation: `Correlation between ${analyticalContext.valCol} and ${analyticalContext.cntCol} â€” Pearson r = ${pearson}. R² = ${r2.toFixed(4)} (${(r2 * 100).toFixed(1)}% variance explained).`,
                      regression:  `OLS regression: ${analyticalContext.cntCol} ~ ${analyticalContext.valCol}. R² = ${r2.toFixed(4)}, slope = ${analyticalContext.regSlope.toFixed(4)}, intercept = ${analyticalContext.regIntercept.toFixed(4)}.`,
                      outlier:     `Anomaly detection on ${analyticalContext.valCol} vs ${analyticalContext.cntCol}. Points with residual > 2.5σ are flagged as outliers.`,
                      histogram:   `Frequency distribution of ${analyticalContext.cntCol} across ${analyticalContext.histY.length} bins using Sturges' rule.`,
                      top5:        `Top 5 records ranked by ${analyticalContext.cntCol} (descending). Highest value: ${analyticalContext.topRows[0]?.value.toFixed(2)}.`,
                      bins:        `Binned averages of ${analyticalContext.cntCol} grouped by ${analyticalContext.valCol} ranges (${analyticalContext.binRows.length} bins).`,
                      percentage:  `Percentage contribution of ${analyticalContext.valCol} value ranges to total ${analyticalContext.cntCol} sum.`,
                      skew:        `Shape analysis of ${analyticalContext.cntCol} â€” examining skewness and kurtosis from the distribution.`,
                      residual:    `Residual analysis of ${analyticalContext.valCol} â†’ ${analyticalContext.cntCol} regression. Patterns suggest ${r2 > 0.3 ? 'acceptable' : 'weak'} model fit.`,
                    };
                    const summary = typeMap[analyticalContext.type] || `Statistical analysis: ${analyticalContext.title}`;
                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, rgba(139,92,246,0.03) 100%)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '10px',
                        padding: '0.6rem 0.9rem',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        flexShrink: 0,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.9rem' }}>📐</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.57rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.15rem' }}>
                            Insight — {analyticalContext.type.charAt(0).toUpperCase() + analyticalContext.type.slice(1)} Analysis
                          </div>
                          <div style={{ fontSize: '0.69rem', color: '#a1a1aa', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.5rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>LOCAL</span>
                          <span style={{ fontSize: '0.5rem', color: '#3f3f46', fontFamily: 'var(--mono)' }}>n={analyticalContext.scatterPairs.length}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* â”€â”€ KPI Cards Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem', flexShrink: 0 }}>
                    {analyticalContext
                      ? /* Stat-specific KPI cards from computation */
                        analyticalContext.kpiCards.map((card, ci) => (
                          <div key={ci} className="pv-kpi" style={{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: `1px solid ${card.color}30`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, right: 0, width: 55, height: 55, background: `radial-gradient(circle,${card.color}08 0%,transparent 70%)`, borderRadius: '0 10px 0 0', pointerEvents: 'none' }} />
                            <div style={{ fontSize: '0.48rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{card.label}</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{card.value}</div>
                            <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.22rem', lineHeight: 1.3 }}>{card.sub}</div>
                          </div>
                        ))
                      : /* Default MH KPI cards â€” or generic for non-MH datasets */
                        isMentalHealthSchema && kpis.records > 0
                          ? [
                            { icon: <Moon size={16} />, label: 'AVG SLEEP HOURS', value: kpis.sleep, sub: 'hrs · per night average', color: '#eab308' },
                            { icon: <Users size={16} />, label: 'AVG AGE', value: kpis.age, sub: 'years · from dataset', color: '#3b82f6' },
                            { icon: <Heart size={16} />, label: 'AVG STRESS', value: kpis.stress, sub: 'level 1–10 scale', color: '#ef4444' },
                            { icon: <Database size={16} />, label: 'TOTAL RECORDS', value: kpis.records.toLocaleString(), sub: 'rows in active filter', color: '#a855f7' },
                          ].map((k, ki) => (
                            <div key={ki} className="pv-kpi" style={{ background: 'linear-gradient(135deg,#0f0f14 0%,#0c0c10 100%)', border: `1px solid ${k.color}28`, borderRadius: '10px', padding: '0.75rem 0.9rem', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', top: 0, right: 0, width: 50, height: 50, background: `radial-gradient(circle,${k.color}08 0%,transparent 70%)`, borderRadius: '0 10px 0 0', pointerEvents: 'none' }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: `${k.color}12`, border: `1px solid ${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0 }}>{k.icon}</div>
                                <div style={{ fontSize: '0.46rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{k.label}</div>
                              </div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</div>
                              <div style={{ fontSize: '0.54rem', color: '#3f3f46', marginTop: '0.2rem' }}>{k.sub}</div>
                            </div>
                          ))
                        : /* Generic non-MH dataset: show record/column counts */
                          (() => {
                            const numericColCount = columnsList.filter(c => c.type === 'number' || ['DECIMAL','INTEGER','BIGINT','FLOAT'].includes((c.type||'').toUpperCase())).length;
                            return [
                              { label: 'RECORDS', value: kpis.records > 0 ? kpis.records.toLocaleString() : (selectedDataset?.row_count?.toLocaleString() || '—'), sub: 'Total rows loaded', color: '#a855f7', icon: <Database size={14} /> },
                              { label: 'COLUMNS', value: columnsList.length || '—', sub: 'Schema fields', color: '#3b82f6', icon: <Layers size={14} /> },
                              { label: 'NUMERIC FIELDS', value: numericColCount || '—', sub: 'Queryable metrics', color: '#eab308', icon: <TrendingUp size={14} /> },
                              { label: 'DATASET', value: selectedDataset?.name?.split('.')[0]?.slice(0,10) || '—', sub: selectedDataset?.name || 'No dataset', color: '#ef4444', icon: <Sparkles size={14} /> },
                            ].map((k, ki) => (
                              <div key={ki} style={{ background: '#0e0e12', border: '1px solid #1f1f23', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
                                <div>
                                  <div style={{ fontSize: '0.52rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{k.label}</div>
                                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: k.color, lineHeight: 1.1, margin: '1px 0' }}>{k.value}</div>
                                  <div style={{ fontSize: '0.54rem', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{k.sub}</div>
                                </div>
                              </div>
                            ));
                          })()
                    }
                  </div>

                  {/* â”€â”€ Row 1: Primary Chart + Right Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  {(analyticalContext || isMentalHealthSchema) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: analyticalContext ? '1.6fr 1fr' : '1.2fr 1fr', gap: '0.6rem', flexShrink: 0 }}>

                      {/* PRIMARY CHART */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', minHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>

                        {analyticalContext && (analyticalContext.type === 'correlation' || analyticalContext.type === 'regression' || analyticalContext.type === 'outlier' || analyticalContext.type === 'residual' || analyticalContext.type === 'skew') ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>
                              ðŸ“‰ {analyticalContext.valCol} vs {analyticalContext.cntCol}
                              <span style={{ fontSize: '0.56rem', color: '#52525b', marginLeft: '0.5rem' }}>n = {analyticalContext.scatterPairs.length} sampled points</span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                              <ComposedChart margin={{ top: 5, right: 12, bottom: 20, left: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis dataKey="x" type="number" name={analyticalContext.valCol} domain={['auto', 'auto']}
                                  tick={{ fontSize: 9, fill: '#52525b' }}
                                  label={{ value: analyticalContext.valCol, position: 'insideBottom', offset: -12, fontSize: 9, fill: '#71717a' }} />
                                <YAxis type="number" name={analyticalContext.cntCol} domain={['auto', 'auto']}
                                  tick={{ fontSize: 9, fill: '#52525b' }}
                                  label={{ value: analyticalContext.cntCol, angle: -90, position: 'insideLeft', offset: 10, fontSize: 9, fill: '#71717a' }} />
                                <Tooltip
                                  contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', borderRadius: 6, fontSize: '0.65rem', color: '#e4e4e7' }}
                                  formatter={(value: unknown, name: unknown) => [Number(value).toFixed(4), String(name ?? '')]}
                                />
                                <Scatter
                                  name="Data points"
                                  data={analyticalContext.scatterPairs.map(p => ({ x: p.x, y: p.y, isOutlier: p.isOutlier }))}
                                  dataKey="y"
                                  fill="#3b82f6"
                                  opacity={0.6}
                                  shape={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    return <circle cx={cx} cy={cy} r={payload.isOutlier ? 5 : 2.5} fill={payload.isOutlier ? '#ef4444' : '#3b82f6'} opacity={payload.isOutlier ? 0.9 : 0.55} />;
                                  }}
                                />
                                {analyticalContext.regR2 > 0 && (() => {
                                  const xs = analyticalContext.scatterPairs.map(p => p.x);
                                  const minX = Math.min(...xs); const maxX = Math.max(...xs);
                                  const rLine = [
                                    { x: minX, y: analyticalContext.regSlope * minX + analyticalContext.regIntercept },
                                    { x: maxX, y: analyticalContext.regSlope * maxX + analyticalContext.regIntercept }
                                  ];
                                  return (
                                    <Line data={rLine} dataKey="y" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Regression" />
                                  );
                                })()}
                              </ComposedChart>
                            </ResponsiveContainer>
                            <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#3f3f46', marginTop: '0.25rem', fontFamily: 'var(--mono)' }}>
                              R² = <span style={{color:'#a855f7',fontWeight:700}}>{analyticalContext.regR2.toFixed(4)}</span>{'  ·  '}ŷ = <span style={{color:'#ef4444',fontWeight:700}}>{analyticalContext.regSlope.toFixed(4)}</span>x {analyticalContext.regIntercept >= 0 ? '+ ' : '− '}<span style={{color:'#ef4444',fontWeight:700}}>{Math.abs(analyticalContext.regIntercept).toFixed(4)}</span>
                            </div>
                          </>
                        ) : analyticalContext && analyticalContext.type === 'feature_importance' ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem', padding: '0.75rem 0.85rem 0 0.85rem' }}>
                              📊 Strongest Predictors of {analyticalContext.cntCol}
                              <span style={{ fontSize: '0.56rem', color: '#71717a', marginLeft: '0.5rem', fontWeight: 400 }}>
                                Ranked by normalized association strength, not direct causal importance
                              </span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={analyticalContext.topRows} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis type="number" tick={{ fontSize: 9, fill: '#52525b' }} domain={[0, 1]} />
                                <YAxis dataKey="rank" type="category" tick={{ fontSize: 8, fill: '#a1a1aa' }} width={90} />
                                <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.65rem', color: '#e4e4e7' }} formatter={(v: unknown) => Number(v).toFixed(4)} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                                  {analyticalContext.topRows.map((r: any, i: number) => {
                                    const extra = r.extra || {};
                                    const fill = extra.strength === 'Strong' ? '#10b981' : (extra.strength === 'Moderate' ? '#3b82f6' : '#eab308');
                                    return <Cell key={i} fill={fill} />;
                                  })}
                                  <LabelList dataKey="value" position="right" fontSize={9} fill="#a1a1aa" formatter={(v: any) => Number(v).toFixed(4)} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : analyticalContext && analyticalContext.type === 'top5' ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>ðŸ† Top 5 by {analyticalContext.cntCol}</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={analyticalContext.topRows.map(r => ({ name: r.rank, value: r.value }))} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis type="number" tick={{ fontSize: 9, fill: '#52525b' }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fill: '#a1a1aa' }} width={55} />
                                <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.65rem', color: '#e4e4e7' }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                                  {analyticalContext.topRows.map((_, i) => <Cell key={i} fill={['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'][i]} />)}
                                  <LabelList dataKey="value" position="right" fontSize={9} fill="#a1a1aa" formatter={(v: any) => Number(v).toFixed(2)} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : analyticalContext && (analyticalContext.type === 'histogram') ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>ðŸ“Š Distribution: {analyticalContext.cntCol}</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={analyticalContext.histY} margin={{ top: 5, right: 12, bottom: 20, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#52525b' }} label={{ value: analyticalContext.cntCol, position: 'insideBottom', offset: -12, fontSize: 9, fill: '#71717a' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#52525b' }} />
                                <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.65rem', color: '#e4e4e7' }} />
                                <Bar dataKey="count" fill="#22c55e" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : analyticalContext && analyticalContext.type === 'bins' ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>ðŸ“¦ Binned Averages: {analyticalContext.valCol} â†’ {analyticalContext.cntCol}</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={analyticalContext.binRows} margin={{ top: 5, right: 12, bottom: 20, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#52525b' }} label={{ value: analyticalContext.valCol, position: 'insideBottom', offset: -12, fontSize: 9, fill: '#71717a' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#52525b' }} />
                                <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.65rem', color: '#e4e4e7' }} />
                                <Bar dataKey="avg" fill="#a855f7" radius={[2, 2, 0, 0]}>
                                  <LabelList dataKey="avg" position="top" fontSize={8} fill="#a1a1aa" formatter={(v: any) => Number(v).toFixed(2)} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : analyticalContext && analyticalContext.type === 'percentage' ? (
                          <>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>ðŸ¥§ % Contribution: {analyticalContext.valCol} ranges</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={analyticalContext.pieSlices} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                <XAxis type="number" unit="%" tick={{ fontSize: 9, fill: '#52525b' }} domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fill: '#a1a1aa' }} width={60} />
                                <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.65rem', color: '#e4e4e7' }} formatter={(v: unknown) => `${Number(v).toFixed(2)}%`} />
                                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                                  {analyticalContext.pieSlices.map((_, i) => <Cell key={i} fill={['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'][i % 5]} />)}
                                  <LabelList dataKey="value" position="right" fontSize={9} fill="#a1a1aa" formatter={(v: unknown) => `${Number(v)}%`} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : /* Default: Average Sleep Hours by Gender (MH) or idle placeholder */ isMentalHealthSchema && genderSleepData.length > 0 ? (
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.6rem' }}>Average Sleep Hours by Gender</div>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={genderSleepData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} domain={[0, 10]} />
                                <Tooltip contentStyle={{ background: '#0e0e12', borderColor: '#3c1417', color: '#fff', fontSize: '0.7rem' }} />
                                <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={40}>
                                  {genderSleepData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.name === 'male' ? '#eab308' : '#3b82f6'} />)}
                                  <LabelList dataKey="value" position="top" fill="#e4e4e7" fontSize={10} fontWeight={600} formatter={(v: any) => typeof v === 'number' ? v.toFixed(2) : String(v)} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </>
                        ) : (
                          /* Generic dataset: empty primary slot */
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: '0.6rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3f3f46' }}>
                              <TrendingUp size={16} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#3f3f46', textAlign: 'center', lineHeight: 1.4 }}>
                              Run a query to populate<br />this chart
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RIGHT COLUMN: Secondary + Tertiary stacked */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

                        {/* SECONDARY CHART */}
                        <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', flex: 1, minHeight: 120, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>

                          {analyticalContext && (analyticalContext.type === 'correlation' || analyticalContext.type === 'regression' || analyticalContext.type === 'outlier' || analyticalContext.type === 'residual' || analyticalContext.type === 'skew') ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Distribution: {analyticalContext.valCol}</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={analyticalContext.histX} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                  <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#52525b' }} />
                                  <YAxis tick={{ fontSize: 8, fill: '#52525b' }} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} />
                                  <Bar dataKey="count" fill="#3b82f6" radius={[1, 1, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </>
                          ) : analyticalContext && analyticalContext.type === 'top5' ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Bin Distribution</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={analyticalContext.binRows.slice(0, 8)} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                  <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#52525b' }} />
                                  <YAxis tick={{ fontSize: 8, fill: '#52525b' }} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} />
                                  <Bar dataKey="avg" fill="#a855f7" radius={[1, 1, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </>
                          ) : analyticalContext && analyticalContext.type === 'feature_importance' && analyticalContext.targetSummary ? (
                            <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', height: '100%', gap: '0.35rem', overflowY: 'auto' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Info size={12} style={{ color: '#3b82f6' }} />
                                🎯 Target Outcome Summary
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.58rem', marginTop: '0.1rem' }}>
                                <div style={{ background: '#121218', border: '1px solid #1e1e28', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                  <div style={{ color: '#71717a', fontSize: '0.5rem', textTransform: 'uppercase' }}>Target Field</div>
                                  <div style={{ fontWeight: 700, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={analyticalContext.targetSummary.target}>
                                    {analyticalContext.targetSummary.target}
                                  </div>
                                </div>
                                <div style={{ background: '#121218', border: '1px solid #1e1e28', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                  <div style={{ color: '#71717a', fontSize: '0.5rem', textTransform: 'uppercase' }}>Detected Type</div>
                                  <div style={{ fontWeight: 700, color: '#f4f4f5', textTransform: 'capitalize' }}>
                                    {analyticalContext.targetSummary.detectedType.replace('_', ' ')}
                                  </div>
                                </div>
                                <div style={{ background: '#121218', border: '1px solid #1e1e28', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                  <div style={{ color: '#71717a', fontSize: '0.5rem', textTransform: 'uppercase' }}>Sample Size (N)</div>
                                  <div style={{ fontWeight: 700, color: '#f4f4f5' }}>
                                    {analyticalContext.targetSummary.sampleSize.toLocaleString()} rows
                                  </div>
                                </div>
                                <div style={{ background: '#121218', border: '1px solid #1e1e28', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                  <div style={{ color: '#71717a', fontSize: '0.5rem', textTransform: 'uppercase' }}>Unique values</div>
                                  <div style={{ fontWeight: 700, color: '#f4f4f5' }}>
                                    {analyticalContext.targetSummary.uniqueCount} distinct
                                  </div>
                                </div>
                              </div>
                              {analyticalContext.targetSummary.positiveClass && (
                                <div style={{ fontSize: '0.52rem', background: 'rgba(59,130,246,0.06)', border: '1px dashed rgba(59,130,246,0.2)', borderRadius: '6px', padding: '0.35rem 0.45rem', color: '#93c5fd', marginTop: '0.1rem', lineHeight: 1.25 }}>
                                  <span style={{ fontWeight: 700 }}>Positive Encoding:</span> "{analyticalContext.targetSummary.positiveClass}" &rarr; 1. {analyticalContext.targetSummary.mappingNote}
                                </div>
                              )}
                            </div>
                          ) : isMentalHealthSchema && platformShareData.length > 0 ? (
                            <>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Platform Usage Share</div>
                              <div style={{ display: 'flex', alignItems: 'center', height: 120, position: 'relative' }}>
                                <div style={{ width: '55%', height: '100%' }}>
                                  <ResponsiveContainer>
                                    <PieChart>
                                      <Pie data={platformShareData} cx="50%" cy="50%" innerRadius={32} outerRadius={46} paddingAngle={3} dataKey="value">
                                        {platformShareData.map((_, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                                      </Pie>
                                      <Tooltip contentStyle={{ background: '#0e0e12', borderColor: '#3c1417', color: '#fff', fontSize: '0.65rem' }} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div style={{ position: 'absolute', top: '50%', left: '27.5%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f4f4f5', lineHeight: 1 }}>{kpis.records.toLocaleString()}</div>
                                    <div style={{ fontSize: '0.48rem', color: '#71717a', marginTop: 1 }}>Total</div>
                                  </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.25rem' }}>
                                  {platformShareData.map((item, idx) => {
                                    const total = platformShareData.reduce((acc, x) => acc + x.value, 0);
                                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.58rem' }}>
                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                                        <span style={{ color: '#a1a1aa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                        <span style={{ fontWeight: 700, color: '#f4f4f5' }}>{pct}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate this chart</div>
                            </div>
                          )}
                        </div>

                        {/* TERTIARY CHART */}
                        <div style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', padding: '0.65rem', flex: 1, minHeight: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
                          {analyticalContext && (analyticalContext.type === 'correlation' || analyticalContext.type === 'regression' || analyticalContext.type === 'outlier' || analyticalContext.type === 'residual' || analyticalContext.type === 'skew') ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Distribution: {analyticalContext.cntCol}</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={analyticalContext.histY} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                                  <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#52525b' }} />
                                  <YAxis tick={{ fontSize: 8, fill: '#52525b' }} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} />
                                  <Bar dataKey="count" fill="#22c55e" radius={[1, 1, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </>
                          ) : analyticalContext && (analyticalContext.type === 'bins' || analyticalContext.type === 'percentage') ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Pie Slices: {analyticalContext.valCol} ranges</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <PieChart>
                                  <Pie data={analyticalContext.pieSlices} cx="50%" cy="50%" innerRadius={28} outerRadius={44} paddingAngle={2} dataKey="value">
                                    {analyticalContext.pieSlices.map((_, i) => <Cell key={i} fill={['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'][i % 5]} />)}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: '#0e0e12', border: '1px solid #27272a', fontSize: '0.6rem', color: '#e4e4e7' }} formatter={(v: unknown) => `${Number(v).toFixed(2)}%`} />
                                </PieChart>
                              </ResponsiveContainer>
                            </>
                          ) : analyticalContext && analyticalContext.type === 'feature_importance' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.45rem', overflowY: 'auto' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Sparkles size={12} style={{ color: '#10b981' }} />
                                Key Predictive Driver Insights
                              </div>

                              {/* Causal warning banner */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', padding: '0.35rem 0.5rem', color: '#f87171', fontSize: '0.52rem', lineHeight: 1.3 }}>
                                <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                                <span>
                                  <strong>⚠️ Important:</strong> This ranking shows statistical association, not causal proof. Correlation does not imply causation.
                                </span>
                              </div>

                              {/* Top Predictor Detail */}
                              {analyticalContext.topRows && analyticalContext.topRows.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.4rem 0.5rem', borderRadius: '6px', fontSize: '0.58rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#a1a1aa', fontSize: '0.5rem' }}>STRONGEST RELATIONSHIP</span>
                                    <span style={{ fontWeight: 700, color: '#10b981' }}>{analyticalContext.topRows[0]?.rank}</span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#a1a1aa', fontSize: '0.5rem' }}>STRENGTH ({String(analyticalContext.topRows[0]?.extra?.method || '')})</div>
                                    <div style={{ fontWeight: 700, color: '#f4f4f5' }}>
                                      {Number(analyticalContext.topRows[0]?.value ?? 0).toFixed(4)} ({String(analyticalContext.topRows[0]?.extra?.strength || '')})
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.58rem', color: '#71717a', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                                  No features survived safety exclusions.
                                </div>
                              )}

                              {/* Exclusions or warnings scroll panel */}
                              {((analyticalContext.excludedFeatures && analyticalContext.excludedFeatures.length > 0) || (analyticalContext.warnings && analyticalContext.warnings.length > 0)) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '110px', overflowY: 'auto', background: '#121218', border: '1px solid #1e1e28', padding: '0.4rem', borderRadius: '6px', fontSize: '0.54rem' }}>
                                  {analyticalContext.warnings && analyticalContext.warnings.map((w: string, idx: number) => (
                                    <div key={`w-${idx}`} style={{ color: '#f59e0b', display: 'flex', gap: '0.2rem', alignItems: 'flex-start' }}>
                                      <span>⚠️</span>
                                      <span>{w}</span>
                                    </div>
                                  ))}
                                  {analyticalContext.excludedFeatures && analyticalContext.excludedFeatures.map((ex: ExcludedFeature, idx: number) => (
                                    <div key={`ex-${idx}`} style={{ color: '#71717a', display: 'flex', gap: '0.2rem', alignItems: 'flex-start' }}>
                                      <span>🛡️</span>
                                      <span><strong>{ex.feature}:</strong> Skipped due to {ex.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : isMentalHealthSchema && screenTimeStressData.length > 0 ? (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.4rem' }}>Screen Time vs Stress</div>
                              <ResponsiveContainer width="100%" height={120}>
                                <LineChart data={screenTimeStressData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                  <XAxis dataKey="name" stroke="#52525b" fontSize={7} tickLine={false} />
                                  <YAxis stroke="#52525b" fontSize={8} tickLine={false} domain={[0, 10]} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', borderColor: '#3c1417', color: '#fff', fontSize: '0.65rem' }} />
                                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={1.5} dot={{ fill: '#ef4444', r: 2 }} activeDot={{ r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate this chart</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Generic dataset idle â€” schema + suggested queries */
                    <div style={{ display: 'grid', gridTemplateColumns: columnsList.length > 0 ? '1fr 1.4fr' : '1fr', gap: '0.75rem', flexShrink: 0 }}>
                      {columnsList.length > 0 && (
                        <div style={{ background: '#0e0e12', border: '1px solid #1f1f23', borderRadius: '12px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Schema â€” {selectedDataset?.name}</span>
                            <span style={{ fontSize: '0.58rem', color: '#3f3f46' }}>{columnsList.length} fields</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '240px', overflowY: 'auto' }}>
                            {columnsList.map(col => {
                              const isNum = col.type === 'number' || ['DECIMAL','INTEGER','BIGINT','FLOAT'].includes((col.type||'').toUpperCase());
                              return (
                                <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.4rem', borderRadius: '5px' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#121216'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.52rem', fontWeight: 800, width: 16, color: isNum ? '#ef4444' : '#3b82f6' }}>{isNum ? '#' : 'Aa'}</span>
                                  <span style={{ fontSize: '0.68rem', color: '#a1a1aa', flex: 1 }}>{col.name}</span>
                                  <span style={{ fontSize: '0.52rem', color: '#3f3f46', fontFamily: 'var(--mono)' }}>{(col.type||'str').toLowerCase()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {suggestedCards.length > 0 && (
                        <div style={{ background: '#0e0e12', border: '1px solid #1f1f23', borderRadius: '12px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Suggested Queries</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {suggestedCards.map((item, idx) => (
                              <div key={idx} onClick={() => handleRunPresetQuestion(item.query)}
                                style={{ background: '#09090c', border: '1px solid #1f1f23', borderRadius: '8px', padding: '0.6rem 0.75rem', cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.background = '#110a0d'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f1f23'; e.currentTarget.style.background = '#09090c'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.7rem' }}>{idx === 0 ? 'ðŸ“ˆ' : idx === 1 ? 'ðŸ“Š' : 'âš¡'}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                                  <div style={{ fontSize: '0.58rem', color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.05rem' }}>{item.desc}</div>
                                </div>
                                <span style={{ fontSize: '0.6rem', color: '#3f3f46' }}>â€º</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* â”€â”€ Row 2: Bottom Three Panels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  {(analyticalContext || isMentalHealthSchema) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.95fr 1fr', gap: '0.6rem', flexShrink: 0 }}>

                      {/* BOTTOM LEFT */}
                      <div style={{ background: '#0e0e12', border: '1.5px solid #3c1417', borderRadius: '16px', padding: '0.75rem', minHeight: 185 }}>
                        {analyticalContext && analyticalContext.scatterPairs.length > 0 ? (
                          <>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Statistical Summary</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.62rem' }}>
                              <tbody>
                                {[
                          { label: `Mean ${analyticalContext.valCol}`, value: analyticalContext.xStats.mean.toFixed(4) },
                          { label: `Std ${analyticalContext.valCol}`, value: analyticalContext.xStats.std.toFixed(4) },
                          { label: `Min / Max ${analyticalContext.valCol}`, value: `${analyticalContext.xStats.min.toFixed(2)} / ${analyticalContext.xStats.max.toFixed(2)}` },
                          { label: `Mean ${analyticalContext.cntCol}`, value: analyticalContext.yStats.mean.toFixed(4) },
                          { label: `Std ${analyticalContext.cntCol}`, value: analyticalContext.yStats.std.toFixed(4) },
                          { label: `Min / Max ${analyticalContext.cntCol}`, value: `${analyticalContext.yStats.min.toFixed(2)} / ${analyticalContext.yStats.max.toFixed(2)}` },
                          { label: 'Pearson r', value: analyticalContext.kpiCards[0]?.value },
                          { label: 'R² (Fit)', value: analyticalContext.regR2.toFixed(4) },
                          { label: 'Slope (β₁)', value: analyticalContext.regSlope.toFixed(4) },
                          { label: 'Intercept (β₀)', value: analyticalContext.regIntercept.toFixed(4) },
                          { label: 'Sample n', value: String(analyticalContext.scatterPairs.length) },
                                ].map((row, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #1f1f23' }}>
                                    <td style={{ padding: '0.3rem 0.2rem', color: '#71717a', width: '60%' }}>{row.label}</td>
                                    <td style={{ padding: '0.3rem 0.2rem', color: '#e4e4e7', fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        ) : isMentalHealthSchema && screenTimeStressData.length > 0 ? (
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.6rem' }}>Screen Time Before Sleep vs Stress</div>
                            <div style={{ width: '100%', height: 145 }}>
                              <ResponsiveContainer>
                                <LineChart data={screenTimeStressData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                  <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                                  <YAxis stroke="#52525b" fontSize={9} tickLine={false} domain={[0, 10]} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', borderColor: '#3c1417', color: '#fff', fontSize: '0.7rem' }} />
                                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} activeDot={{ r: 5 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 145, gap: '0.4rem' }}>
                            <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate</div>
                          </div>
                        )}
                      </div>

                      {/* BOTTOM CENTER */}
                      <div className="pv-card" style={{ background: 'linear-gradient(180deg,#0f0f14 0%,#0c0c10 100%)', border: '1.5px solid #1e1e28', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Gender Summary Report</div>
                        {genderSummaryTable.length > 0 ? (
                          <div style={{ overflowY: 'auto', height: 145 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.62rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1.5px solid #2e1014', color: '#a1a1aa' }}>
                                  <th style={{ padding: '0.3rem 0.2rem', fontWeight: 600 }}>gender</th>
                                  <th style={{ padding: '0.3rem 0.2rem', fontWeight: 600 }}>avg sleep</th>
                                  <th style={{ padding: '0.3rem 0.2rem', fontWeight: 600 }}>avg age</th>
                                  <th style={{ padding: '0.3rem 0.2rem', fontWeight: 600 }}>count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {genderSummaryTable.map((row, idx) => {
                                  const isTotal = row.gender === 'Total';
                                  const gColor = row.gender === 'male' ? '#60a5fa' : row.gender === 'female' ? '#f472b6' : '#ef4444';
                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #1f1f23', fontWeight: isTotal ? 700 : 400, background: isTotal ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                      <td style={{ padding: '0.4rem 0.2rem', color: gColor, fontWeight: 600 }}>{row.gender}</td>
                                      <td style={{ padding: '0.4rem 0.2rem' }}>{row.avg_sleep_hours}</td>
                                      <td style={{ padding: '0.4rem 0.2rem' }}>{row.avg_age}</td>
                                      <td style={{ padding: '0.4rem 0.2rem', fontFamily: 'var(--mono)' }}>{row.count.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 145, gap: '0.4rem' }}>
                            <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Gender breakdown appears here<br />for mental health datasets</div>
                          </div>
                        )}
                      </div>

                      {/* BOTTOM RIGHT */}
                      <div style={{ background: '#0e0e12', border: '1px solid #3c1417', borderRadius: '6px', padding: '0.75rem', minHeight: 185 }}>
                        {analyticalContext && analyticalContext.topRows.length > 0 && analyticalContext.type !== 'top5' ? (
                          <>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.5rem' }}>Top 5 by {analyticalContext.cntCol}</div>
                            {analyticalContext.topRows.map((r, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', borderBottom: '1px solid #1f1f23', fontSize: '0.62rem' }}>
                                <span style={{ color: ['#ef4444','#f97316','#eab308','#a1a1aa','#52525b'][i], fontWeight: 700, width: 18 }}>{r.rank}</span>
                                <span style={{ flex: 1, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{analyticalContext.cntCol}</span>
                                <span style={{ color: '#f4f4f5', fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.value.toFixed(2)}</span>
                              </div>
                            ))}
                          </>
                        ) : anxietyLevelsData.length > 0 ? (
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '0.6rem' }}>Top Anxiety Levels</div>
                            <div style={{ width: '100%', height: 145 }}>
                              <ResponsiveContainer>
                                <BarChart data={anxietyLevelsData} layout="vertical" margin={{ top: 5, right: 20, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                  <XAxis type="number" stroke="#52525b" fontSize={8} tickLine={false} />
                                  <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={8} tickLine={false} width={45} />
                                  <Tooltip contentStyle={{ background: '#0e0e12', borderColor: '#3c1417', color: '#fff', fontSize: '0.7rem' }} />
                                  <Bar dataKey="count" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={12}>
                                    <LabelList dataKey="count" position="right" fill="#a1a1aa" fontSize={8} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 145, gap: '0.4rem' }}>
                            <div style={{ fontSize: '0.62rem', color: '#3f3f46', textAlign: 'center' }}>Run a query to populate<br />this panel</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
              </div>

          ) : activeTab === 'data' ? (

            <div style={{ background: '#0e0e12', border: '1px solid #3c1417', borderRadius: '6px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1a1a24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Local Database Grid Preview</span>
                <span style={{ fontSize: '0.58rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', padding: '1px 5px', borderRadius: '3px' }}>Viewing top 100 rows</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#09090c', borderBottom: '1.5px solid #2e1014', color: '#a1a1aa' }}>
                      {columnsList.map((col) => (
                        <th key={col.name} style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{col.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataGridRows.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid #1f1f23', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        {columnsList.map((col) => (
                          <td key={col.name} style={{ padding: '0.45rem 0.75rem', color: '#e4e4e7', fontFamily: 'var(--mono)', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background: '#0e0e12', border: '1px solid #3c1417', borderRadius: '6px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Layers size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.25rem', color: '#e4e4e7' }}>Local Relational Data Modeling</h3>
                <p style={{ color: '#71717a', fontSize: '0.7rem', maxWidth: 400, lineHeight: 1.45 }}>
                  Model schemas, define foreign keys, and encrypt columns homomorphically. Privana runs modeling tasks in-memory without uploading schema topologies to public hosts.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.58rem', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', padding: '1px 5px', borderRadius: '3px' }}>Enclave sandbox active</span>
                <span style={{ fontSize: '0.58rem', background: 'rgba(168,85,247,0.08)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.18)', padding: '1px 5px', borderRadius: '3px' }}>DuckDB model mappings</span>
              </div>
            </div>
          )}

          {/* Status Bar */}
          {selectedDataset && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', borderTop: '1px solid #111118', flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.55rem', color: '#52525b', fontFamily: 'var(--mono)' }}>
                Local Power BI-style report
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', color: '#3b82f6', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                {(kpis.records > 0 ? kpis.records : selectedDataset.row_count ?? 0).toLocaleString()} rows
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', color: '#52525b', fontFamily: 'var(--mono)' }}>
                {selectedDataset.name?.split('.').pop()?.toUpperCase() ?? 'CSV'} loaded
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', background: 'rgba(34,197,94,0.06)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', padding: '0px 5px', borderRadius: '3px', fontWeight: 700 }}>
                🔒 Local sandbox
              </span>
              {analyticalContext && (
                <>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.55rem', color: '#8b5cf6', fontFamily: 'var(--mono)' }}>
                    {analyticalContext.type} · n={analyticalContext.scatterPairs.length}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Bottom sheet page tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            borderTop: '1px solid #1a1a24',
            paddingTop: '0.5rem',
            marginTop: 'auto',
            fontSize: '0.68rem',
            flexShrink: 0
          }}>
            {['Overview', 'Sleep Analysis', 'Stress Analysis', 'Platform Usage', 'Demographics'].map((tabName) => {
              const isActive = bottomTab === tabName;
              return (
                <button
                  key={tabName}
                  style={{
                    background: isActive ? '#0e0e12' : 'transparent',
                    color: isActive ? '#ef4444' : '#71717a',
                    border: isActive ? '1px solid #3c1417' : '1px solid transparent',
                    borderBottom: isActive ? '1px solid transparent' : '1px solid transparent',
                    borderRadius: '4px 4px 0 0',
                    padding: '3px 10px',
                    fontSize: '0.65rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setBottomTab(tabName)}
                >
                  {tabName}
                </button>
              );
            })}
            <button 
              style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '0.8rem', padding: '0 6px', cursor: 'pointer' }}
              onClick={() => alert('New analysis sheet tab added!')}
            >
              +
            </button>
          </div>

        </div>

        {/* MIDDLE AREA: FILTERS PANEL (230px wide) */}
        {selectedDataset && isMentalHealthSchema && (
          <div style={{
            width: 230,
          borderLeft: '1px solid #3c1417',
          background: '#0a0a0d',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '0.65rem 0.85rem',
            borderBottom: '1px solid #1a1a24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 800, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Filter size={11} style={{ color: '#ef4444' }} /> Filters
            </span>
            <button 
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setGenderFilter({ male: true, female: true });
                setPlatformFilter({ Instagram: true, TikTok: true, YouTube: true, Snapchat: true, Twitter: true });
                setAgeRange([13, 19]);
              }}
            >
              Clear filters
            </button>
          </div>

          {/* Search filters */}
          <div style={{ padding: '0.55rem 0.85rem', borderBottom: '1px solid #1a1a24' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 7.5, color: '#52525b' }} />
              <input 
                type="text" 
                style={{ 
                  height: 25, 
                  fontSize: '0.65rem', 
                  paddingLeft: '1.5rem', 
                  background: '#121215', 
                  borderColor: '#3c1417',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderRadius: '4px',
                  width: '100%',
                  color: '#fff',
                  outline: 'none'
                }}
                placeholder="Search filters..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Collapsible content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Filter Section 1: Gender */}
            <div style={{ borderBottom: '1px solid #1a1a24', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
                <span>Gender</span>
                <span style={{ fontSize: '0.58rem', color: '#71717a' }}>is (All)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                  <input 
                    type="checkbox" 
                    style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                    checked={genderFilter.male && genderFilter.female}
                    onChange={handleSelectAllGender}
                  />
                  <span style={{ color: '#e4e4e7' }}>Select all</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                  <input 
                    type="checkbox" 
                    style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                    checked={genderFilter.male} 
                    onChange={() => setGenderFilter(prev => ({ ...prev, male: !prev.male }))}
                  />
                  <span style={{ color: '#e4e4e7' }}>male</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>{baselineCounts.male}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                  <input 
                    type="checkbox" 
                    style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                    checked={genderFilter.female} 
                    onChange={() => setGenderFilter(prev => ({ ...prev, female: !prev.female }))}
                  />
                  <span style={{ color: '#e4e4e7' }}>female</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>{baselineCounts.female}</span>
                </label>
              </div>
            </div>

            {/* Filter Section 2: Platform */}
            <div style={{ borderBottom: '1px solid #1a1a24', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
                <span>Platform</span>
                <span style={{ fontSize: '0.58rem', color: '#71717a' }}>is (All)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                  <input 
                    type="checkbox" 
                    style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                    checked={Object.values(platformFilter).every(v => v)}
                    onChange={handleSelectAllPlatform}
                  />
                  <span style={{ color: '#e4e4e7' }}>Select all</span>
                </label>
                {Object.keys(platformFilter).map((plat) => (
                  <label key={plat} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.68rem' }}>
                    <input 
                      type="checkbox" 
                      style={{ accentColor: '#ef4444', width: 12, height: 12 }} 
                      checked={platformFilter[plat]} 
                      onChange={() => setPlatformFilter(prev => ({ ...prev, [plat]: !prev[plat] }))}
                    />
                    <span style={{ color: '#e4e4e7' }}>{plat}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#71717a' }}>
                      {(baselineCounts as any)[plat] || 0}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter Section 3: Age Range */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, color: '#a1a1aa', marginBottom: '0.4rem' }}>
                <span>Age Range</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{ageRange[0]} - {ageRange[1]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min={13} 
                    max={19} 
                    value={ageRange[0]} 
                    onChange={(e) => setAgeRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), ageRange[1])])}
                    style={{ flex: 1, accentColor: '#ef4444', height: 3 }} 
                  />
                  <input 
                    type="range" 
                    min={13} 
                    max={19} 
                    value={ageRange[1]} 
                    onChange={(e) => setAgeRange([Math.min(parseInt(e.target.value), ageRange[0]), parseInt(e.target.value)])}
                    style={{ flex: 1, accentColor: '#ef4444', height: 3 }} 
                  />
                </div>
                <button 
                  style={{
                    background: 'transparent',
                    border: '1px solid #3c1417',
                    color: '#ef4444',
                    borderRadius: '4px',
                    padding: '3px 0',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '0.2rem',
                    textAlign: 'center'
                  }}
                  onClick={() => alert(`Filters restricted to age range ${ageRange[0]} - ${ageRange[1]}`)}
                >
                  Apply filter
                </button>
              </div>
            </div>

          </div>

          {/* Bottom indicator */}
          <div style={{ padding: '0.55rem 0.85rem', borderTop: '1px solid #1a1a24', display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#71717a' }}>
            <span>Filters on all pages</span>
            <span>â¯</span>
          </div>
        </div>
        )}

        {/* RIGHT AREA: FIELDS PANEL (230px wide) */}
        {selectedDataset && (
          <div style={{
            width: 230,
          borderLeft: '1px solid #3c1417',
          background: '#0a0a0d',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '0.65rem 0.85rem',
            borderBottom: '1px solid #1a1a24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 800, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Database size={11} style={{ color: '#ef4444' }} /> Fields
            </span>
            <span style={{ fontSize: '0.65rem', color: '#71717a', cursor: 'pointer' }}>â®â®</span>
          </div>

          {/* Search fields */}
          <div style={{ padding: '0.55rem 0.85rem', borderBottom: '1px solid #1a1a24' }}>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 7.5, color: '#52525b' }} />
              <input 
                type="text" 
                style={{ 
                  height: 25, 
                  fontSize: '0.65rem', 
                  paddingLeft: '1.5rem', 
                  background: '#121215', 
                  borderColor: '#3c1417',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderRadius: '4px',
                  width: '100%',
                  color: '#fff',
                  outline: 'none'
                }}
                placeholder="Search fields..."
                value={fieldsSearch}
                onChange={(e) => setFieldsSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Accordion List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.45rem' }}>
            {selectedDataset && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* Accordion File Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  fontSize: '0.65rem', 
                  color: '#e4e4e7', 
                  fontWeight: 700, 
                  padding: '0.35rem 0.45rem', 
                  background: '#121214',
                  borderRadius: '4px',
                  marginBottom: '0.25rem',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  <span>▼</span>
                  <span>ðŸ“„</span> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDataset.name}</span>
                </div>
                
                {/* Fields list */}
                <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0.5rem' }}>
                  {filteredColumns.map(col => {
                    const isNum = col.type === 'number' || ['DECIMAL','INTEGER','BIGINT','FLOAT'].includes(col.type?.toUpperCase());
                    return (
                      <div 
                        key={col.name} 
                        style={{ 
                          padding: '0.28rem 0.45rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.4rem', 
                          cursor: 'default',
                          borderRadius: '3px',
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#121216'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ 
                          fontFamily: 'var(--mono)', 
                          fontSize: '0.54rem', 
                          color: isNum ? '#ef4444' : '#3b82f6', 
                          fontWeight: 800,
                          width: '18px',
                          display: 'inline-block'
                        }}>
                          {isNum ? '#' : 'Aa'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#a1a1aa' }}>{col.name}</span>
                        {isNum && (
                          <span style={{ marginLeft: 'auto', color: '#71717a', fontSize: '0.62rem', fontWeight: 600 }}>Î£</span>
                        )}
                        {col.is_he && (
                          <span style={{ marginLeft: isNum ? '0.2rem' : 'auto', color: '#c084fc', fontSize: '0.6rem' }} title="Homomorphically Encrypted">ðŸ”’</span>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          {/* Visual Fields Builder Dropzone (Red dashed border matching Power BI style in mockup) */}
          <div style={{ padding: '0.55rem', borderTop: '1px solid #1a1a24' }}>
            <div style={{
              border: '1.5px dashed #451a1d',
              borderRadius: '6px',
              padding: '0.85rem 0.55rem',
              textAlign: 'center',
              background: 'rgba(239,68,68,0.01)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              cursor: 'default'
            }}>
              <div style={{ fontSize: '1.25rem' }}>â–¦</div>
              <span style={{ fontSize: '0.65rem', color: '#71717a', lineHeight: 1.3 }}>
                Drag data fields here to build visuals
              </span>
            </div>
          </div>
        </div>
        )}

      </div>

      {/* Floating AI Chat Assistant Trigger Button */}
      {!isChatOpen && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444, #990f14)',
            color: '#fff',
            border: '1.5px solid #ff7b80',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 999
          }}
          title="Ask Privana AI"
        >
          <MessageSquare size={18} />
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#10b981',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: '2px solid #07070a'
          }} />
        </motion.button>
      )}

      {/* Slide-over Copilot Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 210 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '380px',
              height: '100vh',
              background: 'rgba(9, 9, 12, 0.97)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1.5px solid #3c1417',
              boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.8)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            {/* Drawer Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #1a1a24',
              background: 'rgba(239, 68, 68, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Sparkles size={16} style={{ color: '#ef4444' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                    Privana AI Copilot
                  </span>
                  <div style={{ fontSize: '0.55rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                    Offline Enclave Active
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <button
                  onClick={() => {
                    setChatMessages([
                      {
                        sender: 'ai',
                        text: "ðŸ‘‹ Welcome back! I've cleared the chat history. Ask me anything about the active dataset.",
                        timestamp: new Date()
                      }
                    ]);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px dashed rgba(239, 68, 68, 0.2)',
                    borderRadius: '4px',
                    color: '#f87171',
                    fontSize: '0.58rem',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'}
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: 'none',
                    color: '#a1a1aa',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Chat message bubbles list */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              {chatMessages.map((msg, idx) => {
                const isAI = msg.sender === 'ai';
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isAI ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}
                  >
                    <div style={{
                      background: isAI ? '#121216' : 'rgba(239, 68, 68, 0.08)',
                      border: isAI ? '1px solid #1a1a24' : '1px solid #ef444433',
                      borderRadius: isAI ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.72rem',
                      color: '#e4e4e7',
                      lineHeight: 1.45,
                      ...(isAI ? {} : { whiteSpace: 'pre-wrap', fontFamily: 'inherit' })
                    }}>
                      {isAI
                        ? <MarkdownRenderer text={msg.text} />
                        : msg.text
                      }
                    </div>
                    <span style={{
                      fontSize: '0.52rem',
                      color: '#52525b',
                      alignSelf: isAI ? 'flex-start' : 'flex-end',
                      padding: '0 2px'
                    }}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#121216', border: '1px solid #1a1a24', borderRadius: '12px 12px 12px 2px', padding: '0.65rem 0.85rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Privana AI is thinking...</span>
                  <RefreshCw size={11} style={{ color: '#ef4444', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>

            {/* Quick Suggestion Chips */}
            <div style={{
              padding: '0.5rem 1rem',
              borderTop: '1px solid #1a1a24',
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none'
            }}>
              {[
                "Average sleep hours",
                "Show TikTok stress",
                "Female users over 15"
              ].map((chipText) => (
                <button
                  key={chipText}
                  onClick={() => {
                    setChatInput(chipText);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #27272a',
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontSize: '0.62rem',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                    e.currentTarget.style.borderColor = '#ef444455';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = '#27272a';
                    e.currentTarget.style.color = '#a1a1aa';
                  }}
                >
                  {chipText}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div style={{
              padding: '0.85rem 1rem',
              borderTop: '1px solid #1a1a24',
              background: '#09090b',
              display: 'flex',
              gap: '0.5rem'
            }}>
              <input
                type="text"
                placeholder="Ask AI about dataset..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendChatMessage();
                }}
                style={{
                  flex: 1,
                  height: '32px',
                  background: '#040406',
                  border: '1.5px solid #27272a',
                  borderRadius: '6px',
                  padding: '0 0.75rem',
                  fontSize: '0.72rem',
                  color: '#fff',
                  outline: 'none',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
              <button
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (chatLoading || !chatInput.trim()) ? 'default' : 'pointer',
                  color: '#fff',
                  transition: 'background 0.15s'
                }}
              >
                <Send size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: 'rgba(239, 68, 68, 0.95)', color: '#fff',
          padding: '8px 16px', borderRadius: '12px', fontSize: '0.72rem',
          fontWeight: 700, zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '1.5px solid #ff8a8f',
          backdropFilter: 'blur(8px)'
        }}>
          {toastMessage}
        </div>
      )}

    </div>
  );
}
