import React from 'react';
import { motion, Variants } from 'framer-motion';
import { Sparkles, Database, Layers, Shield, Lock, Fingerprint } from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
}

interface SuggestedQuestion {
  title: string;
  desc: string;
  query: string;
}

interface QueryReadyStateProps {
  datasetName: string;
  rowCount: number;
  columns: ColumnInfo[];
  suggestedQuestions: SuggestedQuestion[];
  onSelectField: (fieldName: string) => void;
  onSelectQuestion: (question: string) => void;
}

export function QueryReadyState({
  datasetName,
  rowCount,
  columns,
  suggestedQuestions,
  onSelectField,
  onSelectQuestion
}: QueryReadyStateProps) {
  // Animation container variants for cascading mount
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 120, damping: 14 }
    }
  };

  return (
    <motion.div 
      className="flex flex-col gap-3.5 w-full h-full min-h-0 overflow-y-auto px-0.5 pb-2"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {/* 1. WELCOME COCKPIT PANEL (Obsidian glass with custom double border glows) */}
      <motion.div 
        variants={itemVariants}
        className="cockpit-card cockpit-card--dualrim p-5 flex items-center gap-4 relative overflow-hidden"
      >
        {/* Soft atmospheric background glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-red-500/5 blur-2xl pointer-events-none" />

        <div className="w-11 h-11 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.1)]">
          <Sparkles size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-extrabold text-zinc-100 tracking-tight mb-0.5">
            Ask a question to generate your first analysis
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed max-w-2xl">
            Draft a question in the query bar above or select one of the suggested cards below to generate a beautiful analysis. You can also click columns in the field directory to append them.
          </p>
        </div>
      </motion.div>

      {/* 2. DATASET METRICS GRID */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0"
      >
        {[
          { 
            label: 'DATASET', 
            value: datasetName.replace(/\.[^/.]+$/, "").replace(/_/g, " "), 
            sub: datasetName, 
            variant: 'coral', 
            icon: <Database size={13} className="text-red-400" />,
            pillColor: 'bg-red-500/30'
          },
          { 
            label: 'RECORDS COUNT', 
            value: rowCount.toLocaleString(), 
            sub: 'In-memory rows active', 
            variant: 'zinc', 
            icon: <Layers size={13} className="text-zinc-400" />,
            pillColor: 'bg-zinc-700/30'
          },
          { 
            label: 'SCHEMA FIELDS', 
            value: columns.length, 
            sub: 'Queryable parameters', 
            variant: 'zinc', 
            icon: <Fingerprint size={13} className="text-zinc-400" />,
            pillColor: 'bg-zinc-700/30'
          },
          { 
            label: 'ENGINE STATUS', 
            value: 'SQLite Sandbox', 
            sub: 'Local private sandbox', 
            variant: 'emerald', 
            icon: <Shield size={13} className="text-emerald-400" />,
            pillColor: 'bg-emerald-500/30'
          }
        ].map((k, ki) => {
          const rimClass = k.variant === 'coral' ? '' : k.variant === 'emerald' ? 'green' : 'violet';
          return (
            <div 
              key={ki} 
              className={`cockpit-card cockpit-card--dualrim ${rimClass} px-3.5 py-3 flex items-center gap-3.5`}
            >
              <div className="w-7 h-7 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                {k.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-zinc-400 font-bold tracking-wider uppercase">
                  {k.label}
                </div>
                <div className="text-[1.05rem] font-black text-zinc-200 leading-none my-1 truncate">
                  {k.value}
                </div>
                {/* Visual indicator bar under metric */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-1 w-12 bg-zinc-900 rounded-full overflow-hidden">
                    <div className={`h-full w-2/3 ${k.pillColor} rounded-full`} />
                  </div>
                  <span className="text-[9px] text-zinc-400 truncate leading-none">{k.sub}</span>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* 3. ROW 3: AVAILABLE FIELDS (LEFT) + SUGGESTED ANALYSES (RIGHT) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 min-h-0 flex-1">
        {/* A. AVAILABLE FIELDS DIRECTORY */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-2 cockpit-card p-4 flex flex-col gap-3 min-h-[300px]"
        >
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
              Field Directory ({columns.length})
            </span>
            <span className="text-[9px] text-zinc-500 font-medium">Click to append</span>
          </div>

          <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 flex-1 max-h-[380px]">
            {columns.map((col) => {
              const isNum = col.type === 'number' || ['DECIMAL', 'INTEGER', 'BIGINT', 'FLOAT'].includes((col.type || '').toUpperCase());
              return (
                <motion.div
                  key={col.name}
                  onClick={() => onSelectField(col.name)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-950/40 border border-zinc-900/60 cursor-pointer select-none"
                  whileHover={{
                    x: 2,
                    borderColor: isNum ? "rgba(239, 68, 68, 0.25)" : "rgba(59, 130, 246, 0.25)",
                    backgroundColor: "rgba(255, 255, 255, 0.01)"
                  }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className={`font-mono text-[9px] font-black w-5 text-center ${isNum ? 'text-red-400' : 'text-blue-400'}`}>
                    {isNum ? '#' : 'Aa'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-300 flex-1 truncate">
                    {col.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono uppercase bg-zinc-900 border border-zinc-800/40 px-1 py-0.5 rounded">
                    {(col.type || 'str').toLowerCase()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* B. DYNAMIC SUGGESTED ANALYSES */}
        <motion.div 
          variants={itemVariants}
          className="md:col-span-3 cockpit-card p-4 flex flex-col gap-3 min-h-[300px]"
        >
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider border-b border-zinc-800/40 pb-2">
            Suggested Analyses
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 max-h-[380px] overflow-y-auto pr-0.5">
            {suggestedQuestions.map((item, idx) => (
              <motion.div
                key={idx}
                onClick={() => onSelectQuestion(item.query)}
                className="cockpit-card cockpit-card--dualrim cockpit-hover p-4 flex flex-col justify-between select-none relative"
                whileHover={{
                  y: -1.5,
                  scale: 1.005,
                  borderColor: "rgba(239, 68, 68, 0.30)",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.70), 0 8px 24px rgba(239, 68, 68, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.03)"
                }}
                whileTap={{ scale: 0.995 }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-md bg-red-500/5 border border-red-500/10 flex items-center justify-center text-xs">
                      📊
                    </div>
                    <div className="text-xs font-black text-zinc-300 truncate">
                      {item.title}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 leading-normal line-clamp-2">
                    {item.query}
                  </div>
                </div>

                <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider text-right mt-3">
                  Run Query →
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 4. LOCAL SECURITY COCKPIT FOOTER */}
      <motion.div 
        variants={itemVariants}
        className="cockpit-card px-4 py-3 flex items-center justify-around flex-wrap gap-4 shrink-0 text-zinc-400 border border-zinc-900"
      >
        {[
          { icon: <Shield size={14} className="text-emerald-400" />, text: 'Private Local Active', desc: 'No remote APIs used' },
          { icon: <Lock size={14} className="text-emerald-400" />, text: 'PII Auto-Redaction', desc: 'Sensitive data scrubbed' },
          { icon: <Fingerprint size={14} className="text-emerald-400" />, text: 'Zero-Trust Sandbox', desc: 'Executed inside browser' }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            {item.icon}
            <div>
              <div className="text-[10px] font-bold text-zinc-300">{item.text}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">{item.desc}</div>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
