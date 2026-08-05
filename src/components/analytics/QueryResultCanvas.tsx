import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Database, ArrowRight } from 'lucide-react';
import { ResultView } from '../../domain/analytics/features/result-view/ResultView';
import { PlanPreview } from '../../domain/analytics/features/plan-preview/PlanPreview';

interface WelcomeDashboardProps {
  selectedDataset: any;
  onSelectPrompt: (prompt: string) => void;
  onToggleDefaultReports: () => void;
}

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  selectedDataset,
  onSelectPrompt,
  onToggleDefaultReports
}) => {
  const getSuggestions = () => {
    if (!selectedDataset) return [];
    const cols = selectedDataset.columns_meta || [];
    const names = cols.map((c: any) => c.name.toLowerCase());
    
    const suggs: string[] = [];
    if (names.includes('sleep_hours') && names.includes('gender')) {
      suggs.push("What is the average sleep_hours by gender?");
    }
    if (names.includes('stress_level') && names.includes('gender')) {
      suggs.push("Compare stress_level across gender");
    }
    if (names.includes('daily_social_media_hours') && names.includes('anxiety_level')) {
      suggs.push("Show daily_social_media_hours vs anxiety_level correlation");
    }
    if (names.includes('depression_label')) {
      suggs.push("What is the distribution of depression_label?");
    }
    
    if (suggs.length < 3) {
      const numCols = cols.filter((c: any) => c.type === 'number').map((c: any) => c.name);
      const catCols = cols.filter((c: any) => c.type === 'string' || c.type === 'category').map((c: any) => c.name);
      if (numCols.length > 0 && catCols.length > 0) {
        suggs.push(`Show average ${numCols[0]} by ${catCols[0]}`);
      }
      if (numCols.length >= 2) {
        suggs.push(`Correlation between ${numCols[0]} and ${numCols[1]}`);
      }
    }
    
    return suggs.slice(0, 4);
  };

  const suggestions = getSuggestions();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      flex: 1,
      minHeight: 0,
      padding: '2.5rem 1.5rem',
      background: 'radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.045) 0%, rgba(6, 4, 5, 0.5) 100%)',
      borderRadius: '16px',
      border: '1.5px solid var(--rim)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      margin: '0.5rem 0'
    }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90 }}
        style={{
          width: '68px',
          height: '68px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(249, 115, 22, 0.04) 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.12)',
          marginBottom: '0.2rem'
        }}
      >
        <Sparkles size={32} style={{ color: '#ef4444' }} />
      </motion.div>

      <div style={{ maxWidth: '500px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '0.4rem', color: '#fff' }}>
          Ready to Explore Your Dataset
        </h2>
        <p style={{ fontSize: '0.78rem', color: '#71717a', lineHeight: 1.5, margin: 0 }}>
          Ask natural language questions to generate charts, correlation scatters, and AI narrative interpretations. Your analytical queries compile and run strictly inside your local sandbox.
        </p>
      </div>

      {selectedDataset && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 24, 40, 0.3)',
          border: '1px solid var(--rim)',
          borderRadius: '99px',
          padding: '5px 12px',
          fontSize: '0.68rem',
          color: '#e4e4e7',
          fontFamily: 'var(--mono)'
        }}>
          <Database size={12} style={{ color: '#ef4444' }} />
          <span>Active Table: <strong>{selectedDataset.name}</strong></span>
          <span style={{ color: '#27272a' }}>|</span>
          <span>{Number(selectedDataset.row_count || 1200).toLocaleString()} rows loaded</span>
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ width: '100%', maxWidth: '600px', marginTop: '0.4rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: '0.75rem' }}>
            💡 Quick Exploration Prompts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(s)}
                style={{
                  background: 'rgba(8, 4, 5, 0.65)',
                  border: '1.5px solid var(--rim)',
                  borderRadius: '10px',
                  padding: '7px 12px',
                  fontSize: '0.7rem',
                  color: '#d4d4d8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#d4d4d8';
                  e.currentTarget.style.borderColor = 'var(--rim)';
                  e.currentTarget.style.background = 'rgba(8, 4, 5, 0.65)';
                }}
              >
                <span>{s}</span>
                <ArrowRight size={11} style={{ color: '#ef4444' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        width: '100%',
        maxWidth: '280px',
        margin: '0.3rem 0'
      }}>
        <div style={{ flex: 1, height: '1.5px', background: 'var(--rim)' }} />
        <span style={{ fontSize: '0.62rem', color: '#52525b', fontFamily: 'var(--mono)', fontWeight: 800 }}>OR</span>
        <div style={{ flex: 1, height: '1.5px', background: 'var(--rim)' }} />
      </div>

      <button
        onClick={onToggleDefaultReports}
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          color: '#ef4444',
          border: '1.5px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '10px',
          padding: '7px 16px',
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.borderColor = 'transparent';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
          e.currentTarget.style.color = '#ef4444';
          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        }}
      >
        <span>📊 Load Prebuilt Workspace Reports</span>
      </button>
    </div>
  );
};

