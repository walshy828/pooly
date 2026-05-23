/** History / Journal timeline page with rich filtering */
const HistoryPage = {
  page: 1,
  loading: false,
  hasMore: true,
  filters: {
    datePreset: 'all',
    startDate: '',
    endDate: '',
    entryType: '',
    subType: '',
  },

  async render(container) {
    this.page = 1;
    this.hasMore = true;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">📋 Journal</div>
        <button class="btn btn-ghost" id="filterToggleBtn" style="font-size:var(--fs-sm)">
          <span id="filterBtnIcon">🔍</span> Filters
        </button>
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
            <div class="filter-label">Event Category</div>
            <select class="form-select" id="filterEntryType">
              <option value="">All Categories</option>
              <option value="measurement"${this.filters.entryType==='measurement'?' selected':''}>Water Tests</option>
              <option value="chemical"${this.filters.entryType==='chemical'?' selected':''}>Chemical Additions</option>
              <option value="maintenance"${this.filters.entryType==='maintenance'?' selected':''}>Pool Care / Maintenance</option>
              <option value="observation"${this.filters.entryType==='observation'?' selected':''}>Observations</option>
              <option value="pool_event"${this.filters.entryType==='pool_event'?' selected':''}>Season Events</option>
              <option value="note"${this.filters.entryType==='note'?' selected':''}>Notes</option>
            </select>
          </div>

          <div class="filter-section">
            <div class="filter-label">Specific Event / Sub-type</div>
            <select class="form-select" id="filterSubType">
              <option value="">Any Event</option>
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
            <button class="btn btn-outline btn-block" id="filterResetBtn">Reset All</button>
            <button class="btn btn-primary btn-block" id="filterApplyBtn">Apply Filters</button>
          </div>
        </div>
      </div>
      <div class="filter-overlay" id="filterOverlay"></div>

      <div class="timeline container" id="timeline"></div>
      <div id="loadMoreArea" class="loading-center" style="display:none">
        <button class="btn btn-secondary" id="loadMoreBtn">Load More</button>
      </div>`;

    this.bindFilters();
    await this.loadEntries(true);
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => this.loadEntries());
  },

  bindFilters() {
    const drawer = document.getElementById('filterDrawer');
    const overlay = document.getElementById('filterOverlay');
    const toggle = document.getElementById('filterToggleBtn');
    const close = document.getElementById('filterCloseBtn');
    const apply = document.getElementById('filterApplyBtn');
    const reset = document.getElementById('filterResetBtn');

    const openDrawer = () => { drawer.classList.add('open'); overlay.classList.add('open'); };
    const closeDrawer = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); };

    toggle.addEventListener('click', openDrawer);
    close.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    // Preset chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.datePreset = chip.dataset.preset;
        document.getElementById('customDateRange').style.display = (this.filters.datePreset === 'custom') ? 'grid' : 'none';
      });
    });

    apply.addEventListener('click', () => {
      this.filters.entryType = document.getElementById('filterEntryType').value;
      this.filters.subType = document.getElementById('filterSubType').value;
      this.filters.startDate = document.getElementById('filterStartDate').value;
      this.filters.endDate = document.getElementById('filterEndDate').value;
      
      this.page = 1;
      this.hasMore = true;
      document.getElementById('timeline').innerHTML = '';
      this.loadEntries(true);
      closeDrawer();
      this.updateFilterButtonState();
    });

    reset.addEventListener('click', () => {
      this.filters = { datePreset: 'all', startDate: '', endDate: '', entryType: '', subType: '' };
      // Reset UI
      document.getElementById('filterEntryType').value = '';
      document.getElementById('filterSubType').value = '';
      document.getElementById('filterStartDate').value = '';
      document.getElementById('filterEndDate').value = '';
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-preset="all"]').classList.add('active');
      document.getElementById('customDateRange').style.display = 'none';

      this.page = 1;
      this.hasMore = true;
      document.getElementById('timeline').innerHTML = '';
      this.loadEntries(true);
      closeDrawer();
      this.updateFilterButtonState();
    });
  },

  updateFilterButtonState() {
    const hasFilters = this.filters.datePreset !== 'all' || this.filters.entryType || this.filters.subType;
    const btn = document.getElementById('filterToggleBtn');
    if (btn) {
      btn.style.color = hasFilters ? 'var(--color-primary)' : '';
      btn.style.fontWeight = hasFilters ? 'var(--fw-bold)' : '';
      document.getElementById('filterBtnIcon').textContent = hasFilters ? '🎯' : '🔍';
    }
  },

  async loadEntries(isInitial = false) {
    if (this.loading || !this.hasMore) return;
    this.loading = true;
    
    if (isInitial) {
      document.getElementById('timeline').innerHTML = `<div class="loading-center" style="padding:var(--space-xl)"><div class="spinner"></div></div>`;
    }

    try {
      const apiFilters = {
        entryType: this.filters.entryType,
        subType: this.filters.subType,
      };

      // Calculate dates based on presets
      let start = this.filters.startDate;
      let end = this.filters.endDate;

      if (this.filters.datePreset !== 'custom') {
        const now = new Date();
        if (this.filters.datePreset === '30d') {
          const d = new Date(); d.setDate(now.getDate() - 30);
          start = d.toISOString();
        } else if (this.filters.datePreset === '90d') {
          const d = new Date(); d.setDate(now.getDate() - 90);
          start = d.toISOString();
        } else if (this.filters.datePreset === 'thisYear') {
          start = new Date(now.getFullYear(), 0, 1).toISOString();
        }
      }

      if (start) apiFilters.startDate = start;
      if (end) apiFilters.endDate = end;

      const data = await API.getJournal(this.page, 20, apiFilters);
      const timeline = document.getElementById('timeline');
      if (!timeline) return;

      if (isInitial) timeline.innerHTML = '';

      if (data.entries.length === 0 && isInitial) {
        timeline.innerHTML = `<div class="empty-state" style="padding:var(--space-2xl)">
          <div class="empty-icon">📂</div>
          <div class="empty-text">No entries found matching your filters.</div>
        </div>`;
      }

      data.entries.forEach(entry => {
        timeline.appendChild(this.createEntryElement(entry));
      });

      this.hasMore = data.entries.length === 20 && this.page * 20 < data.total;
      this.page++;
      document.getElementById('loadMoreArea').style.display = this.hasMore ? 'flex' : 'none';
    } catch (err) {
      console.error('Failed to load entries:', err);
      Toast.error('Failed to load journal');
    }
    this.loading = false;
  },

  createEntryElement(entry) {
    const el = document.createElement('div');
    el.className = 'timeline-item animate-in';
    el.dataset.entryId = entry.id;
    const desc = this.getEntryDescription(entry);
    const showNotes = entry.notes && entry.notes !== desc;
    el.innerHTML = `
      <div class="timeline-dot" style="background:${Fmt.entryTypeColor(entry.entry_type)}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${Fmt.entryTypeLabel(entry.entry_type)}</div>
        <div class="timeline-desc">${desc}</div>
        ${showNotes ? `<div class="timeline-notes" style="font-size:var(--fs-xs);color:var(--text-secondary);margin-top:4px;font-style:italic">${entry.notes}</div>` : ''}
        <div class="timeline-time">${Fmt.dateTime(entry.entry_date)}</div>
        <div class="timeline-actions" style="display:flex;gap:var(--space-sm);margin-top:var(--space-sm)">
          <button class="btn btn-ghost btn-sm" data-edit="${entry.id}" title="Edit notes">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" data-delete="${entry.id}" style="color:var(--color-danger)" title="Delete entry">🗑️ Delete</button>
        </div>
      </div>`;

    el.querySelector(`[data-edit="${entry.id}"]`).addEventListener('click', () => EditModal.open(entry.id));
    el.querySelector(`[data-delete="${entry.id}"]`).addEventListener('click', () => this.confirmDelete(entry.id, el));

    return el;
  },

  async confirmDelete(entryId, el) {
    const deleteBtn = el.querySelector(`[data-delete="${entryId}"]`);
    if (deleteBtn.dataset.confirmed === 'true') {
      try {
        await API.deleteEntry(entryId);
        el.style.opacity = '0';
        el.style.transform = 'translateX(-20px)';
        setTimeout(() => el.remove(), 300);
        Toast.success('Entry deleted');
      } catch (err) { Toast.error('Failed to delete: ' + err.message); }
    } else {
      deleteBtn.dataset.confirmed = 'true';
      deleteBtn.innerHTML = '⚠️ Confirm?';
      deleteBtn.style.color = 'var(--color-warning)';
      setTimeout(() => {
        if (deleteBtn) {
          deleteBtn.dataset.confirmed = '';
          deleteBtn.innerHTML = '🗑️ Delete';
          deleteBtn.style.color = 'var(--color-danger)';
        }
      }, 3000);
    }
  },

  getEntryDescription(entry) {
    if (entry.measurements?.length) {
      const m = entry.measurements[0];
      const parts = [];
      if (m.total_chlorine != null) parts.push(`TC: ${m.total_chlorine}`);
      if (m.free_chlorine != null) parts.push(`FC: ${m.free_chlorine}`);
      if (m.ph != null) parts.push(`pH: ${m.ph}`);
      if (m.alkalinity != null) parts.push(`Alk: ${m.alkalinity}`);
      return parts.join(' · ') || 'Water quality test';
    }
    if (entry.chemical_additions?.length) {
      const c = entry.chemical_additions[0];
      return `${Fmt.chemicalLabel(c.chemical_type)}${c.amount ? ` — ${c.amount} ${c.unit || ''}` : ''}`;
    }
    if (entry.maintenance_actions?.length) {
      const a = entry.maintenance_actions[0];
      return Fmt.statusTypeLabel(a.action_type);
    }
    if (entry.observations?.length) {
      const o = entry.observations[0];
      return `Health: ${o.health_score}/10 — ${Chemistry.healthLabels[o.health_score] || ''}`;
    }
    if (entry.entry_type === 'pool_event') {
      return entry.notes || 'Season status updated';
    }
    if (entry.quick_statuses?.length) {
      return entry.quick_statuses.map(s => Fmt.statusTypeLabel(s.status_type)).join(', ');
    }
    return entry.notes || '';
  },
};
