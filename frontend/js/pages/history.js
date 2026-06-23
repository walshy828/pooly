/** History / Journal — timeline view with date grouping */
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
    measurement:'Water Test', chemical:'Chemical', maintenance:'Maintenance',
    observation:'Observation', note:'Note', pool_event:'Season Event',
    quick_status:'Quick Log', shock:'Shock',
  },

  _svgEdit:   `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  _svgTrash:  `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  _svgWarn:   `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#FF453A;fill:none;stroke-width:2.5;stroke-linecap:round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  _svgFilter: `<svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>`,

  async render(container) {
    this.page = 1;
    this.hasMore = true;
    this.lastDateLabel = null;

    container.innerHTML = `
      <div class="page-header flex items-center justify-between">
        <div class="page-title">Journal</div>
        <button id="filterToggleBtn" class="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors"
          style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:rgba(245,245,247,0.6)">
          ${this._svgFilter}
          <span>Filter</span>
          <span id="filterActiveDot" class="hidden absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style="background:#00C8D4"></span>
        </button>
      </div>

      <!-- Category chips -->
      <div class="cat-chips py-2 sticky z-10 top-[57px]" style="background:rgba(7,15,28,0.9);backdrop-filter:blur(16px)">
        <button class="cat-chip active" data-cat="">All</button>
        <button class="cat-chip" data-cat="measurement">Tests</button>
        <button class="cat-chip" data-cat="chemical">Chems</button>
        <button class="cat-chip" data-cat="maintenance">Care</button>
        <button class="cat-chip" data-cat="observation">Observe</button>
        <button class="cat-chip" data-cat="note">Notes</button>
        <button class="cat-chip" data-cat="pool_event">Events</button>
      </div>

      <!-- Filter Drawer -->
      <div class="drawer-overlay hidden" id="filterOverlay"></div>
      <div class="filter-drawer" id="filterDrawer" style="display:none">
        <div class="drawer-handle"></div>
        <div class="flex items-center justify-between mb-4">
          <div class="text-[16px] font-semibold text-pool-text">Filters</div>
          <button id="filterCloseBtn" class="modal-close-btn">✕</button>
        </div>

        <div class="mb-4">
          <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">Date Range</div>
          <div class="flex gap-2 flex-wrap">
            ${[['all','All Time'],['30d','30 Days'],['90d','90 Days'],['thisYear','This Year'],['custom','Custom']].map(([p,l]) =>
              `<button class="log-preset${this.filters.datePreset===p?' active':''}" data-preset="${p}">${l}</button>`).join('')}
          </div>
          <div id="customDateRange" style="display:${this.filters.datePreset==='custom'?'grid':'none'};grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
            <div>
              <label class="text-[11px] text-pool-muted block mb-1">From</label>
              <input type="date" id="filterStartDate" value="${this.filters.startDate}">
            </div>
            <div>
              <label class="text-[11px] text-pool-muted block mb-1">To</label>
              <input type="date" id="filterEndDate" value="${this.filters.endDate}">
            </div>
          </div>
        </div>

        <div class="mb-4">
          <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">Specific Event</div>
          <select id="filterSubType">
            <option value="">Any</option>
            <optgroup label="Pool Care">
              <option value="clean_cartridge"${this.filters.subType==='clean_cartridge'?' selected':''}>Filter Cleaning</option>
              <option value="backwash"${this.filters.subType==='backwash'?' selected':''}>Backwash</option>
              <option value="add_water"${this.filters.subType==='add_water'?' selected':''}>Add Water</option>
              <option value="brush_walls"${this.filters.subType==='brush_walls'?' selected':''}>Brush Walls</option>
              <option value="clean_skimmer"${this.filters.subType==='clean_skimmer'?' selected':''}>Clean Skimmer</option>
              <option value="robot_run"${this.filters.subType==='robot_run'?' selected':''}>Robot Run</option>
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

        <div class="flex gap-3">
          <button id="filterResetBtn" class="btn btn-secondary flex-1">Reset</button>
          <button id="filterApplyBtn" class="btn btn-primary flex-1">Apply</button>
        </div>
      </div>

      <div class="px-4 pt-3" id="journalList"></div>
      <div id="loadMoreArea" style="display:none;padding:16px;text-align:center">
        <button id="loadMoreBtn" class="btn btn-secondary btn-sm">Load more entries</button>
      </div>`;

    this._bindCatChips();
    this._bindFilterDrawer();
    await this.loadEntries(true);
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => this.loadEntries());
  },

  _bindCatChips() {
    document.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.entryType = chip.dataset.cat;
        this._reload();
      });
    });
  },

  _bindFilterDrawer() {
    const drawer  = document.getElementById('filterDrawer');
    const overlay = document.getElementById('filterOverlay');
    const open    = () => { drawer.style.display = 'block'; overlay.classList.remove('hidden'); };
    const close   = () => { drawer.style.display = 'none';  overlay.classList.add('hidden'); };

    document.getElementById('filterToggleBtn').addEventListener('click', open);
    document.getElementById('filterCloseBtn').addEventListener('click', close);
    overlay.addEventListener('click', close);

    document.querySelectorAll('[data-preset]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters.datePreset = chip.dataset.preset;
        document.getElementById('customDateRange').style.display = this.filters.datePreset === 'custom' ? 'grid' : 'none';
      });
    });

    document.getElementById('filterApplyBtn').addEventListener('click', () => {
      this.filters.subType   = document.getElementById('filterSubType').value;
      this.filters.startDate = document.getElementById('filterStartDate').value;
      this.filters.endDate   = document.getElementById('filterEndDate').value;
      close(); this._updateFilterDot(); this._reload();
    });

    document.getElementById('filterResetBtn').addEventListener('click', () => {
      this.filters.datePreset = 'all';
      this.filters.startDate = this.filters.endDate = this.filters.subType = '';
      document.getElementById('filterSubType').value = '';
      document.getElementById('filterStartDate').value = '';
      document.getElementById('filterEndDate').value = '';
      document.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-preset="all"]')?.classList.add('active');
      document.getElementById('customDateRange').style.display = 'none';
      close(); this._updateFilterDot(); this._reload();
    });
  },

  _updateFilterDot() {
    const active = this.filters.datePreset !== 'all' || !!this.filters.subType;
    document.getElementById('filterActiveDot')?.classList.toggle('hidden', !active);
    const btn = document.getElementById('filterToggleBtn');
    if (btn) btn.style.color = active ? '#00C8D4' : '';
  },

  _reload() {
    this.page = 1; this.hasMore = true; this.lastDateLabel = null;
    const list = document.getElementById('journalList');
    if (list) list.innerHTML = '';
    this.loadEntries(true);
  },

  async loadEntries(isInitial = false) {
    if (this.loading || !this.hasMore) return;
    this.loading = true;

    if (isInitial) {
      document.getElementById('journalList').innerHTML = `<div class="loading-center" style="padding:32px"><div class="spinner spinner-lg"></div></div>`;
    }

    try {
      const apiFilters = { entryType: this.filters.entryType, subType: this.filters.subType };
      let start = this.filters.startDate, end = this.filters.endDate;
      if (this.filters.datePreset !== 'custom') {
        const now = new Date();
        if (this.filters.datePreset === '30d')      { const d = new Date(); d.setDate(now.getDate() - 30);  start = d.toISOString(); }
        else if (this.filters.datePreset === '90d') { const d = new Date(); d.setDate(now.getDate() - 90);  start = d.toISOString(); }
        else if (this.filters.datePreset === 'thisYear') { start = new Date(now.getFullYear(), 0, 1).toISOString(); }
      }
      if (start) apiFilters.startDate = start;
      if (end)   apiFilters.endDate   = end;

      const data = await API.getJournal(this.page, 20, apiFilters);
      const list = document.getElementById('journalList');
      if (!list) return;
      if (isInitial) list.innerHTML = '';

      if (data.entries.length === 0 && isInitial) {
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div style="font-size:2.5rem">📂</div>
            <div class="text-[16px] font-semibold text-pool-text">No entries found</div>
            <div class="text-[13px] text-pool-muted">Try adjusting your filters</div>
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
    const d   = new Date(dateStr), now = new Date();
    const yest= new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())  return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    const daysAgo = Math.floor((now - d) / 86400000);
    if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    const opts = { month: 'long', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  },

  _makeDateHeader(label) {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-3 mb-2 mt-4 first:mt-0';
    el.innerHTML = `
      <span class="text-[12px] font-semibold" style="color:rgba(245,245,247,0.4);white-space:nowrap">${label}</span>
      <div style="flex:1;height:1px;background:rgba(255,255,255,0.05)"></div>`;
    return el;
  },

  _makeCard(entry) {
    const el        = document.createElement('div');
    const color     = Fmt.entryTypeColor(entry.entry_type);
    const icon      = Fmt.entryTypeIcon(entry.entry_type);
    const typeLabel = this._typeLabels[entry.entry_type] || entry.entry_type;
    const desc      = this._getDesc(entry);
    const showNotes = entry.notes && entry.notes !== desc;
    const timeStr   = this._relativeTime(entry.entry_date);
    const fullDate  = Fmt.dateTime(entry.entry_date);

    el.className = `entry-card-border-${entry.entry_type} animate-fade-in`;
    el.style.cssText = `display:flex;gap:12px;padding:14px;margin-bottom:8px;border-radius:18px;background:rgba(15,32,64,0.6);border-left-width:3px;border-top:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06)`;
    el.dataset.entryId = entry.id;

    el.innerHTML = `
      <div style="font-size:1.3rem;width:26px;text-align:center;flex-shrink:0;padding-top:1px">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:12px;font-weight:600;color:${color}">${typeLabel}</span>
          <span style="font-size:11px;color:rgba(245,245,247,0.4)" title="${fullDate}">${timeStr}</span>
        </div>
        <div style="font-size:13px;color:rgba(245,245,247,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc}</div>
        ${showNotes ? `<div style="font-size:12px;color:rgba(245,245,247,0.45);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.notes.substring(0,80)}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">
        <button data-edit="${entry.id}" title="Edit" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(245,245,247,0.45)">
          ${this._svgEdit}
        </button>
        <button data-delete="${entry.id}" title="Delete" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(245,245,247,0.45)">
          ${this._svgTrash}
        </button>
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
        el.style.opacity = '0'; el.style.transform = 'translateX(-16px)';
        setTimeout(() => {
          const header = el.previousElementSibling;
          el.remove();
          if (header && header.querySelector('span')?.textContent) {
            const next = header.nextElementSibling;
            if (!next || next.dataset.entryId === undefined) {
              // Check if next is another date header or nothing
              if (!next || next.querySelector('span')) header.remove();
            }
          }
        }, 260);
        Toast.success('Entry deleted');
      } catch (err) { Toast.error('Delete failed: ' + err.message); }
    } else {
      btn.dataset.confirmed = 'true';
      btn.style.color = '#FF453A';
      btn.innerHTML = this._svgWarn;
      btn.title = 'Tap again to confirm';
      setTimeout(() => {
        if (btn && btn.dataset.confirmed) {
          btn.dataset.confirmed = '';
          btn.style.color = '';
          btn.innerHTML = this._svgTrash;
          btn.title = 'Delete entry';
        }
      }, 3000);
    }
  },

  _relativeTime(dateStr) {
    const d = new Date(dateStr), now = new Date();
    const diff = now - d, mins = Math.floor(diff/60000), hours = Math.floor(diff/3600000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24)return `${hours}h ago`;
    return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  },

  _getDesc(entry) {
    if (entry.measurements?.length) {
      const m = entry.measurements[0];
      const parts = [];
      if (m.free_chlorine  != null) parts.push(`FC ${m.free_chlorine}`);
      if (m.total_chlorine != null) parts.push(`TC ${m.total_chlorine}`);
      if (m.ph             != null) parts.push(`pH ${m.ph}`);
      if (m.alkalinity     != null) parts.push(`Alk ${m.alkalinity}`);
      if (m.cyanuric_acid  != null) parts.push(`CYA ${m.cyanuric_acid}`);
      return parts.length ? parts.join(' · ') : 'Water quality test';
    }
    if (entry.chemical_additions?.length) {
      const c = entry.chemical_additions[0];
      return `${Fmt.chemicalLabel(c.chemical_type)}${c.amount ? ` — ${c.amount}${c.unit ? ' '+c.unit : ''}` : ''}`;
    }
    if (entry.maintenance_actions?.length) return Fmt.statusTypeLabel(entry.maintenance_actions[0].action_type);
    if (entry.observations?.length) {
      const o = entry.observations[0];
      return `Health ${o.health_score}/10${Chemistry.healthLabels[o.health_score] ? ' · '+Chemistry.healthLabels[o.health_score] : ''}`;
    }
    if (entry.entry_type === 'pool_event') return entry.notes || 'Season status updated';
    if (entry.quick_statuses?.length) return entry.quick_statuses.map(s => Fmt.statusTypeLabel(s.status_type)).join(', ');
    return entry.notes || '';
  },
};
