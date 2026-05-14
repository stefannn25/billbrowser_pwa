/* ═══════════════════════════════════════════════════════════════
   BillBrowser PWA — SPA Router + Dashboard Rendering
   ═══════════════════════════════════════════════════════════════ */

// ── Helpers ───────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function formatCurrency(v) { return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function showToast(msg, type = 'info') {
  const c = $('#toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function getFreqLabel(f) { return { MNTH: 'Monthly', WEEK: 'Weekly', YEAR: 'Yearly' }[f] || f; }
function getStatusLabel(s) { return { ACTV: 'Active', PNDG: 'Pending', SUSP: 'Suspended' }[s] || s; }
function getTypeColor(t) { return t === 'SUBSCRIPTION' ? '#8259ef' : t === 'UTILITY' ? '#ffab00' : '#42a5f5'; }

// ── Brand Logos ───────────────────────────────────────────────
const BRAND_LOGOS = {
  'netflix':   'https://www.google.com/s2/favicons?domain=netflix.com&sz=128',
  'spotify':   'https://www.google.com/s2/favicons?domain=spotify.com&sz=128',
  'meralco':   'https://www.google.com/s2/favicons?domain=meralco.com.ph&sz=128',
  'gcash':     'https://www.google.com/s2/favicons?domain=gcash.com&sz=128',
  'maya':      'https://www.google.com/s2/favicons?domain=maya.ph&sz=128',
};

function getBrandLogo(creditorName) {
  const name = creditorName.toLowerCase();
  for (const [key, url] of Object.entries(BRAND_LOGOS)) {
    if (name.includes(key)) return url;
  }
  return null;
}

function renderBrandIcon(creditorName, size = 44, color = '#8259ef') {
  const logo = getBrandLogo(creditorName);
  if (logo) {
    return `<img src="${logo}" alt="${creditorName}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.27)}px;object-fit:cover;background:var(--bg-surface)" onerror="this.outerHTML='<span style=color:${color};font-size:${Math.round(size * 0.45)}px;font-weight:700>${creditorName[0]}</span>'">`;
  }
  return `<span style="color:${color};font-size:${Math.round(size * 0.45)}px;font-weight:700">${creditorName[0]}</span>`;
}

function renderWalletIcon(type, size = 48) {
  const logo = BRAND_LOGOS[type];
  if (logo) {
    return `<img src="${logo}" alt="${type}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.29)}px;object-fit:cover;background:var(--bg-surface)" onerror="this.outerHTML='<span style=font-size:${Math.round(size * 0.5)}px;font-weight:800;color:${type === 'gcash' ? '#007dfe' : '#00c853'}>${type === 'gcash' ? 'G' : 'M'}</span>'">`;
  }
  return `<span style="font-size:${Math.round(size * 0.5)}px;font-weight:800">${type === 'gcash' ? 'G' : 'M'}</span>`;
}

// ── Router ────────────────────────────────────────────────────
const routes = { '/': renderDashboard, '/wallets': renderWallets, '/subscriptions': renderSubscriptions, '/audit': renderAudit };

function navigate(path) {
  window.location.hash = path;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const render = routes[hash] || routes['/'];
  const content = $('#page-content');
  content.innerHTML = '';
  render(content);

  $$('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === hash);
  });
}

// ── Modal ─────────────────────────────────────────────────────
function showModal(contentHtml) {
  $('#modal-content').innerHTML = contentHtml;
  $('#modal-overlay').classList.remove('hidden');
}

function hideModal() { $('#modal-overlay').classList.add('hidden'); }

