// ─────────────────────────────────────────────────────────────────────────────
// src/store/useWorkspaceStore.ts
// S12 WORKSPACE STORE — Decoupled Zustand store slice for dynamic worksheets.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { WorkspaceBlueprint, VisualContract } from '../domain/analytics/types';

interface WorkspaceStore {
  workspacePipelineEnabled: boolean;
  activeWorkspace: WorkspaceBlueprint | null;
  activeSheetId: string | null;
  workspaceResults: Record<string, Record<string, VisualContract>>; // Record<sheetId, Record<cardId, VisualContract>>
  workspaceErrors: Record<string, Record<string, string>>; // Record<sheetId, Record<cardId, errorMessage>>
  isWorkspaceInFlight: boolean;

  setWorkspacePipelineEnabled: (enabled: boolean) => void;
  setWorkspaceBlueprint: (blueprint: WorkspaceBlueprint | null) => void;
  setActiveSheetId: (sheetId: string | null) => void;
  commitCardResult: (sheetId: string, cardId: string, result: VisualContract) => void;
  commitCardError: (sheetId: string, cardId: string, error: string) => void;
  setWorkspaceInFlight: (inFlight: boolean) => void;
  resetWorkspaceStore: () => void;
  clearWorkspaceResults: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspacePipelineEnabled: true,
  activeWorkspace: null,
  activeSheetId: null,
  workspaceResults: {},
  workspaceErrors: {},
  isWorkspaceInFlight: false,

  setWorkspacePipelineEnabled: (enabled) => set({ workspacePipelineEnabled: enabled }),
  
  setWorkspaceBlueprint: (blueprint) => set((state) => {
    const defaultSheetId = blueprint && blueprint.sheets.length > 0 ? blueprint.sheets[0].id : null;
    return {
      activeWorkspace: blueprint,
      activeSheetId: defaultSheetId,
      workspaceResults: {},
      workspaceErrors: {}
    };
  }),

  setActiveSheetId: (sheetId) => set({ activeSheetId: sheetId }),

  commitCardResult: (sheetId, cardId, result) => set((state) => {
    const nextResults = { ...state.workspaceResults };
    if (!nextResults[sheetId]) nextResults[sheetId] = {};
    nextResults[sheetId] = {
      ...nextResults[sheetId],
      [cardId]: result
    };
    
    // Clear any previous error on success
    const nextErrors = { ...state.workspaceErrors };
    if (nextErrors[sheetId]) {
      const copy = { ...nextErrors[sheetId] };
      delete copy[cardId];
      nextErrors[sheetId] = copy;
    }

    return {
      workspaceResults: nextResults,
      workspaceErrors: nextErrors
    };
  }),

  commitCardError: (sheetId, cardId, error) => set((state) => {
    const nextErrors = { ...state.workspaceErrors };
    if (!nextErrors[sheetId]) nextErrors[sheetId] = {};
    nextErrors[sheetId] = {
      ...nextErrors[sheetId],
      [cardId]: error
    };

    return {
      workspaceErrors: nextErrors
    };
  }),

  setWorkspaceInFlight: (inFlight) => set({ isWorkspaceInFlight: inFlight }),

  resetWorkspaceStore: () => set({
    activeWorkspace: null,
    activeSheetId: null,
    workspaceResults: {},
    workspaceErrors: {},
    isWorkspaceInFlight: false
  }),

  clearWorkspaceResults: () => set({
    workspaceResults: {},
    workspaceErrors: {}
  })
}));
