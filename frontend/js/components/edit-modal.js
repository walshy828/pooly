/** Edit Modal — type-aware edit interface for journal entries */
const EditModal = {
  editValues: {},
  editHealthScore: 7,

  async open(entryId) {
    try {
      const entry = await API.getEntry(entryId);
      this.show(entry);
    } catch (err) {
      Toast.error('Could not load entry');
    }
  },

  show(entry) {
    this.editValues = {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'editModalOverlay';

    const typeLabel = Fmt.entryTypeLabel(entry.entry_type);
    let bodyHTML = '';
    switch (entry.entry_type) {
      case 'measurement':  bodyHTML = this.renderMeasurementEdit(entry);  break;
      case 'observation':  bodyHTML = this.renderObservationEdit(entry);  break;
      default:             bodyHTML = this.renderNotesEdit(entry);         break;
    }

    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <div class="modal-title" style="margin-bottom:0">${typeLabel}</div>
          <button class="modal-close-btn" id="editModalClose">✕</button>
        </div>
        <div id="editModalBody">${bodyHTML}</div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-secondary" id="editCancel" style="flex:1">Cancel</button>
          <button class="btn btn-primary" id="editSave" style="flex:1">Save Changes</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    document.getElementById('editModalClose').addEventListener('click', () => this.close());
    document.getElementById('editCancel').addEventListener('click', () => this.close());
    document.getElementById('editSave').addEventListener('click', () => this.save(entry));

    if (entry.entry_type === 'measurement') this.bindMeasurementEdit(entry);
    if (entry.entry_type === 'observation') this.bindObservationEdit(entry);
  },

  close() {
    const overlay = document.getElementById('editModalOverlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => overlay.remove(), 200);
    }
  },

  // ── MEASUREMENT EDIT ───────────────────────────
  renderMeasurementEdit(entry) {
    const m   = entry.measurements?.[0] || {};
    const obs = entry.observations?.[0];
    const params = ['total_chlorine', 'free_chlorine', 'bromine', 'alkalinity', 'cyanuric_acid', 'ph'];

    params.forEach(p => { if (m[p] != null) this.editValues[p] = m[p]; });
    if (obs) this.editHealthScore = obs.health_score || 7;

    let html = '';

    if (obs) {
      const label = Chemistry.healthLabels[this.editHealthScore] || '';
      html += `
        <div class="health-slider-container">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(245,245,247,0.4);margin-bottom:12px">Pool Health</div>
          <div class="health-slider-track">
            <div class="health-slider-bg"></div>
            <input type="range" min="1" max="10" value="${this.editHealthScore}" class="health-slider-input" id="editHealthSlider">
          </div>
          <div class="health-current-label" id="editHealthLabel">${this.editHealthScore}/10 — ${label}</div>
        </div>`;
    }

    params.forEach(param => {
      const spec = Chemistry.ranges[param];
      if (!spec) return;
      const selected = this.editValues[param];
      const chips = spec.options.map((val, i) => {
        const bg  = spec.colors[i];
        const sel = selected === val ? ' selected' : '';
        return `<button class="meas-chip${sel}" data-param="${param}" data-value="${val}" style="background:${bg}">${val}</button>`;
      }).join('');

      let idealBar = '';
      if (spec.idealLow && spec.idealHigh) {
        const min = spec.options[0], max = spec.options[spec.options.length - 1];
        const range = max - min;
        if (range > 0) {
          const leftPct  = ((spec.idealLow  - min) / range * 100).toFixed(1);
          const widthPct = ((spec.idealHigh - spec.idealLow) / range * 100).toFixed(1);
          idealBar = `
            <div class="ideal-range-bar">
              <div class="ideal-range-fill" style="left:${leftPct}%;width:${widthPct}%"></div>
              <div class="ideal-range-label">
                <span>${min}</span>
                <span style="position:relative"><span class="ideal-tag" style="left:0">✓ ${spec.idealLow}–${spec.idealHigh}</span></span>
                <span>${max}</span>
              </div>
            </div>`;
        }
      }

      const selDisplay = selected != null ? `Selected: ${selected}${spec.unit ? ' ' + spec.unit : ''}` : '';
      html += `
        <div class="measurement-group">
          <div class="measurement-label">${spec.label} <span class="measurement-unit">${spec.unit}</span></div>
          <div class="measurement-chips">${chips}</div>
          ${idealBar}
          <div class="selected-value-display" id="edit-sel-${param}">${selDisplay}</div>
        </div>`;
    });

    html += `
      <div style="margin-top:4px">
        <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Notes</div>
        <textarea id="editNotes" rows="2">${entry.notes || ''}</textarea>
      </div>`;

    return html;
  },

  bindMeasurementEdit(entry) {
    document.querySelectorAll('#editModalOverlay .meas-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const param = chip.dataset.param;
        const val   = parseFloat(chip.dataset.value);
        if (this.editValues[param] === val) delete this.editValues[param];
        else this.editValues[param] = val;

        document.querySelectorAll(`#editModalOverlay .meas-chip[data-param="${param}"]`).forEach(c => c.classList.remove('selected'));
        if (this.editValues[param] != null) chip.classList.add('selected');

        const spec = Chemistry.ranges[param];
        const el   = document.getElementById(`edit-sel-${param}`);
        if (el) el.textContent = this.editValues[param] != null
          ? `Selected: ${this.editValues[param]}${spec.unit ? ' ' + spec.unit : ''}` : '';
      });
    });

    const slider = document.getElementById('editHealthSlider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.editHealthScore = parseInt(slider.value);
        const lbl = document.getElementById('editHealthLabel');
        if (lbl) lbl.textContent = `${this.editHealthScore}/10 — ${Chemistry.healthLabels[this.editHealthScore] || ''}`;
      });
    }
  },

  // ── OBSERVATION EDIT ───────────────────────────
  renderObservationEdit(entry) {
    const obs = entry.observations?.[0];
    this.editHealthScore = obs?.health_score || 7;
    const label = Chemistry.healthLabels[this.editHealthScore] || '';
    return `
      <div class="health-slider-container">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(245,245,247,0.4);margin-bottom:12px">Pool Health</div>
        <div class="health-slider-track">
          <div class="health-slider-bg"></div>
          <input type="range" min="1" max="10" value="${this.editHealthScore}" class="health-slider-input" id="editHealthSlider">
        </div>
        <div class="health-current-label" id="editHealthLabel">${this.editHealthScore}/10 — ${label}</div>
      </div>
      <div style="margin-top:4px">
        <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Notes</div>
        <textarea id="editNotes" rows="2">${entry.notes || ''}</textarea>
      </div>`;
  },

  bindObservationEdit() {
    const slider = document.getElementById('editHealthSlider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.editHealthScore = parseInt(slider.value);
        const lbl = document.getElementById('editHealthLabel');
        if (lbl) lbl.textContent = `${this.editHealthScore}/10 — ${Chemistry.healthLabels[this.editHealthScore] || ''}`;
      });
    }
  },

  // ── GENERIC NOTES EDIT ─────────────────────────
  renderNotesEdit(entry) {
    let summaryHtml = '';
    if (entry.chemical_additions?.length) {
      const c = entry.chemical_additions[0];
      summaryHtml = `
        <div style="padding:10px 14px;margin-bottom:14px;border-radius:14px;background:rgba(169,156,245,0.08);border:1px solid rgba(169,156,245,0.15)">
          <div style="font-size:13px;color:rgba(245,245,247,0.7)">${Fmt.chemicalLabel(c.chemical_type)}${c.amount ? ` — ${c.amount} ${c.unit || ''}` : ''}</div>
        </div>`;
    }
    if (entry.maintenance_actions?.length) {
      summaryHtml = `
        <div style="padding:10px 14px;margin-bottom:14px;border-radius:14px;background:rgba(48,209,88,0.07);border:1px solid rgba(48,209,88,0.15)">
          <div style="font-size:13px;color:rgba(245,245,247,0.7)">${Fmt.statusTypeLabel(entry.maintenance_actions[0].action_type)}</div>
        </div>`;
    }
    return `${summaryHtml}
      <div>
        <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Notes</div>
        <textarea id="editNotes" rows="3">${entry.notes || ''}</textarea>
      </div>`;
  },

  // ── SAVE ──────────────────────────────────────
  async save(entry) {
    const payload = {};
    const notesEl = document.getElementById('editNotes');
    if (notesEl) payload.notes = notesEl.value.trim() || null;

    if (entry.entry_type === 'measurement') {
      Object.assign(payload, this.editValues);
      if (entry.observations?.length) payload.health_score = this.editHealthScore;
    }
    if (entry.entry_type === 'observation') {
      payload.health_score = this.editHealthScore;
    }

    try {
      await API.updateEntry(entry.id, payload);
      Toast.success('Entry updated! ✅');
      this.close();
      if (App.currentPage === 'history') App.navigate('history');
    } catch (err) {
      Toast.error('Failed to save: ' + err.message);
    }
  },
};