// ── Dashboard Page ────────────────────────────────────────────
function renderDashboard(el) {
  const state = window.appState;
  el.innerHTML = `
    <div class="page-header">
      <div class="header-logo">B</div>
      <div class="header-info">
        <div class="header-title">BillBrowser</div>
        <div class="header-subtitle">AISP Open Finance Prototype</div>
      </div>
      <span class="header-badge">v1.0</span>
    </div>

    <button id="btn-add-wallet" class="btn btn-primary" style="margin-bottom:20px">
      <span class="material-icons-round">add_circle</span>
      Add E-Wallet
    </button>

    ${renderWalletCards(state)}

    <div class="card" id="card-total-wallets">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;border-radius:14px;background:rgba(130,89,239,0.15);display:flex;align-items:center;justify-content:center">
          <span class="material-icons-round" style="color:var(--purple-primary);font-size:24px">account_balance_wallet</span>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text-secondary)">Total Connected E-Wallets</div>
          <div style="font-size:28px;font-weight:700;color:var(--text-primary)">${state.totalConnected}</div>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:14px" onclick="navigate('/wallets')">
        <span class="material-icons-round" style="font-size:18px">visibility</span>
        View E-Wallets
      </button>
    </div>

    <div class="card" id="card-total-subs">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;border-radius:14px;background:rgba(66,165,245,0.15);display:flex;align-items:center;justify-content:center">
          <span class="material-icons-round" style="color:#42a5f5;font-size:24px">receipt_long</span>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text-secondary)">Total Subscriptions Connected</div>
          <div style="font-size:28px;font-weight:700;color:var(--text-primary)">${state.totalSubscriptions}</div>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:14px" onclick="navigate('/subscriptions')">
        <span class="material-icons-round" style="font-size:18px">visibility</span>
        View All Subscriptions
      </button>
    </div>

    <div class="security-badge">
      <span class="material-icons-round">lock</span>
      BSP Circular 1122 · OAuth 2.0 + PKCE · JWS RS256
    </div>
  `;

  $('#btn-add-wallet').addEventListener('click', showAddWalletModal);
}

function renderWalletCards(state) {
  if (state.connectedWallets.length === 0) return '';
  return state.connectedWallets.map(w => `
    <div class="wallet-connect-card connected" style="margin-bottom:16px">
      <div class="wallet-row">
        <div class="wallet-icon ${w.type}">${renderWalletIcon(w.type, 48)}</div>
        <div style="flex:1">
          <div class="wallet-name">${w.name}</div>
          <div class="wallet-status">
            <span class="status-dot connected"></span>
            <span style="color:var(--green-accent)">Connected · Read-Only</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Add Wallet Modal ──────────────────────────────────────────
function showAddWalletModal() {
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">Add E-Wallet</div>
    <div class="wallet-option" id="opt-gcash">
      <div class="wallet-icon gcash">${renderWalletIcon('gcash', 48)}</div>
      <div class="wallet-option-info">
        <div class="wallet-option-name">GCash</div>
        <div class="wallet-option-desc">Connect via OAuth 2.0 + PKCE</div>
      </div>
      <span class="wallet-option-badge" style="background:rgba(0,125,254,0.12);color:#42a5f5">Connect</span>
    </div>
    <div class="wallet-option" id="opt-maya">
      <div class="wallet-icon maya">${renderWalletIcon('maya', 48)}</div>
      <div class="wallet-option-info">
        <div class="wallet-option-name">Maya</div>
        <div class="wallet-option-desc">Digital payments & banking</div>
      </div>
      <span class="wallet-option-badge" style="background:var(--yellow-bg);color:var(--yellow-warn)">Coming Soon</span>
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="hideModal()">Cancel</button>
  `);

  document.getElementById('opt-gcash').addEventListener('click', async () => {
    hideModal();
    const walletId = 'gcash-' + Date.now();
    window.appState.addWallet({
      id: walletId, name: 'GCash', type: 'gcash',
      status: 'connecting', accessToken: null, mandates: [],
    });
    handleRoute();
    await window.oauthFlow.startOAuthFlow(walletId);
  });

  document.getElementById('opt-maya').addEventListener('click', () => {
    showToast('Maya integration coming soon!', 'info');
  });
}

