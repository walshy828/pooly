/** Product Catalog — manage which products appear in the inventory picker */
const CatalogPage = {
  _allProducts: {},
  _catalogFilter: '',

  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      this._allProducts = await API.getAllProducts().catch(() => ({}));
      container.innerHTML = this.buildHTML();
      this.bind();
    } catch (err) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px">
          <div style="font-size:2.5rem">🛒</div>
          <div style="font-size:16px;color:rgba(245,245,247,0.5)">Could not load product catalog</div>
        </div>`;
    }
  },

  _header(title) {
    return `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button id="catBack" class="btn btn-secondary btn-sm" style="padding:8px 12px">←</button>
        <div class="page-title">${title}</div>
      </div>`;
  },

  _typeLabels: {
    shock:'Shock', algaecide:'Algaecide', clarifier:'Clarifier',
    ph_up:'pH Up', ph_down:'pH Down', alkalinity_up:'Alkalinity Up',
    cya:'CYA Stabilizer', hardness:'Calcium Hardness', other:'Other',
  },
  _typeIcons: {
    shock:'⚡', algaecide:'🦠', clarifier:'✨', ph_up:'⬆️', ph_down:'⬇️',
    alkalinity_up:'🔼', cya:'☀️', hardness:'💧', other:'🧪',
  },

  buildHTML() {
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
      ${this._header('Product Catalog')}
      <div style="padding:0 16px 32px">
        <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:0 0 10px">
          Manage which products appear in your inventory picker. Add your own products or disable built-ins you don't use.
        </div>

        <div class="cat-chips" id="catalogTypeChips" style="margin-bottom:10px">
          ${typeChips}
        </div>

        <div class="settings-section" id="catalogProductList">
          ${productRows}
        </div>

        <button class="btn btn-secondary" id="addProductBtn"
          style="width:100%;margin-top:10px;height:44px;font-size:14px;border-radius:14px">
          + Add Custom Product
        </button>

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

  bind() {
    document.getElementById('catBack')?.addEventListener('click', () => App.navigate('settings'));
    this._bindCatalog();
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

    document.getElementById('catalogTypeChips')?.addEventListener('click', async (e) => {
      const chip = e.target.closest('[data-catalog-type]');
      if (!chip) return;
      this._catalogFilter = chip.dataset.catalogType;
      await this._refreshCatalog();
    });

    document.getElementById('catalogProductList')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-product]');
      if (editBtn) {
        const catalogId = parseInt(editBtn.dataset.editProduct);
        const type = this._catalogFilter || '';
        const products = this._allProducts[type] || [];
        const p = products.find(x => x.catalog_id === catalogId);
        if (p) openDrawer('Edit Product', p);
        return;
      }

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
        const type = this._catalogFilter || '';
        const products = this._allProducts[type] || [];
        const p = products.find(x => x.id === productId);
        if (p) p.enabled = enabled;

        const row = cb.closest('.settings-row');
        const nameEl = row?.querySelector('[style*="font-weight:600"]');
        if (nameEl) nameEl.style.color = enabled ? '#F5F5F7' : 'rgba(245,245,247,0.35)';
      } catch (err) {
        cb.checked = !enabled;
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
};
