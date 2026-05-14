/* ═══════════════════════════════════════════════════════════════
   BillBrowser PWA — State Management
   ═══════════════════════════════════════════════════════════════ */

class AppState {
  constructor() {
    this.wallets = [];   // { id, name, type:'gcash'|'maya', status, accessToken, mandates[] }
    this.currentRoute = '/';
    this._listeners = [];
    this._load();
  }

  get connectedWallets() { return this.wallets.filter(w => w.status === 'connected'); }
  get allMandates() { return this.wallets.flatMap(w => w.mandates || []); }
  get totalSubscriptions() { return this.allMandates.length; }
  get totalConnected() { return this.connectedWallets.length; }

  addWallet(wallet) {
    this.wallets.push(wallet);
    this._save(); this._notify();
  }

  updateWallet(id, updates) {
    const w = this.wallets.find(w => w.id === id);
    if (w) { Object.assign(w, updates); this._save(); this._notify(); }
  }

  removeWallet(id) {
    this.wallets = this.wallets.filter(w => w.id !== id);
    this._save(); this._notify();
  }

  getWallet(id) { return this.wallets.find(w => w.id === id); }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() { this._listeners.forEach(fn => fn(this)); }

  _save() {
    try {
      const data = this.wallets.map(w => ({
        id: w.id, name: w.name, type: w.type,
        status: w.status, mandates: w.mandates || [],
      }));
      localStorage.setItem('bb_wallets', JSON.stringify(data));
    } catch (e) { /* storage full */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem('bb_wallets');
      if (raw) {
        this.wallets = JSON.parse(raw);
        // Clear tokens on reload (session-based)
        this.wallets.forEach(w => { w.accessToken = null; });
      }
    } catch (e) { this.wallets = []; }
  }
}

window.appState = new AppState();
