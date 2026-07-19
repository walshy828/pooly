/** Settings page */
const SettingsPage = {
  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, aiStatus] = await Promise.all([
        API.getSettings(),
        API.getAiStatus().catch(() => ({ enabled: false, key_set: false, provider: 'claude', model: 'claude-opus-4-8' })),
      ]);
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

        ${this.renderQuickAccess()}

        <div class="section-label">Configuration</div>

        ${this._configGroup('cfgPool', '🏊 Pool Profile', `
          <div class="settings-section">
            ${this._field('Pool Name',         `<input id="poolName" value="${d.pool?.name || 'My Pool'}">`)}
            ${this._field('Shape',             `<select id="poolShape">${['round','oval','rectangular'].map(v=>`<option value="${v}"${d.pool?.shape===v?' selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}</select>`)}
            ${this._field('Diameter / Length', `<input type="number" id="poolLength" value="${d.pool?.length_ft||''}" placeholder="ft">`)}
            ${this._field('Depth (ft)',        `<input type="number" id="poolDepth"  value="${d.pool?.depth_ft||''}"  placeholder="ft">`)}
            ${this._field('Volume (gal)',      `<input type="number" id="poolVolume" value="${d.pool?.volume_gallons||''}" placeholder="gallons">`)}
            ${this._field('Pool Type',         `<select id="poolType"><option value="above_ground"${d.pool?.pool_type==='above_ground'?' selected':''}>Above Ground</option><option value="in_ground"${d.pool?.pool_type==='in_ground'?' selected':''}>In Ground</option></select>`)}
            ${this._field('Sanitizer',         `<select id="poolSanitizer"><option value="chlorine"${d.pool?.sanitizer_type==='chlorine'?' selected':''}>Chlorine</option><option value="salt"${d.pool?.sanitizer_type==='salt'?' selected':''}>Salt</option><option value="bromine"${d.pool?.sanitizer_type==='bromine'?' selected':''}>Bromine</option></select>`)}
            ${this._field('Filter Type',       `<select id="poolFilter"><option value="cartridge"${d.pool?.filter_type==='cartridge'?' selected':''}>Cartridge</option><option value="sand"${d.pool?.filter_type==='sand'?' selected':''}>Sand</option><option value="de"${d.pool?.filter_type==='de'?' selected':''}>DE</option></select>`)}
            ${this._field('Location Latitude',  `<input type="number" id="poolLat" step="0.0001" value="${d.pool?.location_lat||''}" placeholder="e.g. 40.7128">`)}
            ${this._field('Location Longitude', `<input type="number" id="poolLon" step="0.0001" value="${d.pool?.location_lon||''}" placeholder="e.g. -74.0060">`)}
            <div style="padding:0 16px 10px">
              <div style="font-size:11px;color:rgba(245,245,247,0.3);line-height:1.5">📍 Used for weather forecast in treatment plans. Overridden by WEATHER_LAT/LON env vars if set.</div>
            </div>
            <div style="padding:4px 16px 14px">
              <button class="btn btn-primary" id="savePool" style="width:100%;height:48px">Save Pool Profile</button>
            </div>
          </div>
        `)}

        ${this._configGroup('cfgAi', '✨ AI Insights', this.renderAiSection())}

        ${this._configGroup('cfgSchedules', '⏰ Pool Care Schedules', `
          <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:0 0 10px">
            Toggle tasks and adjust reminder frequency — changes save automatically.
          </div>
          <div class="settings-section" id="schedulesContainer">${scheduleRows}</div>
        `)}

        ${this._configGroup('cfgIntegrations', '🔌 Integrations', `
          <div class="settings-section">
            ${this._statusRow('🏠 Home Assistant', d.ha_enabled, d.ha_enabled ? 'Connected' : 'Not Configured')}
            ${this._statusRow('🌤️ Weather',         d.weather_enabled, d.weather_enabled ? 'Active' : 'Not Configured')}
            ${this._statusRow('🔒 PIN Lock',        d.pin_enabled, d.pin_enabled ? 'Enabled' : 'Disabled')}
          </div>
        `)}

        <div style="text-align:center;padding:28px 0 8px">
          <div style="color:rgba(245,245,247,0.3);font-size:13px">Pooly v1.0.0</div>
          <div style="color:rgba(245,245,247,0.2);font-size:11px;margin-top:4px">Pool Maintenance Manager</div>
        </div>
      </div>`;
  },

  // ── Quick Access (Pool Care) ─────────────────────
  renderQuickAccess() {
    return `
      <div class="section-label">Pool Care</div>
      <div class="quick-grid">
        <button class="quick-card" data-nav="guide">
          <span class="quick-card-icon">📖</span>
          <span class="quick-card-label">Care Guide</span>
        </button>
        <button class="quick-card" data-nav="inventory">
          <span class="quick-card-icon">🧪</span>
          <span class="quick-card-label">Inventory</span>
        </button>
        <button class="quick-card" data-nav="catalog">
          <span class="quick-card-icon">🛒</span>
          <span class="quick-card-label">Catalog</span>
        </button>
      </div>
    `;
  },

  // ── Collapsible configuration group ──────────────
  _configGroup(id, label, bodyHtml) {
    return `
      <button class="config-toggle" data-target="${id}" aria-expanded="false">
        <span>${label}</span>
        <span class="config-chevron">›</span>
      </button>
      <div id="${id}" class="config-body hidden">${bodyHtml}</div>
    `;
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
      <div style="font-size:12px;color:rgba(245,245,247,0.4);padding:0 4px;margin:0 0 10px">
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

    document.querySelectorAll('.quick-card').forEach(card => {
      card.addEventListener('click', () => App.navigate(card.dataset.nav));
    });

    document.querySelectorAll('.config-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const body = document.getElementById(toggle.dataset.target);
        const isOpen = toggle.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        body?.classList.toggle('hidden', !isOpen);
      });
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
          location_lat:    parseFloat(document.getElementById('poolLat').value) || null,
          location_lon:    parseFloat(document.getElementById('poolLon').value) || null,
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

    this._bindAi();
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
