/** Quick Entry page — tabbed interface for all pool actions */
const QuickEntryPage = {
  activeTab: 'test',
  measurementValues: {},
  selectedChemical: null,
  chemForm: 'tabs',
  chemAmount: 1,
  chemUnit: '3" tabs',
  shockType: 'bottle',
  shockUnits: 1,
  healthScore: 7,
  completedStatuses: new Set(),

  tabs: [
    { id: 'test', label: '🔬 Water Test', name: 'Water Test' },
    { id: 'chem', label: '💧 Chemicals', name: 'Chemicals' },
    { id: 'maint', label: '🔧 Pool Care', name: 'Pool Care' },
    { id: 'status', label: '✅ Quick Check', name: 'Quick Check' },
    { id: 'note', label: '📝 Note', name: 'Note' },
  ],

  async render(container) {
    this.measurementValues = {};
    this.completedStatuses = new Set();
    this.poolStatus = 'open';

    try {
      const data = await API.getSettings();
      this.poolStatus = data.pool_status;
    } catch (err) { console.error('Failed to fetch pool status', err); }

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">➕ Quick Entry</div>
      </div>
      <div class="quick-entry-tabs">
        <div class="tab-bar" id="entryTabs">
          ${this.tabs.map(t => {
            const isDisabled = this.poolStatus === 'closed' && ['chem', 'maint', 'status'].includes(t.id);
            return `<button class="tab-item${t.id === this.activeTab ? ' active' : ''}" 
                            data-tab="${t.id}" ${isDisabled ? 'disabled' : ''}
                            title="${isDisabled ? 'Pool is closed' : ''}">${t.label}</button>`;
          }).join('')}
        </div>
      </div>
      ${this.poolStatus === 'closed' ? `
        <div class="alert alert-info container" style="margin-top:var(--space-md); border-radius:var(--radius-md)">
          ❄️ <strong>Pool is Closed.</strong> Chemical additions and care tasks are disabled until the pool is opened for the season.
        </div>
      ` : ''}
      <div id="entryPanel" class="entry-panel container"></div>`;

    document.getElementById('entryTabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab && !tab.disabled) { 
        this.activeTab = tab.dataset.tab; 
        this.renderPanel(); 
        this.updateTabs(); 
      }
    });

    if (this.poolStatus === 'closed' && ['chem', 'maint', 'status'].includes(this.activeTab)) {
      this.activeTab = 'test';
    }

    this.renderPanel();
  },

  updateTabs() {
    document.querySelectorAll('#entryTabs .tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    });
  },

  renderPanel() {
    const panel = document.getElementById('entryPanel');
    if (!panel) return;
    switch (this.activeTab) {
      case 'test': panel.innerHTML = this.renderTestPanel(); this.bindTestPanel(); break;
      case 'chem': panel.innerHTML = this.renderChemPanel(); this.bindChemPanel(); break;
      case 'maint': panel.innerHTML = this.renderMaintPanel(); this.bindMaintPanel(); break;
      case 'status': panel.innerHTML = this.renderStatusPanel(); this.bindStatusPanel(); break;
      case 'note': panel.innerHTML = this.renderNotePanel(); this.bindNotePanel(); break;
    }
  },

  // ── TEST PANEL ──────────────────────────────────────────────
  renderTestPanel() {
    let html = this.renderHealthSlider();
    const params = ['total_chlorine', 'free_chlorine', 'bromine', 'alkalinity', 'cyanuric_acid', 'ph'];
    params.forEach(param => { html += this.renderMeasurementGroup(param); });
    html += `<div class="submit-area"><button class="btn btn-primary btn-block btn-lg" id="submitMeasurement">💾 Save Reading</button></div>`;
    return html;
  },

  renderHealthSlider() {
    const label = Chemistry.healthLabels[this.healthScore] || '';
    return `<div class="health-slider-container">
      <div class="section-title">Pool Health</div>
      <div class="health-slider-labels">
        <span class="health-label-end">🐸</span>
        <span class="health-label-end">🌊</span>
      </div>
      <div class="health-slider-track">
        <div class="health-slider-bg"></div>
        <input type="range" min="1" max="10" value="${this.healthScore}" class="health-slider-input" id="healthSlider">
      </div>
      <div class="health-current-label" id="healthLabel">${this.healthScore}/10 — ${label}</div>
    </div>`;
  },

  renderMeasurementGroup(param) {
    const spec = Chemistry.ranges[param];
    if (!spec) return '';
    const selected = this.measurementValues[param];
    const chips = spec.options.map((val, i) => {
      const bg = spec.colors[i];
      const sel = selected === val ? ' selected' : '';
      return `<button class="meas-chip${sel}" data-param="${param}" data-value="${val}" style="background:${bg};--chip-glow:${bg}">${val}</button>`;
    }).join('');
    const selDisplay = selected != null ? `Selected: ${selected}${spec.unit ? ' ' + spec.unit : ''}` : '';
    // Green zone ideal range indicator
    const idealBar = this.renderIdealRangeBar(spec);
    return `<div class="measurement-group">
      <div class="measurement-label">${spec.label} <span class="measurement-unit">${spec.unit}</span></div>
      <div class="measurement-chips">${chips}</div>
      ${idealBar}
      <div class="selected-value-display" id="sel-${param}">${selDisplay}</div>
    </div>`;
  },

  renderIdealRangeBar(spec) {
    if (!spec.idealLow || !spec.idealHigh) return '';
    const min = spec.options[0];
    const max = spec.options[spec.options.length - 1];
    const range = max - min;
    if (range <= 0) return '';
    const leftPct = ((spec.idealLow - min) / range * 100).toFixed(1);
    const widthPct = ((spec.idealHigh - spec.idealLow) / range * 100).toFixed(1);
    return `<div class="ideal-range-bar">
      <div class="ideal-range-fill" style="left:${leftPct}%;width:${widthPct}%"></div>
      <div class="ideal-range-label">
        <span>${min}</span>
        <span style="position:relative"><span class="ideal-tag" style="left:0">✓ Ideal: ${spec.idealLow}–${spec.idealHigh}${spec.unit ? ' '+spec.unit : ''}</span></span>
        <span>${max}</span>
      </div>
    </div>`;
  },

  bindTestPanel() {
    document.querySelectorAll('.meas-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const param = chip.dataset.param;
        const val = parseFloat(chip.dataset.value);
        if (this.measurementValues[param] === val) { delete this.measurementValues[param]; }
        else { this.measurementValues[param] = val; }
        document.querySelectorAll(`.meas-chip[data-param="${param}"]`).forEach(c => c.classList.remove('selected'));
        if (this.measurementValues[param] != null) chip.classList.add('selected');
        const spec = Chemistry.ranges[param];
        const el = document.getElementById(`sel-${param}`);
        if (el) el.textContent = this.measurementValues[param] != null ? `Selected: ${this.measurementValues[param]}${spec.unit ? ' ' + spec.unit : ''}` : '';
      });
    });

    const slider = document.getElementById('healthSlider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.healthScore = parseInt(slider.value);
        const lbl = document.getElementById('healthLabel');
        if (lbl) lbl.textContent = `${this.healthScore}/10 — ${Chemistry.healthLabels[this.healthScore] || ''}`;
      });
    }

    document.getElementById('submitMeasurement')?.addEventListener('click', () => this.submitMeasurement());
  },

  async submitMeasurement() {
    try {
      const hasValues = Object.keys(this.measurementValues).length > 0;
      if (hasValues) {
        await API.addMeasurement(this.measurementValues);
      }
      await API.addObservation({ health_score: this.healthScore });
      Toast.success('Reading saved! 🎉');
      this.measurementValues = {};
      this.renderPanel();
    } catch (err) { Toast.error('Failed to save: ' + err.message); }
  },

  // ── CHEMICAL PANEL ──────────────────────────────────────────
  renderChemPanel() {
    const types = Chemistry.chemicals.map(c => {
      const sel = this.selectedChemical === c.type ? ' selected' : '';
      return `<button class="chem-type-btn${sel}" data-chem="${c.type}">
        <span class="chem-type-icon">${c.icon}</span>${c.label}</button>`;
    }).join('');

    let formHtml = '';
    if (this.selectedChemical === 'chlorine') {
      formHtml = `<div class="form-group"><div class="form-label">Form</div>
        <div class="chlorine-form-toggle">
          <button class="toggle-btn${this.chemForm === 'tabs' ? ' active' : ''}" data-form="tabs">3" Tabs</button>
          <button class="toggle-btn${this.chemForm === 'granular' ? ' active' : ''}" data-form="granular">Granular</button>
        </div></div>
        <div class="form-group"><div class="form-label">${this.chemForm === 'tabs' ? 'Number of Tabs' : 'Amount (oz)'}</div>
        <div class="amount-stepper">
          <button class="stepper-btn" id="chemMinus">−</button>
          <div class="stepper-value" id="chemAmountDisplay">${this.chemAmount}</div>
          <button class="stepper-btn" id="chemPlus">+</button>
        </div></div>`;
    } else if (this.selectedChemical) {
      formHtml = `<div class="form-group"><div class="form-label">Amount</div>
        <div class="amount-stepper">
          <button class="stepper-btn" id="chemMinus">−</button>
          <div class="stepper-value" id="chemAmountDisplay">${this.chemAmount}</div>
          <button class="stepper-btn" id="chemPlus">+</button>
        </div></div>
        <div class="form-group"><div class="form-label">Unit</div>
        <select class="form-select" id="chemUnitSelect">
          <option value="oz">Ounces (oz)</option><option value="lbs">Pounds (lbs)</option>
          <option value="cups">Cups</option><option value="gallons">Gallons</option>
        </select></div>`;
    }

    // Shock section
    const shockHtml = `<div class="section-title" style="margin-top:var(--space-xl)">Pool Shock</div>
      <div class="chlorine-form-toggle" style="margin-bottom:var(--space-md)">
        <button class="toggle-btn${this.shockType === 'bottle' ? ' active' : ''}" data-shock="bottle">🧴 Bottle</button>
        <button class="toggle-btn${this.shockType === 'granular' ? ' active' : ''}" data-shock="granular">🧂 Granular</button>
      </div>
      <div class="form-group"><div class="form-label">Number of ${this.shockType === 'bottle' ? 'Bottles' : 'Bags'}</div>
      <div class="amount-stepper">
        <button class="stepper-btn" id="shockMinus">−</button>
        <div class="stepper-value" id="shockAmountDisplay">${this.shockUnits}</div>
        <button class="stepper-btn" id="shockPlus">+</button>
      </div></div>
      <button class="btn btn-secondary btn-block" id="submitShock">⚡ Log Shock</button>`;

    return `<div class="section-title">Add Chemicals</div>
      <div class="chemical-type-grid">${types}</div>
      ${formHtml}
      ${this.selectedChemical ? `<button class="btn btn-primary btn-block" id="submitChem">💧 Log Chemicals</button>` : ''}
      ${shockHtml}`;
  },

  bindChemPanel() {
    document.querySelectorAll('.chem-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedChemical = btn.dataset.chem;
        this.chemAmount = 1;
        this.renderPanel();
      });
    });

    document.querySelectorAll('.toggle-btn[data-form]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.chemForm = btn.dataset.form;
        this.chemUnit = this.chemForm === 'tabs' ? '3" tabs' : 'oz';
        this.chemAmount = 1;
        this.renderPanel();
      });
    });

    document.querySelectorAll('.toggle-btn[data-shock]').forEach(btn => {
      btn.addEventListener('click', () => { this.shockType = btn.dataset.shock; this.renderPanel(); });
    });

    this.bindStepper('chemMinus', 'chemPlus', 'chemAmountDisplay', v => this.chemAmount = v, () => this.chemAmount, this.selectedChemical === 'chlorine' && this.chemForm === 'tabs' ? 1 : 0.5);
    this.bindStepper('shockMinus', 'shockPlus', 'shockAmountDisplay', v => this.shockUnits = v, () => this.shockUnits, 1);

    document.getElementById('submitChem')?.addEventListener('click', () => this.submitChemical());
    document.getElementById('submitShock')?.addEventListener('click', () => this.submitShock());
  },

  bindStepper(minusId, plusId, displayId, setter, getter, step = 1) {
    document.getElementById(minusId)?.addEventListener('click', () => {
      const v = Math.max(step, getter() - step);
      setter(v);
      const el = document.getElementById(displayId);
      if (el) el.textContent = v;
    });
    document.getElementById(plusId)?.addEventListener('click', () => {
      const v = getter() + step;
      setter(v);
      const el = document.getElementById(displayId);
      if (el) el.textContent = v;
    });
  },

  async submitChemical() {
    if (!this.selectedChemical) return;
    try {
      const unit = this.selectedChemical === 'chlorine' ? (this.chemForm === 'tabs' ? '3" tabs' : 'oz') : (document.getElementById('chemUnitSelect')?.value || 'oz');
      await API.addChemical({
        chemical_type: this.selectedChemical,
        form: this.selectedChemical === 'chlorine' ? this.chemForm : null,
        amount: this.chemAmount, unit,
      });
      Toast.success(`${Fmt.chemicalLabel(this.selectedChemical)} logged! 💧`);
      this.selectedChemical = null; this.chemAmount = 1;
      this.renderPanel();
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  async submitShock() {
    try {
      await API.addShock({ shock_type: this.shockType, units: this.shockUnits });
      Toast.success('Pool shock logged! ⚡');
      this.shockUnits = 1; this.renderPanel();
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  // ── MAINTENANCE PANEL ───────────────────────────────────────
  renderMaintPanel() {
    const actions = [
      { type: 'clean_cartridge', icon: '🔧', label: 'Clean Filter Cartridge' },
      { type: 'add_water', icon: '💧', label: 'Add Water' },
      { type: 'backwash', icon: '♻️', label: 'Backwash Filter' },
      { type: 'brush_walls', icon: '🖌️', label: 'Brush Walls' },
    ];
    const btns = actions.map(a => `<button class="quick-status-btn" data-action="${a.type}">
      <span class="qs-icon">${a.icon}</span><span class="qs-label">${a.label}</span></button>`).join('');
    return `<div class="section-title">Log Pool Care</div>
      <div class="quick-status-grid">${btns}</div>`;
  },

  bindMaintPanel() {
    document.querySelectorAll('.quick-status-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.addMaintenance({ action_type: btn.dataset.action });
          btn.classList.add('qs-done');
          Toast.success(`${btn.querySelector('.qs-label').textContent} logged! ✅`);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });
  },

  // ── QUICK STATUS PANEL ──────────────────────────────────────
  renderStatusPanel() {
    const btns = Chemistry.quickStatuses.map(s => {
      const done = this.completedStatuses.has(s.type) ? ' qs-done' : '';
      return `<button class="quick-status-btn${done}" data-status="${s.type}">
        <span class="qs-icon">${s.icon}</span><span class="qs-label">${s.label}</span></button>`;
    }).join('');
    return `<div class="section-title">Quick Check</div>
      <div class="quick-status-grid">${btns}</div>`;
  },

  bindStatusPanel() {
    document.querySelectorAll('.quick-status-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.addQuickStatus({ status_type: btn.dataset.status });
          this.completedStatuses.add(btn.dataset.status);
          btn.classList.add('qs-done');
          Toast.success(`${btn.querySelector('.qs-label').textContent} logged! ✅`);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });
  },

  // ── NOTE PANEL ──────────────────────────────────────────────
  renderNotePanel() {
    return `<div class="section-title">Quick Note</div>
      <div class="form-group">
        <textarea class="form-textarea" id="noteText" placeholder="What's going on with the pool?" rows="5"></textarea>
      </div>
      <button class="btn btn-primary btn-block" id="submitNote">📝 Save Note</button>`;
  },

  bindNotePanel() {
    document.getElementById('submitNote')?.addEventListener('click', async () => {
      const text = document.getElementById('noteText')?.value?.trim();
      if (!text) { Toast.info('Please enter a note'); return; }
      try {
        await API.addNote(text);
        Toast.success('Note saved! 📝');
        document.getElementById('noteText').value = '';
      } catch (err) { Toast.error('Failed: ' + err.message); }
    });
  },
};