// ── Wallets Page ──────────────────────────────────────────────
function renderWallets(el) {
  const state = window.appState;
  el.innerHTML = `
    <div class="page-title-row">
      <button class="back-btn" onclick="navigate('/')">
        <span class="material-icons-round" style="font-size:20px">arrow_back_ios_new</span>
      </button>
      <span class="page-title">E-Wallet Dashboard</span>
    </div>
  `;

  if (state.connectedWallets.length === 0) {
    el.innerHTML += `
      <div class="empty-state">
        <span class="material-icons-round">account_balance_wallet</span>
        <p>No e-wallets connected yet.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:16px;width:auto" onclick="navigate('/');setTimeout(showAddWalletModal,300)">
          <span class="material-icons-round" style="font-size:18px">add_circle</span> Add E-Wallet
        </button>
      </div>
    `;
    return;
  }

  state.connectedWallets.forEach(w => {
    const mandatesHtml = (w.mandates || []).map(m => `
      <div class="mandate-card" style="margin-bottom:8px;padding:14px;border:1px solid var(--border-light)">
        <div class="mandate-row">
          <div class="mandate-icon" style="width:36px;height:36px;border-radius:10px;background:${getTypeColor(m.mandateType)}20;font-size:16px">
            ${renderBrandIcon(m.creditor.name, 36, getTypeColor(m.mandateType))}
          </div>
          <div class="mandate-info">
            <div class="mandate-name" style="font-size:14px">${m.creditor.name}</div>
            <div class="mandate-id">${m.mandateId}</div>
          </div>
          <div class="mandate-amount">
            <div class="amount" style="font-size:15px">${formatCurrency(m.amount.value)}</div>
            <div class="currency">${m.amount.currency}</div>
          </div>
        </div>
        <div class="mandate-details" style="margin-top:10px;padding:8px">
          <div class="mandate-detail-item"><label>Freq</label><span>${getFreqLabel(m.frequency)}</span></div>
          <div class="mandate-detail-item"><label>Next</label><span>${m.nextDeductionDate}</span></div>
          <span class="status-badge ${m.status === 'ACTV' ? 'active' : 'pending'}">${getStatusLabel(m.status)}</span>
        </div>
      </div>
    `).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:12px;text-align:center">No subscription mandates</div>';

    el.innerHTML += `
      <div class="card" style="margin-bottom:16px">
        <div class="wallet-row" style="margin-bottom:14px">
          <div class="wallet-icon ${w.type}" style="width:44px;height:44px;border-radius:12px;font-size:22px;font-weight:800">${renderWalletIcon(w.type, 44)}</div>
          <div style="flex:1">
            <div class="wallet-name">${w.name}</div>
            <div class="wallet-status">
              <span class="status-dot connected"></span>
              <span style="color:var(--green-accent);font-size:12px">Connected · ${(w.mandates||[]).length} mandates</span>
            </div>
          </div>
        </div>
        ${mandatesHtml}
        <button class="btn btn-danger btn-sm" style="margin-top:12px" onclick="disconnectWallet('${w.id}')">
          <span class="material-icons-round" style="font-size:16px">link_off</span> Disconnect
        </button>
      </div>
    `;
  });
}

function disconnectWallet(id) {
  window.appState.removeWallet(id);
  showToast('E-Wallet disconnected', 'info');
  handleRoute();
}

// ── Subscriptions Page ────────────────────────────────────────
function renderSubscriptions(el) {
  const state = window.appState;
  const allMandates = [];
  state.connectedWallets.forEach(w => {
    (w.mandates || []).forEach(m => allMandates.push({ ...m, walletName: w.name, walletType: w.type }));
  });

  const totalAmount = allMandates.reduce((s, m) => s + (m.amount?.value || 0), 0);

  el.innerHTML = `
    <div class="page-title-row">
      <button class="back-btn" onclick="navigate('/')">
        <span class="material-icons-round" style="font-size:20px">arrow_back_ios_new</span>
      </button>
      <span class="page-title">Subscriptions</span>
    </div>
  `;

  if (allMandates.length === 0) {
    el.innerHTML += `
      <div class="empty-state">
        <span class="material-icons-round">receipt_long</span>
        <p>No subscriptions found. Connect an e-wallet first.</p>
      </div>
    `;
    return;
  }

  el.innerHTML += `
    <div class="summary-header">
      <div class="total-label">Total Monthly Billing</div>
      <div class="total-value">${formatCurrency(totalAmount)}</div>
      <div class="meta-chips">
        <span class="meta-chip"><span class="material-icons-round">receipt</span>${allMandates.length} Active</span>
        <span class="meta-chip"><span class="material-icons-round">shield</span>ISO 20022</span>
        <span class="meta-chip"><span class="material-icons-round">lock</span>BSP-OF</span>
      </div>
    </div>
  `;

  allMandates.forEach(m => {
    const color = getTypeColor(m.mandateType);
    el.innerHTML += `
      <div class="mandate-card">
        <div class="mandate-row">
          <div class="mandate-icon" style="background:${color}20">
            ${renderBrandIcon(m.creditor.name, 44, color)}
          </div>
          <div class="mandate-info">
            <div class="mandate-name">${m.creditor.name}</div>
            <div class="mandate-id">${m.mandateId}</div>
          </div>
          <div class="mandate-amount">
            <div class="amount">${formatCurrency(m.amount.value)}</div>
            <div class="currency">${m.amount.currency}</div>
          </div>
        </div>
        <div class="mandate-details">
          <div class="mandate-detail-item"><label>Frequency</label><span>${getFreqLabel(m.frequency)}</span></div>
          <div class="mandate-detail-item"><label>Next Deduction</label><span>${m.nextDeductionDate}</span></div>
          <span class="status-badge ${m.status === 'ACTV' ? 'active' : 'pending'}">${getStatusLabel(m.status)}</span>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--text-muted)">Connected to:</span>
          <span class="mandate-wallet-badge ${m.walletType}">${m.walletName}</span>
        </div>
      </div>
    `;
  });
}

