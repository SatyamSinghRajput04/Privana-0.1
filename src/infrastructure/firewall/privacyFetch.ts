import { PrivacyFirewall } from './firewall';
import { useVaultStore } from '../../store/useVaultStore';

export interface RouteInfo {
  isSameOrigin: boolean;
  isLoopback: boolean;
  isPrivateLAN: boolean;
  isCompanyServer: boolean;
  hostname: string;
  pathname: string;
}

export function parseRoute(urlStr: string): RouteInfo {
  let parsed: URL;
  
  if (urlStr.startsWith('/') || !urlStr.includes('://')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    parsed = new URL(urlStr, origin);
  } else {
    parsed = new URL(urlStr);
  }
  
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const isSameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
  
  const isLoopback = 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname === '::1';
    
  const isPrivateLAN = 
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    
  const companyServerUrl = useVaultStore.getState().serverUrl;
  let isCompanyServer = false;
  if (companyServerUrl) {
    try {
      const compParsed = new URL(companyServerUrl);
      if (hostname === compParsed.hostname.toLowerCase()) {
        isCompanyServer = true;
      }
    } catch {}
  }
  
  return {
    isSameOrigin,
    isLoopback,
    isPrivateLAN,
    isCompanyServer,
    hostname,
    pathname
  };
}

/**
 * A fail-closed, workspace-aware fetch interceptor that blocks unauthorized egress.
 * Pre-sanitizes allowed request payloads to avoid PII leakages in console/dev server logs.
 */
const sessionId = typeof window !== 'undefined'
  ? ((window as any).__privana_session_id || ((window as any).__privana_session_id = Math.random().toString(36).substring(2) + Date.now().toString(36)))
  : 'server-session';

