/** Settings page */
const SettingsPage = {
  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const data = await API.getSettings();
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
  },
};
