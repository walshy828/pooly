/** Treatment Plan page — step-by-step pool remediation plans */
const TreatmentPlanPage = {
  _plan: null,
  _generating: false,

  async render(container) {
    container.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:200px"><div class="spinner spinner-lg"></div></div>`;
    try {
      const [plans, aiStatus] = await Promise.all([
        API.getTreatmentPlans(),
        API.getAiStatus().catch(() => ({ enabled: false })),
      ]);
      this._aiStatus = aiStatus;
      const active = plans.find(p => p.status === 'active');
      if (active) {
        this._plan = active;
        container.innerHTML = this.buildPlanHTML(active);
        this.bindPlan();
      } else {
        container.innerHTML = this.buildEmptyHTML();
        this.bindGenerate(container);
      }
    } catch (err) {
      container.innerHTML = this.buildEmptyHTML();
      this.bindGenerate(container);
    }
  },

  // ── Empty / Generate State ──────────────────────────────────

  buildEmptyHTML() {
    const levels = [
      { id: 'none',     label: 'Crystal Clear', emoji: '✨', color: '#30D158', desc: 'Looking good' },
      { id: 'slight',   label: 'Slight Haze',   emoji: '🟡', color: '#FFD60A', desc: 'Minor cloud' },
      { id: 'moderate', label: 'Moderate',       emoji: '🟠', color: '#FF9F0A', desc: 'Noticeable' },
      { id: 'heavy',    label: 'Heavy Algae',    emoji: '🔴', color: '#FF453A', desc: 'Green water' },
      { id: 'swamp',    label: 'Swamp Mode',     emoji: '🐸', color: '#A3E635', desc: 'Dark green' },
    ];

    return `
      <div class="page-header"><div class="page-title">Treatment Plan</div></div>

      <div style="padding:0 16px 24px">
        <div class="bento-card stagger-1 text-center" style="padding:28px 24px 20px">
          <div style="font-size:3rem;margin-bottom:12px">🏊</div>
          <div style="font-size:20px;font-weight:700;color:#F5F5F7;margin-bottom:8px">Get a Custom Plan</div>
          <div style="font-size:13px;color:rgba(245,245,247,0.5);line-height:1.5;max-width:280px;margin:0 auto">
            Based on your water test and pool setup, we'll generate a step-by-step remediation plan with exact chemical amounts and timing.
          </div>
        </div>

        <div class="bento-card stagger-2" style="margin-top:12px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(245,245,247,0.4);margin-bottom:14px">
            What does your pool look like?
          </div>
          <div id="genAlgaePicker" style="display:flex;flex-direction:column;gap:8px">
            ${levels.map((l, i) => `
              <button class="algae-level-btn${i === 0 ? ' active' : ''}" data-algae="${l.id}"
                style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;
                  border:1.5px solid ${i === 0 ? l.color : 'rgba(255,255,255,0.07)'};
                  background:${i === 0 ? l.color + '18' : 'rgba(255,255,255,0.03)'};
                  cursor:pointer;text-align:left;transition:all 0.15s">
                <span style="font-size:1.4rem;width:28px;text-align:center">${l.emoji}</span>
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:600;color:${i === 0 ? l.color : '#F5F5F7'}">${l.label}</div>
                  <div style="font-size:11px;color:rgba(245,245,247,0.4);margin-top:1px">${l.desc}</div>
                </div>
                <div class="algae-check-icon" style="width:20px;height:20px;border-radius:50%;
                  border:1.5px solid ${i === 0 ? l.color : 'rgba(255,255,255,0.15)'};
                  background:${i === 0 ? l.color : 'transparent'};
                  display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s">
                  ${i === 0 ? `<svg viewBox="0 0 10 8" style="width:10px;height:8px;fill:none;stroke:#000;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><polyline points="1 4 3.5 6.5 9 1"/></svg>` : ''}
                </div>
              </button>`).join('')}
          </div>
        </div>

        <div class="bento-card stagger-3" style="margin-top:12px;display:flex;align-items:flex-start;gap:10px;padding:14px 16px">
          <div style="font-size:1rem;padding-top:1px">💡</div>
          <div style="font-size:12px;color:rgba(245,245,247,0.45);line-height:1.5">
            For the best plan, make sure your <a href="#quick-entry/test" style="color:#00C8D4;text-decoration:none">water test</a> is recent and your <a href="#settings" style="color:#00C8D4;text-decoration:none">chemical inventory</a> is up to date.
          </div>
        </div>

        <button class="btn btn-primary" id="generatePlanBtn"
          style="width:100%;margin-top:16px;height:52px;font-size:15px;font-weight:600;border-radius:16px">
          Generate Treatment Plan
        </button>
      </div>`;
  },

  bindGenerate(container) {
    let selectedAlgae = 'none';
    const levels = [
      { id: 'none', color: '#30D158' }, { id: 'slight', color: '#FFD60A' },
      { id: 'moderate', color: '#FF9F0A' }, { id: 'heavy', color: '#FF453A' },
      { id: 'swamp', color: '#A3E635' },
    ];

    document.querySelectorAll('#genAlgaePicker .algae-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedAlgae = btn.dataset.algae;
        document.querySelectorAll('#genAlgaePicker .algae-level-btn').forEach(b => {
          const spec = levels.find(l => l.id === b.dataset.algae);
          const isActive = b.dataset.algae === selectedAlgae;
          const col = spec?.color || '#00C8D4';
          b.style.borderColor  = isActive ? col : 'rgba(255,255,255,0.07)';
          b.style.background   = isActive ? col + '18' : 'rgba(255,255,255,0.03)';
          const nameEl = b.querySelector('div div:first-child');
          if (nameEl) nameEl.style.color = isActive ? col : '#F5F5F7';
          const checkEl = b.querySelector('.algae-check-icon');
          if (checkEl) {
            checkEl.style.border = `1.5px solid ${isActive ? col : 'rgba(255,255,255,0.15)'}`;
            checkEl.style.background = isActive ? col : 'transparent';
            checkEl.innerHTML = isActive
              ? `<svg viewBox="0 0 10 8" style="width:10px;height:8px;fill:none;stroke:#000;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><polyline points="1 4 3.5 6.5 9 1"/></svg>`
              : '';
          }
        });
      });
    });

    document.getElementById('generatePlanBtn')?.addEventListener('click', async () => {
      if (this._generating) return;
      this._generating = true;
      const btn = document.getElementById('generatePlanBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px"><span class="spinner" style="width:16px;height:16px;border-width:2px"></span>Generating plan…</span>`;
      }
      try {
        const plan = await API.generateTreatmentPlan({ algae_level: selectedAlgae });
        this._plan = plan;
        container.innerHTML = this.buildPlanHTML(plan);
        this.bindPlan();
      } catch (err) {
        Toast.error('Failed to generate plan: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Generate Treatment Plan'; }
      } finally {
        this._generating = false;
      }
    });
  },

  // ── Plan View ─────────────────────────────────────────────

  buildPlanHTML(plan) {
    const total = plan.steps_total || plan.steps?.length || 0;
    const done  = plan.steps_completed || plan.steps?.filter(s => s.is_completed).length || 0;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const typeColors = {
      maintenance: '#30D158', minor_correction: '#0A84FF',
      significant_correction: '#FF9F0A', chemistry_correction: '#FF9F0A',
      algae_mild: '#FFD60A', algae_moderate: '#FF9F0A', algae_severe: '#FF453A',
    };
    const headerColor = typeColors[plan.plan_type] || '#0A84FF';
    const isComplete  = plan.status === 'completed';
    const steps       = (plan.steps || []).sort((a, b) => a.step_order - b.step_order);

    return `
      <div class="page-header">
        <div class="page-title">Treatment Plan</div>
        <button id="newPlanBtn"
          style="font-size:12px;font-weight:500;color:rgba(245,245,247,0.5);padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);cursor:pointer">
          ${isComplete ? '+ New Plan' : '↺ Restart'}
        </button>
      </div>

      <div style="padding:0 16px 24px">

        <!-- Plan header -->
        <div class="bento-card stagger-1" style="border-left:3px solid ${headerColor};padding-left:18px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
            <div>
              <div style="font-size:17px;font-weight:700;color:#F5F5F7;line-height:1.3">${plan.condition_label}</div>
              <div style="font-size:12px;color:rgba(245,245,247,0.4);margin-top:4px">
                ${[
                  plan.pool_gallons ? plan.pool_gallons.toLocaleString() + ' gal' : '',
                  plan.estimated_days ? `Est. ${plan.estimated_days}d` : '',
                  'Started ' + this._formatDate(plan.created_at),
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            ${isComplete
              ? `<span style="background:#30D15822;color:#30D158;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;border:1px solid #30D15844;white-space:nowrap">✅ Done</span>`
              : `<span style="background:${headerColor}18;color:${headerColor};font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;border:1px solid ${headerColor}40;white-space:nowrap">${done}/${total} done</span>`}
          </div>
          ${!isComplete ? `
          <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.07);overflow:hidden;margin-top:4px">
            <div style="height:100%;width:${pct}%;background:${headerColor};border-radius:2px;transition:width 0.4s ease"></div>
          </div>` : ''}
        </div>

        <!-- AI Explain block -->
        ${this._aiStatus?.enabled ? `
        <div class="bento-card stagger-2" style="margin-top:12px" id="tpAiBlock">
          <div id="tpAiIntro"></div>
          <button class="btn btn-secondary" id="tpExplainBtn" style="width:100%;margin-top:0">
            ✨ Explain this plan
          </button>
        </div>` : ''}

        <!-- 5-day weather forecast strip -->
        ${this._buildWeatherStrip(plan.weather_forecast)}

        <!-- Steps timeline -->
        <div id="tpStepsList" style="margin-top:12px;position:relative">
          ${steps.map((step, idx) => this.buildStepHTML(step, idx, steps)).join('')}
        </div>
      </div>`;
  },

  buildStepHTML(step, idx, allSteps) {
    const actionIcons = {
      add_chemical: '⚗️', mechanical: '🔧', wait: '⏳', test: '🧪', run_pump: '🔄',
    };

    const isCompleted = step.is_completed;
    const isUnlocked  = idx === 0 || allSteps[idx - 1]?.is_completed;
    const isCurrent   = !isCompleted && isUnlocked && !allSteps.slice(0, idx).some(s => !s.is_completed);
    const isLast      = idx === allSteps.length - 1;

    let numBg, numColor, numContent;
    if (isCompleted) {
      numBg = '#30D158'; numColor = '#000';
      numContent = `<svg viewBox="0 0 12 10" style="width:12px;height:10px;fill:none;stroke:#000;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="1 5 4.5 8.5 11 1"/></svg>`;
    } else if (isCurrent) {
      numBg = '#00C8D4'; numColor = '#000';
      numContent = `<span style="font-size:13px;font-weight:700">${step.step_order}</span>`;
    } else {
      numBg = 'rgba(255,255,255,0.07)'; numColor = 'rgba(245,245,247,0.35)';
      numContent = `<span style="font-size:13px;font-weight:600">${step.step_order}</span>`;
    }

    const cardBg     = isCompleted ? 'rgba(48,209,88,0.05)' : isCurrent ? 'rgba(0,200,212,0.07)' : 'rgba(255,255,255,0.025)';
    const cardBorder = isCompleted ? 'rgba(48,209,88,0.15)' : isCurrent ? 'rgba(0,200,212,0.2)' : 'rgba(255,255,255,0.06)';

    const statePill = isCompleted
      ? `<span style="background:#30D15820;color:#30D158;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px">Done</span>`
      : isCurrent
      ? `<span style="background:#00C8D420;color:#00C8D4;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px">▶ Up Next</span>`
      : `<span style="font-size:10px;font-weight:500;color:rgba(245,245,247,0.25);padding:2px 8px">Waiting</span>`;

    const amountHtml = step.product_name && step.amount
      ? `<div style="margin:8px 0;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
          <span style="font-size:15px;font-weight:700;color:#F5F5F7">${step.bags_needed && step.bags_needed > 1 ? step.bags_needed + ' bags (' : ''}${step.amount} ${step.unit}${step.bags_needed && step.bags_needed > 1 ? ')' : ''}</span>
          <span style="font-size:13px;color:rgba(245,245,247,0.5)"> of ${step.product_name}</span>
        </div>`
      : step.amount
      ? `<div style="margin:8px 0;font-size:15px;font-weight:700;color:#F5F5F7">${step.amount} ${step.unit}</div>` : '';

    const waitHtml = step.wait_hours_after && step.wait_hours_after > 0
      ? `<div style="margin-top:8px;font-size:12px;color:rgba(245,245,247,0.4);display:flex;align-items:center;gap:5px">
          <span>⏱</span> Wait <strong style="color:rgba(245,245,247,0.6)">${this._formatHours(step.wait_hours_after)}</strong> before next step
        </div>` : '';

    const safetyHtml = step.safety_notes
      ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.2);font-size:12px;color:#FF9F0A">⚠️ ${step.safety_notes}</div>` : '';

    const weatherHtml = step.weather_note
      ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(56,131,255,0.08);border:1px solid rgba(56,131,255,0.22);font-size:12px;color:#93C5FD;line-height:1.5">${step.weather_note}</div>`
      : '';

    const whyHtml = step.why
      ? `<details style="margin-top:8px">
          <summary style="font-size:12px;color:rgba(245,245,247,0.4);cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px">
            <span>▸</span> Why this step?
          </summary>
          <div style="margin-top:6px;font-size:12px;color:rgba(245,245,247,0.55);line-height:1.5;padding-left:14px">${step.why}</div>
        </details>` : '';

    const altHtml = step.alternative_products?.length
      ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          <span style="font-size:11px;color:rgba(245,245,247,0.3)">Also works:</span>
          ${step.alternative_products.map(a => `<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,0.06);color:rgba(245,245,247,0.5);border:1px solid rgba(255,255,255,0.08)">${a.name}</span>`).join('')}
        </div>` : '';

    const actionBtn = !isCompleted && isUnlocked
      ? `<button class="btn btn-primary tp-complete-btn" data-step-id="${step.id}" data-plan-id="${step.plan_id}"
          style="margin-top:12px;width:100%;height:44px;border-radius:12px;font-size:14px;font-weight:600">
          Mark Complete ✓
        </button>`
      : isCompleted
      ? `<button class="btn btn-secondary tp-undo-btn" data-step-id="${step.id}" data-plan-id="${step.plan_id}"
          style="margin-top:10px;font-size:12px;height:32px;border-radius:10px">
          Undo
        </button>` : '';

    const testLinkBtn = step.action_type === 'test'
      ? `<a href="#quick-entry/test" class="btn btn-secondary" style="margin-top:10px;text-decoration:none;display:block;text-align:center;font-size:13px;height:36px;line-height:36px;border-radius:12px">Log Water Test →</a>` : '';

    return `
      <div id="step-${step.id}" style="display:flex;gap:12px;margin-bottom:${isLast ? 0 : 4}px;padding:0 0 ${isLast ? 0 : 8}px">
        <!-- Number column with connecting line -->
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px">
          <div style="width:32px;height:32px;border-radius:50%;background:${numBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${numColor};transition:all 0.2s">
            ${numContent}
          </div>
          ${!isLast ? `<div style="width:2px;flex:1;min-height:20px;background:${isCompleted ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.07)'};margin:4px 0;border-radius:1px"></div>` : ''}
        </div>

        <!-- Card content -->
        <div style="flex:1;min-width:0;padding:12px 14px;border-radius:16px;background:${cardBg};border:1px solid ${cardBorder};margin-bottom:${isLast ? 16 : 0}px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:7px">
              <span style="font-size:1rem">${actionIcons[step.action_type] || '•'}</span>
              <div style="font-size:14px;font-weight:600;color:${isCompleted ? 'rgba(245,245,247,0.4)' : '#F5F5F7'};${isCompleted ? 'text-decoration:line-through' : ''}">${step.title}</div>
            </div>
            ${statePill}
          </div>
          ${isCompleted && step.completed_at ? `<div style="font-size:11px;color:rgba(245,245,247,0.3);margin-bottom:6px">Completed ${this._formatDate(step.completed_at)}</div>` : ''}
          ${step.description ? `<div style="font-size:13px;color:rgba(245,245,247,0.55);line-height:1.5;margin-bottom:4px">${step.description}</div>` : ''}
          ${weatherHtml}
          ${amountHtml}
          ${waitHtml}
          ${safetyHtml}
          ${whyHtml}
          <div class="tp-ai-why" id="aiwhy-${step.step_order}"></div>
          ${altHtml}
          ${step.user_notes ? `<div style="margin-top:8px;font-size:12px;color:rgba(245,245,247,0.4)">📝 ${step.user_notes}</div>` : ''}
          ${testLinkBtn}
          ${actionBtn}
        </div>
      </div>`;
  },

  _escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  async loadRationale() {
    const btn = document.getElementById('tpExplainBtn');
    if (!this._plan) return;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Thinking…'; }
    try {
      const res = await API.getPlanRationale(this._plan.id);
      const introEl = document.getElementById('tpAiIntro');
      if (introEl && res.intro) {
        introEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#A99CF522;color:#A99CF5;border:1px solid #A99CF540">✨ AI Insights</span>
          </div>
          <div style="font-size:13px;color:rgba(245,245,247,0.7);line-height:1.6;margin-bottom:10px">${this._escape(res.intro)}</div>`;
        const block = document.getElementById('tpAiBlock');
        if (block) block.style.background = 'rgba(169,156,245,0.05)';
      }
      Object.entries(res.step_why || {}).forEach(([order, why]) => {
        const el = document.getElementById('aiwhy-' + order);
        if (el) {
          el.innerHTML = `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(169,156,245,0.06);border:1px solid rgba(169,156,245,0.15);font-size:12px;color:rgba(169,156,245,0.85);line-height:1.5"><span style="font-weight:600">✨ Why:</span> ${this._escape(why)}</div>`;
        }
      });
      if (btn) btn.textContent = '✨ Explained';
    } catch (err) {
      Toast.error('Could not explain plan: ' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = '✨ Explain this plan'; }
    }
  },

  bindPlan() {
    document.getElementById('tpExplainBtn')?.addEventListener('click', () => this.loadRationale());

    document.getElementById('newPlanBtn')?.addEventListener('click', async () => {
      if (this._plan && this._plan.status === 'active') {
        if (!confirm('Start a new plan? Your current plan will be cancelled.')) return;
        try { await API.cancelPlan(this._plan.id); } catch (e) { /* ignore */ }
      }
      this._plan = null;
      App.navigate('treatment-plan');
    });

    document.querySelectorAll('.tp-complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const stepId = parseInt(btn.dataset.stepId);
        const planId = parseInt(btn.dataset.planId);
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>`;
        try {
          const updatedPlan = await API.completeStep(planId, stepId, { is_completed: true });
          this._plan = updatedPlan;
          const content = document.getElementById('pageContent');
          if (content) { content.innerHTML = this.buildPlanHTML(updatedPlan); this.bindPlan(); }
          Toast.success('Step completed! ✅');
        } catch (err) {
          Toast.error('Failed to update: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Mark Complete ✓';
        }
      });
    });

    document.querySelectorAll('.tp-undo-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const stepId = parseInt(btn.dataset.stepId);
        const planId = parseInt(btn.dataset.planId);
        try {
          const updatedPlan = await API.completeStep(planId, stepId, { is_completed: false });
          this._plan = updatedPlan;
          const content = document.getElementById('pageContent');
          if (content) { content.innerHTML = this.buildPlanHTML(updatedPlan); this.bindPlan(); }
        } catch (err) { Toast.error('Failed to undo: ' + err.message); }
      });
    });
  },

  // ── Weather Strip ────────────────────────────────────────

  _buildWeatherStrip(forecast) {
    if (!forecast?.length) return '';
    const days = forecast.slice(0, 5).map(f => {
      const emoji = f.is_heavy_rain_day ? '⛈️' : f.is_rain_day ? '🌧️' : '☀️';
      const labelColor = f.is_rain_day ? '#93C5FD' : 'rgba(245,245,247,0.4)';
      const label = f.is_heavy_rain_day ? 'Storm' : f.is_rain_day ? 'Rain' : 'Clear';
      return `
        <div style="flex:1;text-align:center;padding:6px 2px">
          <div style="font-size:11px;color:rgba(245,245,247,0.3);margin-bottom:3px">${f.weekday_short || ''}</div>
          <div style="font-size:1.3rem">${emoji}</div>
          <div style="font-size:10px;font-weight:500;color:${labelColor};margin-top:3px">${label}</div>
        </div>`;
    }).join('');

    const hasRain = forecast.slice(0, 5).some(f => f.is_rain_day);
    return `
      <div class="bento-card stagger-2" style="margin-top:12px;padding:12px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(245,245,247,0.35)">5-Day Forecast</div>
          ${hasRain ? `<div style="font-size:11px;color:#93C5FD">🌧️ Rain may affect plan steps</div>` : ''}
        </div>
        <div style="display:flex;gap:4px">${days}</div>
      </div>`;
  },

  // ── Helpers ──────────────────────────────────────────────

  _formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  _formatHours(hours) {
    if (!hours) return '';
    if (hours < 1)        return `${Math.round(hours * 60)} minutes`;
    if (hours === 1)      return '1 hour';
    if (hours % 24 === 0) return `${hours / 24} day${hours / 24 !== 1 ? 's' : ''}`;
    if (hours > 24) {
      const d = Math.floor(hours / 24), h = hours % 24;
      return h > 0 ? `${d}d ${h}h` : `${d} day${d !== 1 ? 's' : ''}`;
    }
    return `${hours} hours`;
  },
};
