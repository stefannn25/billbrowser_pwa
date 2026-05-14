/**
 * GCash Open Finance Simulator — Main Server
 * OAuth 2.0 Authorization Server + JWS-signed Resource API
 * Compliant with BSP Circular No. 1122 Open Finance Framework
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { authRouter, setKeys: setAuthKeys } = require('./auth/oauth');
const { mandatesRouter, setApiKeys } = require('./api/mandates');

const app = express();
const PORT = 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: ['https://billbrowser-pwa-xxxx.onrender.com', '*'], exposedHeaders: ['X-JWS-Signature', 'X-API-Standard', 'X-TLS-Version', 'X-Data-Classification', 'X-Consent-Scope', 'Content-Type', 'Cache-Control', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers (simulating production TLS 1.3 environment)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-TLS-Version', 'TLSv1.3');
  res.setHeader('X-Protocol', 'BSP-OF-1122');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/', authRouter);
app.use('/api/v1', mandatesRouter);

// ─── Key Management & Startup ───────────────────────────────────────────────
async function startServer() {
  const keysDir = path.join(__dirname, 'crypto', 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const privatePath = path.join(keysDir, 'private.pem');
  const publicPath = path.join(keysDir, 'public.pem');
  let privateKeyPem, publicKeyPem;

  if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
    console.log('🔐 Generating RSA 2048-bit key pair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(privatePath, privateKey);
    fs.writeFileSync(publicPath, publicKey);
    privateKeyPem = privateKey;
    publicKeyPem = publicKey;
    console.log('✅ RSA key pair generated and saved.');
  } else {
    privateKeyPem = fs.readFileSync(privatePath, 'utf8');
    publicKeyPem = fs.readFileSync(publicPath, 'utf8');
    console.log('🔑 RSA key pair loaded from disk.');
  }

  // Distribute keys to modules
  setAuthKeys(privateKeyPem, publicKeyPem);
  setApiKeys(privateKeyPem, publicKeyPem);

  // ─── JWKS Endpoint ──────────────────────────────────────────────────────
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = 'gcash-sim-key-001';
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  app.get('/api/v1/.well-known/jwks.json', (req, res) => {
    res.json({ keys: [jwk] });
  });

  // Public key (PEM) endpoint for Flutter app bootstrap
  app.get('/api/v1/.well-known/public-key.pem', (req, res) => {
    res.type('text/plain').send(publicKeyPem);
  });

  // ─── Health Check ───────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'GCash Open Finance Simulator',
      regulation: 'BSP Circular No. 1122',
      uptime: process.uptime(),
    });
  });

  // ─── Start Listening ────────────────────────────────────────────────────
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  🏦  GCash Open Finance Simulator');
    console.log('  📋  BSP Circular No. 1122 Compliant');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  🌐 Server:     http://localhost:${PORT}`);
    console.log(`  🔒 OAuth:      http://localhost:${PORT}/authorize`);
    console.log(`  🎫 Token:      http://localhost:${PORT}/token`);
    console.log(`  📄 Mandates:   http://localhost:${PORT}/api/v1/mandates`);
    console.log(`  🔑 JWKS:       http://localhost:${PORT}/api/v1/.well-known/jwks.json`);
    console.log(`  🔑 Public Key: http://localhost:${PORT}/api/v1/.well-known/public-key.pem`);
    console.log(`  💚 Health:     http://localhost:${PORT}/health`);
    console.log(`${'═'.repeat(60)}\n`);
  });
}

startServer().catch(console.error);
