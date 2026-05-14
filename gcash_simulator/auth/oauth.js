/**
 * OAuth 2.0 Authorization Server Routes
 * Implements Authorization Code Flow with PKCE (RFC 7636)
 * Endpoints: GET /authorize, POST /token
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { verifyPKCE, isValidVerifier } = require('./pkce');

const router = express.Router();

// In-memory stores (production would use Redis/DB)
const authorizationCodes = new Map(); // code → {challenge, redirectUri, clientId, scope, createdAt}
const MOCK_USERS = {
  '09171234567': { mpin: '1234', name: 'Juan Dela Cruz', id: 'USR-JDC-001' },
  '09181234567': { mpin: '5678', name: 'Maria Santos', id: 'USR-MS-002' },
};
const AUTH_CODE_EXPIRY_MS = 60000; // 60 seconds
const ACCESS_TOKEN_EXPIRY = 300;   // 5 minutes

let privateKeyPem = null;
let publicKeyPem = null;

function setKeys(privKey, pubKey) {
  privateKeyPem = privKey;
  publicKeyPem = pubKey;
}

// ─── GET /authorize ─────────────────────────────────────────────────────────
router.get('/authorize', (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  // Validate required parameters
  const errors = [];
  if (!client_id || !['billbrowser-mobile', 'billbrowser-pwa'].includes(client_id)) errors.push('Invalid client_id');
  if (response_type !== 'code') errors.push('response_type must be "code"');
  if (!redirect_uri) errors.push('redirect_uri is required');
  if (!code_challenge) errors.push('code_challenge is required (PKCE)');
  if (code_challenge_method !== 'S256') errors.push('code_challenge_method must be S256');
  if (!scope || scope !== 'mandates.read') errors.push('scope must be "mandates.read"');

  if (errors.length > 0) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  // Read and serve the login page with embedded params
  const loginHtml = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'login.html'),
    'utf8'
  );

  const rendered = loginHtml
    .replace('{{CLIENT_ID}}', client_id)
    .replace('{{REDIRECT_URI}}', redirect_uri)
    .replace('{{SCOPE}}', scope)
    .replace('{{STATE}}', state || '')
    .replace('{{CODE_CHALLENGE}}', code_challenge);

  res.type('html').send(rendered);
});

// ─── POST /authorize/consent ────────────────────────────────────────────────
router.post('/authorize/consent', (req, res) => {
  const {
    mobile_number,
    mpin,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
  } = req.body;

  // Validate mock credentials
  const user = MOCK_USERS[mobile_number];
  if (!user || user.mpin !== mpin) {
    const loginHtml = fs.readFileSync(
      path.join(__dirname, '..', 'views', 'login.html'),
      'utf8'
    );
    const rendered = loginHtml
      .replace('{{CLIENT_ID}}', client_id || '')
      .replace('{{REDIRECT_URI}}', redirect_uri || '')
      .replace('{{SCOPE}}', scope || '')
      .replace('{{STATE}}', state || '')
      .replace('{{CODE_CHALLENGE}}', code_challenge || '')
      .replace('<!--ERROR-->', '<div class="error-msg">Invalid mobile number or MPIN. Try: 09171234567 / 1234</div>');
    return res.type('html').send(rendered);
  }

  // Generate authorization code (single-use, 60s expiry)
  const authCode = crypto.randomBytes(32).toString('hex');

  authorizationCodes.set(authCode, {
    challenge: code_challenge,
    redirectUri: redirect_uri,
    clientId: client_id,
    scope: scope,
    userId: user.id,
    userName: user.name,
    createdAt: Date.now(),
  });

  // Auto-expire the code
  setTimeout(() => authorizationCodes.delete(authCode), AUTH_CODE_EXPIRY_MS);

  console.log(`[AUTH] Code issued for ${user.name}: ${authCode.substring(0, 12)}...`);

  // Redirect back to the app
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);

  res.redirect(302, redirectUrl.toString());
});

// ─── POST /token ────────────────────────────────────────────────────────────
router.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

  // Validate grant type
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code is supported',
    });
  }

  // Validate authorization code exists
  const stored = authorizationCodes.get(code);
  if (!stored) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code is invalid or expired',
    });
  }

  // Single-use: delete immediately
  authorizationCodes.delete(code);

  // Validate code expiry
  if (Date.now() - stored.createdAt > AUTH_CODE_EXPIRY_MS) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code has expired',
    });
  }

  // Validate client_id and redirect_uri match
  if (stored.clientId !== client_id || stored.redirectUri !== redirect_uri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'client_id or redirect_uri mismatch',
    });
  }

  // ── PKCE Verification ──
  if (!code_verifier || !isValidVerifier(code_verifier)) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Invalid or missing code_verifier',
    });
  }

  if (!verifyPKCE(code_verifier, stored.challenge)) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed — code_verifier does not match code_challenge',
    });
  }

  console.log(`[TOKEN] PKCE verified for user ${stored.userId}`);

  // Issue JWT access token
  const jti = uuidv4();
  const payload = {
    sub: stored.userId,
    name: stored.userName,
    scope: stored.scope,
    jti: jti,
  };

  const accessToken = jwt.sign(payload, privateKeyPem, {
    algorithm: 'RS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'gcash-simulator',
    audience: stored.clientId,
  });

  console.log(`[TOKEN] JWT issued — jti: ${jti}, expires in ${ACCESS_TOKEN_EXPIRY}s`);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    scope: stored.scope,
  });
});

module.exports = { authRouter: router, setKeys };
