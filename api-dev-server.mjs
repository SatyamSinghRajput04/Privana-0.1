import http from 'http';
import fs from 'fs';
import { URL } from 'url';

// 1. Load environment variables from vercel.json
try {
  const vercelJson = JSON.parse(fs.readFileSync('./vercel.json', 'utf8'));
  if (vercelJson && vercelJson.env) {
    console.log('🔑 Loading environment keys from vercel.json...');
    Object.entries(vercelJson.env).forEach(([key, val]) => {
      process.env[key] = val;
    });
  }
} catch (e) {
  console.warn('⚠️ No vercel.json found:', e.message);
}

// 2. Pre-import all API route handlers
const handlers = {};
const apiDir = './api';
const files = fs.readdirSync(apiDir);

for (const file of files) {
  if (file.endsWith('.js') && !file.startsWith('_')) {
    const routeName = file.replace('.js', '');
    try {
      const mod = await import(`${apiDir}/${file}`);
      handlers[routeName] = mod.default;
      console.log(`✅ Bound route: /api/${routeName}`);
    } catch (err) {
      console.error(`❌ Failed to import ${file}:`, err.message);
    }
  }
}

// 3. Create a raw HTTP server that builds Vercel-compatible req/res objects
const server = http.createServer(async (rawReq, rawRes) => {
  // Parse the URL
  const parsedUrl = new URL(rawReq.url, `http://localhost:3001`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  rawRes.setHeader('Access-Control-Allow-Origin', '*');
  rawRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  rawRes.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (rawReq.method === 'OPTIONS') {
    rawRes.writeHead(204);
    rawRes.end();
    return;
  }

  // Match route: /api/workspaces -> handlers['workspaces']
  const match = pathname.match(/^\/api\/([a-z0-9_-]+)$/i);
  if (!match || !handlers[match[1]]) {
    rawRes.writeHead(404, { 'Content-Type': 'application/json' });
    rawRes.end(JSON.stringify({ error: `Route ${pathname} not found` }));
    return;
  }

  const handlerName = match[1];
  const handler = handlers[handlerName];

  // Read the request body for POST/PUT/DELETE
  let bodyStr = '';
  for await (const chunk of rawReq) {
    bodyStr += chunk;
  }

  let body = null;
  if (bodyStr) {
    try {
      body = JSON.parse(bodyStr);
    } catch {
      body = bodyStr;
    }
  }

  // Build a Vercel-compatible "req" object
  const query = {};
  parsedUrl.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  const req = {
    method: rawReq.method,
    url: rawReq.url,
    headers: rawReq.headers,
    query: query,
    body: body,
  };

  // Build a Vercel-compatible "res" object
  let statusCode = 200;
  const resHeaders = {};

  const res = {
    setHeader: (key, val) => {
      resHeaders[key] = val;
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      Object.entries(resHeaders).forEach(([k, v]) => rawRes.setHeader(k, v));
      rawRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
      rawRes.end(JSON.stringify(data));
    },
    end: (data) => {
      Object.entries(resHeaders).forEach(([k, v]) => rawRes.setHeader(k, v));
      rawRes.writeHead(statusCode);
      rawRes.end(data || '');
    },
  };

  try {
    console.log(`→ ${rawReq.method} /api/${handlerName}${bodyStr ? ' (body: ' + bodyStr.substring(0, 120) + ')' : ''}`);
    await handler(req, res);
    console.log(`← ${rawReq.method} /api/${handlerName} → ${statusCode}`);
  } catch (err) {
    console.error(`🔴 Error in /api/${handlerName}:`, err);
    if (!rawRes.headersSent) {
      rawRes.writeHead(500, { 'Content-Type': 'application/json' });
      rawRes.end(JSON.stringify({ error: err.message }));
    }
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Privana Local API Server running at http://localhost:${PORT}`);
});
