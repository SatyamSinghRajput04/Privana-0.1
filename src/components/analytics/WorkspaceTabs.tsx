import React from 'react';
import { WorkspaceBlueprint } from '../../domain/analytics/types';

interface WorkspaceTabsProps {
  workspacePipelineEnabled: boolean;
  activeWorkspace: WorkspaceBlueprint | null;
  activeSheetId: string | null;
  setActiveSheetId: (id: string) => void;
  setQaResponse: (val: any) => void;
  setAnalyticalContext: (val: any) => void;
  bottomTab: string;
  setBottomTab: (name: string) => void;
  onRemoveSnapshot: (id: string) => void;
}

export default function WorkspaceTabs({
  workspacePipelineEnabled,
  activeWorkspace,
  activeSheetId,
  setActiveSheetId,
  setQaResponse,
  setAnalyticalContext,
  bottomTab,
  setBottomTab,
  onRemoveSnapshot
}: WorkspaceTabsProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.2rem',
      fontSize: '0.68rem',
      flexShrink: 0
    }}>
      {workspacePipelineEnabled && activeWorkspace ? (
        activeWorkspace.sheets.map((sheet) => {
          const isActive = activeSheetId === sheet.id;
          return (
            <div
              key={sheet.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: isActive ? '#0e0e12' : 'transparent',
                color: isActive ? '#ef4444' : '#71717a',
                border: isActive ? '1px solid #3c1417' : '1px solid transparent',
                borderRadius: '4px 4px 0 0',
                padding: '3px 10px',
                fontSize: '0.65rem',
                fontWeight: isActive ? 700 : 500,
                gap: '4px'
              }}
            >
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  cursor: 'pointer',
                  padding: 0
                }}
                onClick={() => {
                  setActiveSheetId(sheet.id);
                  setQaResponse(null);
                  setAnalyticalContext(null);
                }}
              >
                {sheet.name}
              </button>
              {sheet.id !== 'sheet_overview' && activeWorkspace.sheets[0]?.id !== sheet.id && (
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#52525b',
                    cursor: 'pointer',
                    fontSize: '0.55rem',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSnapshot(sheet.id);
                  }}
                  title="Close sheet"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })
      ) : (
        ['Overview', 'Sleep Analysis', 'Stress Analysis', 'Platform Usage', 'Demographics'].map((tabName) => {
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
        })
      )}
      <button 
        style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '0.8rem', padding: '0 6px', cursor: 'pointer' }}
        onClick={() => alert('New analysis sheet tab added!')}
      >
        +
      </button>
    </div>
  );
}
