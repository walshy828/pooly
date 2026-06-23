/** Dashboard page — Apple-inspired bento grid */
const DashboardPage = {
  trends: null,
  _trendDays: 30,
  aiStatus: null,
  activePlan: null,

  // ── Lifecycle ─────────────────────────────────────────────────
  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [data, trends, aiStatus, plans] = await Promise.all([
        API.getDashboard(),
        API.getTrends(30).catch(() => ({})),
        API.getAiStatus().catch(() => ({ enabled: false })),
        API.getTreatmentPlans().catch(() => []),
      ]);
      this.trends = trends;
      this._trendDays = 30;
      this.aiStatus = aiStatus;
      this.activePlan = (plans || []).find(p => p.status === 'active') || null;
      container.innerHTML = this.buildHTML(data);
      this.bindReminders();
      this.bindTrendToggle();
      this.bindBriefing();
      if (aiStatus && aiStatus.enabled) this.loadBriefing();
    } catch (err) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6 text-center">
          <div style="font-size:3rem">🏊</div>
          <div class="text-xl font-bold text-pool-text">Welcome to Pooly!</div>
          <div class="text-sm text-pool-muted">Add your first entry to get started.</div>
          <button class="btn btn-primary mt-2" onclick="App.navigate('quick-entry')">Log First Entry</button>
        </div>`;
    }
  },

  _escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // ── Main Layout ───────────────────────────────────────────────
  buildHTML(d) {
    const insights = Insights.compute(d, this.activePlan);
    return `
      <div class="px-4 pt-5 pb-2">
        ${d.pool_status === 'closed' ? this.renderClosedBanner(d) : ''}

        <div class="grid grid-cols-2 gap-3">

          <!-- AI / Daily Brief — full width -->
          <div class="col-span-2 animate-slide-up stagger-1">
            ${this.renderBriefCard(d, insights)}
          </div>

          <!-- Health Score + Last Tested — 2-up -->
          <div class="animate-slide-up stagger-2">${this.renderHealthCard(d)}</div>
          <div class="animate-slide-up stagger-2">${this.renderLastTestedCard(d)}</div>

          <!-- Chemistry Cards — 3-up -->
          <div class="col-span-2 animate-slide-up stagger-3">
            ${this.renderChemCards(d)}
          </div>

          <!-- What's Next — full width -->
          <div class="col-span-2 animate-slide-up stagger-4">
            ${this.renderWhatsNext(insights)}
          </div>

          <!-- Weather + Maintenance — 2-up -->
          ${this._hasWeather(d) ? `<div class="col-span-2 animate-slide-up stagger-5">${this.renderWeatherCard(d)}</div>` : ''}

          <!-- Reminders — full width -->
          ${d.reminders && d.reminders.length > 0 ? `
          <div class="col-span-2 animate-slide-up stagger-5">
            ${this.renderReminders(d)}
          </div>` : ''}

          <!-- Trends — full width -->
          ${this.trends && Object.keys(this.trends).length > 0 ? `
          <div class="col-span-2 animate-slide-up stagger-6">
            ${this.renderTrends()}
          </div>` : ''}

          <!-- Active Plan — full width -->
          <div class="col-span-2 animate-slide-up stagger-7">
            ${this.renderPlanCard()}
          </div>

          <!-- Recent Activity — full width -->
          ${d.recent_entries && d.recent_entries.length > 0 ? `
          <div class="col-span-2 animate-slide-up stagger-8">
            ${this.renderRecent(d)}
          </div>` : ''}

        </div>
      </div>`;
  },

  // ── Pool Closed Banner ────────────────────────────────────────
  renderClosedBanner(d) {
    const closedDate = d.pool_closed_at ? Fmt.date(d.pool_closed_at) : 'recently';
    return `
      <div class="pool-closed-banner mb-4 animate-fade-in">
        <div style="font-size:1.6rem">❄️</div>
        <div>
          <div class="font-semibold text-[15px] text-pool-text">Pool is Closed</div>
          <div class="text-[12px] text-pool-muted mt-0.5">Winterized ${closedDate} · Care reminders paused</div>
        </div>
        <button class="ml-auto btn btn-sm btn-secondary" onclick="App.navigate('settings')">Settings</button>
      </div>`;
  },

  // ── Daily Brief Card ──────────────────────────────────────────
  renderBriefCard(d, insights) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const showAI = this.aiStatus && this.aiStatus.enabled;
    const fallbackBrief = this._escape(Insights.generateBrief(d, insights));
    return `
      <div class="bento-card" style="border-left: 3px solid rgba(169,156,245,0.5)" id="aiBriefingCard">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="bento-label" style="color:rgba(169,156,245,0.7)">✦ Daily Brief</div>
            <div class="text-[11px] text-pool-muted">${today}</div>
          </div>
          ${showAI ? `<button id="aiRegenBtn" title="Regenerate" class="w-8 h-8 rounded-full flex items-center justify-center text-pool-muted hover:text-pool-ai transition-colors" style="background:rgba(169,156,245,0.08);border:1px solid rgba(169,156,245,0.15)">
            <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.93"/>
            </svg>
          </button>` : ''}
        </div>
        <div id="aiBriefingBody">
          ${showAI
            ? `<div class="ai-skeleton"><span></span><span></span><span></span></div>`
            : `<p class="text-[14px] leading-relaxed" style="color:rgba(245,245,247,0.75)">${fallbackBrief}</p>`
          }
        </div>
        ${showAI ? `<div class="text-[10px] mt-3" style="color:rgba(169,156,245,0.45)">Powered by AI · Tap ↺ to refresh</div>` : ''}
      </div>`;
  },

  bindBriefing() {
    document.getElementById('aiRegenBtn')?.addEventListener('click', () => this.loadBriefing());
  },

  async loadBriefing() {
    const body = document.getElementById('aiBriefingBody');
    const btn  = document.getElementById('aiRegenBtn');
    if (!body) return;
    body.innerHTML = `<div class="ai-skeleton"><span></span><span></span><span></span></div>`;
    btn?.classList.add('animate-spin');
    try {
      const res = await API.getAiInsights();
      body.innerHTML = `<p class="text-[14px] leading-relaxed animate-fade-in" style="color:rgba(245,245,247,0.8)">${this._escape(res.briefing)}</p>`;
    } catch {
      body.innerHTML = `<p class="text-[13px] text-pool-muted">Couldn't generate insights. <button class="text-pool-ai underline" id="aiRetry">Try again</button></p>`;
      document.getElementById('aiRetry')?.addEventListener('click', () => this.loadBriefing());
    } finally {
      btn?.classList.remove('animate-spin');
    }
  },

  // ── Health Score Card ─────────────────────────────────────────
  renderHealthCard(d) {
    const score  = d.health_score;
    const label  = score ? (Chemistry.healthLabels[score] || '') : 'No observations';
    const color  = score ? this._healthColor(score) : 'rgba(245,245,247,0.2)';
    const age    = d.health_observed_at ? Fmt.timeAgo(d.health_observed_at) : null;

    // SVG ring — 220 circumference, 35 radius
    const R   = 35;
    const C   = 2 * Math.PI * R;
    const pct = score ? score / 10 : 0;
    const offset = C - pct * C;

    return `
      <div class="bento-card bento-card-sm h-full cursor-pointer" onclick="App.navigate('quick-entry',{tab:'care'})">
        <div class="bento-label">Health</div>
        <div class="flex items-center gap-3">
          <div style="position:relative;width:72px;height:72px;flex-shrink:0">
            <svg viewBox="0 0 80 80" style="width:72px;height:72px;transform:rotate(-90deg)">
              <circle class="health-ring-track" cx="40" cy="40" r="${R}" stroke-width="5"/>
              <circle class="health-ring-fill" cx="40" cy="40" r="${R}" stroke-width="5"
                stroke="${color}"
                stroke-dasharray="${C.toFixed(1)}"
                stroke-dashoffset="${offset.toFixed(1)}"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
              <span style="font-size:20px;font-weight:800;color:${color}">${score || '—'}</span>
            </div>
          </div>
          <div style="min-width:0">
            <div class="text-[15px] font-semibold text-pool-text leading-tight">${label}</div>
            ${age ? `<div class="text-[11px] text-pool-muted mt-1">${age}</div>` : ''}
            <div class="text-[11px] mt-2" style="color:rgba(0,200,212,0.7)">Tap to update →</div>
          </div>
        </div>
      </div>`;
  },

  // ── Last Tested Card ──────────────────────────────────────────
  renderLastTestedCard(d) {
    const hoursOld = d.chemistry_age_hours;
    const daysOld  = hoursOld != null ? Math.floor(hoursOld / 24) : null;
    const urgency  = hoursOld == null ? 'critical'
      : hoursOld < 24  ? 'good'
      : hoursOld < 72  ? 'info'
      : hoursOld < 168 ? 'warning' : 'critical';
    const urgencyColor = {
      good: '#30D158', info: '#00C8D4', warning: '#FFD60A', critical: '#FF453A',
    }[urgency];

    const bigNum = daysOld == null ? '—'
      : daysOld === 0 ? '0d'
      : `${daysOld}d`;
    const subText = daysOld == null ? 'Never tested'
      : daysOld === 0 ? 'Tested today'
      : `ago`;

    // 2 most recent param pills
    const pills = (d.chemistry || []).slice(0, 2).map(c => {
      const pLabel = { ph: 'pH', free_chlorine: 'Cl', alkalinity: 'Alk', cyanuric_acid: 'CYA', calcium_hardness: 'Ca', bromine: 'Br' }[c.parameter] || c.parameter;
      const pColor = c.status === 'ideal' ? '#30D158' : c.status === 'low' ? '#FFD60A' : '#FF453A';
      return `<span style="background:rgba(255,255,255,0.05);border-radius:6px;padding:2px 7px;font-size:10px;color:${pColor}">${pLabel} ${c.value ?? '—'}</span>`;
    }).join('');

    return `
      <div class="bento-card bento-card-sm h-full cursor-pointer" onclick="App.navigate('quick-entry',{tab:'test'})">
        <div class="bento-label">Last Tested</div>
        <div class="flex items-baseline gap-1.5">
          <span style="font-size:38px;font-weight:800;line-height:1;color:${urgencyColor}">${bigNum}</span>
          <span class="text-[13px] text-pool-muted">${subText}</span>
        </div>
        ${pills ? `<div class="flex gap-1 flex-wrap mt-2">${pills}</div>` : ''}
        <div class="text-[11px] mt-3" style="color:rgba(0,200,212,0.7)">Test Now →</div>
      </div>`;
  },

  // ── Chemistry Mini Cards ──────────────────────────────────────
  renderChemCards(d) {
    if (!d.chemistry || d.chemistry.length === 0) {
      return `
        <div class="bento-card flex flex-col items-center justify-center py-6 text-center cursor-pointer" onclick="App.navigate('quick-entry',{tab:'test'})">
          <div style="font-size:1.8rem;margin-bottom:8px">🧪</div>
          <div class="text-[14px] font-medium text-pool-text">No water test yet</div>
          <div class="text-[12px] text-pool-muted mt-1">Tap to add your first test</div>
        </div>`;
    }

    const LABELS  = { ph:'pH', free_chlorine:'Free Cl', total_chlorine:'Total Cl', alkalinity:'Alkalinity', cyanuric_acid:'CYA', calcium_hardness:'Hardness', bromine:'Bromine' };
    const RANGES  = {
      ph:               { min:6.2, max:8.4, idealLow:7.2,  idealHigh:7.6  },
      free_chlorine:    { min:0,   max:10,  idealLow:1.0,  idealHigh:4.0  },
      total_chlorine:   { min:0,   max:10,  idealLow:1.0,  idealHigh:4.0  },
      alkalinity:       { min:0,   max:240, idealLow:80,   idealHigh:120  },
      cyanuric_acid:    { min:0,   max:240, idealLow:30,   idealHigh:50   },
      calcium_hardness: { min:0,   max:800, idealLow:200,  idealHigh:400  },
      bromine:          { min:0,   max:10,  idealLow:2.0,  idealHigh:6.0  },
    };

    // Show top 3 params: pH, free chlorine, alkalinity (or whatever is available)
    const PRIORITY = ['ph', 'free_chlorine', 'alkalinity', 'total_chlorine', 'cyanuric_acid', 'calcium_hardness', 'bromine'];
    const params   = PRIORITY.map(p => d.chemistry.find(c => c.parameter === p)).filter(Boolean).slice(0, 3);
    if (params.length === 0) return '';

    const cards = params.map(c => {
      const label    = LABELS[c.parameter] || c.parameter;
      const spec     = RANGES[c.parameter];
      const statusCls= c.status === 'ideal' ? 'status-ideal' : c.status === 'low' ? 'status-low' : 'status-high';
      const statusLbl= c.status === 'ideal' ? 'Ideal' : c.status === 'low' ? 'Low' : 'High';
      const trend    = this._getTrendDir(c.parameter);
      const trendSym = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '';

      let rangeBar = '';
      if (spec && c.value != null) {
        const pct  = v => Math.max(0, Math.min(100, (v - spec.min) / (spec.max - spec.min) * 100));
        const iLeft  = pct(spec.idealLow).toFixed(1);
        const iWidth = (pct(spec.idealHigh) - pct(spec.idealLow)).toFixed(1);
        const vPct   = pct(c.value).toFixed(1);
        rangeBar = `
          <div class="chem-range-bar mt-2">
            <div class="chem-range-ideal" style="left:${iLeft}%;width:${iWidth}%"></div>
            <div class="chem-range-marker" style="left:${vPct}%;background:${c.color || '#00C8D4'}"></div>
          </div>`;
      }

      return `
        <div class="bento-card bento-card-sm cursor-pointer" onclick="App.navigate('quick-entry',{tab:'test'})">
          <div class="bento-label">${label}</div>
          <div class="flex items-baseline gap-1">
            <span style="font-size:26px;font-weight:800;line-height:1;color:${c.color || '#F5F5F7'}">${c.value ?? '—'}</span>
            ${c.unit ? `<span class="text-[11px] text-pool-muted">${c.unit}</span>` : ''}
            ${trendSym ? `<span class="text-[12px] text-pool-muted ml-auto">${trendSym}</span>` : ''}
          </div>
          <div class="mt-2"><span class="status-pill ${statusCls}">${statusLbl}</span></div>
          ${rangeBar}
        </div>`;
    }).join('');

    return `<div class="grid grid-cols-3 gap-3">${cards}</div>`;
  },

  // ── What's Next Card ──────────────────────────────────────────
  renderWhatsNext(insights) {
    if (insights.length === 0) {
      return `
        <div class="bento-card">
          <div class="bento-label">💡 What's Next</div>
          <div class="flex items-center gap-3 py-2">
            <div style="font-size:1.6rem">🌊</div>
            <div>
              <div class="text-[15px] font-semibold text-pool-text">Everything looks great!</div>
              <div class="text-[12px] text-pool-muted mt-0.5">No urgent tasks — keep up the great work.</div>
            </div>
          </div>
        </div>`;
    }

    const ACTION_NAV = {
      test:    () => `App.navigate('quick-entry',{tab:'test'})`,
      chemical:() => `App.navigate('quick-entry',{tab:'chem'})`,
      care:    () => `App.navigate('quick-entry',{tab:'care'})`,
      observe: () => `App.navigate('quick-entry',{tab:'care'})`,
      plan:    () => `App.navigate('treatment-plan')`,
    };

    const items = insights.map(i => {
      const navFn  = ACTION_NAV[i.action] ? ACTION_NAV[i.action]() : "App.navigate('quick-entry')";
      const dotCls = `insight-dot insight-${i.priority}`;
      return `
        <div class="flex items-start gap-3 py-2.5 border-b border-pool-border last:border-0">
          <div class="${dotCls} mt-1.5"></div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] leading-snug" style="color:rgba(245,245,247,0.8)">${this._escape(i.message)}</p>
          </div>
          <button onclick="${navFn}" class="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
            style="background:rgba(0,200,212,0.1);color:#00C8D4;border:none;cursor:pointer;white-space:nowrap">
            ${i.actionLabel}
          </button>
        </div>`;
    }).join('');

    return `
      <div class="bento-card">
        <div class="bento-label mb-0">💡 What's Next</div>
        <div class="mt-1">${items}</div>
      </div>`;
  },

  // ── Weather Card ──────────────────────────────────────────────
  _hasWeather(d) {
    return d.weather && d.weather.air_temp_f != null;
  },

  renderWeatherCard(d) {
    if (!this._hasWeather(d)) return '';
    const w    = d.weather;
    const tempF= Math.round(w.air_temp_f);
    const uv   = w.uv_index != null ? Math.round(w.uv_index) : null;
    const uvLbl= uv == null ? null : uv >= 8 ? 'Very High' : uv >= 6 ? 'High' : uv >= 3 ? 'Moderate' : 'Low';
    const uvClr= uv >= 8 ? '#FF453A' : uv >= 6 ? '#FFD60A' : '#30D158';

    const stats = [
      `<div class="flex flex-col items-center gap-0.5">
        <span class="text-[22px] font-bold text-pool-text">${tempF}°</span>
        <span class="text-[10px] text-pool-muted">${w.condition || 'Air'}</span>
       </div>`,
      uv != null ? `<div class="flex flex-col items-center gap-0.5">
        <span class="text-[22px] font-bold" style="color:${uvClr}">${uv}</span>
        <span class="text-[10px] text-pool-muted">UV ${uvLbl}</span>
       </div>` : '',
      w.humidity != null ? `<div class="flex flex-col items-center gap-0.5">
        <span class="text-[22px] font-bold text-pool-text">${Math.round(w.humidity)}%</span>
        <span class="text-[10px] text-pool-muted">Humidity</span>
       </div>` : '',
      w.wind_speed != null ? `<div class="flex flex-col items-center gap-0.5">
        <span class="text-[22px] font-bold text-pool-text">${Math.round(w.wind_speed)}</span>
        <span class="text-[10px] text-pool-muted">mph Wind</span>
       </div>` : '',
    ].filter(Boolean).join('');

    const impacts = [];
    if (uv != null && uv >= 6) impacts.push({ icon:'☀️', text:`UV ${uv} (${uvLbl}) — chlorine degrades faster. Consider testing today.` });
    if (tempF >= 85)            impacts.push({ icon:'🌡️', text:`Hot weather (${tempF}°F) accelerates algae growth. Test more frequently.` });
    if (w.wind_speed > 15)      impacts.push({ icon:'🌬️', text:`Gusty winds — check your skimmer basket for debris.` });

    return `
      <div class="bento-card">
        <div class="bento-label">🌤 Weather &amp; Pool Impact</div>
        <div class="flex justify-around py-2">${stats}</div>
        ${impacts.length ? `<div class="mt-3 flex flex-col gap-2">${impacts.map(i =>
          `<div class="flex gap-2 text-[12px]" style="color:rgba(245,245,247,0.65)">
            <span>${i.icon}</span><span>${i.text}</span>
          </div>`).join('')}</div>` : ''}
      </div>`;
  },

  // ── Reminders ─────────────────────────────────────────────────
  _FORM_TASKS: {
    test_water:   { tab: 'test' },
    add_chlorine: { tab: 'chem', preselect: 'chlorine' },
    shock_pool:   { tab: 'chem', scrollTo: 'shock' },
    check_cya:    { tab: 'test' },
  },

  async _logDirectTask(taskType, entryDate, notes, fullness = null) {
    await API.logPoolCareAction({
      task_type: taskType,
      ...(entryDate  ? { entry_date: entryDate } : {}),
      ...(notes      ? { notes }                 : {}),
      ...(fullness != null ? { fullness }        : {}),
    });
  },

  _buildLogForm(taskType, displayName, isBasketTask = false) {
    const today = new Date().toISOString().split('T')[0];
    const fullnessRow = isBasketTask ? `
      <div class="mt-3">
        <div class="text-[11px] text-pool-muted mb-2">How full?</div>
        <div class="flex gap-2 flex-wrap">
          ${[['0','Empty'],['25','¼ Full'],['50','½ Full'],['75','¾ Full'],['100','Full']].map(([v,l]) =>
            `<button class="log-fullness-btn" data-fullness="${v}">${l}</button>`).join('')}
        </div>
      </div>` : '';
    return `
      <div class="mt-3 p-4 rounded-2xl" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
        <div class="text-[11px] text-pool-muted mb-2">When?</div>
        <div class="flex gap-2 flex-wrap mb-2">
          <button class="log-preset active" data-days="0">Today</button>
          <button class="log-preset" data-days="1">Yesterday</button>
          <button class="log-preset" data-days="2">2 days ago</button>
          <button class="log-preset" data-days="-1">Other…</button>
        </div>
        <input type="date" class="log-date-input" value="${today}" max="${today}" style="display:none;margin-bottom:8px">
        ${fullnessRow}
        <textarea class="mt-3" rows="2" placeholder="Notes (optional)…" style="font-size:13px"></textarea>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-secondary btn-sm log-cancel flex-1">Cancel</button>
          <button class="btn btn-primary btn-sm log-confirm flex-1" data-task="${taskType}">✓ Log Entry</button>
        </div>
      </div>`;
  },

  renderReminders(d) {
    if (!d.reminders || d.reminders.length === 0) return '';

    const URGENCY_COLOR = { urgent:'#FF453A', overdue:'#FFD60A', due_soon:'#00C8D4', good:'#30D158' };
    const URGENCY_LABEL = { urgent:'Urgent', overdue:'Overdue', due_soon:'Due Soon', good:'Good' };

    const items = d.reminders.slice(0, 8).map(r => {
      const color     = URGENCY_COLOR[r.urgency] || '#666';
      const label     = URGENCY_LABEL[r.urgency] || r.urgency;
      const detail    = r.days_since != null
        ? `${r.days_since}d ago · every ${r.interval_days}d`
        : `Every ${r.interval_days}d · never done`;
      const isForm    = !!this._FORM_TASKS[r.task_type];
      const isBasket  = r.task_type === 'clean_skimmer' || r.task_type === 'empty_basket';
      return `
        <div class="reminder-item py-3 border-b border-pool-border last:border-0" data-task="${r.task_type}">
          <div class="reminder-main flex items-center gap-3 cursor-pointer" title="Tap to act">
            <span style="font-size:1.3rem;width:28px;text-align:center">${r.icon || '🔧'}</span>
            <div class="flex-1 min-w-0">
              <div class="text-[14px] font-medium text-pool-text">${r.display_name}</div>
              <div class="text-[11px] text-pool-muted mt-0.5">${detail}</div>
            </div>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style="background:${color}1a;color:${color};flex-shrink:0">${label}</span>
            <span class="text-pool-subtle text-[12px]">›</span>
          </div>
          <div class="reminder-actions-row" style="display:none">
            <button class="btn btn-sm flex-1 reminder-action-done"
              data-done="${r.task_type}" data-name="${r.display_name}"
              data-form-task="${isForm}" data-basket-task="${isBasket}">
              ${isForm ? '📋 Log Now' : '✓ Done'}
            </button>
            <button class="btn btn-sm btn-secondary flex-1 reminder-action-skip" data-skip="${r.task_type}">
              Skip
            </button>
          </div>
          <div class="reminder-form-container"></div>
        </div>`;
    }).join('');

    return `
      <div class="bento-card" id="remindersContainer">
        <div class="bento-label">🔧 Pool Care</div>
        ${items}
      </div>`;
  },

  bindReminders() {
    document.querySelectorAll('.reminder-main').forEach(main => {
      main.addEventListener('click', () => {
        const item    = main.closest('.reminder-item');
        const actionsRow = item.querySelector('.reminder-actions-row');
        const wasOpen = actionsRow.style.display !== 'none';
        // Close all others
        document.querySelectorAll('.reminder-item .reminder-actions-row').forEach(r => r.style.display = 'none');
        actionsRow.style.display = wasOpen ? 'none' : 'flex';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.reminder-item')) {
        document.querySelectorAll('.reminder-item .reminder-actions-row').forEach(r => r.style.display = 'none');
      }
    }, { capture: true });

    document.querySelectorAll('.reminder-action-done').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const taskType = btn.dataset.done;
        const name     = btn.dataset.name || taskType;
        const isForm   = btn.dataset.formTask === 'true';
        const isBasket = btn.dataset.basketTask === 'true';
        const item     = btn.closest('.reminder-item');

        if (isForm) {
          const cfg = this._FORM_TASKS[taskType];
          if (cfg?.preselect) QuickEntryPage.selectedChemical = cfg.preselect;
          QuickEntryPage.pendingReminder = { task_type: taskType, display_name: name };
          App.navigate('quick-entry', { tab: cfg.tab });
          return;
        }

        item.querySelector('.reminder-actions-row').style.display = 'none';
        const container = item.querySelector('.reminder-form-container');
        container.innerHTML = this._buildLogForm(taskType, name, isBasket);

        container.querySelectorAll('.log-preset').forEach(p => {
          p.addEventListener('click', () => {
            container.querySelectorAll('.log-preset').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            const days     = parseInt(p.dataset.days);
            const dateInput= container.querySelector('.log-date-input');
            if (days === -1) { dateInput.style.display = 'block'; dateInput.focus(); }
            else {
              dateInput.style.display = 'none';
              const d2 = new Date(); d2.setDate(d2.getDate() - days);
              dateInput.value = d2.toISOString().split('T')[0];
            }
          });
        });

        container.querySelectorAll('.log-fullness-btn').forEach(fb => {
          fb.addEventListener('click', () => {
            container.querySelectorAll('.log-fullness-btn').forEach(x => x.classList.remove('active'));
            fb.classList.add('active');
          });
        });

        container.querySelector('.log-cancel')?.addEventListener('click', e => {
          e.stopPropagation();
          container.innerHTML = '';
        });

        container.querySelector('.log-confirm')?.addEventListener('click', async e => {
          e.stopPropagation();
          try {
            const today     = new Date().toISOString().split('T')[0];
            const dateInput = container.querySelector('.log-date-input');
            const entryDate = (dateInput.value && dateInput.value !== today)
              ? new Date(dateInput.value + 'T12:00:00').toISOString() : null;
            const notes   = container.querySelector('textarea')?.value?.trim() || null;
            const activeFB= container.querySelector('.log-fullness-btn.active');
            const fullness= activeFB ? parseInt(activeFB.dataset.fullness) : null;
            await this._logDirectTask(taskType, entryDate, notes, fullness);
            item.classList.add('completing');
            Toast.success(`${name} logged! ✓`);
            setTimeout(() => item.remove(), 350);
          } catch (err) { Toast.error('Failed: ' + err.message); }
        });
      });
    });

    document.querySelectorAll('.reminder-action-skip').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const taskType = btn.dataset.skip;
        const item     = btn.closest('.reminder-item');
        try {
          await API.dismissMaintenance(taskType);
          item.classList.add('dismissing');
          Toast.info('Reminder snoozed ⏭');
          setTimeout(() => item.remove(), 280);
        } catch (err) { Toast.error('Failed: ' + err.message); }
      });
    });

    // Swipe-to-reveal on touch
    document.querySelectorAll('.reminder-item').forEach(item => {
      let startX = 0;
      item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      item.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const actionsRow = item.querySelector('.reminder-actions-row');
        if (dx < -40) {
          document.querySelectorAll('.reminder-actions-row').forEach(r => r.style.display = 'none');
          actionsRow.style.display = 'flex';
        } else if (dx > 30) { actionsRow.style.display = 'none'; }
      }, { passive: true });
    });
  },

  // ── Trends ────────────────────────────────────────────────────
  renderTrends() {
    if (!this.trends || Object.keys(this.trends).length === 0) return '';
    return `
      <div class="bento-card">
        <div class="flex items-center justify-between mb-3">
          <div class="bento-label mb-0">📈 Trends</div>
          <div class="flex gap-1">
            <button class="trend-toggle-btn${this._trendDays === 7  ? ' active':''}" data-days="7">7d</button>
            <button class="trend-toggle-btn${this._trendDays === 14 ? ' active':''}" data-days="14">14d</button>
            <button class="trend-toggle-btn${this._trendDays === 30 ? ' active':''}" data-days="30">30d</button>
          </div>
        </div>
        <div id="trendCharts">${this._renderTrendCharts(this._trendDays)}</div>
      </div>`;
  },

  _renderTrendCharts(days) {
    const paramConfig = {
      total_chlorine:   { label:'Total Cl',  color:'#D46B94', unit:'ppm' },
      free_chlorine:    { label:'Free Cl',   color:'#E8A0B4', unit:'ppm' },
      ph:               { label:'pH',        color:'#5B9B3E', unit:''    },
      alkalinity:       { label:'Alkalinity',color:'#3B8C4A', unit:'ppm' },
      cyanuric_acid:    { label:'CYA',       color:'#C87098', unit:'ppm' },
      bromine:          { label:'Bromine',   color:'#B83878', unit:'ppm' },
      calcium_hardness: { label:'Hardness',  color:'#5858C0', unit:'ppm' },
    };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let charts = '';
    for (const [param, allPoints] of Object.entries(this.trends)) {
      const points = allPoints.filter(p => !p.date || new Date(p.date) >= cutoff);
      if (points.length < 2) continue;
      const cfg   = paramConfig[param] || { label: param, color: '#00C8D4', unit: '' };
      const spec  = Chemistry.ranges[param];
      const latest= points[points.length - 1].value;
      const trend = this._getTrendDir(param);
      const sym   = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '';
      charts += `
        <div class="flex items-center gap-3 py-2.5 border-b border-pool-border last:border-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[12px] font-medium text-pool-muted">${cfg.label}</span>
              <span class="text-[13px] font-semibold" style="color:${cfg.color}">${latest}${cfg.unit ? ' '+cfg.unit:''} ${sym}</span>
            </div>
            <div class="trend-chart">${this.renderSparkline(points, cfg.color, spec)}</div>
          </div>
        </div>`;
    }
    return charts || `<div class="text-center text-[13px] text-pool-muted py-4">Not enough data for this range.</div>`;
  },

  bindTrendToggle() {
    document.querySelectorAll('.trend-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days);
        this._trendDays = days;
        document.querySelectorAll('.trend-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
        const el = document.getElementById('trendCharts');
        if (el) el.innerHTML = this._renderTrendCharts(days);
      });
    });
  },

  _getTrendDir(param) {
    const pts = this.trends?.[param];
    if (!pts || pts.length < 4) return null;
    const slice = pts.slice(-6);
    const first = slice[0].value, last = slice[slice.length - 1].value;
    const diff  = last - first;
    const thr   = { ph:0.15, free_chlorine:0.5, total_chlorine:0.5, alkalinity:8, cyanuric_acid:5, calcium_hardness:20, bromine:0.5 }[param]
      ?? (Math.abs(first) * 0.08 || 0.5);
    return diff > thr ? 'up' : diff < -thr ? 'down' : 'stable';
  },

  // ── Active Plan Card ──────────────────────────────────────────
  renderPlanCard() {
    const plan = this.activePlan;
    if (!plan) {
      return `
        <div class="bento-card flex items-center gap-3 cursor-pointer" onclick="App.navigate('treatment-plan')">
          <div style="font-size:1.5rem">🧪</div>
          <div class="flex-1">
            <div class="text-[14px] font-semibold text-pool-text">No active treatment plan</div>
            <div class="text-[12px] text-pool-muted mt-0.5">Build a step-by-step plan to fix pool issues</div>
          </div>
          <span class="text-pool-muted text-[16px]">›</span>
        </div>`;
    }
    const total = plan.steps_total || 0;
    const done  = plan.steps_completed || 0;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    return `
      <div class="bento-card cursor-pointer" onclick="App.navigate('treatment-plan')">
        <div class="flex items-center gap-3 mb-3">
          <div style="font-size:1.5rem">🧪</div>
          <div class="flex-1">
            <div class="text-[14px] font-semibold text-pool-text">${this._escape(plan.condition_label)}</div>
            <div class="text-[12px] text-pool-muted mt-0.5">${done} of ${total} steps complete</div>
          </div>
          <span class="text-[11px] font-semibold px-2 py-1 rounded-lg" style="background:rgba(0,200,212,0.1);color:#00C8D4">Resume →</span>
        </div>
        <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.07)">
          <div style="height:100%;width:${pct}%;border-radius:2px;background:linear-gradient(90deg,#00C8D4,#0A84FF);transition:width 0.5s ease"></div>
        </div>
      </div>`;
  },

  // ── Recent Activity ───────────────────────────────────────────
  renderRecent(d) {
    if (!d.recent_entries || d.recent_entries.length === 0) return '';
    const items = d.recent_entries.slice(0, 4).map(e => `
      <div class="flex items-center gap-3 py-2.5 border-b border-pool-border last:border-0">
        <div class="flex-1 min-w-0">
          <div class="text-[13px] text-pool-text truncate">${Fmt.entryTypeLabel(e.entry_type)}${e.notes ? ' — ' + e.notes.substring(0,35) : ''}</div>
        </div>
        <span class="text-[11px] text-pool-muted flex-shrink-0">${Fmt.timeAgo(e.entry_date)}</span>
      </div>`).join('');
    return `
      <div class="bento-card">
        <div class="bento-label">🕒 Recent Activity</div>
        ${items}
        <button class="w-full mt-3 text-[12px] text-pool-muted hover:text-pool-accent transition-colors" onclick="App.navigate('history')">
          View full journal →
        </button>
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
    const xScale = (w - 2*pad) / (points.length - 1);
    const yScale = (h - 2*pad) / (yMax - yMin);
    const toX = i => pad + i * xScale;
    const toY = v => h - pad - (v - yMin) * yScale;
    const linePoints = points.map((p,i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
    const areaPoints = linePoints + ` ${toX(points.length-1).toFixed(1)},${(h-pad).toFixed(1)} ${toX(0).toFixed(1)},${(h-pad).toFixed(1)}`;
    let idealZone = '';
    if (spec?.idealLow != null && spec?.idealHigh != null) {
      const iy1 = toY(spec.idealHigh), iy2 = toY(spec.idealLow);
      idealZone = `<rect x="0" y="${Math.min(iy1,iy2).toFixed(1)}" width="${w}" height="${Math.abs(iy2-iy1).toFixed(1)}" class="trend-ideal-zone"/>`;
      idealZone += `<line x1="0" y1="${iy1.toFixed(1)}" x2="${w}" y2="${iy1.toFixed(1)}" class="trend-ideal-line"/>`;
      idealZone += `<line x1="0" y1="${iy2.toFixed(1)}" x2="${w}" y2="${iy2.toFixed(1)}" class="trend-ideal-line"/>`;
    }
    const lastI = points.length - 1;
    const dot   = `<circle cx="${toX(lastI).toFixed(1)}" cy="${toY(points[lastI].value).toFixed(1)}" class="trend-dot" stroke="${color}"/>`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${idealZone}
      <polygon points="${areaPoints}" class="trend-area" fill="${color}"/>
      <polyline points="${linePoints}" class="trend-line" stroke="${color}"/>
      ${dot}
    </svg>`;
  },

  // ── Helpers ───────────────────────────────────────────────────
  _healthColor(score) {
    const stops = { 1:'#2D4A1E',2:'#3B5E28',3:'#4A7232',4:'#5A8A3C',5:'#5A9A6A',6:'#4A9AAA',7:'#3AACCC',8:'#2BB8DD',9:'#1CC8EE',10:'#00D4FF' };
    return stops[Math.round(score)] || '#F5F5F7';
  },
};
