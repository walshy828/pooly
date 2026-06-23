/** Settings page */
const SettingsPage = {
  _inventory: [],
  _products: {},

  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, inventory, products, aiStatus] = await Promise.all([
        API.getSettings(),
        API.getChemicalInventory().catch(() => []),
        API.getChemicalProducts().catch(() => ({})),
        API.getAiStatus().catch(() => ({ enabled: false, key_set: false, model: 'claude-opus-4-8' })),
      ]);
      this._inventory = inventory;
      this._products = products;
      this._aiStatus = aiStatus;
      container.innerHTML = this.buildHTML(data);
      this.bind(data);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚙️</div>
        <div class="empty-text">Could not load settings</div></div>`;
    }
  },

  buildHTML(d) {
    const p = d.pool;
    const scheduleRows = (d.schedules || []).map(s => this.renderScheduleRow(s)).join('');

    return `
      <div class="page-header"><div class="page-title">⚙️ Settings</div></div>
      <div class="container page">

        ${this.renderSeasonCard(d)}

        <div class="settings-group">
          <div class="section-title">Pool Configuration</div>
          <div class="card">
            <div class="form-group"><label class="form-label">Pool Name</label>
              <input class="form-input" id="poolName" value="${p.name || 'My Pool'}"></div>
            <div class="form-group"><label class="form-label">Shape</label>
              <select class="form-select" id="poolShape">
                <option value="round"${p.shape==='round'?' selected':''}>Round</option>
                <option value="oval"${p.shape==='oval'?' selected':''}>Oval</option>
                <option value="rectangular"${p.shape==='rectangular'?' selected':''}>Rectangular</option>
              </select></div>
            <div class="form-group"><label class="form-label">Diameter / Length (ft)</label>
              <input class="form-input" type="number" id="poolLength" value="${p.length_ft || ''}"></div>
            <div class="form-group"><label class="form-label">Depth (ft)</label>
              <input class="form-input" type="number" id="poolDepth" value="${p.depth_ft || ''}"></div>
            <div class="form-group"><label class="form-label">Volume (gallons)</label>
              <input class="form-input" type="number" id="poolVolume" value="${p.volume_gallons || ''}"></div>
            <div class="form-group"><label class="form-label">Pool Type</label>
              <select class="form-select" id="poolType">
                <option value="above_ground"${p.pool_type==='above_ground'?' selected':''}>Above Ground</option>
                <option value="in_ground"${p.pool_type==='in_ground'?' selected':''}>In Ground</option>
              </select></div>
            <div class="form-group"><label class="form-label">Sanitizer</label>
              <select class="form-select" id="poolSanitizer">
                <option value="chlorine"${p.sanitizer_type==='chlorine'?' selected':''}>Chlorine</option>
                <option value="salt"${p.sanitizer_type==='salt'?' selected':''}>Salt</option>
                <option value="bromine"${p.sanitizer_type==='bromine'?' selected':''}>Bromine</option>
              </select></div>
            <div class="form-group"><label class="form-label">Filter Type</label>
              <select class="form-select" id="poolFilter">
                <option value="cartridge"${p.filter_type==='cartridge'?' selected':''}>Cartridge</option>
                <option value="sand"${p.filter_type==='sand'?' selected':''}>Sand</option>
                <option value="de"${p.filter_type==='de'?' selected':''}>DE</option>
              </select></div>
            <button class="btn btn-primary btn-block" id="savePool">Save Pool Config</button>
          </div>
        </div>

        ${this.renderInventorySection()}

        ${this.renderAiSection()}

        <div class="settings-group">
          <div class="section-title">Pool Care Schedules</div>
          <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:var(--space-md)">
            Toggle tasks on/off and adjust reminder frequency. Changes save automatically.
          </div>
          <div id="schedulesContainer">${scheduleRows}</div>
        </div>

        <div class="settings-group">
          <div class="section-title">Integrations</div>
          <div class="settings-item">
            <span class="settings-item-label">🏠 Home Assistant</span>
            <span class="badge ${d.ha_enabled ? 'badge-success' : 'badge-info'}">${d.ha_enabled ? 'Connected' : 'Not Configured'}</span>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">🌤️ Weather</span>
            <span class="badge ${d.weather_enabled ? 'badge-success' : 'badge-info'}">${d.weather_enabled ? 'Active' : 'Not Configured'}</span>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">🔒 PIN Lock</span>
            <span class="badge ${d.pin_enabled ? 'badge-success' : 'badge-info'}">${d.pin_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>

        <div class="settings-group" style="text-align:center;padding:var(--space-xl) 0">
          <div style="color:var(--text-muted);font-size:var(--fs-sm)">Pooly v1.0.0</div>
          <div style="color:var(--text-muted);font-size:var(--fs-xs);margin-top:4px">🏊 Pool Maintenance Manager</div>
        </div>
      </div>`;
  },

  renderInventorySection() {
    const typeIcons = {
      shock: '⚡', algaecide: '🦠', clarifier: '✨', ph_up: '⬆️', ph_down: '⬇️',
      alkalinity_up: '🔼', cya: '☀️', hardness: '💧',
    };
    const typeLabels = {
      shock: 'Shock', algaecide: 'Algaecide', clarifier: 'Clarifier',
      ph_up: 'pH Up', ph_down: 'pH Down', alkalinity_up: 'Alkalinity Up',
      cya: 'CYA Stabilizer', hardness: 'Calcium Hardness',
    };
    const inventoryByType = {};
    (this._inventory || []).forEach(item => {
      const t = item.product_type || 'other';
      if (!inventoryByType[t]) inventoryByType[t] = [];
      inventoryByType[t].push(item);
    });

    const inventoryRows = (this._inventory || []).map(item => `
      <div class="inv-row" data-inv-id="${item.id}" data-product-id="${item.product_id}">
        <div class="inv-row-info">
          <span class="inv-type-icon">${typeIcons[item.product_type] || '🧪'}</span>
          <div class="inv-row-text">
            <div class="inv-product-name">${item.product_name || item.product_id}</div>
            <div class="inv-product-brand" style="color:var(--text-muted);font-size:var(--fs-xs)">${item.product_brand || ''}</div>
          </div>
        </div>
        <div class="inv-row-controls">
          <input type="number" class="inv-qty-input form-input" value="${item.quantity}" min="0" step="0.5"
            data-inv-id="${item.id}" style="width:64px;text-align:center;padding:4px">
          <span style="font-size:var(--fs-xs);color:var(--text-muted)">${item.unit}</span>
          <button class="inv-remove-btn" data-inv-id="${item.id}" title="Remove">✕</button>
        </div>
      </div>`).join('');

    // Build product picker select options grouped by type
    const optGroups = Object.entries(this._products || {}).map(([typeName, products]) => {
      const label = typeLabels[typeName] || typeName;
      const options = (products || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      return options ? `<optgroup label="${typeIcons[typeName] || ''} ${label}">${options}</optgroup>` : '';
    }).filter(Boolean).join('');

    return `
      <div class="settings-group">
        <div class="section-title">My Chemical Inventory</div>
        <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:var(--space-md)">
          Track what chemicals you have on hand. Treatment plans will use these products and calculate exact amounts.
        </div>
        <div class="card" id="inventoryList">
          ${inventoryRows || `<div style="text-align:center;color:var(--text-muted);padding:var(--space-lg);font-size:var(--fs-sm)">
            No chemicals added yet. Add what you have on hand below.
          </div>`}
        </div>
        <div class="card" style="margin-top:var(--space-md)">
          <div class="form-group" style="margin-bottom:var(--space-sm)">
            <label class="form-label">Add Product</label>
            <select class="form-select" id="addProductSelect">
              <option value="">— Select a product —</option>
              ${optGroups}
            </select>
          </div>
          <div class="inv-add-row">
            <input type="number" class="form-input" id="addProductQty" placeholder="Qty" min="0" step="0.5" value="1" style="width:70px">
            <select class="form-select" id="addProductUnit" style="width:100px">
              <option value="lbs">lbs</option>
              <option value="gallons">gallons</option>
              <option value="quarts">quarts</option>
              <option value="oz">oz</option>
              <option value="bags">bags</option>
              <option value="bottles">bottles</option>
            </select>
            <button class="btn btn-primary" id="addInventoryBtn" style="flex:1">+ Add</button>
          </div>
        </div>
      </div>`;
  },

  renderAiSection() {
    const ai = this._aiStatus || {};
    const enabled = !!ai.enabled;
    const keySet = !!ai.key_set;
    const model = ai.model || 'claude-opus-4-8';
    const keyHint = keySet
      ? (ai.key_source === 'env' ? '🔑 Using key from server environment' : '🔑 Key saved')
      : 'No key set yet';
    const placeholder = keySet ? '•••••••••••••• (leave blank to keep)' : 'sk-ant-...';
    return `
      <div class="settings-group">
        <div class="section-title">✨ AI Insights</div>
        <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-bottom:var(--space-md)">
          Optional. Add a Claude API key for a plain-language daily briefing on Today
          and tailored explanations of your treatment plans. All chemical recommendations
          and amounts stay rule-based — AI only explains them, never invents doses.
        </div>
        <div class="card">
          <div class="settings-item" style="border:none;background:none;padding:0 0 var(--space-md) 0">
            <div>
              <div class="settings-item-label">Enable AI insights</div>
              <div class="settings-item-value" id="aiStateLabel">${enabled ? 'On' : 'Off'}</div>
            </div>
            <label class="schedule-toggle">
              <input type="checkbox" class="ai-enabled-cb" id="aiEnabledCb" ${enabled ? 'checked' : ''}>
              <span class="schedule-toggle-slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Claude API Key</label>
            <input class="form-input" type="password" id="aiApiKey" placeholder="${placeholder}" autocomplete="off">
            <div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:4px" id="aiKeyHint">${keyHint}</div>
          </div>
          <div class="form-group" style="margin-bottom:var(--space-md)">
            <label class="form-label">Model</label>
            <input class="form-input" id="aiModel" value="${model}">
          </div>
          <div style="display:flex;gap:var(--space-sm)">
            <button class="btn btn-secondary" id="aiTestBtn" style="flex:1">Test connection</button>
            <button class="btn btn-primary" id="aiSaveBtn" style="flex:1">💾 Save</button>
          </div>
        </div>
      </div>`;
  },

  _bindAi() {
    const enabledCb = document.getElementById('aiEnabledCb');
    const stateLabel = document.getElementById('aiStateLabel');
    enabledCb?.addEventListener('change', () => {
      if (stateLabel) stateLabel.textContent = enabledCb.checked ? 'On' : 'Off';
    });

    document.getElementById('aiTestBtn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const key = document.getElementById('aiApiKey')?.value?.trim() || null;
      const model = document.getElementById('aiModel')?.value?.trim() || null;
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = '⏳ Testing...';
      try {
        const res = await API.testAiKey({
          ...(key ? { ai_api_key: key } : {}),
          ...(model ? { ai_model: model } : {}),
        });
        if (res.ok) Toast.success(res.message || 'Connection successful ✅');
        else Toast.error(res.message || 'Connection failed');
      } catch (err) {
        Toast.error('Test failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });

    document.getElementById('aiSaveBtn')?.addEventListener('click', async () => {
      const enabled = !!document.getElementById('aiEnabledCb')?.checked;
      const key = document.getElementById('aiApiKey')?.value ?? '';
      const model = document.getElementById('aiModel')?.value?.trim() || 'claude-opus-4-8';
      const keySet = !!(this._aiStatus && this._aiStatus.key_set);

      if (enabled && !keySet && !key.trim()) {
        Toast.error('Enter a Claude API key first');
        return;
      }
      const payload = { ai_enabled: enabled, ai_model: model };
      if (key.trim()) payload.ai_api_key = key.trim();
      try {
        this._aiStatus = await API.updateAiSettings(payload);
        const input = document.getElementById('aiApiKey');
        if (input) {
          input.value = '';
          input.placeholder = this._aiStatus.key_set ? '•••••••••••••• (leave blank to keep)' : 'sk-ant-...';
        }
        const hint = document.getElementById('aiKeyHint');
        if (hint) {
          hint.textContent = this._aiStatus.key_set
            ? (this._aiStatus.key_source === 'env' ? '🔑 Using key from server environment' : '🔑 Key saved')
            : 'No key set yet';
        }
        Toast.success(enabled ? 'AI insights enabled ✨' : 'AI settings saved');
      } catch (err) {
        Toast.error('Failed to save: ' + err.message);
      }
    });
  },

  renderScheduleRow(s) {
    const days = s.interval_days;
    return `
      <div class="settings-item schedule-row" data-task="${s.task_type}"
           style="flex-direction:column;align-items:stretch;gap:var(--space-sm)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:var(--space-sm)">
            <span style="font-size:1.2rem">${s.icon || '📋'}</span>
            <div>
              <div class="settings-item-label">${s.display_name}</div>
              <div class="settings-item-value" id="interval-label-${s.task_type}">
                ${s.enabled ? `Every ${days} day${days !== 1 ? 's' : ''}` : 'Disabled'}
              </div>
            </div>
          </div>
          <label class="schedule-toggle" title="${s.enabled ? 'Enabled' : 'Disabled'}">
            <input type="checkbox" class="schedule-enabled-cb" data-task="${s.task_type}" ${s.enabled ? 'checked' : ''}>
            <span class="schedule-toggle-slider"></span>
          </label>
        </div>
        <div class="schedule-interval-row" id="interval-row-${s.task_type}"
             style="${s.enabled ? '' : 'display:none'}">
          <span style="font-size:var(--fs-xs);color:var(--text-muted)">Remind every</span>
          <div style="display:flex;align-items:center;gap:var(--space-sm)">
            <button class="stepper-btn stepper-sm" data-minus="${s.task_type}">−</button>
            <span class="interval-val" id="interval-val-${s.task_type}"
                  style="min-width:32px;text-align:center;font-size:var(--fs-md);font-weight:var(--fw-bold)">
              ${days}
            </span>
            <button class="stepper-btn stepper-sm" data-plus="${s.task_type}">+</button>
            <span style="font-size:var(--fs-xs);color:var(--text-muted)">days</span>
          </div>
        </div>
      </div>`;
  },

  renderSeasonCard(d) {
    const isOpen = d.pool_status === 'open';
    const statusText = isOpen ? 'Open & Active' : 'Closed & Winterized';
    const statusIcon = isOpen ? '🏊' : '❄️';
    const dateText = isOpen 
      ? (d.pool_opened_at ? `Opened on ${Fmt.date(d.pool_opened_at)}` : 'Current Season')
      : (d.pool_closed_at ? `Closed on ${Fmt.date(d.pool_closed_at)}` : 'Last Season');

    return `
      <div class="settings-group">
        <div class="section-title">Pool Season</div>
        <div class="card season-card ${d.pool_status}">
          <div class="season-status">
            <div class="season-icon">${statusIcon}</div>
            <div class="season-info">
              <div class="season-label">${statusText}</div>
              <div class="season-date">${dateText}</div>
            </div>
          </div>
          <div class="season-actions">
            ${isOpen 
              ? `<button class="btn btn-outline btn-block" id="closePoolBtn">❄️ Close Pool for Season</button>`
              : `<button class="btn btn-primary btn-block" id="openPoolBtn">🏊 Open Pool for Season</button>`
            }
          </div>
        </div>
      </div>`;
  },

  bind(data) {
    // Season actions
    document.getElementById('openPoolBtn')?.addEventListener('click', async () => {
      if (!confirm('Ready to open the pool for the season? This will enable Pool Care reminders.')) return;
      try {
        await API.openPool();
        Toast.success('Pool is now OPEN! 🏊✨');
        window.location.reload(); // Reload to update UI
      } catch (err) { Toast.error('Failed to open: ' + err.message); }
    });

    document.getElementById('closePoolBtn')?.addEventListener('click', async () => {
      if (!confirm('Winterizing the pool? This will pause all Pool Care reminders.')) return;
      try {
        await API.closePool();
        Toast.success('Pool is now CLOSED. ❄️😴');
        window.location.reload(); // Reload to update UI
      } catch (err) { Toast.error('Failed to close: ' + err.message); }
    });

    // Pool config save
    document.getElementById('savePool')?.addEventListener('click', async () => {
      try {
        await API.updatePool({
          name: document.getElementById('poolName').value,
          shape: document.getElementById('poolShape').value,
          length_ft: parseFloat(document.getElementById('poolLength').value) || null,
          depth_ft: parseFloat(document.getElementById('poolDepth').value) || null,
          volume_gallons: parseInt(document.getElementById('poolVolume').value) || null,
          pool_type: document.getElementById('poolType').value,
          sanitizer_type: document.getElementById('poolSanitizer').value,
          filter_type: document.getElementById('poolFilter').value,
        });
        Toast.success('Pool configuration saved! ⚙️');
      } catch (err) { Toast.error('Failed to save: ' + err.message); }
    });

    // Track interval values locally
    const intervals = {};
    (data.schedules || []).forEach(s => { intervals[s.task_type] = s.interval_days; });

    const saveSchedule = async (taskType) => {
      const enabled = document.querySelector(`.schedule-enabled-cb[data-task="${taskType}"]`)?.checked ?? true;
      try {
        await API.updateSchedule(taskType, { enabled, interval_days: intervals[taskType] });
      } catch (err) { Toast.error('Failed to save: ' + err.message); }
    };

    // Enable/disable toggle
    document.querySelectorAll('.schedule-enabled-cb').forEach(cb => {
      cb.addEventListener('change', async () => {
        const t = cb.dataset.task;
        const row = document.getElementById(`interval-row-${t}`);
        const lbl = document.getElementById(`interval-label-${t}`);
        row.style.display = cb.checked ? '' : 'none';
        if (lbl) lbl.textContent = cb.checked
          ? `Every ${intervals[t]} day${intervals[t] !== 1 ? 's' : ''}`
          : 'Disabled';
        await saveSchedule(t);
        Toast.success(cb.checked ? '✅ Task enabled' : '⏸ Task disabled');
      });
    });

    // Interval − stepper
    document.querySelectorAll('[data-minus]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = btn.dataset.minus;
        intervals[t] = Math.max(1, (intervals[t] || 7) - 1);
        document.getElementById(`interval-val-${t}`).textContent = intervals[t];
        document.getElementById(`interval-label-${t}`).textContent =
          `Every ${intervals[t]} day${intervals[t] !== 1 ? 's' : ''}`;
        await saveSchedule(t);
      });
    });

    // Interval + stepper
    document.querySelectorAll('[data-plus]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = btn.dataset.plus;
        intervals[t] = Math.min(365, (intervals[t] || 7) + 1);
        document.getElementById(`interval-val-${t}`).textContent = intervals[t];
        document.getElementById(`interval-label-${t}`).textContent =
          `Every ${intervals[t]} day${intervals[t] !== 1 ? 's' : ''}`;
        await saveSchedule(t);
      });
    });

    // ── Chemical Inventory ────────────────────────────────────────
    this._bindInventory();

    // ── AI Insights ───────────────────────────────────────────────
    this._bindAi();
  },

  _buildInventoryHTML() {
    const typeIcons = { shock: '⚡', algaecide: '🦠', clarifier: '✨', ph_up: '⬆️', ph_down: '⬇️', alkalinity_up: '🔼', cya: '☀️', hardness: '💧' };
    if (!this._inventory.length) {
      return `<div style="text-align:center;color:var(--text-muted);padding:var(--space-lg);font-size:var(--fs-sm)">No chemicals added yet.</div>`;
    }
    return this._inventory.map(item => `
      <div class="inv-row" data-product-id="${item.product_id}">
        <div class="inv-row-info">
          <span class="inv-type-icon">${typeIcons[item.product_type] || '🧪'}</span>
          <div class="inv-row-text">
            <div class="inv-product-name">${item.product_name || item.product_id}</div>
            <div style="color:var(--text-muted);font-size:var(--fs-xs)">${item.product_brand || ''}</div>
          </div>
        </div>
        <div class="inv-row-controls">
          <input type="number" class="inv-qty-input form-input" value="${item.quantity}" min="0" step="0.5"
            data-product-id="${item.product_id}" style="width:64px;text-align:center;padding:4px">
          <span style="font-size:var(--fs-xs);color:var(--text-muted)">${item.unit}</span>
          <button class="inv-remove-btn" data-product-id="${item.product_id}" title="Remove">✕</button>
        </div>
      </div>`).join('');
  },

  async _saveInventoryToServer() {
    try {
      const saved = await API.saveChemicalInventory(this._inventory.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit: i.unit,
      })));
      this._inventory = saved;
    } catch (err) { Toast.error('Failed to save inventory: ' + err.message); }
  },

  _bindInventory() {
    const listEl = document.getElementById('inventoryList');
    if (!listEl) return;

    const refresh = () => {
      listEl.innerHTML = this._buildInventoryHTML();
      this._bindInventoryRows();
    };
    this._bindInventoryRows = () => {
      listEl.querySelectorAll('.inv-qty-input').forEach(input => {
        input.addEventListener('change', async () => {
          const pid = input.dataset.productId;
          const item = this._inventory.find(i => i.product_id === pid);
          if (item) { item.quantity = parseFloat(input.value) || 0; }
          await this._saveInventoryToServer();
        });
      });
      listEl.querySelectorAll('.inv-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pid = btn.dataset.productId;
          this._inventory = this._inventory.filter(i => i.product_id !== pid);
          await this._saveInventoryToServer();
          refresh();
          Toast.success('Chemical removed');
        });
      });
    };
    this._bindInventoryRows();

    document.getElementById('addInventoryBtn')?.addEventListener('click', async () => {
      const select = document.getElementById('addProductSelect');
      const pid = select?.value;
      if (!pid) { Toast.error('Select a product first'); return; }

      const existing = this._inventory.find(i => i.product_id === pid);
      if (existing) { Toast.error('That product is already in your inventory'); return; }

      const qty = parseFloat(document.getElementById('addProductQty')?.value) || 1;
      const unit = document.getElementById('addProductUnit')?.value || 'lbs';

      // Find product info from catalog
      let productInfo = null;
      for (const [typeName, products] of Object.entries(this._products || {})) {
        const found = products.find(p => p.id === pid);
        if (found) { productInfo = { ...found, product_type: typeName }; break; }
      }

      this._inventory.push({
        product_id: pid,
        quantity: qty,
        unit,
        product_name: productInfo?.name || pid,
        product_brand: productInfo?.brand || '',
        product_type: productInfo?.type || productInfo?.product_type || '',
      });

      await this._saveInventoryToServer();
      refresh();
      if (select) select.value = '';
      Toast.success('Chemical added to inventory ✅');
    });
  },
};
