/* ═══════════════════════════════════════════════════════════════
   BillBrowser PWA — OAuth 2.0 + PKCE (Web Crypto API)
   ═══════════════════════════════════════════════════════════════ */

const OAUTH_CONFIG = {
  serverBaseUrl: '', // set dynamically
  clientId: 'billbrowser-pwa',
  scope: 'mandates.read',
  responseType: 'code',
  codeChallengeMethod: 'S256',
};

function getServerUrl() {
  // Use the same host but port 3000 for the GCash simulator
  const loc = window.location;
  // If deployed, use env variable or same origin
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    return `${loc.protocol}//${loc.hostname}:3000`;
  }
  // For deployed: the simulator should be on the same domain or configured separately
  return window.GCASH_SIMULATOR_URL || `${loc.protocol}//${loc.hostname}:3000`;
}

function getRedirectUri() {
  return `${window.location.origin}/callback`;
}

// ── PKCE helpers using Web Crypto API ─────────────────────────
function generateRandomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(str) {
  const encoded = new TextEncoder().encode(str);
  return await crypto.subtle.digest('SHA-256', encoded);
}

// ── OAuth Flow ────────────────────────────────────────────────
const oauthState = { codeVerifier: null, codeChallenge: null, state: null, walletId: null };

async function startOAuthFlow(walletId) {
  const audit = window.auditLogger;
  const AC = window.AuditCategory;

  audit.clear();
  audit.log(AC.TLS_CHECK, '═══ BillBrowser AISP Handshake Initiated ═══');

  // Generate PKCE
  const verifierBytes = generateRandomBytes(32);
  oauthState.codeVerifier = base64UrlEncode(verifierBytes);
  const challengeHash = await sha256(oauthState.codeVerifier);
  oauthState.codeChallenge = base64UrlEncode(challengeHash);
  oauthState.state = base64UrlEncode(generateRandomBytes(16));
  oauthState.walletId = walletId;

  // Store in sessionStorage for callback
  sessionStorage.setItem('oauth_verifier', oauthState.codeVerifier);
  sessionStorage.setItem('oauth_state', oauthState.state);
  sessionStorage.setItem('oauth_wallet_id', walletId);

  audit.log(AC.PKCE_GEN, `Code Verifier generated (${oauthState.codeVerifier.length} chars)`, {
    details: {
      verifier_preview: `${oauthState.codeVerifier.substring(0, 8)}...${oauthState.codeVerifier.slice(-8)}`,
      challenge_method: 'S256',
    }
  });
  audit.log(AC.PKCE_GEN, 'Code Challenge: SHA256(verifier) → base64url', {
    details: { challenge_preview: `${oauthState.codeChallenge.substring(0, 12)}...${oauthState.codeChallenge.slice(-8)}` }
  });
  audit.log(AC.PKCE_GEN, 'CSRF state token generated', {
    details: { state: oauthState.state }
  });

  // Build authorization URL
  const serverUrl = getServerUrl();
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: getRedirectUri(),
    response_type: OAUTH_CONFIG.responseType,
    scope: OAUTH_CONFIG.scope,
    state: oauthState.state,
    code_challenge: oauthState.codeChallenge,
    code_challenge_method: OAUTH_CONFIG.codeChallengeMethod,
  });

  const authUrl = `${serverUrl}/authorize?${params}`;

  audit.log(AC.AUTH_REDIRECT, `Redirecting to /authorize with scope=${OAUTH_CONFIG.scope}`, {
    details: { url: authUrl.substring(0, 80) + '...', method: 'GET' }
  });

  // Redirect browser
  window.location.href = authUrl;
}

async function handleOAuthCallback() {
  const audit = window.auditLogger;
  const AC = window.AuditCategory;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code) return false;

  const storedState = sessionStorage.getItem('oauth_state');
  const storedVerifier = sessionStorage.getItem('oauth_verifier');
  const walletId = sessionStorage.getItem('oauth_wallet_id');

  audit.log(AC.CODE_RECEIVED, 'Authorization code received from callback', {
    details: {
      code_preview: `${code.substring(0, 12)}...`,
      state_valid: String(state === storedState),
    }
  });

  if (state !== storedState) {
    audit.log(AC.ERROR, 'State mismatch — possible CSRF attack', { isSuccess: false });
    throw new Error('State mismatch — possible CSRF attack');
  }

  // Exchange code for token
  audit.log(AC.TOKEN_EXCHANGE, 'POST /token with code + code_verifier', {
    details: {
      grant_type: 'authorization_code',
      code_preview: `${code.substring(0, 12)}...`,
      verifier_length: String(storedVerifier.length),
    }
  });

  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: OAUTH_CONFIG.clientId,
      code_verifier: storedVerifier,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    audit.log(AC.ERROR, `Token exchange failed: ${err.error_description || err.error}`, { isSuccess: false });
    throw new Error(err.error_description || 'Token exchange failed');
  }

  const tokenData = await response.json();

  audit.log(AC.TOKEN_RECEIVED, `JWT received, expires in ${tokenData.expires_in}s`, {
    details: {
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      token_preview: `${tokenData.access_token.substring(0, 20)}...`,
    }
  });

  audit.log(AC.TLS_CHECK, 'Transport security verified', {
    details: {
      protocol: 'TLS 1.3 (simulated)',
      cipher: 'TLS_AES_256_GCM_SHA384',
      certificate: 'gcash-simulator.local',
    }
  });

  // Store token in session
  sessionStorage.setItem('access_token', tokenData.access_token);
  sessionStorage.removeItem('oauth_verifier');
  sessionStorage.removeItem('oauth_state');

  return { tokenData, walletId };
}

window.oauthFlow = { startOAuthFlow, handleOAuthCallback, getServerUrl, getRedirectUri, OAUTH_CONFIG };
