const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const WSServer = require('./websocket/wsServer');
const { handleAuthRoutes } = require('./routes/auth');
const { handleUserRoutes } = require('./routes/users');
const { handleMessageRoutes } = require('./routes/messages');
const { getMimeType } = require('./utils/mime');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Create HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathName = parsedUrl.pathname;

  // Handle API routes
  if (pathName.startsWith('/api/')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 5 * 1024 * 1024) {
        // 5MB limit
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      let jsonBody = {};
      if (bodyData) {
        try {
          jsonBody = JSON.parse(bodyData);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        }
      }

      // 1. Auth routes
      if (handleAuthRoutes(req, res, pathName, req.method, jsonBody)) return;

      // 2. User routes
      if (handleUserRoutes(req, res, pathName, req.method, jsonBody, wsServer)) return;

      // 3. Message routes
      if (handleMessageRoutes(req, res, pathName, req.method, jsonBody, wsServer)) return;

      // 404 for unhandled API endpoints
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'API route not found' }));
    });
    return;
  }

  // Handle Static Files
  let filePath = path.join(PUBLIC_DIR, pathName === '/' ? 'index.html' : pathName);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found, try index.html for client-side routing
      const indexFallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFallback, (err2, content) => {
        if (err2) {
          res.writeHead(404);
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(content);
      });
      return;
    }

    const mime = getMimeType(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Attach Native Real-Time WebSocket Server
const wsServer = new WSServer(server);

// Start Server
server.listen(PORT, () => {
  console.log(`
  ==============================================================
    🌟 DOSTHU - REAL-TIME CHAT APPLICATION (FSWD) 🌟
  ==============================================================
    🚀 Server running at: http://localhost:${PORT}
    📡 WebSocket Protocol: ws://localhost:${PORT}
    💾 Local Database: data/dosthu.json (persistent)
    🎨 Modern Glassmorphism UI & Real-Time Sync Ready!
  ==============================================================
  `);
});

// Graceful termination
process.on('SIGINT', () => {
  console.log('\nShutting down Dosthu server gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
