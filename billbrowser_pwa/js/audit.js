/* ═══════════════════════════════════════════════════════════════
   BillBrowser PWA — Audit Logger (mirrors Flutter AuditLogger)
   ═══════════════════════════════════════════════════════════════ */

const AuditCategory = {
  PKCE_GEN: 'PKCE',
  AUTH_REDIRECT: 'AUTH',
  CODE_RECEIVED: 'CALLBACK',
  TOKEN_EXCHANGE: 'TOKEN',
  TOKEN_RECEIVED: 'TOKEN',
  API_REQUEST: 'API',
  JWS_VERIFY: 'JWS',
  TLS_CHECK: 'TLS',
  VAULT_STORE: 'VAULT',
  ERROR: 'ERROR',
};

const CATEGORY_COLORS = {
  PKCE: '#7c4dff',
  AUTH: '#42a5f5',
  CALLBACK: '#00c853',
  TOKEN: '#ffab00',
  API: '#42a5f5',
  JWS: '#7c4dff',
  TLS: '#00bcd4',
  VAULT: '#00c853',
  ERROR: '#ff5252',
};

class AuditLogger {
  constructor() {
    this.logs = [];
    this.securityHeaders = {};
    this.jwsDetails = {};
    this._listeners = [];
  }

  log(category, message, { details = null, isSuccess = true } = {}) {
    const entry = {
      timestamp: new Date(),
      category,
      message,
      details,
      isSuccess,
      formattedTime: this._formatTime(new Date()),
    };
    this.logs.push(entry);
    this._listeners.forEach(fn => fn(entry));
  }

  setSecurityHeaders(headers) { this.securityHeaders = { ...headers }; }
  setJWSDetails(details) { this.jwsDetails = { ...details }; }

  clear() {
    this.logs = [];
    this.securityHeaders = {};
    this.jwsDetails = {};
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _formatTime(d) {
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }
}

// Singleton
window.auditLogger = new AuditLogger();
window.AuditCategory = AuditCategory;
window.CATEGORY_COLORS = CATEGORY_COLORS;