interface QueryResultCanvasProps {
  workspacePipelineEnabled: boolean;
  activeWorkspace: any;
  hasQueryResult: boolean;
  showPredefinedReports: boolean;
  selectedDataset: any;
  qaResponse: any;
  isDev: boolean;
  handleAskAI: (prompt: string) => void;
  setShowPredefinedReports: (show: boolean) => void;
  handleRunPresetQuestion: (question: string) => void;
  bypassDataset: (id: string) => void;
  bypassedDatasets: Record<string, boolean>;
}

export default function QueryResultCanvas({
  workspacePipelineEnabled,
  activeWorkspace,
  hasQueryResult,
  showPredefinedReports,
  selectedDataset,
  qaResponse,
  isDev,
  handleAskAI,
  setShowPredefinedReports,
  handleRunPresetQuestion,
  bypassDataset,
  bypassedDatasets
}: QueryResultCanvasProps) {
  const resultContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasQueryResult && resultContainerRef.current) {
      resultContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [qaResponse, hasQueryResult]);

  if (workspacePipelineEnabled && activeWorkspace && !hasQueryResult) {
    if (!showPredefinedReports) {
      return (
        <WelcomeDashboard
          selectedDataset={selectedDataset}
          onSelectPrompt={handleAskAI}
          onToggleDefaultReports={() => setShowPredefinedReports(true)}
        />
      );
    } else {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0.15rem' }}>
          <ResultView 
            result={{
              status: 'computed',
              plan: { planId: 'workspace', intent: 'summary', confidence: 1, source: 'pattern' },
              data: { status: 'success', rows: [] },
              chart: { chartType: 'none' },
              narrative: '',
              provenance: { question: 'Workspace Canvas', planGeneratedAt: new Date(), executionTimeMs: 0, plannerAttempts: 1 }
            }} 
          />
        </div>
      );
    }
  }

  if (hasQueryResult) {
    return (
      <div ref={resultContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0.15rem' }}>
        {qaResponse && typeof qaResponse === 'object' && (
          <ResultView 
            result={qaResponse} 
            onSelectChoice={(choice) => handleRunPresetQuestion(choice.question)}
            onSelectQuestion={handleRunPresetQuestion} 
            onBypass={() => {
              if (selectedDataset && qaResponse.status === 'blocked' && qaResponse.provenance) {
                bypassDataset(selectedDataset.id);
                handleAskAI(qaResponse.provenance.question);
              }
            }}
          />
        )}
        {isDev && qaResponse && typeof qaResponse === 'object' && (
          <PlanPreview 
            plan={
              (qaResponse.status === 'computed' || qaResponse.status === 'partial')
                ? qaResponse.plan
                : (qaResponse.status === 'clarify')
                  ? qaResponse.clarification.choices[0]?.plan
                  : null
            } 
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-8 cockpit-card cockpit-card--dualrim min-h-[350px]">
      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3 animate-pulse">
        <Sparkles size={20} />
      </div>
      <h3 className="text-sm font-extrabold text-zinc-100 tracking-wide uppercase">
        Initializing Analytics Workspace...
      </h3>
      <p className="text-xs text-zinc-500 mt-1 font-mono">
        {selectedDataset?.name ? `Loading ${selectedDataset.name} into SQLite engine` : 'Preparing localized data sandbox'}
      </p>
    </div>
  );
}
