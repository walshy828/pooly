/** Dashboard page renderer */
const DashboardPage = {
  trends: null,
  _trendDays: 30,

  // ── Lifecycle ─────────────────────────────────────────────────
  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, trends] = await Promise.all([
        API.getDashboard(),
        API.getTrends(30).catch(() => ({}))
      ]);
      this.trends = trends;
      this._trendDays = 30;
      container.innerHTML = this.buildHTML(data);
      this.bindReminders();
      this.bindTrendToggle();
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
        ${this.renderStatusHero(d)}
        ${this.renderActionCenter(d)}
        ${this.renderChemistryPanel(d)}
        ${this.renderTrends()}
        ${this.renderWeatherInsights(d)}
        ${this.renderReminders(d)}
        ${this.renderRecent(d)}
      </div>`;
  },

  // ── Pool Closed Banner ────────────────────────────────────────
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

  // ── Status Hero ───────────────────────────────────────────────
  renderStatusHero(d) {
    const score = d.health_score;
    const pct = score ? score * 10 : 0;
    const label = d.health_label || 'No observations yet';
    const age = d.health_observed_at ? Fmt.timeAgo(d.health_observed_at) : null;

    const testAge = d.chemistry_age_hours;
    const testText = testAge == null ? 'Never tested'
      : testAge < 1 ? 'Just tested'
      : testAge < 24 ? `Tested ${Math.round(testAge)}h ago`
      : `Tested ${Math.round(testAge / 24)}d ago`;
    const testState = testAge == null ? 'stale'
      : testAge < 24 ? 'fresh'
      : testAge < 72 ? 'aging' : 'stale';

    const scoreColor = !score ? 'var(--text-muted)'
      : score >= 8 ? 'var(--color-success)'
      : score >= 6 ? 'var(--color-warning)' : 'var(--color-danger)';

    const s = d.sensors || {};
    const chips = [];
    if (s.pool_temp_f != null) {
      chips.push(`<span class="hero-chip">🌡️ ${Fmt.temp(s.pool_temp_f)}</span>`);
    }
    if (s.pump_state != null) {
      const on = s.pump_state === 'on';
      chips.push(`<span class="hero-chip" style="color:${on ? 'var(--color-success)' : 'var(--text-muted)'}">⚙️ Pump ${on ? 'ON' : 'OFF'}</span>`);
    }
    if (d.weather?.air_temp_f != null) {
      chips.push(`<span class="hero-chip">🌤️ ${Math.round(d.weather.air_temp_f)}°F outside</span>`);
    }
    if (d.weather?.uv_index != null) {
      const uv = Math.round(d.weather.uv_index);
      const uvLabel = uv >= 8 ? 'Very High' : uv >= 6 ? 'High' : uv >= 3 ? 'Moderate' : 'Low';
      chips.push(`<span class="hero-chip hero-chip-uv-${uv >= 8 ? 'danger' : uv >= 6 ? 'warn' : 'ok'}">☀️ UV ${uv} — ${uvLabel}</span>`);
    }

    return `
      <div class="status-hero slide-up">
        <div class="status-hero-top">
          <div class="hero-score-block">
            <div class="hero-score" style="color:${scoreColor}">
              ${score ? `${score}<span class="hero-score-denom">/10</span>` : '—'}
            </div>
            <div class="hero-label">${label}</div>
            ${age ? `<div class="hero-age">${age}</div>` : ''}
          </div>
          <div class="hero-test-badge hero-test-${testState}">🧪 ${testText}</div>
        </div>
        ${score ? `<div class="health-bar" style="margin-top:var(--space-md)"><div class="health-bar-fill" style="width:${pct}%"></div></div>` : ''}
        ${chips.length ? `<div class="hero-chips">${chips.join('')}</div>` : ''}
      </div>`;
  },

  // ── Action Center ─────────────────────────────────────────────
  renderActionCenter(d) {
    const actions = [];

    // Chemistry recommendations with dosage guidance
    (d.recommendations || []).forEach(r => {
      actions.push({
        severity: r.severity,
        sort: r.severity === 'critical' ? 0 : r.severity === 'warning' ? 1 : 2,
        icon: r.icon,
        title: r.category,
        body: r.message,
        consequences: r.consequences || [],
        impact_tags: r.impact_tags || [],
        impact_score: r.impact_score || 1,
      });
    });

    // Urgent/overdue maintenance reminders
    (d.reminders || [])
      .filter(r => r.urgency === 'urgent' || r.urgency === 'overdue')
      .forEach(r => {
        actions.push({
          severity: r.urgency === 'urgent' ? 'critical' : 'warning',
          sort: r.urgency === 'urgent' ? 0 : 1,
          icon: r.icon,
          title: r.display_name,
          body: r.days_since != null
            ? `Last done ${r.days_since} days ago — recommended every ${r.interval_days} days.`
            : `Never done — recommended every ${r.interval_days} days.`,
        });
      });

    if (actions.length === 0) {
      return `
        <div class="action-center animate-in">
          <div class="all-good-banner">
            <div class="all-good-icon">✅</div>
            <div class="all-good-content">
              <div class="all-good-title">Pool looks great!</div>
              <div class="all-good-sub">No chemistry corrections or urgent tasks needed right now.</div>
            </div>
          </div>
        </div>`;
    }

    actions.sort((a, b) => a.sort - b.sort);

    const critCount = actions.filter(a => a.severity === 'critical').length;
    const warnCount = actions.filter(a => a.severity === 'warning').length;
    const infCount  = actions.filter(a => a.severity === 'info').length;
    const chips = [
      critCount ? `<span class="ac-chip ac-chip-critical">${critCount} Critical</span>` : '',
      warnCount ? `<span class="ac-chip ac-chip-warning">${warnCount} Warning</span>` : '',
      infCount  ? `<span class="ac-chip ac-chip-info">${infCount} Info</span>` : '',
    ].filter(Boolean).join('');

    const TAG_META = {
      health:    { icon: '⚕️', label: 'Health risk' },
      cost:      { icon: '💸', label: 'Higher cost' },
      equipment: { icon: '🔧', label: 'Equipment damage' },
      water:     { icon: '🌊', label: 'Water quality' },
    };

    const items = actions.map(a => {
      const hasConsequences = a.consequences && a.consequences.length > 0;
      let consequenceHtml = '';
      if (hasConsequences) {
        const dots = [1, 2, 3].map(n =>
          `<span class="impact-dot${n <= a.impact_score ? ' filled' : ''}"></span>`
        ).join('');
        const impactLabel = a.impact_score >= 3 ? 'High' : a.impact_score === 2 ? 'Medium' : 'Low';
        const tagHtml = (a.impact_tags || []).map(t => {
          const m = TAG_META[t] || { icon: '', label: t };
          return `<span class="impact-tag">${m.icon} ${m.label}</span>`;
        }).join('');
        const bulletHtml = a.consequences.map(c =>
          `<li>${c}</li>`
        ).join('');
        consequenceHtml = `
          <div class="consequence-strip">
            <div class="consequence-header">
              <span class="consequence-label">If you skip this:</span>
              <span class="impact-meter">${dots}<span class="impact-meter-label">${impactLabel} impact</span></span>
            </div>
            <ul class="consequence-list">${bulletHtml}</ul>
            ${tagHtml ? `<div class="impact-tags">${tagHtml}</div>` : ''}
          </div>`;
      }
      return `
        <div class="action-item action-${a.severity}">
          <div class="action-item-header">
            <span class="action-item-icon">${a.icon}</span>
            <span class="action-item-title">${a.title}</span>
          </div>
          <div class="action-item-body">${a.body}</div>
          ${consequenceHtml}
        </div>`;
    }).join('');

    return `
      <div class="action-center animate-in">
        <div class="section-title" style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md)">
          Actions Needed
          <div style="display:flex;gap:4px;flex-wrap:wrap">${chips}</div>
        </div>
        <div class="action-list">${items}</div>
      </div>`;
  },

  // ── Chemistry Panel ───────────────────────────────────────────
  renderChemistryPanel(d) {
    const RANGES = {
      ph:               { min: 6.2, max: 8.4, idealLow: 7.2,  idealHigh: 7.6,  unit: '' },
      free_chlorine:    { min: 0,   max: 10,  idealLow: 1.0,  idealHigh: 4.0,  unit: 'ppm' },
      total_chlorine:   { min: 0,   max: 10,  idealLow: 1.0,  idealHigh: 4.0,  unit: 'ppm' },
      alkalinity:       { min: 0,   max: 240, idealLow: 80,   idealHigh: 120,  unit: 'ppm' },
      cyanuric_acid:    { min: 0,   max: 240, idealLow: 30,   idealHigh: 50,   unit: 'ppm' },
      calcium_hardness: { min: 0,   max: 800, idealLow: 200,  idealHigh: 400,  unit: 'ppm' },
      bromine:          { min: 0,   max: 10,  idealLow: 2.0,  idealHigh: 6.0,  unit: 'ppm' },
    };
    const LABELS = {
      ph: 'pH', free_chlorine: 'Free Chlorine', total_chlorine: 'Total Chlorine',
      alkalinity: 'Alkalinity', cyanuric_acid: 'Stabilizer (CYA)',
      calcium_hardness: 'Calcium Hardness', bromine: 'Bromine',
    };

    if (!d.chemistry || d.chemistry.length === 0) {
      return `
        <div class="chemistry-panel">
          <div class="section-title">Water Chemistry</div>
          <div class="card" style="text-align:center;color:var(--text-muted);padding:var(--space-2xl)">
            No measurements yet. Tap + to add your first test.
          </div>
        </div>`;
    }

    const testAge = d.chemistry_age_hours;
    const ageText = testAge == null ? null
      : testAge < 1 ? 'Just tested'
      : testAge < 24 ? `${Math.round(testAge)}h ago`
      : `${Math.round(testAge / 24)}d ago`;
    const ageState = testAge == null ? 'stale' : testAge < 24 ? 'fresh' : testAge < 72 ? 'aging' : 'stale';

    const rows = d.chemistry.filter(c => c.value != null).map(c => {
      const r = RANGES[c.parameter];
      const label = LABELS[c.parameter] || c.parameter;
      const trend = this._getTrendDir(c.parameter);
      const trendHtml = !trend ? ''
        : `<span class="trend-dir trend-${trend}">${trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}</span>`;

      const statusText = c.status === 'ideal' ? '✓' : c.status === 'low' ? '↑ Low' : '↓ High';

      let rangeBar = '';
      if (r) {
        const pct = v => Math.max(0, Math.min(100, (v - r.min) / (r.max - r.min) * 100));
        const iLeft   = pct(r.idealLow).toFixed(1);
        const iWidth  = (pct(r.idealHigh) - pct(r.idealLow)).toFixed(1);
        const vPct    = pct(c.value).toFixed(1);
        const unitStr = r.unit ? ` ${r.unit}` : '';
        rangeBar = `
          <div class="chem-range-row">
            <div class="param-range-bar">
              <div class="param-range-track"></div>
              <div class="param-range-ideal" style="left:${iLeft}%;width:${iWidth}%"></div>
              <div class="param-range-marker" style="left:${vPct}%;background:${c.color}"></div>
            </div>
            <span class="param-ideal-label">Ideal ${r.idealLow}–${r.idealHigh}${unitStr}</span>
          </div>`;
      }

      return `
        <div class="chem-row chem-row-${c.status}">
          <div class="chem-row-top">
            <span class="chem-row-name">${label}</span>
            <div class="chem-row-right">
              <span class="chem-row-val" style="color:${c.color}">${c.value}${c.unit ? `<span class="chem-unit"> ${c.unit}</span>` : ''}</span>
              ${trendHtml}
              <span class="chem-status-pill chem-pill-${c.status}">${statusText}</span>
            </div>
          </div>
          ${rangeBar}
        </div>`;
    }).join('');

    return `
      <div class="chemistry-panel">
        <div class="section-title">
          Water Chemistry
          ${ageText ? `<span class="section-meta chem-age-${ageState}"> · ${ageText}</span>` : ''}
        </div>
        <div class="chem-rows-list card">${rows}</div>
      </div>`;
  },

  // ── Trends ────────────────────────────────────────────────────
  renderTrends() {
    if (!this.trends || Object.keys(this.trends).length === 0) return '';
    return `
      <div class="trends-section">
        <div class="trends-header">
          <div class="section-title" style="margin:0">Trends</div>
          <div class="trend-toggle-group">
            <button class="trend-toggle-btn${this._trendDays === 7  ? ' active' : ''}" data-days="7">7d</button>
            <button class="trend-toggle-btn${this._trendDays === 14 ? ' active' : ''}" data-days="14">14d</button>
            <button class="trend-toggle-btn${this._trendDays === 30 ? ' active' : ''}" data-days="30">30d</button>
          </div>
        </div>
        <div id="trendCharts">${this._renderTrendCharts(this._trendDays)}</div>
      </div>`;
  },

  _renderTrendCharts(days) {
    const paramConfig = {
      total_chlorine:   { label: 'Total Chlorine', color: '#D46B94', unit: 'ppm' },
      free_chlorine:    { label: 'Free Chlorine',  color: '#E8A0B4', unit: 'ppm' },
      ph:               { label: 'pH',             color: '#5B9B3E', unit: '' },
      alkalinity:       { label: 'Alkalinity',     color: '#3B8C4A', unit: 'ppm' },
      cyanuric_acid:    { label: 'CYA',            color: '#C87098', unit: 'ppm' },
      bromine:          { label: 'Bromine',        color: '#B83878', unit: 'ppm' },
      calcium_hardness: { label: 'Hardness',       color: '#5858C0', unit: 'ppm' },
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let charts = '';
    for (const [param, allPoints] of Object.entries(this.trends)) {
      const points = allPoints.filter(p => !p.date || new Date(p.date) >= cutoff);
      if (points.length < 2) continue;
      const cfg = paramConfig[param] || { label: param, color: '#20B2AA', unit: '' };
      const spec = Chemistry.ranges[param];
      const latestVal = points[points.length - 1].value;
      const trendDir = this._getTrendDir(param);
      const trendHtml = !trendDir ? ''
        : ` <span class="trend-dir trend-${trendDir}">${trendDir === 'up' ? '↗' : trendDir === 'down' ? '↘' : '→'}</span>`;

      charts += `
        <div class="trend-card">
          <div class="trend-header">
            <span class="trend-title">${cfg.label}</span>
            <span class="trend-value" style="color:${cfg.color}">${latestVal}${cfg.unit ? ' ' + cfg.unit : ''}${trendHtml}</span>
          </div>
          <div class="trend-chart">${this.renderSparkline(points, cfg.color, spec)}</div>
        </div>`;
    }

    return charts || `<div style="text-align:center;color:var(--text-muted);padding:var(--space-xl);font-size:var(--fs-sm)">Not enough data for this range.</div>`;
  },

  bindTrendToggle() {
    document.querySelectorAll('.trend-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days);
        this._trendDays = days;
        document.querySelectorAll('.trend-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
        const container = document.getElementById('trendCharts');
        if (container) container.innerHTML = this._renderTrendCharts(days);
      });
    });
  },

  _getTrendDir(param) {
    const pts = this.trends?.[param];
    if (!pts || pts.length < 4) return null;
    const slice = pts.slice(-6);
    const first = slice[0].value, last = slice[slice.length - 1].value;
    const diff = last - first;
    const threshold = {
      ph: 0.15, free_chlorine: 0.5, total_chlorine: 0.5,
      alkalinity: 8, cyanuric_acid: 5, calcium_hardness: 20, bromine: 0.5,
    }[param] ?? (Math.abs(first) * 0.08 || 0.5);
    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  },

  // ── Weather Insights ──────────────────────────────────────────
  renderWeatherInsights(d) {
    if (!d.weather || d.weather.air_temp_f == null) return '';
    const w = d.weather;

    const tempF = Math.round(w.air_temp_f);
    const uv = w.uv_index != null ? Math.round(w.uv_index) : null;
    const uvLabel = uv == null ? null
      : uv >= 11 ? 'Extreme' : uv >= 8 ? 'Very High' : uv >= 6 ? 'High' : uv >= 3 ? 'Moderate' : 'Low';
    const uvState = uv != null && uv >= 8 ? 'danger' : uv != null && uv >= 6 ? 'warn' : 'ok';

    const insights = [];
    if (uv != null && uv >= 6) {
      insights.push({ icon: '☀️', level: uv >= 8 ? 'warning' : 'info',
        text: `UV is ${uvLabel} (${uv}) — chlorine degrades ${uv >= 8 ? '2–3×' : '~1.5×'} faster in direct sun. Consider testing Free Chlorine today.` });
    }
    if (tempF >= 85) {
      insights.push({ icon: '🌡️', level: 'warning',
        text: `Hot weather (${tempF}°F) accelerates algae growth and raises chlorine demand. Test more frequently during heat waves.` });
    }
    if (w.humidity != null && w.humidity < 30) {
      insights.push({ icon: '💧', level: 'info',
        text: `Low humidity (${Math.round(w.humidity)}%) increases evaporation. Monitor water level and chemical concentration.` });
    }
    if (w.wind_speed != null && w.wind_speed > 15) {
      insights.push({ icon: '🌬️', level: 'info',
        text: `Gusty winds at ${Math.round(w.wind_speed)} mph — debris may enter the pool. Check the skimmer basket.` });
    }
    // Backend-generated impacts — skip if a topic is already covered above
    const coveredTopics = [];
    if (uv != null && uv >= 6) coveredTopics.push('uv', 'ultraviolet', 'chlorine degrad');
    if (tempF >= 85) coveredTopics.push('hot', 'heat', 'algae', 'temperature');
    if (w.humidity != null && w.humidity < 30) coveredTopics.push('humidity', 'evaporation');
    if (w.wind_speed != null && w.wind_speed > 15) coveredTopics.push('wind', 'debris', 'skimmer');
    (w.pool_impact || []).forEach(msg => {
      const lower = msg.toLowerCase();
      if (!coveredTopics.some(t => lower.includes(t))) {
        insights.push({ icon: '💡', level: 'info', text: msg });
      }
    });

    const statItems = [
      `<div class="w-stat"><span class="w-stat-val">${tempF}°F</span><span class="w-stat-lbl">${w.condition || 'Air'}</span></div>`,
      w.humidity != null ? `<div class="w-stat"><span class="w-stat-val">${Math.round(w.humidity)}%</span><span class="w-stat-lbl">Humidity</span></div>` : '',
      uv != null ? `<div class="w-stat"><span class="w-stat-val w-uv-${uvState}">${uv}</span><span class="w-stat-lbl">UV Index</span></div>` : '',
      w.wind_speed != null ? `<div class="w-stat"><span class="w-stat-val">${Math.round(w.wind_speed)}</span><span class="w-stat-lbl">mph Wind</span></div>` : '',
    ].filter(Boolean).join('');

    const impactsHtml = insights.length ? `
      <div class="weather-pool-impacts">
        ${insights.map(i => `
          <div class="pool-impact-row impact-${i.level}">
            <span class="impact-icon">${i.icon}</span>
            <span class="impact-text">${i.text}</span>
          </div>`).join('')}
      </div>` : '';

    return `
      <div class="weather-insights-section">
        <div class="section-title">Weather &amp; Pool Impact</div>
        <div class="weather-card">
          <div class="weather-stats-row">${statItems}</div>
          ${impactsHtml}
        </div>
      </div>`;
  },

  // ── Pool Care Reminders ───────────────────────────────────────
  _FORM_TASKS: {
    test_water:   { tab: 'test' },
    add_chlorine: { tab: 'chem', preselect: 'chlorine' },
    shock_pool:   { tab: 'chem', scrollTo: 'shock' },
    check_cya:    { tab: 'test' },
  },

  async _logDirectTask(taskType, entryDate, notes, fullness = null) {
    const maintTasks = new Set(['clean_cartridge', 'add_water', 'backwash', 'brush_walls']);
    const statusMap  = { clean_skimmer: 'clean_skimmer', robot_run: 'robot_run', vacuum: 'vacuumed', empty_basket: 'basket_emptied' };
    const datePayload = entryDate ? { entry_date: entryDate } : {};
    const notePayload = notes    ? { notes }                  : {};
    if (maintTasks.has(taskType)) {
      await API.addMaintenance({ action_type: taskType, ...datePayload, ...notePayload });
    } else if (statusMap[taskType]) {
      const fullnessPayload = fullness != null ? { fullness } : {};
      await API.addQuickStatus({ status_type: statusMap[taskType], ...datePayload, ...fullnessPayload });
      if (notes) await API.addNote(notes, entryDate || null);
    } else {
      throw new Error(`Unknown task type: ${taskType}`);
    }
  },

  _buildLogForm(taskType, displayName, isBasketTask = false) {
    const today = new Date().toISOString().split('T')[0];
    const fullnessRow = isBasketTask ? `
      <div class="log-fullness-row">
        <span class="log-when-label">How full?</span>
        <div class="log-fullness-btns">
          <button class="log-fullness-btn" data-fullness="0">Empty</button>
          <button class="log-fullness-btn" data-fullness="25">¼ Full</button>
          <button class="log-fullness-btn" data-fullness="50">½ Full</button>
          <button class="log-fullness-btn" data-fullness="75">¾ Full</button>
          <button class="log-fullness-btn" data-fullness="100">Full</button>
        </div>
      </div>` : '';
    return `<div class="reminder-log-form">
      <div class="log-when-row">
        <span class="log-when-label">When?</span>
        <div class="log-presets">
          <button class="log-preset active" data-days="0">Today</button>
          <button class="log-preset" data-days="1">Yesterday</button>
          <button class="log-preset" data-days="2">2 days ago</button>
          <button class="log-preset" data-days="3">3 days ago</button>
          <button class="log-preset" data-days="-1">Other…</button>
        </div>
        <input type="date" class="log-date-input" value="${today}" max="${today}">
      </div>
      ${fullnessRow}
      <textarea class="log-note-textarea" placeholder="Notes (optional)…" rows="2"></textarea>
      <div class="log-form-btns">
        <button class="log-cancel">Cancel</button>
        <button class="log-confirm" data-task="${taskType}">✅ Log Entry</button>
      </div>
    </div>`;
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
      let detail = r.days_since != null
        ? `${r.days_since}d ago · every ${r.interval_days}d`
        : `Every ${r.interval_days}d · never done`;
      if (r.suggested_interval_days) {
        const arrow = r.suggested_interval_days < r.interval_days ? '↑' : '↓';
        detail += ` · ${arrow} try every ${r.suggested_interval_days}d`;
      }
      const isFormTask = !!this._FORM_TASKS[r.task_type];
      const doneLabel = isFormTask ? '→ Log Now' : 'Done';
      const doneTip = isFormTask ? 'Opens the entry form' : 'Tap to log with date options';
      const isBasketTask = r.task_type === 'clean_skimmer' || r.task_type === 'empty_basket';
      return `
        <div class="reminder-item reminder-urgency-${r.urgency}" data-task="${r.task_type}">
          <div class="reminder-track">
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
              <button class="reminder-action-btn reminder-action-done" data-done="${r.task_type}"
                data-name="${r.display_name}" data-form-task="${isFormTask}"
                data-basket-task="${isBasketTask}" title="${doneTip}">
                <span class="action-icon">${isFormTask ? '📋' : '✅'}</span>${doneLabel}
              </button>
              <button class="reminder-action-btn reminder-action-skip" data-skip="${r.task_type}">
                <span class="action-icon">⏭</span>Skip
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="reminders-section">
        <div class="section-title">Pool Care <span style="font-size:var(--fs-xs);color:var(--text-muted);font-weight:normal;text-transform:none;letter-spacing:0">· tap to act</span></div>
        <div id="remindersContainer">${items}</div>
      </div>`;
  },

  bindReminders() {
    document.querySelectorAll('.reminder-main').forEach(main => {
      main.addEventListener('click', () => {
        const item = main.closest('.reminder-item');
        const wasOpen = item.classList.contains('actions-open');
        document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
        if (!wasOpen) item.classList.add('actions-open');
      });
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.reminder-item')) {
        document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
      }
    }, { capture: true });

    document.querySelectorAll('[data-done]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const taskType    = btn.dataset.done;
        const name        = btn.dataset.name || taskType;
        const isForm      = btn.dataset.formTask === 'true';
        const isBasket    = btn.dataset.basketTask === 'true';
        const item        = btn.closest('.reminder-item');

        if (isForm) {
          const cfg = this._FORM_TASKS[taskType];
          if (cfg.preselect) QuickEntryPage.selectedChemical = cfg.preselect;
          QuickEntryPage.pendingReminder = { task_type: taskType, display_name: name };
          App.navigate('quick-entry', { tab: cfg.tab });
          return;
        }

        // Close slide-out actions and show inline form below the track
        item.classList.remove('actions-open');
        item.querySelector('.reminder-form-wrap')?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'reminder-form-wrap';
        wrap.innerHTML = this._buildLogForm(taskType, name, isBasket);
        item.appendChild(wrap);
        const form = wrap.querySelector('.reminder-log-form');

        form.querySelectorAll('.log-preset').forEach(p => {
          p.addEventListener('click', () => {
            form.querySelectorAll('.log-preset').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            const days = parseInt(p.dataset.days);
            const dateInput = form.querySelector('.log-date-input');
            if (days === -1) {
              dateInput.style.display = 'block';
              dateInput.focus();
            } else {
              dateInput.style.display = 'none';
              const d = new Date();
              d.setDate(d.getDate() - days);
              dateInput.value = d.toISOString().split('T')[0];
            }
          });
        });

        form.querySelectorAll('.log-fullness-btn').forEach(fb => {
          fb.addEventListener('click', () => {
            form.querySelectorAll('.log-fullness-btn').forEach(x => x.classList.remove('active'));
            fb.classList.add('active');
          });
        });

        form.querySelector('.log-cancel').addEventListener('click', e => {
          e.stopPropagation();
          wrap.remove();
        });

        form.querySelector('.log-confirm').addEventListener('click', async e => {
          e.stopPropagation();
          try {
            const dateInput = form.querySelector('.log-date-input');
            const today = new Date().toISOString().split('T')[0];
            const entryDate = (dateInput.value && dateInput.value !== today)
              ? new Date(dateInput.value + 'T12:00:00').toISOString()
              : null;
            const notes = form.querySelector('.log-note-textarea')?.value?.trim() || null;
            const activeFullness = form.querySelector('.log-fullness-btn.active');
            const fullness = activeFullness ? parseInt(activeFullness.dataset.fullness) : null;
            await this._logDirectTask(taskType, entryDate, notes, fullness);
            item.classList.add('completing');
            Toast.success(`${name} logged! ✅`);
            setTimeout(() => item.remove(), 400);
          } catch (err) { Toast.error('Failed: ' + err.message); }
        });
      });
    });

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

    document.querySelectorAll('.reminder-item').forEach(item => {
      let startX = 0;
      item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      item.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (dx < -40) {
          document.querySelectorAll('.reminder-item.actions-open').forEach(el => el.classList.remove('actions-open'));
          item.classList.add('actions-open');
        } else if (dx > 30) {
          item.classList.remove('actions-open');
        }
      }, { passive: true });
    });
  },

  // ── Recent Activity ───────────────────────────────────────────
  renderRecent(d) {
    if (!d.recent_entries || d.recent_entries.length === 0) return '';
    const items = d.recent_entries.slice(0, 5).map(e => `
      <div class="activity-item">
        <span class="activity-icon">${Fmt.entryTypeIcon(e.entry_type)}</span>
        <span class="activity-text">${Fmt.entryTypeLabel(e.entry_type)}${e.notes ? ' — ' + e.notes.substring(0, 40) : ''}</span>
        <span class="activity-time">${Fmt.timeAgo(e.entry_date)}</span>
      </div>`).join('');
    return `
      <div class="recent-section">
        <div class="section-title">Recent Activity</div>
        <div class="card">${items}</div>
      </div>`;
  },

  // ── Sparkline SVG ─────────────────────────────────────────────
  renderSparkline(points, color, spec) {
    const w = 300, h = 50, pad = 4;
    const values = points.map(p => p.value);
    let yMin = Math.min(...values), yMax = Math.max(...values);
    if (spec) {
      yMin = Math.min(yMin, spec.idealLow * 0.9);
      yMax = Math.max(yMax, spec.idealHigh * 1.1);
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const xScale = (w - 2 * pad) / (points.length - 1);
    const yScale = (h - 2 * pad) / (yMax - yMin);
    const toX = i => pad + i * xScale;
    const toY = v => h - pad - (v - yMin) * yScale;
    const linePoints = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
    const areaPoints = linePoints + ` ${toX(points.length - 1).toFixed(1)},${(h - pad).toFixed(1)} ${toX(0).toFixed(1)},${(h - pad).toFixed(1)}`;
    let idealZone = '';
    if (spec?.idealLow != null && spec?.idealHigh != null) {
      const iy1 = toY(spec.idealHigh), iy2 = toY(spec.idealLow);
      idealZone = `<rect x="0" y="${Math.min(iy1, iy2).toFixed(1)}" width="${w}" height="${Math.abs(iy2 - iy1).toFixed(1)}" class="trend-ideal-zone"/>`;
      idealZone += `<line x1="0" y1="${iy1.toFixed(1)}" x2="${w}" y2="${iy1.toFixed(1)}" class="trend-ideal-line"/>`;
      idealZone += `<line x1="0" y1="${iy2.toFixed(1)}" x2="${w}" y2="${iy2.toFixed(1)}" class="trend-ideal-line"/>`;
    }
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