export async function privacyFetch(url: string, options?: RequestInit): Promise<Response> {
  const store = useVaultStore.getState();
  const workspaceId = store.ws?.id || 1;
  const mode = store.authMode || 'solo'; // solo (local) or server
  
  // Retrieve settings state (or fallback to localStorage config)
  let allowPrivateLAN = false;
  try {
    const savedSettings = localStorage.getItem('privana_allow_lan');
    allowPrivateLAN = savedSettings === 'true';
  } catch {}

  let route: RouteInfo;
  try {
    route = parseRoute(url);
  } catch {
    // Fail-closed on parsing errors
    await PrivacyFirewall.auditLocal({
      workspaceId,
      eventType: 'ALERT',
      processName: 'privana:firewall',
      messageLabel: 'BLOCK: Malformed or unparseable egress URL detected',
      piiTypes: [],
      sanitizedPayload: url,
      bytesExternal: 0,
      bytesLoopback: 0,
      bytesAuditSync: 0
    });
    return new Response('Blocked by Privacy Firewall: Malformed URL', { status: 400 });
  }

  // --- Fetch Payload Pre-Sanitization ---
  let originalBodyLength = 0;
  let hasSanitizedBody = false;
  const modifiedOptions = options ? { ...options } : {};
  let bodyPiiFound: string[] = [];

  if (modifiedOptions.body && typeof modifiedOptions.body === 'string') {
    originalBodyLength = modifiedOptions.body.length;
    try {
      const scanOutcome = PrivacyFirewall.scan(modifiedOptions.body);
      if (scanOutcome.redactedCount > 0) {
        modifiedOptions.body = scanOutcome.sanitized;
        hasSanitizedBody = true;
        bodyPiiFound = scanOutcome.piiFound;
      }
    } catch {
      // Fail-closed if scanner throws during execution
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'ALERT',
        processName: 'privana:firewall',
        messageLabel: 'BLOCK: Firewall scanner crashed during outgoing request body inspection',
        piiTypes: [],
        sanitizedPayload: '',
        bytesExternal: 0,
        bytesLoopback: 0,
        bytesAuditSync: 0
      });
      return new Response('Blocked by Privacy Firewall: Scanner failure', { status: 500 });
    }
  }

  // Calculate approximate request size
  const finalBodyString = typeof modifiedOptions.body === 'string' ? modifiedOptions.body : '';
  const requestBytes = finalBodyString.length + url.length + JSON.stringify(modifiedOptions.headers || {}).length;

  // --- Egress Domain Routing Rules ---
  
  // 1. Same-Origin Network Log Endpoint
  if (route.isSameOrigin && route.pathname === '/api/network-log') {
    if (mode === 'solo') {
      // Local mode does not sync metadata to any server
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'BLOCK',
        processName: 'privana:firewall',
        messageLabel: 'BLOCK: Outbound metadata sync rejected in local mode',
        piiTypes: [],
        sanitizedPayload: 'Destination: /api/network-log',
        bytesExternal: 0,
        bytesLoopback: 0,
        bytesAuditSync: 0
      });
      return new Response('Blocked: Remote audit sync is disabled in local mode', { status: 403 });
    }
    
    // Server mode is allowed to dispatch metadata
    try {
      const headers = new Headers(modifiedOptions.headers || {});
      headers.set('x-workspace-id', String(workspaceId));
      headers.set('x-session-id', sessionId);
      modifiedOptions.headers = headers;

      const response = await fetch(url, modifiedOptions);
      const responseBytes = response.headers.get('content-length') ? parseInt(response.headers.get('content-length') || '0', 10) : 100;
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'ALLOW',
        processName: 'privana:audit-sync',
        messageLabel: 'ALLOW: Dispatched sanitized metadata logs to server',
        piiTypes: [],
        sanitizedPayload: 'Sync size: ' + requestBytes + ' bytes',
        bytesExternal: 0,
        bytesLoopback: 0,
        bytesAuditSync: requestBytes + responseBytes
      });
      return response;
    } catch {
      return new Response('Network log sync error', { status: 502 });
    }
  }

  // 2. Same-Origin normal app APIs
  if (route.isSameOrigin) {
    try {
      const headers = new Headers(modifiedOptions.headers || {});
      headers.set('x-workspace-id', String(workspaceId));
      headers.set('x-session-id', sessionId);
      modifiedOptions.headers = headers;

      if (hasSanitizedBody) {
        await PrivacyFirewall.auditLocal({
          workspaceId,
          eventType: 'WARN',
          processName: 'privana:firewall',
          messageLabel: 'WARN: Same-origin API payload sanitized before execution',
          piiTypes: bodyPiiFound,
          sanitizedPayload: `Pre-sanitized size: ${originalBodyLength}B, post-sanitized size: ${finalBodyString.length}B`,
          bytesExternal: 0,
          bytesLoopback: requestBytes,
          bytesAuditSync: 0
        });
      }
      return await fetch(url, modifiedOptions);
    } catch {
      return new Response('App API offline error', { status: 502 });
    }
  }

  // 3. Local Loopbacks (Ollama local model calls, IPC interfaces)
  if (route.isLoopback) {
    try {
      const start = Date.now();
      const response = await fetch(url, modifiedOptions);
      const end = Date.now();
      const responseBytes = response.headers.get('content-length') ? parseInt(response.headers.get('content-length') || '0', 10) : 500;
      
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'ALLOW',
        processName: 'privana:loopback',
        messageLabel: `ALLOW: Local loopback query (${route.hostname}:${url.split(':')[2]?.split('/')[0] || ''}) in ${end - start}ms`,
        piiTypes: bodyPiiFound,
        sanitizedPayload: url,
        bytesExternal: 0,
        bytesLoopback: requestBytes + responseBytes,
        bytesAuditSync: 0
      });
      
      return response;
    } catch {
      return new Response('Local loopback service offline', { status: 502 });
    }
  }

  // 4. Private LAN Addresses (Conditional access rules)
  if (route.isPrivateLAN) {
    if (!allowPrivateLAN) {
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'BLOCK',
        processName: 'privana:firewall',
        messageLabel: 'BLOCK: Unauthorized private LAN request rejected',
        piiTypes: [],
        sanitizedPayload: `Destination: ${url}`,
        bytesExternal: 0,
        bytesLoopback: 0,
        bytesAuditSync: 0
      });
      return new Response('Blocked by Privacy Firewall: Private LAN not configured', { status: 403 });
    }
    
    try {
      const response = await fetch(url, modifiedOptions);
      const responseBytes = response.headers.get('content-length') ? parseInt(response.headers.get('content-length') || '0', 10) : 200;
      
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'ALLOW',
        processName: 'privana:lan',
        messageLabel: `ALLOW: Authorized private LAN query to ${route.hostname}`,
        piiTypes: bodyPiiFound,
        sanitizedPayload: url,
        bytesExternal: 0,
        bytesLoopback: requestBytes + responseBytes,
        bytesAuditSync: 0
      });
      
      return response;
    } catch {
      return new Response('Private LAN connection failed', { status: 502 });
    }
  }

  // 5. Authorized Company Server Domain
  if (route.isCompanyServer) {
    if (mode === 'solo') {
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'BLOCK',
        processName: 'privana:firewall',
        messageLabel: 'BLOCK: Company server access blocked in local mode',
        piiTypes: [],
        sanitizedPayload: `Destination: ${url}`,
        bytesExternal: 0,
        bytesLoopback: 0,
        bytesAuditSync: 0
      });
      return new Response('Blocked by Privacy Firewall: Company server access disabled in local mode', { status: 403 });
    }
    
    try {
      const response = await fetch(url, modifiedOptions);
      const responseBytes = response.headers.get('content-length') ? parseInt(response.headers.get('content-length') || '0', 10) : 500;
      
      await PrivacyFirewall.auditLocal({
        workspaceId,
        eventType: 'ALLOW',
        processName: 'privana:company-server',
        messageLabel: `ALLOW: Sync transaction with secure company backend`,
        piiTypes: bodyPiiFound,
        sanitizedPayload: `Request: ${requestBytes}B, Response: ${responseBytes}B`,
        bytesExternal: requestBytes + responseBytes,
        bytesLoopback: 0,
        bytesAuditSync: 0
      });
      
      return response;
    } catch {
      return new Response('Company server backend unreachable', { status: 502 });
    }
  }

  // 6. Block any other unknown external destination (Fail Closed - BLOCK UX STATE)
  await PrivacyFirewall.auditLocal({
    workspaceId,
    eventType: 'BLOCK',
    processName: 'privana:firewall',
    messageLabel: 'BLOCK: Unknown external destination blocked',
    piiTypes: [],
    sanitizedPayload: `Blocked URL: ${url}`,
    bytesExternal: 0,
    bytesLoopback: 0,
    bytesAuditSync: 0
  });

  return new Response('Blocked by Privacy Firewall: Unauthorized external egress', { 
    status: 403, 
    statusText: 'Blocked by Privacy Firewall' 
  });
}
