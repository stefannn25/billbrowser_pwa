/**
 * Bearer Token Authentication Middleware
 * Validates JWT access tokens per RFC 6750
 */
const jwt = require('jsonwebtoken');

let publicKeyPem = null;

function setPublicKey(pem) {
  publicKeyPem = pem;
}

/**
 * Express middleware: extracts and verifies Bearer token from Authorization header.
 * Returns 401 with WWW-Authenticate header per RFC 6750 on failure.
 */
function bearerAuth(requiredScope) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader(
        'WWW-Authenticate',
        'Bearer realm="gcash-openfinance", error="invalid_request"'
      );
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Missing or malformed Authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, publicKeyPem, {
        algorithms: ['RS256'],
        issuer: 'gcash-simulator',
        audience: ['billbrowser-mobile', 'billbrowser-pwa'],
      });

      // Verify required scope
      if (requiredScope && decoded.scope !== requiredScope) {
        res.setHeader(
          'WWW-Authenticate',
          `Bearer realm="gcash-openfinance", error="insufficient_scope", scope="${requiredScope}"`
        );
        return res.status(403).json({
          error: 'insufficient_scope',
          error_description: `Required scope: ${requiredScope}`,
        });
      }

      req.tokenPayload = decoded;
      next();
    } catch (err) {
      let errorType = 'invalid_token';
      let description = 'Token verification failed';

      if (err.name === 'TokenExpiredError') {
        description = 'Access token has expired';
      } else if (err.name === 'JsonWebTokenError') {
        description = err.message;
      }

      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="gcash-openfinance", error="${errorType}", error_description="${description}"`
      );
      return res.status(401).json({
        error: errorType,
        error_description: description,
      });
    }
  };
}

module.exports = { bearerAuth, setPublicKey };
