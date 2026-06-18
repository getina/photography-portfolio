// Local dev API server — run alongside `npm run dev`
// Usage: node dev-api-server.js
//
// Requires a .env.local file with:
//   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
//   DRIVE_PORTFOLIO_FOLDER_ID=your_folder_id_here

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local into process.env
try {
  const env = readFileSync(resolve('.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
} catch { /* .env.local not found — rely on real env vars */ }

const { default: locationsHandler } = await import('./api/locations.js');
const { default: photoHandler }     = await import('./api/photo.js');

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost:3001');

  // Add Express-style helpers
  res.json   = (data) => { res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  res.status = (code) => { res.statusCode = code; return res; };
  req.query  = Object.fromEntries(searchParams);

  try {
    if (pathname === '/api/locations') {
      await locationsHandler(req, res);
    } else if (pathname === '/api/photo') {
      await photoHandler(req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(3001, () => {
  console.log('API dev server → http://localhost:3001/api/locations');
});