// ── Audit Console Page ────────────────────────────────────────
function renderAudit(el) {
  const audit = window.auditLogger;
  const colors = window.CATEGORY_COLORS;

  el.innerHTML = `
    <div class="page-title-row">
      <button class="back-btn" onclick="navigate('/')">
        <span class="material-icons-round" style="font-size:20px">arrow_back_ios_new</span>
      </button>
      <span class="page-title" style="display:flex;align-items:center;gap:8px">
        <span class="material-icons-round" style="color:var(--green-accent);font-size:20px">terminal</span>
        Audit Console
      </span>
      <span class="header-badge" style="margin-left:auto">${audit.logs.length} events</span>
    </div>

    <div class="audit-section">
      <div class="section-header">
        <div class="section-number" style="background:rgba(66,165,245,0.15);color:#42a5f5">1</div>
        <div><div class="section-title">Handshake Log</div><div class="section-subtitle">OAuth 2.0 Exchange</div></div>
      </div>
      <div class="audit-panel" id="handshake-log">
        ${audit.logs.length === 0
          ? '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No events yet. Connect to GCash to start the handshake.</div>'
          : audit.logs.map(l => renderLogEntry(l, colors)).join('')
        }
      </div>
    </div>

    <div class="audit-section">
      <div class="section-header">
        <div class="section-number" style="background:rgba(255,171,0,0.15);color:#ffab00">2</div>
        <div><div class="section-title">Security Headers</div><div class="section-subtitle">TLS & Bearer Token</div></div>
      </div>
      <div class="audit-panel">${renderSecHeaders(audit.securityHeaders)}</div>
    </div>

    <div class="audit-section">
      <div class="section-header">
        <div class="section-number" style="background:rgba(124,77,255,0.15);color:#7c4dff">3</div>
        <div><div class="section-title">Integrity Check</div><div class="section-subtitle">JWS Signature Verification</div></div>
      </div>
      <div class="audit-panel" style="border-color:${audit.jwsDetails.isValid ? 'rgba(0,200,83,0.3)' : audit.jwsDetails.isValid === false ? 'rgba(255,82,82,0.3)' : 'var(--border-light)'}">
        ${renderJWSCheck(audit.jwsDetails)}
      </div>
    </div>
  `;
}

function renderLogEntry(log, colors) {
  const c = colors[log.category] || '#8899aa';
  const detailsHtml = log.details ? Object.entries(log.details).map(
    ([k, v]) => `<div class="log-detail">${k}: ${v}</div>`
  ).join('') : '';
  return `<div class="log-entry">
    <div class="log-row">
      <span class="log-time">${log.formattedTime}</span>
      <span class="log-cat" style="background:${c}25;color:${c}">${log.category}</span>
      <span class="log-msg${log.isSuccess ? '' : ' error'}">${log.message}</span>
    </div>
    ${detailsHtml ? `<div class="log-details">${detailsHtml}</div>` : ''}
  </div>`;
}

function renderSecHeaders(headers) {
  const display = Object.keys(headers).length > 0 ? headers : {
    'x-tls-version': 'Awaiting connection...', 'authorization': 'Awaiting token...',
    'content-type': '—', 'x-jws-signature': '—', 'x-api-standard': '—', 'cache-control': '—'
  };
  const highlights = ['x-tls-version', 'authorization', 'x-jws-signature'];
  return Object.entries(display).map(([k, v]) => `
    <div class="header-row">
      <span class="header-key${highlights.includes(k) ? ' highlight' : ''}">${k}</span>
      <span class="header-value">${v}</span>
    </div>
  `).join('');
}

