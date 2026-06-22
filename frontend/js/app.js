/** Pooly SPA — Main application router and initialization */
const App = {
  currentPage: 'dashboard',
  contentEl: null,
  authenticated: false,

  parseHash() {
    const hash = location.hash.slice(1);
    if (!hash) return { page: 'dashboard', tab: null };
    const [rawPage, tab = null] = hash.split('/');
    const pageMap = { journal: 'history', home: 'dashboard', plan: 'treatment-plan' };
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
      <div style="font-size:3rem;margin-bottom:var(--space-lg)">🏊</div>
      <div class="pin-title">Pooly</div>
      <input type="password" class="pin-input" id="pinInput" maxlength="10" placeholder="PIN" inputmode="numeric" autocomplete="off">
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
    nav.innerHTML = `
      <button class="nav-item" data-page="dashboard">
        <span class="nav-icon">🏠</span><span class="nav-label">Home</span>
      </button>
      <button class="nav-item" data-page="history">
        <span class="nav-icon">📋</span><span class="nav-label">Journal</span>
      </button>
      <button class="nav-item nav-add" data-page="quick-entry">
        <span class="nav-icon">➕</span><span class="nav-label">Add</span>
      </button>
      <button class="nav-item" data-page="settings">
        <span class="nav-icon">⚙️</span><span class="nav-label">Settings</span>
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
