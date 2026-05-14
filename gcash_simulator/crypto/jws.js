/**
 * JWS (JSON Web Signature) Signing Module
 * Signs API response payloads using RS256 (RSA + SHA-256)
 * Output: JWS Compact Serialization (header.payload.signature)
 */
const crypto = require('crypto');

const KID = 'gcash-sim-key-001';

function base64url(data) {
  let str;
  if (Buffer.isBuffer(data)) {
    str = data.toString('base64');
  } else {
    str = Buffer.from(JSON.stringify(data)).toString('base64');
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Signs a JSON payload as JWS Compact Serialization.
 * @param {object} payload - The JSON data to sign
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @returns {string} JWS Compact Serialization: header.payload.signature
 */
function signPayload(payload, privateKeyPem) {
  const header = {
    alg: 'RS256',
    kid: KID,
    typ: 'JOSE',
    cty: 'application/json',
  };

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  const signatureB64 = base64url(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Decodes a JWS without verifying (for debugging)
 */
function decodeJWS(jws) {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS format');

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  return { header, payload, signature: parts[2] };
}

module.exports = { signPayload, decodeJWS, KID };
