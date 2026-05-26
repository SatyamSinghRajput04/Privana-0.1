import crypto from 'crypto';

/**
 * Validates and sets strict CORS headers on the serverless response.
 * Blocks general '*' wildcard origins in production.
 */
export function enforceCORS(req, res) {
  const origin = req.headers.origin;
  const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;

  if (isLocalhost) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOriginEnv && origin && origin === allowedOriginEnv) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && (origin === 'https://privana.vercel.app' || (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) || origin === 'https://privana.local')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id, x-session-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Validates that requests contain valid session and workspace ID headers.
 */
export function enforceSessionWorkspaceHeaders(req, res) {
  const workspaceId = req.headers['x-workspace-id'];
  const sessionId = req.headers['x-session-id'];

  if (!workspaceId || !sessionId || sessionId.trim() === '' || isNaN(parseInt(workspaceId, 10))) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid x-workspace-id and x-session-id headers.' });
    return false;
  }
  return true;
}

/**
 * Enforces strict request body payload size boundaries.
 * Enforces < 10 KB payload constraint.
 */
export function enforceBodySize(req, res) {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024) {
    res.status(413).json({ error: 'Payload too large. Maximum size allowed is 10 KB.' });
    return false;
  }
  return true;
}

/**
 * Hashes raw text queries using a salted SHA-256 HMAC for zero-prompt plain-text egress.
 */
export function securePromptPersistence(question) {
  if (!question) return '';
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || 'privana-secure-default-salt';
  return crypto.createHmac('sha256', salt).update(question).digest('hex');
}

const ipCache = new Map();

/**
 * Enforces rate limiting on the serverless API (60 requests per minute).
 */
export function enforceRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowSize = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requests per minute

  let clientRequests = ipCache.get(ip) || [];
  clientRequests = clientRequests.filter(timestamp => now - timestamp < windowSize);

  if (clientRequests.length >= maxRequests) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    return false;
  }

  clientRequests.push(now);
  ipCache.set(ip, clientRequests);
  return true;
}
