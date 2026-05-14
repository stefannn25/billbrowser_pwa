/* ═══════════════════════════════════════════════════════════════
   BillBrowser PWA — API Client + JWS Verification
   ═══════════════════════════════════════════════════════════════ */

let serverPublicKey = null; // CryptoKey for JWS verification

async function fetchPublicKey() {
  const serverUrl = window.oauthFlow.getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/v1/.well-known/public-key.pem`);
    if (res.ok) {
      const pem = await res.text();
      serverPublicKey = await importRSAPublicKey(pem);
      window.auditLogger.log(window.AuditCategory.TLS_CHECK, 'Server public key fetched for JWS verification');
      return true;
    }
  } catch (e) {
    window.auditLogger.log(window.AuditCategory.ERROR, `Failed to fetch public key: ${e.message}`, { isSuccess: false });
  }
  return false;
}

async function importRSAPublicKey(pem) {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '').replace(/\s/g, '');
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey('spki', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']);
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyJWS(jwsCompact) {
  const audit = window.auditLogger;
  const AC = window.AuditCategory;
  const parts = jwsCompact.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS format');

  const headerJson = new TextDecoder().decode(base64UrlDecode(parts[0]));
  const header = JSON.parse(headerJson);
  const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));
  const payload = JSON.parse(payloadJson);
  const signatureBytes = base64UrlDecode(parts[2]);

  audit.log(AC.JWS_VERIFY, 'JWS Header decoded', {
    details: { alg: header.alg || 'unknown', kid: header.kid || 'unknown', typ: header.typ || 'unknown' }
  });

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let isValid = false;

  if (serverPublicKey) {
    try {
      isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', serverPublicKey, signatureBytes, signingInput);
    } catch (e) {
      audit.log(AC.ERROR, `Signature verification error: ${e.message}`, { isSuccess: false });
    }
  }

  const signatureHex = toHex(signatureBytes);

  audit.log(AC.JWS_VERIFY,
    isValid ? '✅ SIGNATURE VERIFIED — Data integrity confirmed' : '❌ SIGNATURE VERIFICATION FAILED',
    { isSuccess: isValid, details: { algorithm: 'RS256 (RSA + SHA-256)', signature_length: `${signatureBytes.length} bytes` } }
  );

  audit.setJWSDetails({
    isValid, header,
    payloadPreview: payloadJson.length > 200 ? payloadJson.substring(0, 200) + '...' : payloadJson,
    signatureHex: signatureHex.length > 64 ? signatureHex.substring(0, 64) + '...' : signatureHex,
    publicKeyFingerprint: serverPublicKey ? 'loaded' : 'unavailable',
    headerRaw: parts[0], payloadRaw: parts[1],
    signatureRaw: parts[2].length > 32 ? parts[2].substring(0, 32) + '...' : parts[2],
  });

  if (!isValid) throw new Error('JWS signature verification failed');
  return payload;
}

async function fetchMandates(accessToken) {
  const audit = window.auditLogger;
  const AC = window.AuditCategory;
  const serverUrl = window.oauthFlow.getServerUrl();

  audit.log(AC.API_REQUEST, 'GET /api/v1/mandates with Bearer token', {
    details: { endpoint: `${serverUrl}/api/v1/mandates`, authorization: `Bearer ${accessToken.substring(0, 20)}...`, accept: 'application/jose' }
  });

  const res = await fetch(`${serverUrl}/api/v1/mandates`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/jose' },
  });

  // Capture security headers
  const secHeaders = {};
  ['x-tls-version', 'x-jws-signature', 'x-api-standard', 'x-data-classification',
   'x-consent-scope', 'content-type', 'cache-control'].forEach(k => {
    const v = res.headers.get(k);
    if (v) secHeaders[k] = v;
  });
  secHeaders['authorization'] = `Bearer ${accessToken.substring(0, 20)}...`;
  audit.setSecurityHeaders(secHeaders);

  audit.log(AC.API_REQUEST, `Response received — ${res.status}`, {
    details: {
      'content-type': res.headers.get('content-type') || 'unknown',
      'x-jws-signature': res.headers.get('x-jws-signature') || 'unknown',
    }
  });

  if (res.status === 401) throw new Error('Unauthorized: Access token is invalid or expired');
  if (!res.ok) throw new Error(`API request failed: ${res.status}`);

  const jwsToken = await res.text();

  audit.log(AC.JWS_VERIFY, 'Received JWS Compact Serialization — verifying signature...', {
    details: { format: 'header.payload.signature', total_length: `${jwsToken.length} chars` }
  });

  if (!serverPublicKey) await fetchPublicKey();
  const payload = await verifyJWS(jwsToken);
  const mandates = payload.data || [];

  audit.log(AC.API_REQUEST, `Pipeline complete — ${mandates.length} mandates fetched, verified`);

  return mandates;
}

window.api = { fetchPublicKey, fetchMandates, verifyJWS };
