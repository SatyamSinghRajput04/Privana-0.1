// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/evalLogger.ts
// S11 EVAL LOGGER — Logs Q&A runs for pipeline monitoring and CI metrics.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalyticsResult } from './types';

export interface EvalLogRecord {
  id?: number;
  question: string;
  timestamp: string;
  intent: string;
  status: string;
  executionTimeMs: number;
  resultSummary?: string;
}

function openEvalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open('viq_eval_db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('viq_eval_log')) {
        db.createObjectStore('viq_eval_log', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export const EvalLogger = {
  /**
   * Logs an evaluation record of the Q&A process to IndexedDB.
   */
  async log(question: string, result: AnalyticsResult): Promise<void> {
    try {
      const db = await openEvalDB();
      const transaction = db.transaction('viq_eval_log', 'readwrite');
      const store = transaction.objectStore('viq_eval_log');

      const record: EvalLogRecord = {
        question,
        timestamp: new Date().toISOString(),
        intent: result.status === 'computed' || result.status === 'partial' 
          ? result.plan?.intent || 'unknown' 
          : 'none',
        status: result.status,
        executionTimeMs: result.provenance?.executionTimeMs || 0,
        resultSummary: result.status === 'computed' || result.status === 'partial'
          ? result.narrative.slice(0, 100) + (result.narrative.length > 100 ? '...' : '')
          : result.status === 'blocked'
          ? result.reason
          : result.status === 'unsupported'
          ? result.explanation
          : 'N/A',
      };

      store.add(record);
    } catch (err) {
      console.warn('[EvalLogger] failed to log evaluation:', err);
    }
  }
};
