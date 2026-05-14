/**
 * BillBrowser PWA — Local Development Server
 * Serves static PWA files and handles OAuth callback routing
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    // Required for PWA service worker scope
    res.setHeader('Service-Worker-Allowed', '/');
    // Disable caching during development so changes show up immediately
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// OAuth callback route — serve the SPA (JS handles the code param)
app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// SPA fallback — serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  📱  BillBrowser PWA');
  console.log('  📋  AISP Open Finance Prototype');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  🌐 Local:   http://localhost:${PORT}`);
  console.log(`  📱 Network: http://<your-ip>:${PORT}`);
  console.log(`${'═'.repeat(50)}\n`);
});
