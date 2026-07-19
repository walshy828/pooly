/** Chemical Inventory — track what's on hand for exact dosing */
const InventoryPage = {
  _inventory: [],
  _products: {},
  _allProducts: {},

  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [inventory, products, allProducts] = await Promise.all([
        API.getChemicalInventory().catch(() => []),
        API.getChemicalProducts().catch(() => ({})),
        API.getAllProducts().catch(() => ({})),
      ]);
      this._inventory   = inventory;
      this._products     = products;
      this._allProducts  = allProducts;
      container.innerHTML = this.buildHTML();
      this.bind();
    } catch (err) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px">
          <div style="font-size:2.5rem">🧪</div>
          <div style="font-size:16px;color:rgba(245,245,247,0.5)">Could not load inventory</div>
        </div>`;
    }
  },

  _header(title) {
    return `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button id="invBack" class="btn btn-secondary btn-sm" style="padding:8px 12px">←</button>
        <div class="page-title">${title}</div>
      </div>`;
  },

  buildHTML() {
    return `
      ${this._header('Chemical Inventory')}
      <div style="padding:0 16px 32px">
        <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:0 0 10px">
          Track what you have on hand — treatment plans use these for exact dosing.
        </div>
        <div class="settings-section" id="inventoryList">
          ${this._buildInventoryHTML()}
        </div>
        <div class="bento-card bento-card-sm" style="margin-top:8px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(245,245,247,0.35);margin-bottom:10px">Add Product</div>
          <select id="addProductSelect" style="margin-bottom:10px">
            <option value="">— Select a product —</option>
            ${this._optGroups()}
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
        </div>
      </div>`;
  },

  _typeIcons: {
    shock:'⚡', algaecide:'🦠', clarifier:'✨', ph_up:'⬆️', ph_down:'⬇️',
    alkalinity_up:'🔼', cya:'☀️', hardness:'💧',
  },
  _typeLabels: {
    shock:'Shock', algaecide:'Algaecide', clarifier:'Clarifier',
    ph_up:'pH Up', ph_down:'pH Down', alkalinity_up:'Alkalinity Up',
    cya:'CYA Stabilizer', hardness:'Calcium Hardness',
  },

  _optGroups() {
    const pickerSource = Object.keys(this._allProducts).length ? this._allProducts : this._products;
    return Object.entries(pickerSource).map(([typeName, products]) => {
      const label = this._typeLabels[typeName] || typeName;
      const enabled = (products || []).filter(p => p.enabled !== false);
      const opts = enabled.map(p => `<option value="${p.id}">${p.name}${p.is_custom ? ' ★' : ''}</option>`).join('');
      return opts ? `<optgroup label="${this._typeIcons[typeName] || '🧪'} ${label}">${opts}</optgroup>` : '';
    }).filter(Boolean).join('');
  },

  _buildInventoryHTML() {
    if (!this._inventory.length) {
      return `<div style="padding:24px 16px;text-align:center;color:rgba(245,245,247,0.3);font-size:14px">No chemicals added yet — add what you have below.</div>`;
    }
    return this._inventory.map(item => `
      <div class="settings-row" style="gap:10px" data-product-id="${item.product_id}">
        <span style="font-size:1.2rem;width:24px;text-align:center;flex-shrink:0">${this._typeIcons[item.product_type] || '🧪'}</span>
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

  bind() {
    document.getElementById('invBack')?.addEventListener('click', () => App.navigate('settings'));

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
};
