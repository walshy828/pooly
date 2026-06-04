/** History / Journal — modern card list with date grouping */
const HistoryPage = {
  page: 1,
  loading: false,
  hasMore: true,
  lastDateLabel: null,
  filters: {
    datePreset: 'all',
    startDate: '',
    endDate: '',
    entryType: '',
    subType: '',
  },

  _typeLabels: {
    measurement: 'Water Test', chemical: 'Chemical', maintenance: 'Maintenance',
    observation: 'Observation', note: 'Note', pool_event: 'Season Event',
    quick_status: 'Quick Log', shock: 'Shock',
  },

  _svgEdit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  _svgTrash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  _svgWarn: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  _svgFilter: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>`,

  async render(container) {
    this.page = 1;
    this.hasMore = true;
    this.lastDateLabel = null;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">Journal</div>
        <button class="jnl-filter-btn" id="filterToggleBtn" title="Date &amp; sub-type filters">
          ${this._svgFilter}
          <span class="jnl-filter-dot hidden" id="filterActiveDot"></span>
        </button>
      </div>

      <div class="journal-cat-bar" id="catBar">
        <button class="jcat-chip active" data-cat="">All</button>
        <button class="jcat-chip" data-cat="measurement">🔬 Tests</button>
        <button class="jcat-chip" data-cat="chemical">💧 Chems</button>
        <button class="jcat-chip" data-cat="maintenance">🔧 Care</button>
        <button class="jcat-chip" data-cat="observation">👁 Observe</button>
        <button class="jcat-chip" data-cat="note">📝 Notes</button>
        <button class="jcat-chip" data-cat="pool_event">📅 Events</button>
      </div>

      <div class="filter-drawer" id="filterDrawer">
        <div class="filter-drawer-header">
          <div class="filter-drawer-title">Filters</div>
          <button class="filter-close" id="filterCloseBtn">✕</button>
        </div>
        <div class="filter-drawer-content">
          <div class="filter-section">
            <div class="filter-label">Date Range</div>
            <div class="filter-chips">
              <button class="filter-chip${this.filters.datePreset==='all'?' active':''}" data-preset="all">All Time</button>
              <button class="filter-chip${this.filters.datePreset==='30d'?' active':''}" data-preset="30d">Last 30 Days</button>
              <button class="filter-chip${this.filters.datePreset==='90d'?' active':''}" data-preset="90d">Last 90 Days</button>
              <button class="filter-chip${this.filters.datePreset==='thisYear'?' active':''}" data-preset="thisYear">This Year</button>
              <button class="filter-chip${this.filters.datePreset==='custom'?' active':''}" data-preset="custom">Custom</button>
            </div>
            <div class="custom-date-range" id="customDateRange" style="display:${this.filters.datePreset==='custom'?'grid':'none'}">
              <div class="form-group">
                <label class="form-label">From</label>
                <input type="date" class="form-input" id="filterStartDate" value="${this.filters.startDate}">
              </div>
              <div class="form-group">
                <label class="form-label">To</label>
                <input type="date" class="form-input" id="filterEndDate" value="${this.filters.endDate}">
              </div>
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-label">Specific Event</div>
            <select class="form-select" id="filterSubType">
              <option value="">Any</option>
              <optgroup label="Pool Care">
                <option value="clean_cartridge"${this.filters.subType==='clean_cartridge'?' selected':''}>Filter Cleaning</option>
                <option value="backwash"${this.filters.subType==='backwash'?' selected':''}>Backwash</option>
                <option value="add_water"${this.filters.subType==='add_water'?' selected':''}>Add Water</option>
                <option value="brush_walls"${this.filters.subType==='brush_walls'?' selected':''}>Brush Walls</option>
                <option value="clean_skimmer"${this.filters.subType==='clean_skimmer'?' selected':''}>Clean Skimmer</option>
                <option value="robot_run"${this.filters.subType==='robot_run'?' selected':''}>Robot Run</option>
                <option value="vacuumed"${this.filters.subType==='vacuumed'?' selected':''}>Vacuumed</option>
                <option value="basket_emptied"${this.filters.subType==='basket_emptied'?' selected':''}>Pump Basket Emptied</option>
              </optgroup>
              <optgroup label="Chemicals">
                <option value="chlorine"${this.filters.subType==='chlorine'?' selected':''}>Chlorine</option>
                <option value="shock"${this.filters.subType==='shock'?' selected':''}>Pool Shock</option>
                <option value="ph_up"${this.filters.subType==='ph_up'?' selected':''}>pH Up</option>
                <option value="ph_down"${this.filters.subType==='ph_down'?' selected':''}>pH Down</option>
                <option value="alkalinity"${this.filters.subType==='alkalinity'?' selected':''}>Alkalinity+</option>
                <option value="cyanuric_acid"${this.filters.subType==='cyanuric_acid'?' selected':''}>Stabilizer (CYA)</option>
              </optgroup>
            </select>
          </div>

          <div class="filter-drawer-actions">
            <button class="btn btn-outline btn-block" id="filterResetBtn">Reset</button>
            <button class="btn btn-primary btn-block" id="filterApplyBtn">Apply</button>
          </div>
        </div>
      </div>
      <div class="filter-overlay" id="filterOverlay"></div>

      <div class="journal-list container" id="journalList"></div>
      <div id="loadMoreArea" style="display:none;padding:var(--space-lg) var(--space-lg) var(--space-xl);text-align:center">
        <button class="btn btn-ghost btn-sm" id="loadMoreBtn">Load more entries</button>
      </div>`;

    this._bindCatChips();
    this._bindFilterDrawer();
    await this.loadEntries(true);
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => this.loadEntries());
  },

  _bindCatChips() {
    document.getElementById('catBar').addEventListener('click', e => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      document.querySelectorAll('.jcat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.filters.entryType = chip.dataset.cat;
      this._reload();
    });
  },

  _bindFilterDrawer() {
    const drawer = document.getElementById('filterDrawer');
    const overlay = document.getElementById('filterOverlay');
    const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); };
    const close = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); };

    document.getElementById('filterToggleBtn').addEventListener('click', open);
    document.getElementById('filterCloseBtn').addEventListener('click', close);
    overlay.addEventListener('click', close);

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.datePreset = chip.dataset.preset;
        document.getElementById('customDateRange').style.display =
          this.filters.datePreset === 'custom' ? 'grid' : 'none';
      });
    });

    document.getElementById('filterApplyBtn').addEventListener('click', () => {
      this.filters.subType = document.getElementById('filterSubType').value;
      this.filters.startDate = document.getElementById('filterStartDate').value;
      this.filters.endDate = document.getElementById('filterEndDate').value;
      close();
      this._updateFilterDot();
      this._reload();
    });

    document.getElementById('filterResetBtn').addEventListener('click', () => {
      this.filters.datePreset = 'all';
      this.filters.startDate = '';
      this.filters.endDate = '';
      this.filters.subType = '';
      document.getElementById('filterSubType').value = '';
      document.getElementById('filterStartDate').value = '';
      document.getElementById('filterEndDate').value = '';
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-preset="all"]').classList.add('active');
      document.getElementById('customDateRange').style.display = 'none';
      close();
      this._updateFilterDot();
      this._reload();
    });
  },

  _updateFilterDot() {
    const hasDateFilter = this.filters.datePreset !== 'all' || this.filters.subType;
    const dot = document.getElementById('filterActiveDot');
    const btn = document.getElementById('filterToggleBtn');
    if (dot) dot.classList.toggle('hidden', !hasDateFilter);
    if (btn) btn.classList.toggle('active', hasDateFilter);
  },

  _reload() {
    this.page = 1;
    this.hasMore = true;
    this.lastDateLabel = null;
    const list = document.getElementById('journalList');
    if (list) list.innerHTML = '';
    this.loadEntries(true);
  },

  async loadEntries(isInitial = false) {
    if (this.loading || !this.hasMore) return;
    this.loading = true;

    if (isInitial) {
      document.getElementById('journalList').innerHTML =
        `<div class="loading-center" style="padding:var(--space-2xl)"><div class="spinner spinner-lg"></div></div>`;
    }

    try {
      const apiFilters = { entryType: this.filters.entryType, subType: this.filters.subType };
      let start = this.filters.startDate;
      let end = this.filters.endDate;

      if (this.filters.datePreset !== 'custom') {
        const now = new Date();
        if (this.filters.datePreset === '30d') {
          const d = new Date(); d.setDate(now.getDate() - 30); start = d.toISOString();
        } else if (this.filters.datePreset === '90d') {
          const d = new Date(); d.setDate(now.getDate() - 90); start = d.toISOString();
        } else if (this.filters.datePreset === 'thisYear') {
          start = new Date(now.getFullYear(), 0, 1).toISOString();
        }
      }
      if (start) apiFilters.startDate = start;
      if (end) apiFilters.endDate = end;

      const data = await API.getJournal(this.page, 20, apiFilters);
      const list = document.getElementById('journalList');
      if (!list) return;

      if (isInitial) list.innerHTML = '';

      if (data.entries.length === 0 && isInitial) {
        list.innerHTML = `<div class="empty-state">
          <div class="empty-icon">📂</div>
          <div class="empty-text">No entries match your filters.</div>
        </div>`;
      }

      data.entries.forEach(entry => {
        const dateLabel = this._dateLabel(entry.entry_date);
        if (dateLabel !== this.lastDateLabel) {
          list.appendChild(this._makeDateHeader(dateLabel));
          this.lastDateLabel = dateLabel;
        }
        list.appendChild(this._makeCard(entry));
      });

      this.hasMore = data.entries.length === 20 && this.page * 20 < data.total;
      this.page++;
      document.getElementById('loadMoreArea').style.display = this.hasMore ? 'block' : 'none';
    } catch (err) {
      console.error('Failed to load entries:', err);
      Toast.error('Failed to load journal');
    }
    this.loading = false;
  },

  _dateLabel(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const daysAgo = Math.floor((now - d) / 86400000);
    if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    const opts = { month: 'long', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  },

  _makeDateHeader(label) {
    const el = document.createElement('div');
    el.className = 'journal-date-header';
    el.textContent = label;
    return el;
  },

  _makeCard(entry) {
    const el = document.createElement('div');
    el.className = 'journal-card animate-in';
    el.dataset.entryId = entry.id;

    const color = Fmt.entryTypeColor(entry.entry_type);
    const icon = Fmt.entryTypeIcon(entry.entry_type);
    const typeLabel = this._typeLabels[entry.entry_type] || entry.entry_type;
    const desc = this._getDesc(entry);
    const showNotes = entry.notes && entry.notes !== desc;
    const timeStr = this._relativeTime(entry.entry_date);
    const fullDate = Fmt.dateTime(entry.entry_date);

    el.innerHTML = `
      <div class="jc-accent" style="background:${color}"></div>
      <div class="jc-icon" style="background:${color}18">${icon}</div>
      <div class="jc-body">
        <div class="jc-header">
          <span class="jc-type" style="color:${color}">${typeLabel}</span>
          <span class="jc-time" title="${fullDate}">${timeStr}</span>
        </div>
        <div class="jc-desc">${desc}</div>
        ${showNotes ? `<div class="jc-notes">${entry.notes}</div>` : ''}
      </div>
      <div class="jc-actions">
        <button class="jc-btn jc-btn-edit" data-edit="${entry.id}" title="Edit entry">${this._svgEdit}</button>
        <button class="jc-btn jc-btn-delete" data-delete="${entry.id}" title="Delete entry">${this._svgTrash}</button>
      </div>`;

    el.querySelector(`[data-edit]`).addEventListener('click', () => EditModal.open(entry.id));
    el.querySelector(`[data-delete]`).addEventListener('click', () => this._confirmDelete(entry.id, el));
    return el;
  },

  async _confirmDelete(entryId, el) {
    const btn = el.querySelector(`[data-delete="${entryId}"]`);
    if (btn.dataset.confirmed === 'true') {
      try {
        await API.deleteEntry(entryId);
        el.style.transition = 'opacity 0.25s, transform 0.25s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(-16px)';
        setTimeout(() => {
          const header = el.previousElementSibling;
          el.remove();
          // Remove orphaned date header if no more cards follow it
          if (header?.classList.contains('journal-date-header')) {
            const next = header.nextElementSibling;
            if (!next || next.classList.contains('journal-date-header')) header.remove();
          }
        }, 260);
        Toast.success('Entry deleted');
      } catch (err) { Toast.error('Delete failed: ' + err.message); }
    } else {
      btn.dataset.confirmed = 'true';
      btn.classList.add('jc-btn-confirm');
      btn.innerHTML = this._svgWarn;
      btn.title = 'Tap again to confirm delete';
      setTimeout(() => {
        if (btn && btn.dataset.confirmed) {
          btn.dataset.confirmed = '';
          btn.classList.remove('jc-btn-confirm');
          btn.innerHTML = this._svgTrash;
          btn.title = 'Delete entry';
        }
      }, 3000);
    }
  },

  _relativeTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  _getDesc(entry) {
    if (entry.measurements?.length) {
      const m = entry.measurements[0];
      const parts = [];
      if (m.free_chlorine != null) parts.push(`FC ${m.free_chlorine}`);
      if (m.total_chlorine != null) parts.push(`TC ${m.total_chlorine}`);
      if (m.ph != null) parts.push(`pH ${m.ph}`);
      if (m.alkalinity != null) parts.push(`Alk ${m.alkalinity}`);
      if (m.cyanuric_acid != null) parts.push(`CYA ${m.cyanuric_acid}`);
      return parts.length ? parts.join(' · ') : 'Water quality test';
    }
    if (entry.chemical_additions?.length) {
      const c = entry.chemical_additions[0];
      return `${Fmt.chemicalLabel(c.chemical_type)}${c.amount ? ` — ${c.amount}${c.unit ? ' ' + c.unit : ''}` : ''}`;
    }
    if (entry.maintenance_actions?.length) {
      return Fmt.statusTypeLabel(entry.maintenance_actions[0].action_type);
    }
    if (entry.observations?.length) {
      const o = entry.observations[0];
      return `Health ${o.health_score}/10${Chemistry.healthLabels[o.health_score] ? ' · ' + Chemistry.healthLabels[o.health_score] : ''}`;
    }
    if (entry.entry_type === 'pool_event') return entry.notes || 'Season status updated';
    if (entry.quick_statuses?.length) {
      return entry.quick_statuses.map(s => Fmt.statusTypeLabel(s.status_type)).join(', ');
    }
    return entry.notes || '';
  },
};
