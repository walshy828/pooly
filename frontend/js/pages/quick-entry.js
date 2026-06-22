/** Quick Entry page — tabbed interface for all pool actions */
const QuickEntryPage = {
  activeTab: 'test',
  measurementValues: {},
  lastMeasurements: {},   // last known test values, fetched on render for slider defaults
  selectedChemical: null,
  algaeLevel: 'none',
  chemForm: 'tabs',
  chemAmount: 1,
  chemUnit: '3" tabs',
  shockType: 'bottle',
  shockUnits: 1,
  healthScore: 7,
  completedStatuses: new Set(),
  panelNotes: {},
  entryDate: null,        // null = now; ISO string = backdated
  pendingReminder: null,  // { task_type, display_name } when navigated from a reminder

  tabs: [
    { id: 'test',   label: '🔬 Water Test',  name: 'Water Test' },
    { id: 'chem',   label: '💧 Chemicals',   name: 'Chemicals' },
    { id: 'maint',  label: '🔧 Pool Care',   name: 'Pool Care' },
    { id: 'status', label: '✅ Quick Check', name: 'Quick Check' },
    { id: 'note',   label: '📝 Note',        name: 'Note' },
  ],

  async render(container) {
    this.measurementValues = {};
    this.lastMeasurements = {};
    this.completedStatuses = new Set();
    this.panelNotes = {};
    this.entryDate = null;
    this.algaeLevel = 'none';
    this.poolStatus = 'open';

    try {
      const [settingsData, dashData] = await Promise.all([
        API.getSettings(),
        API.getDashboard().catch(() => null),
      ]);
      this.poolStatus = settingsData.pool_status;
      if (dashData?.chemistry) {
        dashData.chemistry.forEach(c => {
          if (c.value != null) this.lastMeasurements[c.parameter] = c.value;
        });
      }
    } catch (err) { console.error('Failed to fetch initial data', err); }

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
        this.captureState();
        this.activeTab = tab.dataset.tab;
        this.entryDate = null;  // reset date when switching tabs
        history.replaceState(null, '', `#quick-entry/${tab.dataset.tab}`);
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
      const isActive = btn.dataset.tab === this.activeTab;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  },

  renderPanel() {
    const panel = document.getElementById('entryPanel');
    if (!panel) return;
    switch (this.activeTab) {
      case 'test':   panel.innerHTML = this.renderTestPanel();   this.bindTestPanel();   break;
      case 'chem':   panel.innerHTML = this.renderChemPanel();   this.bindChemPanel();   break;
      case 'maint':  panel.innerHTML = this.renderMaintPanel();  this.bindMaintPanel();  break;
      case 'status': panel.innerHTML = this.renderStatusPanel(); this.bindStatusPanel(); break;
      case 'note':   panel.innerHTML = this.renderNotePanel();   this.bindNotePanel();   break;
    }
  },

  captureState() {
    const noteEl = document.getElementById('panelNoteText');
    if (noteEl) this.panelNotes[this.activeTab] = noteEl.value;
    const dateEl = document.getElementById('entryDateInput');
    if (dateEl) this.entryDate = this._dateInputToISO(dateEl.value);
  },

  _todayStr() {
    return new Date().toISOString().split('T')[0];
  },

  _dateInputToISO(dateStr) {
    if (!dateStr) return null;
    const today = this._todayStr();
    if (dateStr === today) return null;  // null → backend uses now
    const d = new Date(dateStr + 'T12:00:00');
    return isNaN(d) ? null : d.toISOString();
  },

  renderPendingReminderBanner() {
    if (!this.pendingReminder) return '';
    return `<div class="pending-reminder-banner" id="pendingReminderBanner">
      <span class="pr-icon">📋</span>
      <span class="pr-text">Completing: <strong>${this.pendingReminder.display_name}</strong></span>
      <button class="pr-dismiss" id="dismissReminderBanner">✕</button>
    </div>`;
  },

  bindPendingReminderBanner() {
    document.getElementById('dismissReminderBanner')?.addEventListener('click', () => {
      this.pendingReminder = null;
      document.getElementById('pendingReminderBanner')?.remove();
    });
  },

  renderDateSelector() {
    const today = this._todayStr();
    const selectedDate = this.entryDate ? new Date(this.entryDate).toISOString().split('T')[0] : today;
    const isToday = selectedDate === today;
    const displayText = isToday ? 'Today' : Fmt.shortDate ? Fmt.shortDate(selectedDate) : selectedDate;
    return `<div class="entry-date-row" id="entryDateRow">
      <span class="entry-date-icon">📅</span>
      <span class="entry-date-display" id="entryDateDisplay">${displayText}</span>
      <input type="date" class="entry-date-input" id="entryDateInput"
        value="${selectedDate}" max="${today}">
    </div>`;
  },

  bindDateSelector() {
    const input = document.getElementById('entryDateInput');
    if (!input) return;
    input.addEventListener('change', () => {
      const today = this._todayStr();
      const display = document.getElementById('entryDateDisplay');
      if (input.value === today) {
        this.entryDate = null;
        if (display) display.textContent = 'Today';
      } else {
        this.entryDate = this._dateInputToISO(input.value);
        if (display) {
          const d = new Date(input.value + 'T12:00:00');
          if (display) display.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
    });
  },

  renderNotesSection(tab) {
    const saved = this.panelNotes[tab] || '';
    return `<div class="entry-notes-section">
      <label class="entry-notes-label" for="panelNoteText">Notes <span class="entry-notes-optional">(optional)</span></label>
      <textarea class="form-textarea entry-notes-textarea" id="panelNoteText"
        placeholder="Any observations, context, or reminders..." rows="2">${saved}</textarea>
    </div>`;
  },

  // ── TEST PANEL ──────────────────────────────────────────────
  renderTestPanel() {
    let html = this.renderPendingReminderBanner();
    html += this.renderDateSelector();
    html += this.renderHealthSlider();
    html += `<div class="section-title" style="margin-bottom:var(--space-md)">Water Chemistry</div>`;
    const params = ['free_chlorine', 'total_chlorine', 'bromine', 'ph', 'alkalinity', 'cyanuric_acid'];
    params.forEach(param => { html += this.renderMeasurementSlider(param); });
    html += this.renderAlgaeSelector();
    html += this.renderNotesSection('test');
    html += `<div class="submit-area"><button class="btn btn-primary btn-block btn-lg" id="submitMeasurement">💾 Save Reading</button></div>`;
    return html;
  },

  renderAlgaeSelector() {
    const levels = [
      { id: 'none',     label: 'None',     emoji: '✓',  color: '#22c55e', desc: 'No algae visible' },
      { id: 'slight',   label: 'Slight',   emoji: '🟡', color: '#eab308', desc: 'Faint green tint' },
      { id: 'moderate', label: 'Moderate', emoji: '🟠', color: '#f97316', desc: 'Cloudy green water' },
      { id: 'heavy',    label: 'Heavy',    emoji: '🔴', color: '#ef4444', desc: 'Visibly green' },
      { id: 'swamp',    label: 'Swamp',    emoji: '🐸', color: '#16a34a', desc: 'Dark green / black' },
    ];
    const buttons = levels.map(l => {
      const isActive = this.algaeLevel === l.id;
      return `<button class="algae-btn${isActive ? ' active' : ''}" data-algae="${l.id}"
        style="${isActive ? `border-color:${l.color};background:${l.color}22;color:${l.color}` : ''}"
        title="${l.desc}">
        <span class="algae-btn-emoji">${l.emoji}</span>
        <span class="algae-btn-label">${l.label}</span>
      </button>`;
    }).join('');
    const current = levels.find(l => l.id === this.algaeLevel);
    return `<div class="algae-selector-container">
      <div class="section-title" style="margin-bottom:var(--space-sm)">Algae Observation</div>
      <div class="algae-btn-row">${buttons}</div>
      <div class="algae-current-desc" id="algaeDesc">${current ? current.desc : ''}</div>
    </div>`;
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

  renderMeasurementSlider(param) {
    const spec = Chemistry.ranges[param];
    if (!spec) return '';
    const N = spec.options.length;

    // Priority: user-set value > last measurement > not tested (-1)
    const currentVal = this.measurementValues[param];
    const lastVal = this.lastMeasurements[param];
    const initVal = currentVal ?? lastVal ?? null;
    const initIdx = initVal != null ? this._valueToSliderIdx(param, initVal) : -1;

    const isNotTested = initIdx < 0;
    const badgeColor = isNotTested ? null : spec.colors[initIdx];
    const badgeLabel = isNotTested ? 'Not Tested' : spec.colorLabels[initIdx];
    const unitStr = spec.unit ? ` ${spec.unit}` : '';
    const badgeNum = isNotTested ? '—' : `${spec.options[initIdx]}${unitStr}`;

    const gradient = this._buildTrackGradient(spec);

    // Last-value marker position on the track (0–100%)
    let lastMarkerHtml = '';
    if (lastVal != null) {
      const lastIdx = this._valueToSliderIdx(param, lastVal);
      const pct = ((lastIdx + 1) / N * 100).toFixed(1);
      lastMarkerHtml = `<div class="meas-last-marker" style="left:${pct}%"></div>`;
    }

    const lastText = lastVal != null ? `Last: ${lastVal}${unitStr}` : 'No prior reading';

    // Abbreviated tick labels (N+1 total: "Clear" + N color labels)
    const ticks = ['<span class="meas-tick meas-tick-clear">✕<br>Clear</span>'];
    spec.colorLabels.forEach((lbl, i) => {
      const short = this._abbrevLabel(lbl);
      ticks.push(`<span class="meas-tick" style="color:${spec.colors[i]}">${short}</span>`);
    });

    const idealInfo = spec.idealLow != null && spec.idealHigh != null
      ? `<div class="meas-ideal-info">✓ Ideal: ${spec.idealLow}–${spec.idealHigh}${unitStr}</div>`
      : '';

    const badgeBorderColor = badgeColor || 'rgba(255,255,255,0.06)';
    const badgeBgColor = badgeColor ? this._hexToRgba(badgeColor, 0.12) : 'rgba(0,0,0,0.25)';
    const numColor = badgeColor || 'var(--text-muted)';

    return `
<div class="meas-slider-group" data-param="${param}">
  <div class="meas-slider-header">
    <span class="meas-slider-label">${spec.label}${spec.unit ? ` <span class="meas-unit">(${spec.unit})</span>` : ''}</span>
    <span class="meas-last-text" id="lasttext-${param}">${lastText}</span>
  </div>
  <div class="meas-value-display${isNotTested ? ' not-tested' : ''}" id="badge-${param}"
       style="border-color:${badgeBorderColor};background:${badgeBgColor}">
    <span class="meas-val-number" id="valnum-${param}" style="color:${numColor}">${badgeNum}</span>
    <span class="meas-val-tag" id="vallbl-${param}" style="color:${numColor}">${badgeLabel}</span>
  </div>
  <div class="meas-slider-wrap">
    <div class="meas-track-bg" style="background:${gradient}"></div>
    ${lastMarkerHtml}
    <input type="range" class="meas-slider-input" id="slider-${param}"
      data-param="${param}" min="-1" max="${N - 1}" step="1" value="${initIdx}"
      style="--thumb-color:${badgeColor || '#555'}">
  </div>
  <div class="meas-tick-row">${ticks.join('')}</div>
  ${idealInfo}
</div>`;
  },

  _abbrevLabel(lbl) {
    return lbl
      .replace('Very Low', 'V.Low')
      .replace('Very High', 'V.High')
      .replace('Very Soft', 'V.Soft')
      .replace('Ideal Low', 'Idl-Lo')
      .replace('Ideal High', 'Idl-Hi')
      .replace('Low-Ideal', 'Lo-Idl')
      .replace('Excessive', 'Excess');
  },

  _buildTrackGradient(spec) {
    const N = spec.options.length;
    // N+1 equal slots: first slot is "not tested" (grey), rest are color bands
    const slotPct = 100 / (N + 1);
    const stops = [
      `#222 0%`,
      `#2e2e2e ${slotPct.toFixed(2)}%`,
    ];
    spec.colors.forEach((color, i) => {
      const s = ((i + 1) * slotPct).toFixed(2);
      const e = ((i + 2) * slotPct).toFixed(2);
      stops.push(`${color} ${s}%`, `${color} ${e}%`);
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  },

  _valueToSliderIdx(param, val) {
    const opts = Chemistry.ranges[param].options;
    let best = 0, bestDiff = Math.abs(val - opts[0]);
    opts.forEach((o, i) => {
      const d = Math.abs(val - o);
      if (d < bestDiff) { bestDiff = d; best = i; }
    });
    return best;
  },

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  _updateSliderBadge(param, idx) {
    const spec = Chemistry.ranges[param];
    const badge = document.getElementById(`badge-${param}`);
    const numEl = document.getElementById(`valnum-${param}`);
    const lblEl = document.getElementById(`vallbl-${param}`);
    const sliderEl = document.getElementById(`slider-${param}`);
    if (!badge || !numEl || !lblEl) return;

    const unitStr = spec.unit ? ` ${spec.unit}` : '';

    if (idx < 0) {
      badge.classList.add('not-tested');
      badge.style.borderColor = 'rgba(255,255,255,0.06)';
      badge.style.background = 'rgba(0,0,0,0.25)';
      numEl.textContent = '—';
      numEl.style.color = 'var(--text-muted)';
      lblEl.textContent = 'Not Tested';
      lblEl.style.color = 'var(--text-muted)';
      if (sliderEl) sliderEl.style.setProperty('--thumb-color', '#555');
    } else {
      const val = spec.options[idx];
      const color = spec.colors[idx];
      const label = spec.colorLabels[idx];
      badge.classList.remove('not-tested');
      badge.style.borderColor = color;
      badge.style.background = this._hexToRgba(color, 0.12);
      numEl.textContent = `${val}${unitStr}`;
      numEl.style.color = color;
      lblEl.textContent = label;
      lblEl.style.color = color;
      if (sliderEl) sliderEl.style.setProperty('--thumb-color', color);
    }
  },

  bindTestPanel() {
    this.bindDateSelector();
    this.bindPendingReminderBanner();

    // Initialize measurementValues from rendered slider positions (picks up defaults)
    document.querySelectorAll('.meas-slider-input').forEach(slider => {
      const param = slider.dataset.param;
      const spec = Chemistry.ranges[param];
      const idx = parseInt(slider.value);
      if (idx >= 0) {
        this.measurementValues[param] = spec.options[idx];
      }

      slider.addEventListener('input', () => {
        const i = parseInt(slider.value);
        if (i >= 0) {
          this.measurementValues[param] = spec.options[i];
        } else {
          delete this.measurementValues[param];
        }
        this._updateSliderBadge(param, i);
      });
    });

    const healthSlider = document.getElementById('healthSlider');
    if (healthSlider) {
      healthSlider.addEventListener('input', () => {
        this.healthScore = parseInt(healthSlider.value);
        const lbl = document.getElementById('healthLabel');
        if (lbl) lbl.textContent = `${this.healthScore}/10 — ${Chemistry.healthLabels[this.healthScore] || ''}`;
      });
    }

    // Algae level chip buttons
    const algaeLevels = [
      { id: 'none', color: '#22c55e', desc: 'No algae visible' },
      { id: 'slight', color: '#eab308', desc: 'Faint green tint' },
      { id: 'moderate', color: '#f97316', desc: 'Cloudy green water' },
      { id: 'heavy', color: '#ef4444', desc: 'Visibly green' },
      { id: 'swamp', color: '#16a34a', desc: 'Dark green / black' },
    ];
    document.querySelectorAll('.algae-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.algaeLevel = btn.dataset.algae;
        const spec = algaeLevels.find(l => l.id === this.algaeLevel);
        document.querySelectorAll('.algae-btn').forEach(b => {
          const s = algaeLevels.find(l => l.id === b.dataset.algae);
          if (b.dataset.algae === this.algaeLevel && s) {
            b.classList.add('active');
            b.style.borderColor = s.color;
            b.style.background = s.color + '22';
            b.style.color = s.color;
          } else {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.background = '';
            b.style.color = '';
          }
        });
        const descEl = document.getElementById('algaeDesc');
        if (descEl && spec) descEl.textContent = spec.desc;
      });
    });

    document.getElementById('submitMeasurement')?.addEventListener('click', () => this.submitMeasurement());
  },

  async submitMeasurement() {
    try {
      const notes = document.getElementById('panelNoteText')?.value?.trim() || null;
      const entryDate = this.entryDate;
      const hasValues = Object.keys(this.measurementValues).length > 0;
      if (hasValues) {
        await API.addMeasurement({
          ...this.measurementValues,
          algae_level: this.algaeLevel || 'none',
          ...(notes ? { notes } : {}),
          ...(entryDate ? { entry_date: entryDate } : {}),
        });
      }
      await API.addObservation({
        health_score: this.healthScore,
        ...(notes ? { notes } : {}),
        ...(entryDate ? { entry_date: entryDate } : {}),
      });

      const reminderName = this.pendingReminder?.display_name;
      this.pendingReminder = null;
      this.measurementValues = {};
      this.panelNotes.test = '';
      this.entryDate = null;

      if (reminderName) {
        Toast.success(`${reminderName} logged! ✅`);
        App.navigate('dashboard');
      } else {
        Toast.success('Reading saved! 🎉');
        this.renderPanel();
      }
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

    const notesSection = this.selectedChemical ? this.renderNotesSection('chem') : '';
    const submitBtn = this.selectedChemical
      ? `${notesSection}<button class="btn btn-primary btn-block" id="submitChem">💧 Log Chemicals</button>`
      : '';

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

    const banner = this.renderPendingReminderBanner();
    const dateRow = this.renderDateSelector();
    return `${banner}${dateRow}
      <div class="section-title">Add Chemicals</div>
      <div class="chemical-type-grid">${types}</div>
      ${formHtml}${submitBtn}
      ${shockHtml}`;
  },

  bindChemPanel() {
    this.bindDateSelector();
    this.bindPendingReminderBanner();

    document.querySelectorAll('.chem-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.captureState();
        this.selectedChemical = btn.dataset.chem;
        this.chemAmount = 1;
        this.renderPanel();
      });
    });

    document.querySelectorAll('.toggle-btn[data-form]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.captureState();
        this.chemForm = btn.dataset.form;
        this.chemUnit = this.chemForm === 'tabs' ? '3" tabs' : 'oz';
        this.chemAmount = 1;
        this.renderPanel();
      });
    });

    document.querySelectorAll('.toggle-btn[data-shock]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.captureState();
        this.shockType = btn.dataset.shock;
        this.renderPanel();
      });
    });

    this.bindStepper('chemMinus', 'chemPlus', 'chemAmountDisplay',
      v => this.chemAmount = v, () => this.chemAmount,
      this.selectedChemical === 'chlorine' && this.chemForm === 'tabs' ? 1 : 0.5);
    this.bindStepper('shockMinus', 'shockPlus', 'shockAmountDisplay',
      v => this.shockUnits = v, () => this.shockUnits, 1);

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
      const notes = document.getElementById('panelNoteText')?.value?.trim() || null;
      const entryDate = this.entryDate;
      const unit = this.selectedChemical === 'chlorine'
        ? (this.chemForm === 'tabs' ? '3" tabs' : 'oz')
        : (document.getElementById('chemUnitSelect')?.value || 'oz');
      await API.addChemical({
        chemical_type: this.selectedChemical,
        form: this.selectedChemical === 'chlorine' ? this.chemForm : null,
        amount: this.chemAmount,
        unit,
        ...(notes ? { notes } : {}),
        ...(entryDate ? { entry_date: entryDate } : {}),
      });

      const reminderName = this.pendingReminder?.display_name;
      const chemLabel = Fmt.chemicalLabel(this.selectedChemical);
      this.pendingReminder = null;
      this.selectedChemical = null;
      this.chemAmount = 1;
      this.panelNotes.chem = '';
      this.entryDate = null;

      if (reminderName) {
        Toast.success(`${reminderName} logged! ✅`);
        App.navigate('dashboard');
      } else {
        Toast.success(`${chemLabel} logged! 💧`);
        this.renderPanel();
      }
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  async submitShock() {
    try {
      const entryDate = this.entryDate;
      await API.addShock({
        shock_type: this.shockType,
        units: this.shockUnits,
        ...(entryDate ? { entry_date: entryDate } : {}),
      });

      const reminderName = this.pendingReminder?.display_name;
      this.pendingReminder = null;
      this.shockUnits = 1;
      this.entryDate = null;

      if (reminderName) {
        Toast.success(`${reminderName} logged! ✅`);
        App.navigate('dashboard');
      } else {
        Toast.success('Pool shock logged! ⚡');
        this.renderPanel();
      }
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  // ── MAINTENANCE PANEL ───────────────────────────────────────
  renderMaintPanel() {
    const actions = [
      { type: 'clean_cartridge', icon: '🔧', label: 'Clean Filter Cartridge' },
      { type: 'add_water',       icon: '💧', label: 'Add Water' },
      { type: 'backwash',        icon: '♻️', label: 'Backwash Filter' },
      { type: 'brush_walls',     icon: '🖌️', label: 'Brush Walls' },
    ];
    const btns = actions.map(a => `<button class="quick-status-btn" data-action="${a.type}">
      <span class="qs-icon">${a.icon}</span><span class="qs-label">${a.label}</span></button>`).join('');
    return `${this.renderPendingReminderBanner()}
      ${this.renderDateSelector()}
      <div class="section-title">Log Pool Care</div>
      <div class="quick-status-grid">${btns}</div>
      <div class="entry-notes-divider"></div>
      ${this.renderNotesSection('maint')}
      <button class="btn btn-secondary btn-block" id="submitMaintNote">📝 Save Note</button>`;
  },

  bindMaintPanel() {
    this.bindDateSelector();
    this.bindPendingReminderBanner();

    document.querySelectorAll('.quick-status-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const entryDate = this.entryDate;
          await API.addMaintenance({
            action_type: btn.dataset.action,
            ...(entryDate ? { entry_date: entryDate } : {}),
          });
          btn.classList.add('qs-done');
          Toast.success(`${btn.querySelector('.qs-label').textContent} logged! ✅`);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });

    document.getElementById('submitMaintNote')?.addEventListener('click', async () => {
      const text = document.getElementById('panelNoteText')?.value?.trim();
      if (!text) { Toast.info('Enter a note first'); return; }
      try {
        const entryDate = this.entryDate;
        await API.addNote(text, entryDate);
        Toast.success('Note saved! 📝');
        document.getElementById('panelNoteText').value = '';
        this.panelNotes.maint = '';
      } catch (err) { Toast.error('Failed: ' + err.message); }
    });
  },

  // ── QUICK STATUS PANEL ──────────────────────────────────────
  renderStatusPanel() {
    const btns = Chemistry.quickStatuses.map(s => {
      const done = this.completedStatuses.has(s.type) ? ' qs-done' : '';
      return `<button class="quick-status-btn${done}" data-status="${s.type}">
        <span class="qs-icon">${s.icon}</span><span class="qs-label">${s.label}</span></button>`;
    }).join('');
    return `${this.renderDateSelector()}
      <div class="section-title">Quick Check</div>
      <div class="quick-status-grid">${btns}</div>
      <div class="entry-notes-divider"></div>
      ${this.renderNotesSection('status')}
      <button class="btn btn-secondary btn-block" id="submitStatusNote">📝 Save Note</button>`;
  },

  bindStatusPanel() {
    this.bindDateSelector();

    document.querySelectorAll('.quick-status-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const entryDate = this.entryDate;
          await API.addQuickStatus({
            status_type: btn.dataset.status,
            ...(entryDate ? { entry_date: entryDate } : {}),
          });
          this.completedStatuses.add(btn.dataset.status);
          btn.classList.add('qs-done');
          Toast.success(`${btn.querySelector('.qs-label').textContent} logged! ✅`);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });

    document.getElementById('submitStatusNote')?.addEventListener('click', async () => {
      const text = document.getElementById('panelNoteText')?.value?.trim();
      if (!text) { Toast.info('Enter a note first'); return; }
      try {
        const entryDate = this.entryDate;
        await API.addNote(text, entryDate);
        Toast.success('Note saved! 📝');
        document.getElementById('panelNoteText').value = '';
        this.panelNotes.status = '';
      } catch (err) { Toast.error('Failed: ' + err.message); }
    });
  },

  // ── NOTE PANEL ──────────────────────────────────────────────
  renderNotePanel() {
    return `${this.renderDateSelector()}
      <div class="section-title">Quick Note</div>
      <div class="form-group">
        <textarea class="form-textarea" id="noteText" placeholder="What's going on with the pool?" rows="6"></textarea>
      </div>
      <button class="btn btn-primary btn-block" id="submitNote">📝 Save Note</button>`;
  },

  bindNotePanel() {
    this.bindDateSelector();

    document.getElementById('submitNote')?.addEventListener('click', async () => {
      const text = document.getElementById('noteText')?.value?.trim();
      if (!text) { Toast.info('Please enter a note'); return; }
      try {
        await API.addNote(text, this.entryDate);
        Toast.success('Note saved! 📝');
        document.getElementById('noteText').value = '';
        this.entryDate = null;
        this.renderPanel();
      } catch (err) { Toast.error('Failed: ' + err.message); }
    });
  },
};