function renderJWSCheck(jws) {
  if (!jws || Object.keys(jws).length === 0) {
    return '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">JWS verification data will appear after fetching mandates.</div>';
  }
  const valid = jws.isValid;
  const header = jws.header || {};
  return `
    <div style="text-align:center;margin-bottom:16px">
      <span class="jws-status ${valid ? 'valid' : 'invalid'}">
        <span class="material-icons-round">${valid ? 'verified' : 'dangerous'}</span>
        ${valid ? 'SIGNATURE VERIFIED' : 'VERIFICATION FAILED'}
      </span>
    </div>
    <div style="font-size:11px;color:var(--text-secondary);font-weight:600;margin-bottom:8px">JWS Compact Serialization</div>
    <div class="jws-part" style="background:rgba(255,107,107,0.06)">
      <span class="jws-part-label" style="background:rgba(255,107,107,0.15);color:#ff6b6b">HEADER</span>
      <span class="jws-part-value" style="color:rgba(255,107,107,0.7)">${jws.headerRaw || ''}</span>
    </div>
    <div style="text-align:center;color:var(--text-muted);font-size:18px">.</div>
    <div class="jws-part" style="background:rgba(124,77,255,0.06)">
      <span class="jws-part-label" style="background:rgba(124,77,255,0.15);color:#7c4dff">PAYLOAD</span>
      <span class="jws-part-value" style="color:rgba(124,77,255,0.7)">${jws.payloadRaw || ''}</span>
    </div>
    <div style="text-align:center;color:var(--text-muted);font-size:18px">.</div>
    <div class="jws-part" style="background:rgba(0,200,83,0.06)">
      <span class="jws-part-label" style="background:rgba(0,200,83,0.15);color:#00c853">SIGNATURE</span>
      <span class="jws-part-value" style="color:rgba(0,200,83,0.7)">${jws.signatureRaw || ''}</span>
    </div>
    <hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0 8px">
    <div class="jws-detail-row"><span class="jws-detail-label">Algorithm</span><span class="jws-detail-value">${header.alg || '—'}</span></div>
    <div class="jws-detail-row"><span class="jws-detail-label">Key ID</span><span class="jws-detail-value">${header.kid || '—'}</span></div>
    <div class="jws-detail-row"><span class="jws-detail-label">Type</span><span class="jws-detail-value">${header.typ || '—'}</span></div>
    <div class="jws-detail-row"><span class="jws-detail-label">Signature (hex)</span><span class="jws-detail-value">${jws.signatureHex || '—'}</span></div>
    <div class="jws-detail-row"><span class="jws-detail-label">Public Key FP</span><span class="jws-detail-value">${jws.publicKeyFingerprint || '—'}</span></div>
    <hr style="border:none;border-top:1px solid var(--border-light);margin:8px 0">
    <div style="font-size:11px;color:var(--text-secondary);font-weight:600;margin-bottom:4px">Decoded Payload Preview</div>
    <div class="payload-preview">${jws.payloadPreview || '—'}</div>
  `;
}

// ── OAuth Callback Handler ────────────────────────────────────
async function processCallback() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('code')) return;

  try {
    const result = await window.oauthFlow.handleOAuthCallback();
    if (!result) return;

    const { tokenData, walletId } = result;

    // Fetch mandates
    const mandates = await window.api.fetchMandates(tokenData.access_token);

    // Update wallet state
    const wId = walletId || window.appState.wallets.find(w => w.status === 'connecting')?.id;
    if (wId) {
      window.appState.updateWallet(wId, {
        status: 'connected', accessToken: tokenData.access_token, mandates,
      });
    }

    // Clean URL and navigate to dashboard
    window.history.replaceState({}, '', '/');
    window.location.hash = '/';
    showToast('GCash connected successfully!', 'success');
  } catch (e) {
    console.error('OAuth callback error:', e);
    const wId = sessionStorage.getItem('oauth_wallet_id');
    if (wId) window.appState.removeWallet(wId);
    window.history.replaceState({}, '', '/');
    window.location.hash = '/';
    showToast(`Connection failed: ${e.message}`, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Register service worker
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) { console.log('SW registration failed:', e); }
  }

  // Handle OAuth callback first
  await processCallback();

  // Setup routing
  window.addEventListener('hashchange', handleRoute);
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  // Click outside modal to close
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) hideModal();
  });

  // State change listener
  window.appState.subscribe(() => handleRoute());

  // Fetch server public key
  window.api.fetchPublicKey();

  // Initial render
  handleRoute();
});

// Global functions for inline onclick
window.navigate = navigate;
window.showAddWalletModal = showAddWalletModal;
window.disconnectWallet = disconnectWallet;
window.hideModal = hideModal;
