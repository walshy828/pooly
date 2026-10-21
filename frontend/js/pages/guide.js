/** Pool Care Guide — chemical cheat-sheet + how-to articles (markdown wiki) */
const GuidePage = {
  activeTab: 'chemicals',
  _container: null,

  async render(container) {
    this._container = container;
    await this.showList();
  },

  _esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _md(src) {
    if (window.marked) return marked.parse(src || '');
    return `<pre style="white-space:pre-wrap">${this._esc(src)}</pre>`;
  },

  _header(title, backAction) {
    return `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button id="guideBack" class="btn btn-secondary btn-sm" style="padding:8px 12px">←</button>
        <div class="page-title">${this._esc(title)}</div>
      </div>`;
  },

  // ── List view (tabs: Chemicals | Guides) ─────────────────────────────────

  async showList() {
    const c = this._container;
    c.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;

    let chemicals = [], articles = [];
    try {
      [chemicals, articles] = await Promise.all([API.getGuideChemicals(), API.getGuideArticles()]);
    } catch (e) {
      c.innerHTML = `<div style="padding:32px;text-align:center;color:rgba(245,245,247,0.4)">Could not load guide content</div>`;
      return;
    }

    const isChem = this.activeTab === 'chemicals';
    c.innerHTML = `
      ${this._header('Pool Care Guide')}
      <div style="padding:0 16px 32px">
        <div class="seg-control" style="margin-bottom:16px">
          <button class="seg-btn${isChem ? ' active' : ''}" data-tab="chemicals">Chemicals</button>
          <button class="seg-btn${!isChem ? ' active' : ''}" data-tab="articles">Guides</button>
        </div>
        <div id="guideTabContent">
          ${isChem ? this.renderChemicalList(chemicals) : this.renderArticleList(articles)}
        </div>
      </div>`;

    document.getElementById('guideBack').addEventListener('click', () => App.navigate('settings'));

    c.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        history.replaceState(null, '', `#guide/${this.activeTab}`);
        this.showList();
      });
    });

    if (isChem) this.bindChemicalList(chemicals);
    else this.bindArticleList(articles);
  },

  // ── Chemicals tab ────────────────────────────────────────────────────────

  renderChemicalList(chemicals) {
    const cards = chemicals.map((ch, i) => `
      <div class="bento-card animate-slide-up stagger-${Math.min(i + 1, 8)}" style="margin-bottom:12px" data-chem-id="${ch.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div style="font-size:16px;font-weight:700;color:#F5F5F7">${this._esc(ch.product_name)}</div>
            <div style="font-size:13px;color:#00C8D4;margin-top:2px">
              ${this._esc(ch.chemical_name)}${ch.common_name ? ` · <b>${this._esc(ch.common_name)}</b>` : ''}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" data-edit-chem="${ch.id}">Edit</button>
        </div>
        ${ch.purpose ? `<div style="font-size:13px;color:rgba(245,245,247,0.6);margin-top:8px">${this._esc(ch.purpose)}</div>` : ''}
        ${ch.buy_cheaper ? `<div style="font-size:13px;color:#30D158;margin-top:8px;line-height:1.5">💰 ${this._esc(ch.buy_cheaper)}</div>` : ''}
        ${ch.warnings ? `<div style="font-size:13px;color:#FFD60A;margin-top:8px;line-height:1.5">⚠️ ${this._esc(ch.warnings)}</div>` : ''}
      </div>`).join('');

    return `
      ${cards || '<div style="text-align:center;color:rgba(245,245,247,0.4);padding:24px">No chemical entries yet</div>'}
      <button class="btn btn-primary btn-full" id="addChemBtn" style="height:48px;margin-top:8px">＋ Add Chemical</button>`;
  },

  bindChemicalList(chemicals) {
    document.getElementById('addChemBtn')?.addEventListener('click', () => this.showChemicalEditor(null));
    this._container.querySelectorAll('[data-edit-chem]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = chemicals.find(x => x.id === parseInt(btn.dataset.editChem));
        this.showChemicalEditor(ch);
      });
    });
  },

  showChemicalEditor(ch) {
    const c = this._container;
    const isNew = !ch;
    const f = (label, id, value, placeholder = '', textarea = false) => `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;color:rgba(245,245,247,0.5);margin-bottom:6px">${label}</div>
        ${textarea
          ? `<textarea id="${id}" rows="3" style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#F5F5F7;font-size:14px;resize:vertical" placeholder="${placeholder}">${this._esc(value)}</textarea>`
          : `<input id="${id}" value="${this._esc(value)}" placeholder="${placeholder}" style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#F5F5F7;font-size:14px">`}
      </div>`;

    c.innerHTML = `
      ${this._header(isNew ? 'Add Chemical' : 'Edit Chemical')}
      <div style="padding:0 16px 32px">
        <div class="bento-card">
          ${f('Branded product name *', 'chemProduct', ch?.product_name || '', 'e.g. Alkalinity Up')}
          ${f('Chemical name *', 'chemChemical', ch?.chemical_name || '', 'e.g. Sodium bicarbonate')}
          ${f('Common name', 'chemCommon', ch?.common_name || '', 'e.g. Baking soda')}
          ${f('What it does', 'chemPurpose', ch?.purpose || '', 'e.g. Raises total alkalinity')}
          ${f('What to buy instead (cheaper)', 'chemBuy', ch?.buy_cheaper || '', 'Where to buy the generic version', true)}
          ${f('Warnings', 'chemWarn', ch?.warnings || '', 'Safety notes, side effects', true)}
          <button class="btn btn-primary btn-full" id="chemSave" style="height:48px">Save</button>
          <button class="btn btn-secondary btn-full" id="chemCancel" style="height:44px;margin-top:10px">Cancel</button>
          ${!isNew ? `<button class="btn btn-danger btn-full" id="chemDelete" style="height:44px;margin-top:10px">Delete</button>` : ''}
        </div>
      </div>`;

    document.getElementById('guideBack').addEventListener('click', () => this.showList());
    document.getElementById('chemCancel').addEventListener('click', () => this.showList());

    document.getElementById('chemSave').addEventListener('click', async () => {
      const data = {
        product_name: document.getElementById('chemProduct').value.trim(),
        chemical_name: document.getElementById('chemChemical').value.trim(),
        common_name: document.getElementById('chemCommon').value,
        purpose: document.getElementById('chemPurpose').value,
        buy_cheaper: document.getElementById('chemBuy').value,
        warnings: document.getElementById('chemWarn').value,
      };
      if (!data.product_name || !data.chemical_name) {
        Toast.error('Product name and chemical name are required');
        return;
      }
      try {
        if (isNew) await API.createGuideChemical(data);
        else await API.updateGuideChemical(ch.id, data);
        Toast.success('Saved');
        this.showList();
      } catch (e) {
        Toast.error('Save failed');
      }
    });

    document.getElementById('chemDelete')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${ch.product_name}"?`)) return;
      try {
        await API.deleteGuideChemical(ch.id);
        Toast.success('Deleted');
        this.showList();
      } catch (e) {
        Toast.error('Delete failed');
      }
    });
  },

  // ── Guides (articles) tab ────────────────────────────────────────────────

  renderArticleList(articles) {
    const cards = articles.map((a, i) => `
      <div class="bento-card animate-slide-up stagger-${Math.min(i + 1, 8)}" style="margin-bottom:12px;cursor:pointer" data-article-id="${a.id}">
        <div style="font-size:16px;font-weight:700;color:#F5F5F7">${this._esc(a.title)}</div>
        ${a.summary ? `<div style="font-size:13px;color:rgba(245,245,247,0.6);margin-top:6px;line-height:1.5">${this._esc(a.summary)}</div>` : ''}
        <div style="font-size:11px;color:rgba(245,245,247,0.3);margin-top:8px">Updated ${a.updated_at ? Fmt.timeAgo(a.updated_at) : ''}</div>
      </div>`).join('');

    return `
      ${cards || '<div style="text-align:center;color:rgba(245,245,247,0.4);padding:24px">No guides yet</div>'}
      <button class="btn btn-primary btn-full" id="addArticleBtn" style="height:48px;margin-top:8px">＋ New Guide</button>`;
  },

  bindArticleList(articles) {
    document.getElementById('addArticleBtn')?.addEventListener('click', () => this.showArticleEditor(null));
    this._container.querySelectorAll('[data-article-id]').forEach(card => {
      card.addEventListener('click', () => this.showArticle(parseInt(card.dataset.articleId)));
    });
  },

  async showArticle(articleId) {
    const c = this._container;
    c.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;

    let article;
    try {
      article = await API.getGuideArticle(articleId);
    } catch (e) {
      Toast.error('Could not load guide');
      this.showList();
      return;
    }

    c.innerHTML = `
      ${this._header(article.title)}
      <div style="padding:0 16px 32px">
        <div class="bento-card">
          <div class="markdown-body">${this._md(article.content_md)}</div>
        </div>
        <button class="btn btn-secondary btn-full" id="articleEdit" style="height:44px;margin-top:14px">Edit Guide</button>
      </div>`;

    document.getElementById('guideBack').addEventListener('click', () => this.showList());
    document.getElementById('articleEdit').addEventListener('click', () => this.showArticleEditor(article));
  },

  showArticleEditor(article) {
    const c = this._container;
    const isNew = !article;

    c.innerHTML = `
      ${this._header(isNew ? 'New Guide' : 'Edit Guide')}
      <div style="padding:0 16px 32px">
        <div class="bento-card">
          <div style="font-size:12px;color:rgba(245,245,247,0.5);margin-bottom:6px">Title *</div>
          <input id="articleTitle" value="${this._esc(article?.title || '')}" placeholder="e.g. How to Shock the Pool"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#F5F5F7;font-size:14px;margin-bottom:14px">
          <div style="font-size:12px;color:rgba(245,245,247,0.5);margin-bottom:6px">Summary</div>
          <input id="articleSummary" value="${this._esc(article?.summary || '')}" placeholder="One-line description for the list"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#F5F5F7;font-size:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:12px;color:rgba(245,245,247,0.5)">Content (markdown) *</div>
            <button class="btn btn-secondary btn-sm" id="articlePreviewToggle">Preview</button>
          </div>
          <textarea id="articleContent" rows="18" placeholder="## Heading&#10;&#10;Write your guide in markdown…"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#F5F5F7;font-size:13px;font-family:ui-monospace,monospace;resize:vertical">${this._esc(article?.content_md || '')}</textarea>
          <div id="articlePreview" class="markdown-body" style="display:none;padding:4px 2px"></div>
          <button class="btn btn-primary btn-full" id="articleSave" style="height:48px;margin-top:14px">Save</button>
          <button class="btn btn-secondary btn-full" id="articleCancel" style="height:44px;margin-top:10px">Cancel</button>
          ${!isNew ? `<button class="btn btn-danger btn-full" id="articleDelete" style="height:44px;margin-top:10px">Delete</button>` : ''}
        </div>
      </div>`;

    const back = () => isNew ? this.showList() : this.showArticle(article.id);
    document.getElementById('guideBack').addEventListener('click', back);
    document.getElementById('articleCancel').addEventListener('click', back);

    const textarea = document.getElementById('articleContent');
    const preview = document.getElementById('articlePreview');
    document.getElementById('articlePreviewToggle').addEventListener('click', (e) => {
      const showing = preview.style.display !== 'none';
      if (showing) {
        preview.style.display = 'none';
        textarea.style.display = '';
        e.target.textContent = 'Preview';
      } else {
        preview.innerHTML = this._md(textarea.value);
        preview.style.display = '';
        textarea.style.display = 'none';
        e.target.textContent = 'Edit';
      }
    });

    document.getElementById('articleSave').addEventListener('click', async () => {
      const data = {
        title: document.getElementById('articleTitle').value.trim(),
        summary: document.getElementById('articleSummary').value,
        content_md: textarea.value,
      };
      if (!data.title || !data.content_md.trim()) {
        Toast.error('Title and content are required');
        return;
      }
      try {
        if (isNew) {
          const created = await API.createGuideArticle(data);
          Toast.success('Guide created');
          this.showArticle(created.id);
        } else {
          await API.updateGuideArticle(article.id, data);
          Toast.success('Saved');
          this.showArticle(article.id);
        }
      } catch (e) {
        Toast.error('Save failed');
      }
    });

    document.getElementById('articleDelete')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${article.title}"?`)) return;
      try {
        await API.deleteGuideArticle(article.id);
        Toast.success('Deleted');
        this.showList();
      } catch (e) {
        Toast.error('Delete failed');
      }
    });
  },
};
