/**
 * Mandates API — Protected Resource Endpoint
 * GET /api/v1/mandates — Returns JWS-signed mandate data
 * Format: ISO 20022 / BSP Open Finance (Tier 3)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { bearerAuth, setPublicKey } = require('../middleware/bearerAuth');
const { signPayload } = require('../crypto/jws');

const router = express.Router();

let privateKeyPem = null;

function setApiKeys(privKey, pubKey) {
  privateKeyPem = privKey;
  setPublicKey(pubKey);
}

// ─── GET /api/v1/mandates ───────────────────────────────────────────────────
router.get(
  '/mandates',
  bearerAuth('mandates.read'),
  (req, res) => {
    // Load mock mandate data
    const mandatesRaw = fs.readFileSync(
      path.join(__dirname, '..', 'data', 'mandates.json'),
      'utf8'
    );
    const mandates = JSON.parse(mandatesRaw);

    // Construct ISO 20022 / BSP Open Finance response
    const responsePayload = {
      data: mandates,
      meta: {
        totalCount: mandates.length,
        requestTimestamp: new Date().toISOString(),
        apiVersion: 'v1.0.0',
        standard: 'BSP-OF-Tier3/ISO20022',
        regulation: 'BSP Circular No. 1122',
        dataClassification: 'CONFIDENTIAL',
        consentScope: req.tokenPayload.scope,
        subject: req.tokenPayload.sub,
      },
    };

    // Sign the entire response as JWS Compact Serialization
    const jwsToken = signPayload(responsePayload, privateKeyPem);

    console.log(`[API] Mandates served for ${req.tokenPayload.sub} — ${mandates.length} records, JWS-signed`);

    // Set response headers
    res.setHeader('Content-Type', 'application/jose');
    res.setHeader('X-JWS-Signature', 'true');
    res.setHeader('X-API-Standard', 'BSP-OF-1122');
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Consent-Scope', req.tokenPayload.scope);

    res.send(jwsToken);
  }
);

module.exports = { mandatesRouter: router, setApiKeys };
