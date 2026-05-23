/** Dashboard page renderer */
const DashboardPage = {
  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, trends] = await Promise.all([
        API.getDashboard(),
        API.getTrends(30).catch(() => ({}))
      ]);
      this.trends = trends;
      container.innerHTML = this.buildHTML(data);
      this.bindChemLegend();
      this.bindReminders();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏊</div>
          <div class="empty-text">Welcome to Pooly!<br>Add your first entry to get started.</div>
        </div>`;
    }
  },

  buildHTML(d) {
    return `
      <div class="dashboard container">
        ${d.pool_status === 'closed' ? this.renderClosedBanner(d) : ''}
        ${this.renderHealthHero(d)}
        ${this.renderSensors(d)}
        ${this.renderChemistry(d)}
        ${this.renderTrends()}
        ${this.renderRecommendations(d)}
        ${this.renderReminders(d)}
        ${this.renderWeather(d)}
        ${this.renderRecent(d)}
      </div>`;
  },

  renderClosedBanner(d) {
    const closedDate = d.pool_closed_at ? Fmt.date(d.pool_closed_at) : 'recently';
    return `
      <div class="pool-closed-banner animate-in">
        <div class="banner-icon">❄️</div>
        <div class="banner-content">
          <div class="banner-title">Pool is Closed</div>
          <div class="banner-desc">Winterized on ${closedDate}. Pool Care reminders are paused.</div>
        </div>
      </div>`;
  },

  renderHealthHero(d) {
    const score = d.health_score || '--';
    const label = d.health_label || 'No observation yet';
    const pct = d.health_score ? d.health_score * 10 : 0;
    const age = d.health_observed_at ? Fmt.timeAgo(d.health_observed_at) : '';
    return `
      <div class="health-hero slide-up">
        <div class="health-score-display">
          <div class="health-score-number">${score === '--' ? '🏊' : score + '/10'}</div>
          <div class="health-score-label">${label}</div>
          <div class="health-bar"><div class="health-bar-fill" style="width:${pct}%"></div></div>
          ${age ? `<div class="health-age">${age}</div>` : ''}
        </div>
      </div>`;
  },

  renderSensors(d) {
    const s = d.sensors || {};
    const items = [];
    if (s.pool_temp_f != null) {
      items.push(`<div class="stat-card animate-in"><div class="stat-icon">🌡️</div>
        <div class="stat-value">${Fmt.temp(s.pool_temp_f)}</div>
        <div class="stat-label">Pool Temp</div></div>`);
    }
    if (s.pump_state != null) {
      const pumpColor = s.pump_state === 'on' ? 'var(--color-success)' : 'var(--text-muted)';
      items.push(`<div class="stat-card animate-in"><div class="stat-icon">⚙️</div>
        <div class="stat-value" style="color:${pumpColor}">${s.pump_state === 'on' ? 'ON' : 'OFF'}</div>
        <div class="stat-label">Pump</div></div>`);
    }
    if (s.pump_energy_kwh != null) {
      items.push(`<div class="stat-card animate-in"><div class="stat-icon">⚡</div>
        <div class="stat-value">${Fmt.number(s.pump_energy_kwh, 1)}</div>
        <div class="stat-label">kWh</div></div>`);
    }
    if (d.weather && d.weather.uv_index != null) {
      const uvLevel = d.weather.uv_index >= 8 ? 'Very High' : d.weather.uv_index >= 6 ? 'High' : d.weather.uv_index >= 3 ? 'Moderate' : 'Low';
      items.push(`<div class="stat-card animate-in"><div class="stat-icon">☀️</div>
        <div class="stat-value">${Math.round(d.weather.uv_index)}</div>
        <div class="stat-label">UV ${uvLevel}</div></div>`);
    }
    if (items.length === 0) return '';
    return `<div class="sensor-row"><div class="section-title">Pool Status</div>
      <div class="stat-grid">${items.join('')}</div></div>`;
  },

  renderChemistry(d) {
    // Abbreviation and full name for every parameter
    const PARAM_META = {
      ph:               { abbr: 'pH',   full: 'pH Level' },
      free_chlorine:    { abbr: 'FC',   full: 'Free Chlorine' },
      total_chlorine:   { abbr: 'TC',   full: 'Total Chlorine' },
      alkalinity:       { abbr: 'Alk',  full: 'Total Alkalinity' },
      cyanuric_acid:    { abbr: 'CYA',  full: 'Cyanuric Acid (Stabilizer)' },
      calcium_hardness: { abbr: 'CH',   full: 'Calcium Hardness' },
      bromine:          { abbr: 'Br',   full: 'Bromine' },
    };

    if (!d.chemistry || d.chemistry.length === 0) {
      return `<div class="chemistry-section"><div class="section-title">Water Chemistry</div>
        <div class="card" style="text-align:center;color:var(--text-muted);padding:var(--space-2xl)">
        No measurements yet. Tap + to add your first test.</div></div>`;
    }

    const cards = d.chemistry.map(c => {
      if (c.value == null) return '';
      const meta = PARAM_META[c.parameter] || { abbr: c.parameter.toUpperCase(), full: c.parameter };
      // Compact status icon — avoid repeating text
      const statusIcon = c.status === 'ideal' ? '✓' : c.status === 'low' ? '↓' : c.status === 'high' ? '↑' : '•';
      const statusClass = `status-${c.status}`;
      const valDisplay = `${c.value}${c.unit ? '<span style="font-size:var(--fs-xs);opacity:0.7"> ' + c.unit + '</span>' : ''}`;
      return `<div class="chem-card animate-in" style="--chem-color:${c.color}" title="${meta.full}: ${c.value}${c.unit ? ' ' + c.unit : ''} — ${c.label}">
        <div class="param-name">${meta.abbr}</div>
        <div class="param-value" style="color:${c.color}">${valDisplay}</div>
        <div class="param-status ${statusClass}" style="display:flex;align-items:center;justify-content:center;gap:3px">
          <span style="font-size:10px;font-weight:700">${statusIcon}</span>
          <span>${c.status === 'ideal' ? 'OK' : c.label}</span>
        </div>
      </div>`;
    }).filter(Boolean).join('');

    const ageColor = (d.chemistry_age_hours || 0) < 24 ? 'var(--color-success)' :
      (d.chemistry_age_hours || 0) < 72 ? 'var(--color-warning)' : 'var(--color-danger)';
    const ageText = d.chemistry_age_hours != null
      ? (d.chemistry_age_hours < 1 ? 'Just tested' : d.chemistry_age_hours < 24 ? `${Math.round(d.chemistry_age_hours)}h ago` : `${Math.round(d.chemistry_age_hours / 24)}d ago`)
      : '';

    return `<div class="chemistry-section">
      <div class="section-title">Water Quality</div>
      <div class="chem-grid">${cards}</div>
      <div class="chem-legend">
        <button class="chem-legend-toggle" id="chemLegendToggle">ℹ️ Abbreviations</button>
        <div class="chem-legend-content" id="chemLegendContent">
          <div class="chem-legend-row"><span class="chem-legend-abbr">TC</span><span class="chem-legend-name">Total Chlorine</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">FC</span><span class="chem-legend-name">Free Chlorine</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">Br</span><span class="chem-legend-name">Bromine</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">Alk</span><span class="chem-legend-name">Total Alkalinity</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">CYA</span><span class="chem-legend-name">Cyanuric Acid</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">CH</span><span class="chem-legend-name">Calcium Hardness</span></div>
          <div class="chem-legend-row"><span class="chem-legend-abbr">pH</span><span class="chem-legend-name">Potential of Hydrogen</span></div>
        </div>
      </div>
      ${ageText ? `<div class="chemistry-age"><span class="age-dot" style="background:${ageColor}"></span> Last tested ${ageText}</div>` : ''}
    </div>`;
  },

  bindChemLegend() {
    const btn = document.getElementById('chemLegendToggle');
    const content = document.getElementById('chemLegendContent');
    if (!btn || !content) return;
    btn.addEventListener('click', () => {
      const open = content.classList.toggle('open');
      btn.textContent = open ? '✕ Close' : 'ℹ️ Abbreviations';
    });
  },

  renderRecommendations(d) {
    if (!d.recommendations || d.recommendations.length === 0) return '';
    const items = d.recommendations.map(r => `
      <div class="rec-item rec-${r.severity}">
        <span class="rec-icon">${r.icon}</span>
        <div><span class="rec-category">${r.category}</span>
        <div class="rec-text">${r.message}</div></div>
      </div>`).join('');
    return `<div class="recommendations-section">
      <div class="section-title">Recommendations</div>${items}</div>`;
  },

  renderReminders(d) {
    if (!d.reminders || d.reminders.length === 0) return '';
    const items = d.reminders.slice(0, 8).map(r => {
      const badgeClass = r.urgency === 'urgent' ? 'badge-danger'
        : r.urgency === 'overdue' ? 'badge-warning'
        : r.urgency === 'due_soon' ? 'badge-info' : 'badge-success';
      const badgeText = r.urgency === 'good' ? '✓ Good'
        : r.urgency === 'due_soon' ? 'Due Soon'
        : r.urgency === 'overdue' ? 'Overdue' : '⚠ Urgent';
      const detail = r.days_since != null
        ? `${r.days_since}d ago · every ${r.interval_days}d`
        : `Every ${r.interval_days}d · never done`;
      return `
        <div class="reminder-item reminder-urgency-${r.urgency}" data-task="${r.task_type}" data-action-type="${r.task_type}">
          <div class="reminder-main" title="Tap to reveal actions">
            <div class="reminder-icon reminder-urgency-${r.urgency}">${r.icon}</div>
            <div class="reminder-info">
              <div class="reminder-name">${r.display_name}</div>
              <div class="reminder-detail">${detail}</div>
            </div>
            <span class="badge ${badgeClass}">${badgeText}</span>
            <span style="color:var(--text-muted);font-size:var(--fs-xs);margin-left:4px">›</span>
          </div>
          <div class="reminder-actions">
            <button class="reminder-action-btn reminder-action-done" data-done="${r.task_type}">
              <span class="action-icon">✅</span>Done
            </button>
            <button class="reminder-action-btn reminder-action-skip" data-skip="${r.task_type}">
              <span class="action-icon">⏭</span>Skip
            </button>
          </div>
        </div>`;
    }).join('');
    return `<div class="reminders-section">
      <div class="section-title">Pool Care <span style="font-size:var(--fs-xs);color:var(--text-muted);font-weight:normal">tap to act</span></div>
      <div id="remindersContainer">${items}</div>
    </div>`;
  },

  bindReminders() {
    // Toggle actions on card tap
    document.querySelectorAll('.reminder-main').forEach(main => {
      main.addEventListener('click', () => {
        const item = main.closest('.reminder-item');
        const wasOpen = item.classList.contains('actions-open');
        // Close all others
        document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
        if (!wasOpen) item.classList.add('actions-open');
      });
    });

    // Close actions when tapping elsewhere
    document.addEventListener('click', e => {
      if (!e.target.closest('.reminder-item')) {
        document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
      }
    }, { once: false, capture: true });

    // Done button — log maintenance + reset clock
    document.querySelectorAll('[data-done]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const taskType = btn.dataset.done;
        const item = btn.closest('.reminder-item');
        try {
          await API.addMaintenance({ action_type: taskType });
          item.classList.remove('actions-open');
          item.classList.add('completing');
          const name = item.querySelector('.reminder-name')?.textContent || taskType;
          Toast.success(`${name} logged! ✅`);
          setTimeout(() => item.remove(), 400);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });

    // Skip button — reset clock only, no journal entry
    document.querySelectorAll('[data-skip]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const taskType = btn.dataset.skip;
        const item = btn.closest('.reminder-item');
        try {
          await API.dismissMaintenance(taskType);
          item.classList.remove('actions-open');
          item.classList.add('dismissing');
          Toast.info('Reminder snoozed — clock reset ⏭');
          setTimeout(() => item.remove(), 300);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });

    // Swipe support (touch devices)
    document.querySelectorAll('.reminder-item').forEach(item => {
      let startX = 0;
      item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      item.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (dx < -40) { // swipe left
          document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
          item.classList.add('actions-open');
        } else if (dx > 30) {
          item.classList.remove('actions-open');
        }
      }, { passive: true });
    });
  },

  renderWeather(d) {
    if (!d.weather || !d.weather.air_temp_f) return '';
    const w = d.weather;
    const impacts = (w.pool_impact || []).map(i => `<div class="weather-impact-item">${i}</div>`).join('');
    return `<div class="weather-section"><div class="section-title">Weather</div>
      <div class="weather-card">
        <div class="weather-current">
          <div class="weather-temp">${Math.round(w.air_temp_f)}°F</div>
          <div><div>${w.condition || ''}</div>
          <div class="weather-details">
            ${w.humidity != null ? `<span>💧 ${Math.round(w.humidity)}%</span>` : ''}
            ${w.wind_speed != null ? `<span>💨 ${Math.round(w.wind_speed)} mph</span>` : ''}
          </div></div>
        </div>
        ${impacts ? `<div class="weather-impact">${impacts}</div>` : ''}
      </div></div>`;
  },

  renderRecent(d) {
    if (!d.recent_entries || d.recent_entries.length === 0) return '';
    const items = d.recent_entries.slice(0, 5).map(e => `
      <div class="activity-item">
        <span class="activity-icon">${Fmt.entryTypeIcon(e.entry_type)}</span>
        <span class="activity-text">${Fmt.entryTypeLabel(e.entry_type)}${e.notes ? ' — ' + e.notes.substring(0, 40) : ''}</span>
        <span class="activity-time">${Fmt.timeAgo(e.entry_date)}</span>
      </div>`).join('');
    return `<div class="recent-section"><div class="section-title">Recent Activity</div>
      <div class="card">${items}</div></div>`;
  },

  // ── TREND CHARTS ────────────────────────────────────────────
  renderTrends() {
    if (!this.trends || Object.keys(this.trends).length === 0) return '';

    const paramConfig = {
      total_chlorine: { label: 'Total Chlorine', color: '#D46B94', unit: 'ppm' },
      free_chlorine: { label: 'Free Chlorine', color: '#E8A0B4', unit: 'ppm' },
      ph: { label: 'pH', color: '#5B9B3E', unit: '' },
      alkalinity: { label: 'Alkalinity', color: '#3B8C4A', unit: 'ppm' },
      cyanuric_acid: { label: 'CYA', color: '#C87098', unit: 'ppm' },
      bromine: { label: 'Bromine', color: '#B83878', unit: 'ppm' },
      calcium_hardness: { label: 'Hardness', color: '#5858C0', unit: 'ppm' },
    };

    let charts = '';
    for (const [param, points] of Object.entries(this.trends)) {
      if (points.length < 2) continue;
      const cfg = paramConfig[param] || { label: param, color: '#20B2AA', unit: '' };
      const spec = Chemistry.ranges[param];
      const latestVal = points[points.length - 1].value;
      charts += `<div class="trend-card">
        <div class="trend-header">
          <span class="trend-title">${cfg.label}</span>
          <span class="trend-value" style="color:${cfg.color}">${latestVal}${cfg.unit ? ' ' + cfg.unit : ''}</span>
        </div>
        <div class="trend-chart">${this.renderSparkline(points, cfg.color, spec)}</div>
      </div>`;
    }

    if (!charts) return '';
    return `<div class="trends-section">
      <div class="section-title">30-Day Trends</div>${charts}</div>`;
  },

  renderSparkline(points, color, spec) {
    const w = 300, h = 50, pad = 4;
    const values = points.map(p => p.value);
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);

    // Expand range to include ideal zone if available
    if (spec) {
      yMin = Math.min(yMin, spec.idealLow * 0.9);
      yMax = Math.max(yMax, spec.idealHigh * 1.1);
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }

    const xScale = (w - 2 * pad) / (points.length - 1);
    const yScale = (h - 2 * pad) / (yMax - yMin);

    const toX = i => pad + i * xScale;
    const toY = v => h - pad - (v - yMin) * yScale;

    // Build SVG path
    const linePoints = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
    const areaPoints = linePoints + ` ${toX(points.length - 1).toFixed(1)},${(h - pad).toFixed(1)} ${toX(0).toFixed(1)},${(h - pad).toFixed(1)}`;

    // Ideal zone rectangle
    let idealZone = '';
    if (spec && spec.idealLow != null && spec.idealHigh != null) {
      const iy1 = toY(spec.idealHigh);
      const iy2 = toY(spec.idealLow);
      idealZone = `<rect x="0" y="${Math.min(iy1, iy2).toFixed(1)}" width="${w}" height="${Math.abs(iy2 - iy1).toFixed(1)}" class="trend-ideal-zone"/>`;
      idealZone += `<line x1="0" y1="${iy1.toFixed(1)}" x2="${w}" y2="${iy1.toFixed(1)}" class="trend-ideal-line"/>`;
      idealZone += `<line x1="0" y1="${iy2.toFixed(1)}" x2="${w}" y2="${iy2.toFixed(1)}" class="trend-ideal-line"/>`;
    }

    // Last dot
    const lastI = points.length - 1;
    const dot = `<circle cx="${toX(lastI).toFixed(1)}" cy="${toY(points[lastI].value).toFixed(1)}" class="trend-dot" stroke="${color}"/>`;

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${idealZone}
      <polygon points="${areaPoints}" class="trend-area" fill="${color}"/>
      <polyline points="${linePoints}" class="trend-line" stroke="${color}"/>
      ${dot}
    </svg>`;
  },
};
