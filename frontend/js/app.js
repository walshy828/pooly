/** Pooly SPA — Main application router and initialization */
const App = {
  currentPage: 'dashboard',
  contentEl: null,
  authenticated: false,

  async init() {
    this.contentEl = document.getElementById('pageContent');
    if (!this.contentEl) return;

    // Check PIN requirement
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
    this.navigate('dashboard');
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
            this.navigate('dashboard');
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

  async navigate(page) {
    if (!this.authenticated && page !== 'pin') return;
    this.currentPage = page;
    this.updateNavActive();
    this.contentEl.innerHTML = '';

    // Scroll to top
    window.scrollTo(0, 0);

    switch (page) {
      case 'dashboard':
        await DashboardPage.render(this.contentEl);
        break;
      case 'quick-entry':
        QuickEntryPage.render(this.contentEl);
        break;
      case 'history':
        await HistoryPage.render(this.contentEl);
        break;
      case 'settings':
        await SettingsPage.render(this.contentEl);
        break;
      default:
        await DashboardPage.render(this.contentEl);
    }
  },
};

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
