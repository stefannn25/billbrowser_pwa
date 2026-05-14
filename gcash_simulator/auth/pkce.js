/**
 * PKCE (Proof Key for Code Exchange) Verification Module
 * Implements RFC 7636 — S256 code challenge method
 */
const crypto = require('crypto');

/**
 * Verifies a PKCE code_verifier against a stored code_challenge.
 * Method: SHA-256 hash of the verifier, then base64url-encode, must match the challenge.
 */
function verifyPKCE(codeVerifier, storedCodeChallenge) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const computed = hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return computed === storedCodeChallenge;
}

/**
 * Validates code_verifier format per RFC 7636 §4.1
 * Must be 43–128 characters, using [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
function isValidVerifier(verifier) {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  return /^[A-Za-z0-9\-._~]+$/.test(verifier);
}

module.exports = { verifyPKCE, isValidVerifier };
