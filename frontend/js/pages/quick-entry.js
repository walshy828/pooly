/** Quick Entry page — tabbed interface for all pool actions */
const QuickEntryPage = {
  activeTab: 'test',
  measurementValues: {},
  lastMeasurements: {},
  selectedChemical: null,
  selectedProduct: null,
  chemQuantity: 1,
  chemUnit: 'lbs',
  _inventory: [],
  _productCatalog: {},
  _poolGallons: null,
  _catalogExpanded: false,
  algaeLevel: 'none',
  healthScore: 7,
  completedCareActions: new Set(),
  selectedCareAction: null,
  careFullness: null,
  careInches: 1.0,
  panelNotes: {},
  entryDate: null,
  pendingReminder: null,

  tabs: [
    { id: 'test', label: 'Water Test' },
    { id: 'chem', label: 'Chemicals'  },
    { id: 'care', label: 'Pool Care'  },
    { id: 'note', label: 'Note'       },
  ],

  async render(container) {
    this.measurementValues = {};
    this.lastMeasurements  = {};
    this.completedCareActions = new Set();
    this.selectedCareAction = null;
    this.careFullness = null;
    this.careInches   = 1.0;
    this.panelNotes   = {};
    this.entryDate    = null;
    this.algaeLevel   = 'none';
    this.poolStatus   = 'open';
    this._inventory   = [];
    this._productCatalog = {};
    this._poolGallons = null;

    try {
      const [settingsData, dashData, inventory, catalog] = await Promise.all([
        API.getSettings(),
        API.getDashboard().catch(() => null),
        API.getChemicalInventory().catch(() => []),
        API.getChemicalProducts().catch(() => ({})),
      ]);
      this.poolStatus   = settingsData.pool_status;
      this._poolGallons = settingsData.pool?.volume_gallons || null;
      this._inventory   = inventory;
      this._productCatalog = catalog;
      if (dashData?.chemistry) {
        dashData.chemistry.forEach(c => { if (c.value != null) this.lastMeasurements[c.parameter] = c.value; });
      }
    } catch (err) { console.error('Failed to fetch initial data', err); }

    if (this.poolStatus === 'closed' && ['chem', 'care'].includes(this.activeTab)) {
      this.activeTab = 'test';
    }

    const tabsHtml = this.tabs.map(t => {
      const disabled = this.poolStatus === 'closed' && ['chem','care'].includes(t.id);
      return `<button class="seg-btn${t.id === this.activeTab ? ' active' : ''}" data-tab="${t.id}" ${disabled ? 'disabled title="Pool is closed"' : ''}>${t.label}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">Log Entry</div>
        ${this.poolStatus === 'closed' ? `<span class="text-[11px] px-2 py-0.5 rounded-full" style="background:rgba(10,132,255,0.1);color:#0A84FF">❄️ Pool Closed</span>` : ''}
      </div>
      <div class="px-4 pt-3 sticky top-[57px] z-10" style="background:rgba(7,15,28,0.9);backdrop-filter:blur(16px);padding-bottom:10px">
        <div class="seg-control" id="entryTabs">${tabsHtml}</div>
      </div>
      <div id="entryPanel" class="px-4 pb-8 pt-3"></div>`;

    document.getElementById('entryTabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab && !tab.disabled) {
        this.captureState();
        this.activeTab = tab.dataset.tab;
        this.entryDate = null;
        history.replaceState(null, '', `#quick-entry/${tab.dataset.tab}`);
        this.renderPanel();
        this.updateTabs();
      }
    });

    this.renderPanel();
  },

  updateTabs() {
    document.querySelectorAll('#entryTabs .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    });
  },

  renderPanel() {
    const panel = document.getElementById('entryPanel');
    if (!panel) return;
    switch (this.activeTab) {
      case 'test': panel.innerHTML = this.renderTestPanel(); this.bindTestPanel(); break;
      case 'chem': panel.innerHTML = this.renderChemPanel(); this.bindChemPanel(); break;
      case 'care': panel.innerHTML = this.renderCarePanel(); this.bindCarePanel(); break;
      case 'note': panel.innerHTML = this.renderNotePanel(); this.bindNotePanel(); break;
    }
  },

  captureState() {
    const noteEl = document.getElementById('panelNoteText');
    if (noteEl) this.panelNotes[this.activeTab] = noteEl.value;
    const dateEl = document.getElementById('entryDateInput') || document.getElementById('careDateInput');
    if (dateEl) this.entryDate = this._dateInputToISO(dateEl.value);
  },

  _todayStr() { return new Date().toISOString().split('T')[0]; },

  _dateInputToISO(dateStr) {
    if (!dateStr) return null;
    const today = this._todayStr();
    if (dateStr === today) return null;
    const d = new Date(dateStr + 'T12:00:00');
    return isNaN(d) ? null : d.toISOString();
  },

  renderPendingReminderBanner() {
    if (!this.pendingReminder) return '';
    return `
      <div class="flex items-center gap-3 px-4 py-3 mb-3 rounded-2xl" style="background:rgba(0,200,212,0.08);border:1px solid rgba(0,200,212,0.2)">
        <span>📋</span>
        <span class="text-[13px] flex-1" style="color:rgba(245,245,247,0.8)">Completing: <strong class="text-pool-accent">${this.pendingReminder.display_name}</strong></span>
        <button id="dismissReminderBanner" class="text-pool-muted text-[16px]">✕</button>
      </div>`;
  },

  bindPendingReminderBanner() {
    document.getElementById('dismissReminderBanner')?.addEventListener('click', () => {
      this.pendingReminder = null;
      document.getElementById('dismissReminderBanner')?.closest('.flex')?.remove();
    });
  },

  renderDateSelector() {
    const today = this._todayStr();
    const selectedDate = this.entryDate ? new Date(this.entryDate).toISOString().split('T')[0] : today;
    const isToday = selectedDate === today;
    const displayText = isToday ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
    return `
      <div class="flex items-center gap-2 mb-4">
        <span class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold">When?</span>
        <div class="relative">
          <input type="date" id="entryDateInput" value="${selectedDate}" max="${today}"
            class="text-[13px] font-medium cursor-pointer"
            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:5px 10px;color:#00C8D4;min-width:0;width:auto">
        </div>
      </div>`;
  },

  bindDateSelector() {
    document.getElementById('entryDateInput')?.addEventListener('change', e => {
      this.entryDate = this._dateInputToISO(e.target.value);
    });
  },

  renderNotesSection(tab) {
    const saved = this.panelNotes[tab] || '';
    return `
      <div class="mt-4">
        <label class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold block mb-2">Notes <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
        <textarea id="panelNoteText" rows="2" placeholder="Any observations or context…">${saved}</textarea>
      </div>`;
  },

  // ── TEST PANEL ────────────────────────────────────────────────
  renderTestPanel() {
    const params = ['free_chlorine','total_chlorine','bromine','ph','alkalinity','cyanuric_acid','calcium_hardness'];
    let paramHtml = params.map(p => this.renderMeasurementSlider(p)).join('');
    return `
      ${this.renderPendingReminderBanner()}
      ${this.renderDateSelector()}
      ${this.renderHealthSlider()}
      <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-3 mt-5">Water Chemistry</div>
      <div class="flex flex-col gap-4">${paramHtml}</div>
      ${this.renderAlgaeSelector()}
      ${this.renderNotesSection('test')}
      <button class="btn btn-primary btn-full mt-5" id="submitMeasurement">Save Reading</button>`;
  },

  renderHealthSlider() {
    const label = Chemistry.healthLabels[this.healthScore] || '';
    return `
      <div class="bento-card mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="bento-label mb-0">Pool Health</div>
          <div class="text-[15px] font-bold" id="healthLabel" style="color:var(--health-${this.healthScore})">${this.healthScore}/10 — ${label}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[20px]">🐸</span>
          <input type="range" min="1" max="10" value="${this.healthScore}" id="healthSlider"
            style="flex:1;background:linear-gradient(90deg,var(--health-1),var(--health-5),var(--health-10))">
          <span class="text-[20px]">🌊</span>
        </div>
      </div>`;
  },

  renderAlgaeSelector() {
    const levels = [
      { id:'none',     label:'None',     emoji:'✓',  color:'#30D158', desc:'No algae visible' },
      { id:'slight',   label:'Slight',   emoji:'🟡', color:'#FFD60A', desc:'Faint green tint' },
      { id:'moderate', label:'Moderate', emoji:'🟠', color:'#FF9F0A', desc:'Cloudy green water'},
      { id:'heavy',    label:'Heavy',    emoji:'🔴', color:'#FF453A', desc:'Visibly green'    },
      { id:'swamp',    label:'Swamp',    emoji:'🐸', color:'#30D158', desc:'Dark green/black' },
    ];
    const buttons = levels.map(l => {
      const isActive = this.algaeLevel === l.id;
      const style = isActive ? `border-color:${l.color};background:${l.color}18;color:${l.color}` : '';
      return `<button class="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border cursor-pointer transition-all"
        style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);${style}" data-algae="${l.id}">
        <span style="font-size:16px">${l.emoji}</span>
        <span class="text-[11px] font-medium" style="color:inherit">${l.label}</span>
      </button>`;
    }).join('');
    const current = levels.find(l => l.id === this.algaeLevel);
    return `
      <div class="mt-5">
        <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">Algae Observation</div>
        <div class="flex gap-2">${buttons}</div>
        <div class="text-[12px] text-pool-muted mt-2" id="algaeDesc">${current?.desc || ''}</div>
      </div>`;
  },

  renderMeasurementSlider(param) {
    const currentVal = this.measurementValues[param];
    const lastVal    = this.lastMeasurements[param];
    const initVal    = currentVal ?? lastVal ?? null;
    return MeasurementSlider.render(param, initVal, { lastValue: lastVal });
  },

  bindTestPanel() {
    this.bindDateSelector();
    this.bindPendingReminderBanner();
    document.querySelectorAll('.meas-slider-input').forEach(slider => {
      const param = slider.dataset.param;
      const spec  = Chemistry.ranges[param];
      const raw   = parseFloat(slider.value);
      if (raw >= spec.min) this.measurementValues[param] = parseFloat(raw.toFixed(spec.decimals ?? 1));
      MeasurementSlider.bindSlider(param, (val) => {
        if (val != null) this.measurementValues[param] = val;
        else delete this.measurementValues[param];
      });
    });
    const healthSlider = document.getElementById('healthSlider');
    if (healthSlider) {
      healthSlider.addEventListener('input', () => {
        this.healthScore = parseInt(healthSlider.value);
        const lbl = document.getElementById('healthLabel');
        if (lbl) {
          lbl.textContent = `${this.healthScore}/10 — ${Chemistry.healthLabels[this.healthScore]||''}`;
          lbl.style.color = `var(--health-${this.healthScore})`;
        }
      });
    }
    const algaeLevels = [
      {id:'none',color:'#30D158',desc:'No algae visible'},{id:'slight',color:'#FFD60A',desc:'Faint green tint'},
      {id:'moderate',color:'#FF9F0A',desc:'Cloudy green water'},{id:'heavy',color:'#FF453A',desc:'Visibly green'},
      {id:'swamp',color:'#30D158',desc:'Dark green / black'},
    ];
    document.querySelectorAll('[data-algae]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.algaeLevel = btn.dataset.algae;
        const spec = algaeLevels.find(l => l.id === this.algaeLevel);
        document.querySelectorAll('[data-algae]').forEach(b => {
          const s = algaeLevels.find(l => l.id === b.dataset.algae);
          if (b.dataset.algae === this.algaeLevel && s) {
            b.style.borderColor = s.color; b.style.background = s.color+'18'; b.style.color = s.color;
          } else { b.style.borderColor='rgba(255,255,255,0.08)'; b.style.background='rgba(255,255,255,0.04)'; b.style.color=''; }
        });
        const descEl = document.getElementById('algaeDesc');
        if (descEl && spec) descEl.textContent = spec.desc;
      });
    });
    document.getElementById('submitMeasurement')?.addEventListener('click', () => this.submitMeasurement());
  },

  async submitMeasurement() {
    try {
      const notes     = document.getElementById('panelNoteText')?.value?.trim() || null;
      const entryDate = this.entryDate;
      const hasValues = Object.keys(this.measurementValues).length > 0;
      if (hasValues) {
        await API.addMeasurement({
          ...this.measurementValues, algae_level: this.algaeLevel || 'none',
          ...(notes ? {notes} : {}), ...(entryDate ? {entry_date:entryDate} : {}),
        });
      }
      await API.addObservation({ health_score: this.healthScore, ...(notes?{notes}:{}), ...(entryDate?{entry_date:entryDate}:{}) });
      const reminderName = this.pendingReminder?.display_name;
      this.pendingReminder = null; this.measurementValues = {}; this.panelNotes.test = ''; this.entryDate = null;
      Toast.success(reminderName ? `${reminderName} logged! ✓` : 'Reading saved! 🎉');
      App.navigate('dashboard');
    } catch (err) { Toast.error('Failed to save: ' + err.message); }
  },

  // ── CHEMICAL PANEL ────────────────────────────────────────────
  _chemStep() { return this.chemUnit === 'tabs' ? 1 : 0.5; },

  _suggestQty(product) {
    const gal = this._poolGallons;
    if (!gal || !product) return 1;
    const ratio = gal / 10000;
    if (product.ppm_per_unit_per_10k) {
      return Math.max(0.5, Math.round((10 / product.ppm_per_unit_per_10k) * ratio * 2) / 2);
    }
    return Math.max(0.5, Math.round(ratio * 2) / 2);
  },

  _unitFromProduct(product) {
    if (!product) return 'lbs';
    if (product.form === 'tablet') return 'tabs';
    return product.package_unit || (product.form === 'liquid' ? 'gallons' : 'lbs');
  },

  _inventoryForType(chemType) {
    const catalogType = Chemistry.chemToCatalogType[chemType];
    if (!catalogType) return [];
    return (this._inventory || []).filter(i => i.product_type === catalogType);
  },

  _catalogForType(chemType) {
    const catalogType = Chemistry.chemToCatalogType[chemType];
    if (!catalogType) return [];
    return (this._productCatalog[catalogType] || []);
  },

  renderChemPanel() {
    const types = Chemistry.chemicals.map(c => `
      <button class="chem-card flex flex-col items-center gap-1.5 py-3 rounded-2xl border cursor-pointer transition-all ${this.selectedChemical === c.type ? 'selected' : ''}"
        style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08)" data-chem="${c.type}">
        <span style="font-size:1.5rem">${c.icon}</span>
        <span class="text-[12px] font-medium text-pool-muted">${c.label}</span>
      </button>`).join('');

    let bodyHtml = '';
    if (this.selectedChemical) {
      const chemDef   = Chemistry.chemicals.find(c => c.type === this.selectedChemical);
      const hasCatalog= !!Chemistry.chemToCatalogType[this.selectedChemical];
      if (this.selectedProduct) bodyHtml = this._renderChemQuantityStep(chemDef);
      else if (hasCatalog)      bodyHtml = this._renderChemProductPicker(chemDef);
      else                      bodyHtml = this._renderChemGenericForm(chemDef);
    }

    return `
      ${this.renderPendingReminderBanner()}
      ${this.renderDateSelector()}
      <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-3">Add Chemicals</div>
      <div class="grid grid-cols-3 gap-2">${types}</div>
      ${bodyHtml}`;
  },

  _renderChemProductPicker(chemDef) {
    const invItems     = this._inventoryForType(this.selectedChemical);
    const catalogItems = this._catalogForType(this.selectedChemical);
    let html = '';

    if (invItems.length > 0) {
      html += `<div class="mt-4"><div class="text-[11px] text-pool-muted mb-2">${chemDef.label} on hand</div>`;
      invItems.forEach(item => {
        html += `<div class="bento-card bento-card-sm flex items-center gap-3 mb-2" data-product-id="${item.product_id}" data-source="inventory">
          <div class="flex-1">
            <div class="text-[14px] font-medium text-pool-text">${item.product_name || item.product_id}</div>
            <div class="text-[11px] text-pool-muted">${item.product_brand||''} · ${item.quantity} ${item.unit} on hand</div>
          </div>
          <button class="btn btn-sm btn-primary chem-use-btn">Use →</button>
        </div>`;
      });
      html += `<button class="text-[12px] text-pool-muted mt-1 mb-3" id="catalogToggle">${this._catalogExpanded ? '▾' : '▸'} Use a different product</button>`;
      if (this._catalogExpanded && catalogItems.length > 0) html += this._renderCatalogList(catalogItems);
    } else {
      html += `<div class="bento-card text-center py-4 mt-4">
        <div class="text-[13px] text-pool-muted">No ${chemDef.label.toLowerCase()} in inventory</div>
        <div class="text-[11px] text-pool-subtle mt-1">Select from our product catalog below</div>
      </div>`;
      if (catalogItems.length > 0) html += `<div class="mt-2">${this._renderCatalogList(catalogItems)}</div>`;
    }

    html += `<button class="text-[12px] text-pool-accent mt-3" id="chemManageInv">Manage Inventory →</button>`;
    return html;
  },

  _renderCatalogList(items) {
    return items.map(p => {
      const formLabel = p.form === 'liquid' ? 'liquid' : p.form === 'tablet' ? 'tablet' : 'granular';
      return `<div class="bento-card bento-card-sm flex items-center gap-3 mb-2" data-product-id="${p.id}" data-source="catalog">
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-medium text-pool-text">${p.name}</div>
          <div class="text-[11px] text-pool-muted">${p.brand} · ${formLabel} · ${p.package_size} ${p.package_unit}</div>
        </div>
        <button class="btn btn-sm btn-secondary chem-use-btn">Use</button>
      </div>`;
    }).join('');
  },

  _renderChemQuantityStep(chemDef) {
    const p          = this.selectedProduct;
    const suggested  = this._suggestQty(p);
    const poolNote   = this._poolGallons ? `Suggested for ${this._poolGallons.toLocaleString()} gal: ${suggested} ${this.chemUnit}` : '';
    return `
      <div class="bento-card mt-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-[15px] font-semibold text-pool-text">${chemDef.icon} ${p.name}</div>
            <div class="text-[11px] text-pool-muted">${p.brand || ''} ${p.form || ''}</div>
          </div>
          <button id="changeProduct" class="btn btn-sm btn-secondary">Change</button>
        </div>
        ${poolNote ? `<div class="text-[12px] text-pool-accent mb-3">${poolNote}</div>` : ''}
        <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">Amount (${this.chemUnit})</div>
        <div class="flex items-center gap-4 justify-center py-2">
          <button id="chemMinus" class="btn btn-secondary" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:22px">−</button>
          <span id="chemAmountDisplay" class="text-[28px] font-bold text-pool-text" style="min-width:60px;text-align:center">${this.chemQuantity}</span>
          <button id="chemPlus" class="btn btn-secondary" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:22px">+</button>
        </div>
        ${this.renderNotesSection('chem')}
        <button class="btn btn-primary btn-full mt-4" id="submitChem">Log ${chemDef.label}</button>
      </div>`;
  },

  _renderChemGenericForm(chemDef) {
    return `
      <div class="bento-card mt-4">
        <div class="text-[15px] font-semibold text-pool-text mb-3">${chemDef.icon} ${chemDef.label}</div>
        <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">Amount</div>
        <div class="flex items-center gap-4 justify-center py-2">
          <button id="chemMinus" class="btn btn-secondary" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:22px">−</button>
          <span id="chemAmountDisplay" class="text-[28px] font-bold text-pool-text" style="min-width:60px;text-align:center">${this.chemQuantity}</span>
          <button id="chemPlus" class="btn btn-secondary" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:22px">+</button>
        </div>
        <div class="mt-3">
          <label class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold block mb-2">Unit</label>
          <select id="chemUnitSelect">
            <option value="oz">Ounces (oz)</option>
            <option value="lbs" selected>Pounds (lbs)</option>
            <option value="tabs">Tabs</option>
            <option value="gallons">Gallons</option>
          </select>
        </div>
        ${this.renderNotesSection('chem')}
        <button class="btn btn-primary btn-full mt-4" id="submitChem">Log ${chemDef.label}</button>
      </div>`;
  },

  bindChemPanel() {
    this.bindDateSelector();
    this.bindPendingReminderBanner();
    document.querySelectorAll('.chem-card').forEach(btn => {
      btn.addEventListener('click', () => {
        this.captureState(); this.selectedChemical = btn.dataset.chem;
        this.selectedProduct = null; this.chemQuantity = 1; this._catalogExpanded = false;
        this.renderPanel();
      });
    });
    document.getElementById('catalogToggle')?.addEventListener('click', () => {
      this._catalogExpanded = !this._catalogExpanded; this.renderPanel();
    });
    document.querySelectorAll('.chem-use-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('[data-product-id]');
        const pid = card?.dataset.productId, source = card?.dataset.source;
        if (!pid) return;
        let product = null;
        if (source === 'inventory') {
          const invItem = this._inventory.find(i => i.product_id === pid);
          const catalogType = Chemistry.chemToCatalogType[this.selectedChemical];
          const catProd = (this._productCatalog[catalogType]||[]).find(p => p.id === pid);
          product = { id:pid, name:invItem?.product_name||pid, brand:invItem?.product_brand||'', form:catProd?.form||'granular', package_unit:catProd?.package_unit||'lbs', ppm_per_unit_per_10k:catProd?.ppm_per_unit_per_10k||null, onHand:invItem?.quantity, from:'inventory' };
        } else {
          const catalogType = Chemistry.chemToCatalogType[this.selectedChemical];
          const catProd = (this._productCatalog[catalogType]||[]).find(p => p.id === pid);
          if (catProd) product = { id:pid, name:catProd.name, brand:catProd.brand, form:catProd.form, package_unit:catProd.package_unit, ppm_per_unit_per_10k:catProd.ppm_per_unit_per_10k||null, onHand:null, from:'catalog' };
        }
        if (!product) return;
        this.selectedProduct = product; this.chemUnit = this._unitFromProduct(product);
        this.chemQuantity = this._suggestQty(product); this.renderPanel();
      });
    });
    document.getElementById('changeProduct')?.addEventListener('click', () => { this.selectedProduct = null; this._catalogExpanded = false; this.renderPanel(); });
    document.getElementById('chemManageInv')?.addEventListener('click', e => { e.preventDefault(); App.navigate('settings'); });
    this.bindStepper('chemMinus','chemPlus','chemAmountDisplay', v => this.chemQuantity = v, () => this.chemQuantity, this._chemStep());
    document.getElementById('submitChem')?.addEventListener('click', () => this.submitChemical());
  },

  bindStepper(minusId, plusId, displayId, setter, getter, step = 1) {
    document.getElementById(minusId)?.addEventListener('click', () => {
      const v = Math.max(step, Math.round((getter() - step) * 100) / 100);
      setter(v); const el = document.getElementById(displayId); if (el) el.textContent = v;
    });
    document.getElementById(plusId)?.addEventListener('click', () => {
      const v = Math.round((getter() + step) * 100) / 100;
      setter(v); const el = document.getElementById(displayId); if (el) el.textContent = v;
    });
  },

  async submitChemical() {
    if (!this.selectedChemical) return;
    try {
      const notes     = document.getElementById('panelNoteText')?.value?.trim() || null;
      const entryDate = this.entryDate;
      const unit      = this.selectedProduct ? this.chemUnit : (document.getElementById('chemUnitSelect')?.value || 'oz');
      const form      = this.selectedProduct?.form || null;
      await API.addChemical({ chemical_type:this.selectedChemical, form, amount:this.chemQuantity, unit, ...(notes?{notes}:{}), ...(entryDate?{entry_date:entryDate}:{}) });
      const reminderName = this.pendingReminder?.display_name;
      const chemLabel = this.selectedProduct?.name || Chemistry.chemicals.find(c => c.type === this.selectedChemical)?.label || this.selectedChemical;
      this.pendingReminder = null; this.selectedChemical = null; this.selectedProduct = null;
      this.chemQuantity = 1; this.panelNotes.chem = ''; this.entryDate = null; this._catalogExpanded = false;
      Toast.success(reminderName ? `${reminderName} logged! ✓` : `${chemLabel} logged! 💧`);
      reminderName ? App.navigate('dashboard') : this.renderPanel();
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  // ── POOL CARE PANEL ───────────────────────────────────────────
  renderCareDateRow() {
    const today = this._todayStr();
    const selectedDate = this.entryDate ? new Date(this.entryDate).toISOString().split('T')[0] : today;
    const presets = [{label:'Today',days:0},{label:'Yesterday',days:1},{label:'2 days ago',days:2},{label:'3 days ago',days:3},{label:'Other…',days:-1}];
    const activeDays = this.entryDate ? Math.round((new Date(today+'T12:00:00') - new Date(this.entryDate)) / 86400000) : 0;
    const showInput  = activeDays > 3;
    const btns = presets.map(p => {
      const isActive = (p.days === activeDays && p.days >= 0) || (p.days === -1 && showInput);
      return `<button class="log-preset${isActive?' active':''}" data-days="${p.days}">${p.label}</button>`;
    }).join('');
    return `
      <div class="mb-4">
        <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-2">When?</div>
        <div class="flex gap-2 flex-wrap">${btns}</div>
        <input type="date" id="careDateInput" value="${selectedDate}" max="${today}"
          style="display:${showInput?'block':'none'};margin-top:8px">
      </div>`;
  },

  _renderCareExtra(action) {
    if (!action?.extra) return '';
    if (action.extra === 'fullness') {
      const levels = [{value:0,label:'Empty'},{value:25,label:'¼ Full'},{value:50,label:'½ Full'},{value:75,label:'¾ Full'},{value:100,label:'Full'}];
      return `<div class="mt-3">
        <div class="text-[11px] text-pool-muted mb-2">How full was it? <span style="opacity:0.5">(optional)</span></div>
        <div class="flex gap-2 flex-wrap">
          ${levels.map(l => `<button class="log-fullness-btn${this.careFullness===l.value?' active':''}" data-fullness="${l.value}">${l.label}</button>`).join('')}
        </div>
      </div>`;
    }
    if (action.extra === 'inches') {
      return `<div class="mt-3">
        <div class="text-[11px] text-pool-muted mb-2">Inches of water added</div>
        <div class="flex items-center gap-4 justify-center">
          <button id="careInchesDown" class="btn btn-secondary" style="width:40px;height:40px;border-radius:50%;padding:0;font-size:20px"${this.careInches<=0.5?' disabled':''}>−</button>
          <span id="careInchesVal" class="text-[22px] font-bold text-pool-text">${this.careInches.toFixed(1)}"</span>
          <button id="careInchesUp" class="btn btn-secondary" style="width:40px;height:40px;border-radius:50%;padding:0;font-size:20px"${this.careInches>=12?' disabled':''}>+</button>
        </div>
      </div>`;
    }
    return '';
  },

  renderCarePanel() {
    const sel = this.selectedCareAction;
    const selAction = Chemistry.poolCareActions.find(a => a.type === sel);
    const hasSelection = !!sel;
    const btns = Chemistry.poolCareActions.map(a => {
      const isSelected = a.type === sel;
      const isDone     = !isSelected && this.completedCareActions.has(a.type);
      return `<button class="action-card flex flex-col items-center gap-2 py-4 rounded-2xl border cursor-pointer transition-all ${isSelected?' selected':''}${isDone?' opacity-50':''}"
        style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08)" data-care="${a.type}">
        <span style="font-size:1.6rem">${a.icon}</span>
        <span class="text-[12px] font-medium text-pool-muted leading-tight text-center">${a.label}</span>
        ${isDone?`<span style="font-size:10px;color:#30D158">✓ Done</span>`:''}
      </button>`;
    }).join('');

    return `
      ${this.renderPendingReminderBanner()}
      ${this.renderCareDateRow()}
      <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-3">What did you do?</div>
      <div class="grid grid-cols-2 gap-2" id="careGrid">${btns}</div>
      <div id="careExtra">${this._renderCareExtra(selAction)}</div>
      ${this.renderNotesSection('care')}
      <div class="flex gap-3 mt-4">
        <button class="btn btn-secondary flex-1" id="logAndAdd"${!hasSelection?' disabled':''}>Log &amp; Add Another</button>
        <button class="btn btn-primary flex-1" id="logEntry"${!hasSelection?' disabled':''}>Log Entry</button>
      </div>`;
  },

  _bindCareExtra() {
    document.querySelectorAll('#careExtra .log-fullness-btn').forEach(fb => {
      fb.addEventListener('click', () => {
        document.querySelectorAll('#careExtra .log-fullness-btn').forEach(b => b.classList.remove('active'));
        fb.classList.add('active'); this.careFullness = parseInt(fb.dataset.fullness);
      });
    });
    const downBtn = document.getElementById('careInchesDown');
    const upBtn   = document.getElementById('careInchesUp');
    const valEl   = document.getElementById('careInchesVal');
    if (downBtn && upBtn && valEl) {
      downBtn.addEventListener('click', () => {
        if (this.careInches > 0.5) { this.careInches = Math.round((this.careInches - 0.5)*10)/10; valEl.textContent = this.careInches.toFixed(1)+'"'; downBtn.disabled = this.careInches<=0.5; upBtn.disabled=false; }
      });
      upBtn.addEventListener('click', () => {
        if (this.careInches < 12) { this.careInches = Math.round((this.careInches + 0.5)*10)/10; valEl.textContent = this.careInches.toFixed(1)+'"'; upBtn.disabled = this.careInches>=12; downBtn.disabled=false; }
      });
    }
  },

  async _submitCareEntry(andAddAnother = false) {
    const taskType = this.selectedCareAction;
    if (!taskType) return;
    const action = Chemistry.poolCareActions.find(a => a.type === taskType);
    const notes  = document.getElementById('panelNoteText')?.value?.trim() || null;
    const payload = { task_type:taskType, ...(this.entryDate?{entry_date:this.entryDate}:{}), ...(notes?{notes}:{}), ...(action?.extra==='fullness'&&this.careFullness!=null?{fullness:this.careFullness}:{}), ...(action?.extra==='inches'?{inches:this.careInches}:{}) };
    try {
      await API.logPoolCareAction(payload);
      this.completedCareActions.add(taskType);
      if (andAddAnother) {
        const doneBtn = document.querySelector(`.action-card[data-care="${taskType}"]`);
        if (doneBtn) { doneBtn.classList.remove('selected'); doneBtn.classList.add('opacity-50'); }
        this.selectedCareAction = null; this.careFullness = null; this.careInches = 1.0;
        document.getElementById('careExtra').innerHTML = '';
        document.getElementById('logEntry').disabled  = true;
        document.getElementById('logAndAdd').disabled = true;
        const noteEl = document.getElementById('panelNoteText');
        if (noteEl) { noteEl.value = ''; this.panelNotes.care = ''; }
        Toast.success(`${action?.label||taskType} logged! ✓`);
      } else {
        Toast.success(`${action?.label||taskType} logged! ✓`);
        setTimeout(() => App.navigate('dashboard'), 400);
      }
    } catch (err) { Toast.error('Failed: ' + err.message); }
  },

  bindCarePanel() {
    this.bindPendingReminderBanner();
    document.querySelectorAll('.care-date-row .log-preset, #careGrid ~ div .log-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-days]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const days = parseInt(btn.dataset.days), dateInput = document.getElementById('careDateInput');
        if (days === -1) { dateInput.style.display='block'; dateInput.focus(); }
        else {
          dateInput.style.display = 'none';
          const d = new Date(); d.setDate(d.getDate() - days);
          dateInput.value = d.toISOString().split('T')[0];
          this.entryDate = days === 0 ? null : this._dateInputToISO(dateInput.value);
        }
      });
    });
    // Bind all date presets in care panel
    document.querySelectorAll('.log-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.flex')?.querySelectorAll('.log-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const days = parseInt(btn.dataset.days), dateInput = document.getElementById('careDateInput');
        if (!dateInput) return;
        if (days === -1) { dateInput.style.display='block'; dateInput.focus(); }
        else {
          dateInput.style.display='none';
          const d = new Date(); d.setDate(d.getDate() - days);
          dateInput.value = d.toISOString().split('T')[0];
          this.entryDate = days === 0 ? null : this._dateInputToISO(dateInput.value);
        }
      });
    });
    document.getElementById('careDateInput')?.addEventListener('change', e => { this.entryDate = this._dateInputToISO(e.target.value); });
    document.querySelectorAll('#careGrid .action-card[data-care]').forEach(btn => {
      btn.addEventListener('click', () => {
        const taskType = btn.dataset.care;
        const isAlreadySelected = this.selectedCareAction === taskType;
        document.querySelectorAll('#careGrid .action-card').forEach(b => b.classList.remove('selected'));
        if (isAlreadySelected) {
          this.selectedCareAction = null; this.careFullness = null;
          document.getElementById('careExtra').innerHTML = '';
          document.getElementById('logEntry').disabled = true;
          document.getElementById('logAndAdd').disabled = true;
        } else {
          btn.classList.add('selected'); btn.classList.remove('opacity-50');
          this.selectedCareAction = taskType; this.careFullness = null;
          const action = Chemistry.poolCareActions.find(a => a.type === taskType);
          document.getElementById('careExtra').innerHTML = this._renderCareExtra(action);
          this._bindCareExtra();
          document.getElementById('logEntry').disabled  = false;
          document.getElementById('logAndAdd').disabled = false;
        }
      });
    });
    document.getElementById('logEntry')?.addEventListener('click', () => this._submitCareEntry(false));
    document.getElementById('logAndAdd')?.addEventListener('click', () => this._submitCareEntry(true));
  },

  // ── NOTE PANEL ────────────────────────────────────────────────
  renderNotePanel() {
    return `
      ${this.renderDateSelector()}
      <div class="text-[11px] text-pool-muted uppercase tracking-wider font-semibold mb-3">Quick Note</div>
      <textarea id="noteText" rows="6" placeholder="What's going on with the pool?" class="resize-none"></textarea>
      <button class="btn btn-primary btn-full mt-4" id="submitNote">Save Note</button>`;
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
