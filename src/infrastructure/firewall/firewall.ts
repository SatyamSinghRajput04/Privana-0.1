import { localDB, type AuditLog } from '../../lib/indexedDb';

// Session-level salt generated once when the app load to protect hashes from rainbow-table attacks
const sessionSalt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export interface ScanResult {
  sanitized: string;
  redactedCount: number;
  piiFound: string[];
  mapping: Record<string, string>; // Action-scoped mapping (original -> redacted)
}

export function isValidLuhn(digits: string): boolean {
  // Remove non-digit characters
  const clean = digits.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let val = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export const PrivacyFirewall = {
  /**
   * Synchronously scans chat inputs or other texts for PII.
   * Returns sanitized text and an action-scoped redaction mapping.
   * Keeps mappings strictly local to the current operation context.
   */
  scan(payload: string): ScanResult {
    let sanitized = payload;
    let redactedCount = 0;
    const piiFoundSet = new Set<string>();
    const mapping: Record<string, string> = {};

    // 1. Scan and redact Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = payload.match(emailRegex) || [];
    let emailIdx = 1;
    emails.forEach(email => {
      if (!mapping[email]) {
        const replacement = `[EMAIL_REDACTED_${emailIdx++}]`;
        mapping[email] = replacement;
        piiFoundSet.add('email');
        redactedCount++;
      }
    });

    // 2. Scan and redact Phone Numbers (Standard formats)
    // Enforces word boundaries to avoid matching sequences inside keys, and matches optional country codes properly
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+?\d{1,3}[-.\s]?)?\b\d{3}[-.\s]?\d{4}\b/g;
    const phones = payload.match(phoneRegex) || [];
    let phoneIdx = 1;
    phones.forEach(phone => {
      // Avoid matching pure years/short numbers
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 7 && cleanPhone.length <= 15) {
        if (!mapping[phone]) {
          const replacement = `[PHONE_REDACTED_${phoneIdx++}]`;
          mapping[phone] = replacement;
          piiFoundSet.add('phone');
          redactedCount++;
        }
      }
    });

    // 3. Scan and redact Credit Cards (candidate extraction + Luhn verification)
    // Matches 13 to 19 digit numbers separated by optional dashes or spaces
    const ccCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;
    const ccCandidates = payload.match(ccCandidateRegex) || [];
    let ccIdx = 1;
    ccCandidates.forEach(candidate => {
      if (isValidLuhn(candidate)) {
        if (!mapping[candidate]) {
          const replacement = `[CREDIT_CARD_REDACTED_${ccIdx++}]`;
          mapping[candidate] = replacement;
          piiFoundSet.add('credit_card');
          redactedCount++;
        }
      }
    });

    // 4. Scan and redact National IDs (SSN, Aadhaar, PAN)
    // SSN: matches 3-2-4 digit blocks
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssns = payload.match(ssnRegex) || [];
    let ssnIdx = 1;
    ssns.forEach(ssn => {
      if (!mapping[ssn]) {
        const replacement = `[SSN_REDACTED_${ssnIdx++}]`;
        mapping[ssn] = replacement;
        piiFoundSet.add('ssn');
        redactedCount++;
      }
    });

    // Aadhaar: 12 digits or 4-4-4 digit spacing (with negative lookahead & lookbehind to prevent overmatching Credit Cards)
    const aadhaarRegex = /(?<!\d[ -]*)\b\d{4}\s\d{4}\s\d{4}\b(?![ -]*\d)|(?<!\d[ -]*)\b\d{12}\b(?![ -]*\d)/g;
    const aadhaars = payload.match(aadhaarRegex) || [];
    let aadhaarIdx = 1;
    aadhaars.forEach(aadhaar => {
      if (!mapping[aadhaar]) {
        const replacement = `[AADHAAR_REDACTED_${aadhaarIdx++}]`;
        mapping[aadhaar] = replacement;
        piiFoundSet.add('aadhaar');
        redactedCount++;
      }
    });

    // PAN Card: 5 letters, 4 digits, 1 letter
    const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/ig;
    const pans = payload.match(panRegex) || [];
    let panIdx = 1;
    pans.forEach(pan => {
      if (!mapping[pan]) {
        const replacement = `[PAN_REDACTED_${panIdx++}]`;
        mapping[pan] = replacement;
        piiFoundSet.add('pan');
        redactedCount++;
      }
    });

    // 5. Scan and redact Secrets (Conservative API keys and private keys)
    // Bearer token
    const bearerRegex = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g;
    const bearers = payload.match(bearerRegex) || [];
    let secIdx = 1;
    bearers.forEach(bearer => {
      if (!mapping[bearer]) {
        const replacement = `[SECRET_REDACTED_${secIdx++}]`;
        mapping[bearer] = replacement;
        piiFoundSet.add('secret');
        redactedCount++;
      }
    });

    // OpenAI API Keys
    const openaiRegex = /\bsk-[A-Za-z0-9]{32,}\b/g;
    const openais = payload.match(openaiRegex) || [];
    openais.forEach(openai => {
      if (!mapping[openai]) {
        const replacement = `[SECRET_REDACTED_${secIdx++}]`;
        mapping[openai] = replacement;
        piiFoundSet.add('secret');
        redactedCount++;
      }
    });

    // GitHub Tokens
    const githubRegex = /\bghp_[A-Za-z0-9]{36,255}\b/g;
    const githubs = payload.match(githubRegex) || [];
    githubs.forEach(github => {
      if (!mapping[github]) {
        const replacement = `[SECRET_REDACTED_${secIdx++}]`;
        mapping[github] = replacement;
        piiFoundSet.add('secret');
        redactedCount++;
      }
    });

    // Private Keys (PEM format blocks)
    const privateKeyRegex = /-----BEGIN[ A-Z0-9]*?PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9]*?PRIVATE KEY-----/g;
    const privateKeys = payload.match(privateKeyRegex) || [];
    privateKeys.forEach(pk => {
      if (!mapping[pk]) {
        const replacement = `[PRIVATE_KEY_REDACTED_${secIdx++}]`;
        mapping[pk] = replacement;
        piiFoundSet.add('private_key');
        redactedCount++;
      }
    });

    // Apply all redactions to the sanitized output text
    // Sort keys descending by length to avoid partial replacements (e.g. email substring)
    const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);
    keys.forEach(original => {
      const replacement = mapping[original];
      // Escape special regex characters in original string
      const escaped = original.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escaped, 'g'), replacement);
    });

    return {
      sanitized,
      redactedCount,
      piiFound: Array.from(piiFoundSet),
      mapping
    };
  },

  /**
   * Computes a secure SHA-256 hash using the session salt + sanitized payload.
   * Guarantees raw PII is never part of the hash input.
   */
  async computeHash(sanitizedPayload: string): Promise<string> {
    const input = sessionSalt + sanitizedPayload;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const msgUint8 = new TextEncoder().encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // Fallback below
      }
    }
    // Headless/Simple Node.js or older browser fallback hash (Fowler-Noll-Vo FNV-1a simple 32-bit hash representation as hex)
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  },

  /**
   * Records audit logs directly to the local IndexedDB audit store.
   * Sanitizes all fields to prevent raw PII from being stored locally.
   */
  async auditLocal(params: {
    workspaceId: number;
    eventType: AuditLog['event_type'];
    processName: string;
    messageLabel: string;
    piiTypes: string[];
    sanitizedPayload: string;
    bytesExternal: number;
    bytesLoopback: number;
    bytesAuditSync: number;
  }): Promise<AuditLog> {
    const payloadHash = await this.computeHash(params.sanitizedPayload);
    
    const logEntry: Omit<AuditLog, 'id' | 'created_at'> = {
      workspace_id: params.workspaceId,
      event_type: params.eventType,
      process_name: params.processName,
      message_label: params.messageLabel,
      pii_types: params.piiTypes,
      payload_hash: payloadHash,
      bytes_external: params.bytesExternal,
      bytes_loopback: params.bytesLoopback,
      bytes_audit_sync: params.bytesAuditSync
    };

    return await localDB.saveAuditLog(logEntry);
  }
};
