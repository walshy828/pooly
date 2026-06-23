/** Settings page */
const SettingsPage = {
  _inventory: [],
  _products: {},
  _allProducts: {},       // full catalog from /api/products (with enabled flags)
  _catalogFilter: '',     // active type filter in catalog section

  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, inventory, products, allProducts, aiStatus] = await Promise.all([
        API.getSettings(),
        API.getChemicalInventory().catch(() => []),
        API.getChemicalProducts().catch(() => ({})),
        API.getAllProducts().catch(() => ({})),
        API.getAiStatus().catch(() => ({ enabled: false, key_set: false, provider: 'claude', model: 'claude-opus-4-8' })),
      ]);
      this._inventory    = inventory;
      this._products     = products;
      this._allProducts  = allProducts;
      this._aiStatus     = aiStatus;
      container.innerHTML = this.buildHTML(data);
      this.bind(data);
    } catch (err) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px">
          <div style="font-size:2.5rem">⚙️</div>
          <div style="font-size:16px;color:rgba(245,245,247,0.5)">Could not load settings</div>
        </div>`;
    }
  },

  buildHTML(d) {
    const scheduleRows = (d.schedules || []).map(s => this.renderScheduleRow(s)).join('');

    return `
      <div class="page-header"><div class="page-title">Settings</div></div>
      <div style="padding:0 16px 32px">

        ${this.renderSeasonCard(d)}

        <div class="section-label">Pool Profile</div>
        <div class="settings-section">
          ${this._field('Pool Name',         `<input id="poolName" value="${d.pool?.name || 'My Pool'}">`)}
          ${this._field('Shape',             `<select id="poolShape">${['round','oval','rectangular'].map(v=>`<option value="${v}"${d.pool?.shape===v?' selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}</select>`)}
          ${this._field('Diameter / Length', `<input type="number" id="poolLength" value="${d.pool?.length_ft||''}" placeholder="ft">`)}
          ${this._field('Depth (ft)',        `<input type="number" id="poolDepth"  value="${d.pool?.depth_ft||''}"  placeholder="ft">`)}
          ${this._field('Volume (gal)',      `<input type="number" id="poolVolume" value="${d.pool?.volume_gallons||''}" placeholder="gallons">`)}
          ${this._field('Pool Type',         `<select id="poolType"><option value="above_ground"${d.pool?.pool_type==='above_ground'?' selected':''}>Above Ground</option><option value="in_ground"${d.pool?.pool_type==='in_ground'?' selected':''}>In Ground</option></select>`)}
          ${this._field('Sanitizer',         `<select id="poolSanitizer"><option value="chlorine"${d.pool?.sanitizer_type==='chlorine'?' selected':''}>Chlorine</option><option value="salt"${d.pool?.sanitizer_type==='salt'?' selected':''}>Salt</option><option value="bromine"${d.pool?.sanitizer_type==='bromine'?' selected':''}>Bromine</option></select>`)}
          ${this._field('Filter Type',       `<select id="poolFilter"><option value="cartridge"${d.pool?.filter_type==='cartridge'?' selected':''}>Cartridge</option><option value="sand"${d.pool?.filter_type==='sand'?' selected':''}>Sand</option><option value="de"${d.pool?.filter_type==='de'?' selected':''}>DE</option></select>`)}
          <div style="padding:14px 16px">
            <button class="btn btn-primary" id="savePool" style="width:100%;height:48px">Save Pool Profile</button>
          </div>
        </div>

        ${this.renderInventorySection()}

        ${this.renderCatalogSection()}

        ${this.renderAiSection()}

        <div class="section-label">Pool Care Schedules</div>
        <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:-4px 0 10px">
          Toggle tasks and adjust reminder frequency — changes save automatically.
        </div>
        <div class="settings-section" id="schedulesContainer">${scheduleRows}</div>

        <div class="section-label">Integrations</div>
        <div class="settings-section">
          ${this._statusRow('🏠 Home Assistant', d.ha_enabled, d.ha_enabled ? 'Connected' : 'Not Configured')}
          ${this._statusRow('🌤️ Weather',         d.weather_enabled, d.weather_enabled ? 'Active' : 'Not Configured')}
          ${this._statusRow('🔒 PIN Lock',        d.pin_enabled, d.pin_enabled ? 'Enabled' : 'Disabled')}
        </div>

        <div style="text-align:center;padding:28px 0 8px">
          <div style="color:rgba(245,245,247,0.3);font-size:13px">Pooly v1.0.0</div>
          <div style="color:rgba(245,245,247,0.2);font-size:11px;margin-top:4px">Pool Maintenance Manager</div>
        </div>
      </div>`;
  },

  _field(label, inputHtml) {
    return `
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 16px">
        <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4)">${label}</div>
        ${inputHtml}
      </div>`;
  },

  _statusRow(label, active, valueText) {
    const color = active ? '#30D158' : 'rgba(245,245,247,0.3)';
    return `
      <div class="settings-row">
        <span class="settings-row-label">${label}</span>
        <span style="font-size:12px;font-weight:600;color:${color}">${valueText}</span>
      </div>`;
  },

  // ── Season Card ─────────────────────────────────
  renderSeasonCard(d) {
    const isOpen = d.pool_status === 'open';
    const statusColor = isOpen ? '#30D158' : '#0A84FF';

    return `
      <div class="section-label">Pool Season</div>
      <div class="bento-card" style="margin-bottom:0">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:48px;height:48px;border-radius:50%;background:${statusColor}18;display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">
            ${isOpen ? '🏊' : '❄️'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;color:#F5F5F7">${isOpen ? 'Pool is Open' : 'Pool is Closed'}</div>
            <div style="font-size:12px;color:rgba(245,245,247,0.45);margin-top:2px">
              ${isOpen
                ? (d.pool_opened_at ? `Opened ${Fmt.date(d.pool_opened_at)}` : 'Current Season')
                : (d.pool_closed_at ? `Closed ${Fmt.date(d.pool_closed_at)}` : 'Winterized')}
            </div>
          </div>
          <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}30">
            ${isOpen ? 'Active' : 'Closed'}
          </span>
        </div>
        <button class="btn ${isOpen ? 'btn-secondary' : 'btn-primary'}" id="${isOpen ? 'closePoolBtn' : 'openPoolBtn'}"
          style="width:100%;margin-top:14px;height:44px;font-size:14px">
          ${isOpen ? '❄️ Close Pool for Season' : '🏊 Open Pool for Season'}
        </button>
      </div>`;
  },

  // ── Chemical Inventory ──────────────────────────
  renderInventorySection() {
    const typeIcons = {
      shock:'⚡', algaecide:'🦠', clarifier:'✨', ph_up:'⬆️', ph_down:'⬇️',
      alkalinity_up:'🔼', cya:'☀️', hardness:'💧',
    };
    const typeLabels = {
      shock:'Shock', algaecide:'Algaecide', clarifier:'Clarifier',
      ph_up:'pH Up', ph_down:'pH Down', alkalinity_up:'Alkalinity Up',
      cya:'CYA Stabilizer', hardness:'Calcium Hardness',
    };

    const inventoryRows = (this._inventory || []).length
      ? (this._inventory || []).map(item => `
          <div class="settings-row" style="gap:10px" data-product-id="${item.product_id}">
            <span style="font-size:1.2rem;width:24px;text-align:center;flex-shrink:0">${typeIcons[item.product_type] || '🧪'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;color:#F5F5F7;font-weight:500">${item.product_name || item.product_id}</div>
              ${item.product_brand ? `<div style="font-size:11px;color:rgba(245,245,247,0.35)">${item.product_brand}</div>` : ''}
            </div>
            <input type="number" class="inv-qty-input" value="${item.quantity}" min="0" step="0.5"
              data-product-id="${item.product_id}"
              style="width:60px;text-align:center;padding:7px 6px;font-size:14px;font-weight:600;border-radius:10px;flex-shrink:0">
            <span style="font-size:11px;color:rgba(245,245,247,0.35);flex-shrink:0">${item.unit}</span>
            <button class="inv-remove-btn" data-product-id="${item.product_id}" title="Remove"
              style="width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,69,58,0.2);background:rgba(255,69,58,0.08);color:#FF453A;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ✕
            </button>
          </div>`).join('')
      : `<div style="padding:24px 16px;text-align:center;color:rgba(245,245,247,0.3);font-size:14px">
          No chemicals added yet — add what you have below.
        </div>`;

    // Build picker from full catalog (enabled products only), falling back to built-in list
    const pickerSource = Object.keys(this._allProducts).length ? this._allProducts : this._products;
    const optGroups = Object.entries(pickerSource).map(([typeName, products]) => {
      const label = typeLabels[typeName] || typeName;
      const enabled = (products || []).filter(p => p.enabled !== false);
      const opts = enabled.map(p => `<option value="${p.id}">${p.name}${p.is_custom ? ' ★' : ''}</option>`).join('');
      return opts ? `<optgroup label="${typeIcons[typeName] || '🧪'} ${label}">${opts}</optgroup>` : '';
    }).filter(Boolean).join('');

    return `
      <div class="section-label">Chemical Inventory</div>
      <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:-4px 0 10px">
        Track what you have on hand — treatment plans use these for exact dosing.
      </div>
      <div class="settings-section" id="inventoryList">
        ${inventoryRows}
      </div>
      <div class="bento-card bento-card-sm" style="margin-top:8px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(245,245,247,0.35);margin-bottom:10px">Add Product</div>
        <select id="addProductSelect" style="margin-bottom:10px">
          <option value="">— Select a product —</option>
          ${optGroups}
        </select>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="addProductQty" placeholder="Qty" min="0" step="0.5" value="1" style="width:72px;flex-shrink:0">
          <select id="addProductUnit" style="flex:1">
            <option value="lbs">lbs</option>
            <option value="gallons">gallons</option>
            <option value="quarts">quarts</option>
            <option value="oz">oz</option>
            <option value="bags">bags</option>
            <option value="bottles">bottles</option>
          </select>
          <button class="btn btn-primary" id="addInventoryBtn" style="flex-shrink:0;padding:11px 16px;font-size:14px">+ Add</button>
        </div>
      </div>`;
  },

  // ── Product Catalog ──────────────────────────────

  _typeLabels: {
    shock:'Shock', algaecide:'Algaecide', clarifier:'Clarifier',
    ph_up:'pH Up', ph_down:'pH Down', alkalinity_up:'Alkalinity Up',
    cya:'CYA Stabilizer', hardness:'Calcium Hardness', other:'Other',
  },
  _typeIcons: {
    shock:'⚡', algaecide:'🦠', clarifier:'✨', ph_up:'⬆️', ph_down:'⬇️',
    alkalinity_up:'🔼', cya:'☀️', hardness:'💧', other:'🧪',
  },

  renderCatalogSection() {
    const types = Object.keys(this._allProducts).sort();
    const activeType = this._catalogFilter || types[0] || 'shock';
    const products = (this._allProducts[activeType] || []);

    const typeChips = types.map(t => `
      <button class="cat-chip${t === activeType ? ' active' : ''}" data-catalog-type="${t}">
        ${this._typeIcons[t] || '🧪'} ${this._typeLabels[t] || t}
      </button>`).join('');

    const productRows = products.length
      ? products.map(p => this._renderCatalogRow(p)).join('')
      : `<div style="padding:20px 16px;text-align:center;color:rgba(245,245,247,0.3);font-size:13px">No products in this category</div>`;

    return `
      <div class="section-label">Product Catalog</div>
      <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:-4px 0 10px">
        Manage which products appear in your inventory picker. Add your own products or disable built-ins you don't use.
      </div>

      <!-- Type filter chips -->
      <div class="cat-chips" id="catalogTypeChips" style="margin-bottom:10px">
        ${typeChips}
      </div>

      <!-- Product list -->
      <div class="settings-section" id="catalogProductList">
        ${productRows}
      </div>

      <!-- Add custom product button -->
      <button class="btn btn-secondary" id="addProductBtn"
        style="width:100%;margin-top:10px;height:44px;font-size:14px;border-radius:14px">
        + Add Custom Product
      </button>

      <!-- Add/Edit drawer -->
      <div class="drawer-overlay hidden" id="productDrawerOverlay"></div>
      <div class="filter-drawer" id="productDrawer" style="display:none">
        <div class="drawer-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-size:17px;font-weight:700;color:#F5F5F7" id="productDrawerTitle">Add Custom Product</div>
          <button class="modal-close-btn" id="productDrawerClose">✕</button>
        </div>
        <div id="productDrawerForm">
          ${this._productFormHTML()}
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-secondary" id="productDrawerCancel" style="flex:1">Cancel</button>
          <button class="btn btn-primary" id="productDrawerSave" style="flex:1">Save Product</button>
        </div>
      </div>`;
  },

  _renderCatalogRow(p) {
    const icon     = this._typeIcons[p.type] || '🧪';
    const sizeStr  = p.package_size && p.package_unit ? `${p.package_size} ${p.package_unit}` : '';
    const brandStr = [p.brand, sizeStr, p.form].filter(Boolean).join(' · ');
    const customBadge = p.is_custom
      ? `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(0,200,212,0.12);color:#00C8D4;border:1px solid rgba(0,200,212,0.2)">Custom</span>`
      : '';

    return `
      <div class="settings-row" style="gap:10px;flex-wrap:wrap" data-product-id="${p.id}" data-catalog-id="${p.catalog_id || ''}">
        <span style="font-size:1.1rem;width:22px;text-align:center;flex-shrink:0">${icon}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:600;color:${p.enabled ? '#F5F5F7' : 'rgba(245,245,247,0.35)'}">
              ${p.name}
            </span>
            ${customBadge}
          </div>
          ${brandStr ? `<div style="font-size:11px;color:rgba(245,245,247,0.35);margin-top:2px">${brandStr}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${p.is_custom ? `
            <button data-edit-product="${p.catalog_id}" title="Edit"
              style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);cursor:pointer;color:rgba(245,245,247,0.5);display:flex;align-items:center;justify-content:center">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button data-delete-product="${p.catalog_id}" data-product-name="${p.name}" title="Delete"
              style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,69,58,0.15);background:rgba(255,69,58,0.06);cursor:pointer;color:#FF453A;display:flex;align-items:center;justify-content:center">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>` : ''}
          <label class="toggle-switch" title="${p.enabled ? 'Enabled' : 'Disabled'}">
            <input type="checkbox" class="catalog-enabled-cb" data-product-id="${p.id}"
              data-is-custom="${p.is_custom}" data-catalog-id="${p.catalog_id || ''}" ${p.enabled ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>`;
  },

  _productFormHTML(p = {}) {
    const types = Object.keys(this._typeLabels);
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Product Name *</div>
          <input id="pf_name" placeholder="e.g. Super Blue Clarifier" value="${p.name || ''}">
        </div>
        <div>
          <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Brand</div>
          <input id="pf_brand" placeholder="e.g. Robarb" value="${p.brand || ''}">
        </div>
        <div>
          <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Type *</div>
          <select id="pf_type">
            ${types.map(t => `<option value="${t}"${(p.type||p.product_type) === t ? ' selected' : ''}>${this._typeLabels[t]}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Form</div>
            <select id="pf_form">
              ${['granular','liquid','tablet','powder'].map(f => `<option value="${f}"${p.form===f?' selected':''}>${f.charAt(0).toUpperCase()+f.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Size</div>
            <input type="number" id="pf_size" placeholder="e.g. 32" min="0" step="0.1" value="${p.package_size || ''}">
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Unit</div>
          <select id="pf_unit">
            ${['oz','lbs','gallons','quarts','bags','bottles'].map(u => `<option value="${u}"${p.package_unit===u?' selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Notes / Usage</div>
          <textarea id="pf_notes" rows="2" placeholder="e.g. Use 1 oz per 5,000 gal; run pump 24 hrs after">${p.notes || ''}</textarea>
        </div>
      </div>`;
  },

  _bindCatalog() {
    let editingCatalogId = null;

    const openDrawer = (title, product = {}) => {
      editingCatalogId = product.catalog_id || null;
      document.getElementById('productDrawerTitle').textContent = title;
      document.getElementById('productDrawerForm').innerHTML = this._productFormHTML(product);
      document.getElementById('productDrawer').style.display = 'block';
      document.getElementById('productDrawerOverlay').classList.remove('hidden');
    };
    const closeDrawer = () => {
      document.getElementById('productDrawer').style.display = 'none';
      document.getElementById('productDrawerOverlay').classList.add('hidden');
      editingCatalogId = null;
    };

    document.getElementById('addProductBtn')?.addEventListener('click', () => openDrawer('Add Custom Product'));
    document.getElementById('productDrawerClose')?.addEventListener('click', closeDrawer);
    document.getElementById('productDrawerCancel')?.addEventListener('click', closeDrawer);
    document.getElementById('productDrawerOverlay')?.addEventListener('click', closeDrawer);

    // Save (create or update)
    document.getElementById('productDrawerSave')?.addEventListener('click', async () => {
      const name  = document.getElementById('pf_name')?.value?.trim();
      if (!name) { Toast.error('Product name is required'); return; }

      const data = {
        name,
        brand:        document.getElementById('pf_brand')?.value?.trim() || null,
        product_type: document.getElementById('pf_type')?.value,
        form:         document.getElementById('pf_form')?.value,
        package_size: parseFloat(document.getElementById('pf_size')?.value) || null,
        package_unit: document.getElementById('pf_unit')?.value,
        notes:        document.getElementById('pf_notes')?.value?.trim() || null,
      };

      const btn = document.getElementById('productDrawerSave');
      btn.disabled = true;
      try {
        if (editingCatalogId) {
          await API.updateProduct(editingCatalogId, data);
          Toast.success('Product updated');
        } else {
          await API.createProduct(data);
          Toast.success('Product added to catalog ✅');
        }
        closeDrawer();
        await this._refreshCatalog();
      } catch (err) {
        Toast.error('Failed to save: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    // Type filter chips
    document.getElementById('catalogTypeChips')?.addEventListener('click', async (e) => {
      const chip = e.target.closest('[data-catalog-type]');
      if (!chip) return;
      this._catalogFilter = chip.dataset.catalogType;
      await this._refreshCatalog();
    });

    // Delegate edit, delete, toggle from the product list
    document.getElementById('catalogProductList')?.addEventListener('click', async (e) => {
      // Edit
      const editBtn = e.target.closest('[data-edit-product]');
      if (editBtn) {
        const catalogId = parseInt(editBtn.dataset.editProduct);
        const type = this._catalogFilter || '';
        const products = this._allProducts[type] || [];
        const p = products.find(x => x.catalog_id === catalogId);
        if (p) openDrawer('Edit Product', p);
        return;
      }

      // Delete
      const delBtn = e.target.closest('[data-delete-product]');
      if (delBtn) {
        const catalogId  = parseInt(delBtn.dataset.deleteProduct);
        const productName = delBtn.dataset.productName;
        if (!confirm(`Delete "${productName}" from your catalog? This cannot be undone.`)) return;
        try {
          await API.deleteProduct(catalogId);
          Toast.success('Product deleted');
          await this._refreshCatalog();
        } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
        return;
      }
    });

    // Toggle enabled/disabled
    document.getElementById('catalogProductList')?.addEventListener('change', async (e) => {
      const cb = e.target.closest('.catalog-enabled-cb');
      if (!cb) return;
      const enabled   = cb.checked;
      const isCustom  = cb.dataset.isCustom === 'true';
      const catalogId = parseInt(cb.dataset.catalogId);
      const productId = cb.dataset.productId;

      try {
        if (isCustom) {
          await API.updateProduct(catalogId, { enabled });
        } else {
          await API.toggleBuiltinProduct(productId, enabled);
        }
        // Update local cache
        const type = this._catalogFilter || '';
        const products = this._allProducts[type] || [];
        const p = products.find(x => x.id === productId);
        if (p) p.enabled = enabled;

        // Update the product name color in row
        const row = cb.closest('.settings-row');
        const nameEl = row?.querySelector('[style*="font-weight:600"]');
        if (nameEl) nameEl.style.color = enabled ? '#F5F5F7' : 'rgba(245,245,247,0.35)';
      } catch (err) {
        cb.checked = !enabled; // revert
        Toast.error('Failed to update: ' + err.message);
      }
    });
  },

  async _refreshCatalog() {
    try {
      this._allProducts = await API.getAllProducts();
    } catch (err) { /* keep stale data */ }

    const activeType = this._catalogFilter || Object.keys(this._allProducts)[0] || '';
    const listEl = document.getElementById('catalogProductList');
    const chipsEl = document.getElementById('catalogTypeChips');

    if (listEl) {
      const products = this._allProducts[activeType] || [];
      listEl.innerHTML = products.length
        ? products.map(p => this._renderCatalogRow(p)).join('')
        : `<div style="padding:20px 16px;text-align:center;color:rgba(245,245,247,0.3);font-size:13px">No products in this category</div>`;
    }

    if (chipsEl) {
      const types = Object.keys(this._allProducts).sort();
      chipsEl.innerHTML = types.map(t => `
        <button class="cat-chip${t === activeType ? ' active' : ''}" data-catalog-type="${t}">
          ${this._typeIcons[t] || '🧪'} ${this._typeLabels[t] || t}
        </button>`).join('');
    }
  },

  // ── AI Insights ──────────────────────────────────
  _aiModelOptions: {
    claude: [
      { value: 'claude-opus-4-8',           label: 'Opus 4.8 — Most capable' },
      { value: 'claude-sonnet-4-6',          label: 'Sonnet 4.6 — Balanced' },
      { value: 'claude-haiku-4-5-20251001',  label: 'Haiku 4.5 — Fast' },
    ],
    gemini: [
      { value: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro — Most capable' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — Balanced' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Fast' },
    ],
  },

  _aiKeyPlaceholder(provider, keySet) {
    if (keySet) return '•••••••••••••• (leave blank to keep)';
    return provider === 'gemini' ? 'AIza...' : 'sk-ant-...';
  },

  renderAiSection() {
    const ai       = this._aiStatus || {};
    const enabled  = !!ai.enabled;
    const keySet   = !!ai.key_set;
    const provider = ai.provider || 'claude';
    const model    = ai.model    || 'claude-opus-4-8';
    const keyHint  = keySet
      ? (ai.key_source === 'env' ? '🔑 Using key from server environment' : '🔑 Key saved')
      : 'No key set yet';
    const placeholder = this._aiKeyPlaceholder(provider, keySet);
    const keyLabel = provider === 'gemini' ? 'Google AI API Key' : 'Anthropic API Key';

    const providerOpts = [
      { value: 'claude', label: '🤖 Claude (Anthropic)' },
      { value: 'gemini', label: '✦ Gemini (Google)' },
    ].map(o => `<option value="${o.value}"${o.value === provider ? ' selected' : ''}>${o.label}</option>`).join('');

    const modelOpts = (this._aiModelOptions[provider] || [])
      .map(o => `<option value="${o.value}"${o.value === model ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    return `
      <div class="section-label">✨ AI Insights</div>
      <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:-4px 0 10px">
        Optional. Connect Claude or Gemini for a plain-language daily briefing. Chemical doses always stay rule-based.
      </div>
      <div class="settings-section">
        <div class="settings-row">
          <div style="flex:1">
            <div class="settings-row-label">Enable AI insights</div>
            <div class="settings-row-value" id="aiStateLabel">${enabled ? 'On' : 'Off'}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" class="ai-enabled-cb" id="aiEnabledCb" ${enabled ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
      <div class="bento-card bento-card-sm" style="margin-top:8px">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Provider</div>
            <select id="aiProvider">${providerOpts}</select>
          </div>
          <div>
            <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px">Model</div>
            <select id="aiModel">${modelOpts}</select>
          </div>
          <div>
            <div style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.4);margin-bottom:6px" id="aiKeyLabel">${keyLabel}</div>
            <input type="password" id="aiApiKey" placeholder="${placeholder}" autocomplete="off">
            <div style="font-size:11px;color:rgba(245,245,247,0.35);margin-top:5px" id="aiKeyHint">${keyHint}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" id="aiTestBtn" style="flex:1">Test connection</button>
            <button class="btn btn-primary" id="aiSaveBtn" style="flex:1">Save</button>
          </div>
        </div>
      </div>`;
  },

  // ── Schedule Row ────────────────────────────────
  renderScheduleRow(s) {
    const days = s.interval_days;
    return `
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:0" data-task="${s.task_type}">
        <div style="display:flex;align-items:center;gap:12px;padding:2px 0">
          <span style="font-size:1.2rem;width:24px;text-align:center;flex-shrink:0">${s.icon || '📋'}</span>
          <div style="flex:1;min-width:0">
            <div class="settings-row-label">${s.display_name}</div>
            <div class="settings-row-value" id="interval-label-${s.task_type}">
              ${s.enabled ? `Every ${days} day${days !== 1 ? 's' : ''}` : 'Disabled'}
            </div>
          </div>
          <label class="toggle-switch" title="${s.enabled ? 'Enabled' : 'Disabled'}">
            <input type="checkbox" class="schedule-enabled-cb" data-task="${s.task_type}" ${s.enabled ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="schedule-interval-row" id="interval-row-${s.task_type}" style="${s.enabled ? '' : 'display:none'}">
          <span style="font-size:12px;color:rgba(245,245,247,0.4)">Remind every</span>
          <div style="display:flex;align-items:center;gap:8px">
            <button style="width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#F5F5F7;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center" data-minus="${s.task_type}">−</button>
            <span id="interval-val-${s.task_type}" style="min-width:28px;text-align:center;font-size:16px;font-weight:700;color:#F5F5F7">${days}</span>
            <button style="width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#F5F5F7;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center" data-plus="${s.task_type}">+</button>
            <span style="font-size:12px;color:rgba(245,245,247,0.4)">days</span>
          </div>
        </div>
      </div>`;
  },

  // ── Bind (all logic unchanged) ──────────────────
  bind(data) {
    document.getElementById('openPoolBtn')?.addEventListener('click', async () => {
      if (!confirm('Ready to open the pool for the season? This will enable Pool Care reminders.')) return;
      try {
        await API.openPool();
        Toast.success('Pool is now OPEN! 🏊✨');
        window.location.reload();
      } catch (err) { Toast.error('Failed to open: ' + err.message); }
    });

    document.getElementById('closePoolBtn')?.addEventListener('click', async () => {
      if (!confirm('Winterizing the pool? This will pause all Pool Care reminders.')) return;
      try {
        await API.closePool();
        Toast.success('Pool is now CLOSED. ❄️😴');
        window.location.reload();
      } catch (err) { Toast.error('Failed to close: ' + err.message); }
    });

    document.getElementById('savePool')?.addEventListener('click', async () => {
      try {
        await API.updatePool({
          name:            document.getElementById('poolName').value,
          shape:           document.getElementById('poolShape').value,
          length_ft:       parseFloat(document.getElementById('poolLength').value) || null,
          depth_ft:        parseFloat(document.getElementById('poolDepth').value) || null,
          volume_gallons:  parseInt(document.getElementById('poolVolume').value) || null,
          pool_type:       document.getElementById('poolType').value,
          sanitizer_type:  document.getElementById('poolSanitizer').value,
          filter_type:     document.getElementById('poolFilter').value,
        });
        Toast.success('Pool configuration saved! ⚙️');
      } catch (err) { Toast.error('Failed to save: ' + err.message); }
    });

    const intervals = {};
    (data.schedules || []).forEach(s => { intervals[s.task_type] = s.interval_days; });

    const saveSchedule = async (taskType) => {
      const enabled = document.querySelector(`.schedule-enabled-cb[data-task="${taskType}"]`)?.checked ?? true;
      try {
        await API.updateSchedule(taskType, { enabled, interval_days: intervals[taskType] });
      } catch (err) { Toast.error('Failed to save: ' + err.message); }
    };

    document.querySelectorAll('.schedule-enabled-cb').forEach(cb => {
      cb.addEventListener('change', async () => {
        const t = cb.dataset.task;
        const row = document.getElementById(`interval-row-${t}`);
        const lbl = document.getElementById(`interval-label-${t}`);
        if (row) row.style.display = cb.checked ? '' : 'none';
        if (lbl) lbl.textContent = cb.checked
          ? `Every ${intervals[t]} day${intervals[t] !== 1 ? 's' : ''}`
          : 'Disabled';
        await saveSchedule(t);
        Toast.success(cb.checked ? '✅ Task enabled' : '⏸ Task disabled');
      });
    });

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

    this._bindInventory();
    this._bindCatalog();
    this._bindAi();
  },

  _buildInventoryHTML() {
    const typeIcons = { shock:'⚡', algaecide:'🦠', clarifier:'✨', ph_up:'⬆️', ph_down:'⬇️', alkalinity_up:'🔼', cya:'☀️', hardness:'💧' };
    if (!this._inventory.length) {
      return `<div style="padding:24px 16px;text-align:center;color:rgba(245,245,247,0.3);font-size:14px">No chemicals added yet.</div>`;
    }
    return this._inventory.map(item => `
      <div class="settings-row" style="gap:10px" data-product-id="${item.product_id}">
        <span style="font-size:1.2rem;width:24px;text-align:center;flex-shrink:0">${typeIcons[item.product_type] || '🧪'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;color:#F5F5F7;font-weight:500">${item.product_name || item.product_id}</div>
          ${item.product_brand ? `<div style="font-size:11px;color:rgba(245,245,247,0.35)">${item.product_brand}</div>` : ''}
        </div>
        <input type="number" class="inv-qty-input" value="${item.quantity}" min="0" step="0.5"
          data-product-id="${item.product_id}"
          style="width:60px;text-align:center;padding:7px 6px;font-size:14px;font-weight:600;border-radius:10px;flex-shrink:0">
        <span style="font-size:11px;color:rgba(245,245,247,0.35);flex-shrink:0">${item.unit}</span>
        <button class="inv-remove-btn" data-product-id="${item.product_id}" title="Remove"
          style="width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,69,58,0.2);background:rgba(255,69,58,0.08);color:#FF453A;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ✕
        </button>
      </div>`).join('');
  },

  async _saveInventoryToServer() {
    try {
      const saved = await API.saveChemicalInventory(this._inventory.map(i => ({
        product_id: i.product_id, quantity: i.quantity, unit: i.unit,
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

      const qty  = parseFloat(document.getElementById('addProductQty')?.value) || 1;
      const unit = document.getElementById('addProductUnit')?.value || 'lbs';

      let productInfo = null;
      // Search full catalog first (includes custom), then fall back to built-in
      const searchSources = [this._allProducts, this._products];
      for (const source of searchSources) {
        for (const [typeName, products] of Object.entries(source || {})) {
          const found = products.find(p => p.id === pid);
          if (found) { productInfo = { ...found, product_type: found.type || typeName }; break; }
        }
        if (productInfo) break;
      }

      this._inventory.push({
        product_id:    pid,
        quantity:      qty,
        unit,
        product_name:  productInfo?.name || pid,
        product_brand: productInfo?.brand || '',
        product_type:  productInfo?.type || productInfo?.product_type || '',
      });

      await this._saveInventoryToServer();
      refresh();
      if (select) select.value = '';
      Toast.success('Chemical added to inventory ✅');
    });
  },

  _bindAi() {
    const enabledCb  = document.getElementById('aiEnabledCb');
    const stateLabel = document.getElementById('aiStateLabel');
    enabledCb?.addEventListener('change', () => {
      if (stateLabel) stateLabel.textContent = enabledCb.checked ? 'On' : 'Off';
    });

    const providerSel = document.getElementById('aiProvider');
    const modelSel    = document.getElementById('aiModel');
    const keyLabel    = document.getElementById('aiKeyLabel');
    const keyInput    = document.getElementById('aiApiKey');

    providerSel?.addEventListener('change', () => {
      const p = providerSel.value;
      const opts = (this._aiModelOptions[p] || [])
        .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      if (modelSel) modelSel.innerHTML = opts;
      if (keyLabel) keyLabel.textContent = p === 'gemini' ? 'Google AI API Key' : 'Anthropic API Key';
      if (keyInput) {
        keyInput.value = '';
        keyInput.placeholder = this._aiKeyPlaceholder(p, false);
      }
      const hint = document.getElementById('aiKeyHint');
      if (hint) hint.textContent = 'No key set yet';
    });

    document.getElementById('aiTestBtn')?.addEventListener('click', async (e) => {
      const btn  = e.currentTarget;
      const key  = keyInput?.value?.trim() || null;
      const model    = modelSel?.value || null;
      const provider = providerSel?.value || null;
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = '⏳ Testing…';
      try {
        const res = await API.testAiKey({
          ...(key      ? { ai_api_key: key }      : {}),
          ...(model    ? { ai_model: model }       : {}),
          ...(provider ? { ai_provider: provider } : {}),
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
      const enabled  = !!enabledCb?.checked;
      const key      = keyInput?.value ?? '';
      const model    = modelSel?.value    || 'claude-opus-4-8';
      const provider = providerSel?.value || 'claude';
      const keySet   = !!(this._aiStatus && this._aiStatus.key_set);

      if (enabled && !keySet && !key.trim()) {
        const providerName = provider === 'gemini' ? 'Google AI' : 'Anthropic';
        Toast.error(`Enter a ${providerName} API key first`);
        return;
      }
      const payload = { ai_enabled: enabled, ai_provider: provider, ai_model: model };
      if (key.trim()) payload.ai_api_key = key.trim();
      try {
        this._aiStatus = await API.updateAiSettings(payload);
        if (keyInput) {
          keyInput.value = '';
          keyInput.placeholder = this._aiKeyPlaceholder(provider, this._aiStatus.key_set);
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
};
