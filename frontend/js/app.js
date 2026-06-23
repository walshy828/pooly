/** Pooly SPA — Main application router and initialization */
const App = {
  currentPage: 'dashboard',
  contentEl: null,
  authenticated: false,

  parseHash() {
    const hash = location.hash.slice(1);
    if (!hash) return { page: 'dashboard', tab: null };
    const [rawPage, rawTab = null] = hash.split('/');
    const pageMap = { journal: 'history', home: 'dashboard', plan: 'treatment-plan' };
    // Remap legacy quick-entry tabs to merged care tab
    const tabMap = { maint: 'care', status: 'care' };
    const tab = rawTab ? (tabMap[rawTab] || rawTab) : null;
    return { page: pageMap[rawPage] || rawPage, tab };
  },

  async init() {
    this.contentEl = document.getElementById('pageContent');
    if (!this.contentEl) return;

    try {
      const pinCheck = await API.checkPinRequired();
      if (pinCheck.pin_required) {
        this.showPinOverlay();
        return;
      }
    } catch (e) {
      // API not ready, proceed anyway
    }

    this.authenticated = true;
    this.renderNav();
    this._startRouter();

    const { page, tab } = this.parseHash();
    await this.navigate(page, { tab, skipHash: true });
  },

  _startRouter() {
    // Handles browser back/forward (entries created by pushState)
    window.addEventListener('popstate', async () => {
      const { page, tab } = this.parseHash();
      await this.navigate(page, { tab, skipHash: true });
    });
  },

  showPinOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.innerHTML = `
      <div style="font-size:3.5rem;margin-bottom:16px">🏊</div>
      <div class="pin-title">Pooly</div>
      <p style="font-size:14px;color:rgba(245,245,247,0.45);margin-top:-8px">Enter your PIN to continue</p>
      <input type="password" class="pin-input" id="pinInput" maxlength="10" placeholder="••••" inputmode="numeric" autocomplete="off">
      <div class="pin-error" id="pinError"></div>`;
    document.body.appendChild(overlay);

    const input = document.getElementById('pinInput');
    input.focus();
    input.addEventListener('keyup', async (e) => {
      if (e.key === 'Enter') {
        try {
          const result = await API.verifyPin(input.value);
          if (result.valid) {
            overlay.remove();
            this.authenticated = true;
            this.renderNav();
            this._startRouter();
            const { page, tab } = this.parseHash();
            await this.navigate(page, { tab, skipHash: true });
          } else {
            document.getElementById('pinError').textContent = 'Incorrect PIN';
            input.value = '';
            input.style.borderColor = 'var(--color-danger)';
            setTimeout(() => { input.style.borderColor = ''; }, 1500);
          }
        } catch (err) {
          document.getElementById('pinError').textContent = 'Connection error';
        }
      }
    });
  },

  renderNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    const SVG = {
      home: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      plan: `<svg viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>`,
      add:  `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      hist: `<svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>`,
      set:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    };
    nav.innerHTML = `
      <button class="nav-item" data-page="dashboard">
        <span class="nav-icon">${SVG.home}</span>
        <span class="nav-label">Today</span>
      </button>
      <button class="nav-item" data-page="treatment-plan">
        <span class="nav-icon">${SVG.plan}</span>
        <span class="nav-label">Plan</span>
      </button>
      <button class="nav-item nav-add" data-page="quick-entry">
        <div class="nav-add-ring">${SVG.add.replace('viewBox="0 0 24 24"','viewBox="0 0 24 24" style="width:24px;height:24px;stroke:white;stroke-width:2.5;fill:none"')}</div>
        <span class="nav-label">Add</span>
      </button>
      <button class="nav-item" data-page="history">
        <span class="nav-icon">${SVG.hist}</span>
        <span class="nav-label">Journal</span>
      </button>
      <button class="nav-item" data-page="settings">
        <span class="nav-icon">${SVG.set}</span>
        <span class="nav-label">Settings</span>
      </button>`;

    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item) this.navigate(item.dataset.page);
    });

    this.updateNavActive();
  },

  updateNavActive() {
    document.querySelectorAll('#bottomNav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === this.currentPage);
    });
  },

  async navigate(page, options = {}) {
    if (!this.authenticated && page !== 'pin') return;
    const { tab = null, skipHash = false } = options;

    const validPages = ['dashboard', 'quick-entry', 'history', 'settings', 'treatment-plan'];
    const targetPage = validPages.includes(page) ? page : 'dashboard';

    this.currentPage = targetPage;
    this.updateNavActive();
    this.contentEl.innerHTML = '';
    window.scrollTo(0, 0);

    if (!skipHash) {
      const hashPage = targetPage === 'history' ? 'journal' : targetPage === 'treatment-plan' ? 'plan' : targetPage;
      const newHash = tab ? `${hashPage}/${tab}` : hashPage;
      history.pushState(null, '', `#${newHash}`);
    }

    switch (targetPage) {
      case 'dashboard':
        await DashboardPage.render(this.contentEl);
        break;
      case 'quick-entry':
        if (tab) QuickEntryPage.activeTab = tab;
        await QuickEntryPage.render(this.contentEl);
        break;
      case 'history':
        await HistoryPage.render(this.contentEl);
        break;
      case 'settings':
        await SettingsPage.render(this.contentEl);
        break;
      case 'treatment-plan':
        await TreatmentPlanPage.render(this.contentEl);
        break;
      default:
        await DashboardPage.render(this.contentEl);
    }
  },
};

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
