import React, { useRef, useEffect } from 'react';
import { Database, HelpCircle } from 'lucide-react';
import { ResultView } from '../../domain/analytics/features/result-view/ResultView';
import { PlanPreview } from '../../domain/analytics/features/plan-preview/PlanPreview';
import { ErrorBoundary } from '../ErrorBoundary';
import FactsVsNarrativePanel from './FactsVsNarrativePanel';
import { AnalyticsResult } from '../../domain/analytics/types';
import { WelcomeDashboard } from './QueryResultCanvas';

export interface AnalyticsCanvasProps {
  qaResponse: AnalyticsResult | string | null;
  activeWorkspace: any;
  activeSheetId?: string | null;
  selectedDataset: any;
  isDev?: boolean;
  showPredefinedReports?: boolean;
  onTogglePredefinedReports?: () => void;
  onSelectPrompt: (prompt: string) => void;
  onCrossFilter?: (column: string, value: any) => void;
  onBypassDataset?: (id: string) => void;
  bypassedDatasets?: Record<string, boolean>;
  localAiKillSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  onReupload?: () => void;
  canvasStyle?: React.CSSProperties;
}

export default function AnalyticsCanvas({
  qaResponse,
  activeWorkspace,
  activeSheetId,
  selectedDataset,
  isDev = false,
  showPredefinedReports: propShowPredefinedReports,
  onTogglePredefinedReports,
  onSelectPrompt,
  onBypassDataset,
  localAiKillSwitchActive,
  onToggleKillSwitch,
  onReupload,
  canvasStyle
}: AnalyticsCanvasProps) {
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const [localShowPredefined, setLocalShowPredefined] = React.useState(false);
  const showPredefinedReports = propShowPredefinedReports ?? localShowPredefined;
  const togglePredefinedReports = onTogglePredefinedReports ?? (() => setLocalShowPredefined(prev => !prev));

  const hasQueryResult = qaResponse !== null;
  const isObjectResult = hasQueryResult && typeof qaResponse === 'object';

  useEffect(() => {
    if (activeSheetId) {
      setLocalShowPredefined(true);
    }
  }, [activeSheetId]);

  useEffect(() => {
    if (hasQueryResult && resultContainerRef.current) {
      resultContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [qaResponse, hasQueryResult]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', ...canvasStyle }}>
      {/* 1. If an explicit Q&A result is returned */}
      {isObjectResult ? (
        <div ref={resultContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
          <ErrorBoundary>
            <ResultView
              result={qaResponse as AnalyticsResult}
              onSelectChoice={(choice) => onSelectPrompt(choice.question)}
              onSelectQuestion={onSelectPrompt}
              onBypass={() => {
                if (selectedDataset && (qaResponse as any).status === 'blocked' && (qaResponse as any).provenance) {
                  onBypassDataset?.(selectedDataset.id);
                  onSelectPrompt((qaResponse as any).provenance.question);
                }
              }}
            />
          </ErrorBoundary>

          {/* Dev Plan Inspection */}
          {isDev && (
            <PlanPreview
              plan={
                ((qaResponse as any).status === 'computed' || (qaResponse as any).status === 'partial')
                  ? (qaResponse as any).plan
                  : ((qaResponse as any).status === 'clarify')
                    ? (qaResponse as any).clarification.choices[0]?.plan
                    : null
              }
            />
          )}

          {/* Tri-Partite Privacy & Facts vs Narrative Panel */}
          <FactsVsNarrativePanel
            result={qaResponse as AnalyticsResult}
            datasetName={selectedDataset?.name}
            localAiKillSwitchActive={localAiKillSwitchActive}
            onToggleKillSwitch={onToggleKillSwitch}
          />
        </div>
      ) : typeof qaResponse === 'string' ? (
        /* String Guidance Banner */
        <div style={{
          padding: '1.5rem',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: 'center',
          textAlign: 'center',
          margin: '1.5rem auto',
          maxWidth: '560px'
        }}>
          <HelpCircle size={28} style={{ color: '#ef4444' }} />
          <p style={{ fontSize: '0.82rem', color: '#f4f4f5', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {qaResponse}
          </p>
          {qaResponse.includes('Legacy Preview') && onReupload && (
            <button
              onClick={onReupload}
              style={{
                marginTop: '0.5rem',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Select Full CSV File to Re-Upload
            </button>
          )}
        </div>
      ) : activeWorkspace && selectedDataset ? (
        /* 2. Workspace View */
        showPredefinedReports ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <ErrorBoundary fallbackTitle="Workspace Canvas Rendering Intercepted">
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
            </ErrorBoundary>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            <WelcomeDashboard
              selectedDataset={selectedDataset}
              onSelectPrompt={onSelectPrompt}
              onToggleDefaultReports={() => togglePredefinedReports()}
            />
          </div>
        )
      ) : (
        /* 3. Empty / Unselected Dataset State */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: '3rem 1.5rem',
          textAlign: 'center',
          color: '#71717a'
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem'
          }}>
            <Database size={22} style={{ color: '#ef4444' }} />
          </div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f4f4f5', margin: '0 0 0.35rem 0' }}>
            No Dataset Selected
          </h3>
          <p style={{ fontSize: '0.72rem', maxWidth: '380px', margin: 0, lineHeight: 1.5 }}>
            Please upload or select a dataset from the workspace sidebar to begin local, private analysis.
          </p>
        </div>
      )}
    </div>
  );
}
