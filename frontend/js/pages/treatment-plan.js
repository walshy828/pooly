/** Treatment Plan page — step-by-step pool remediation plans */
const TreatmentPlanPage = {
  _plan: null,
  _generating: false,

  async render(container) {
    container.innerHTML = `<div class="loading-center"><div class="spinner spinner-lg"></div></div>`;
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

  // ── Empty / Generate State ────────────────────────────────────

  buildEmptyHTML() {
    return `
      <div class="page-header"><div class="page-title">🧪 Treatment Plan</div></div>
      <div class="container page">
        <div class="tp-empty-card card">
          <div class="tp-empty-icon">🏊</div>
          <div class="tp-empty-title">Get a Custom Treatment Plan</div>
          <div class="tp-empty-desc">
            Based on your water test readings and pool setup, we'll generate a step-by-step plan
            with exact chemical amounts, timing, and instructions to get your pool crystal clear.
          </div>
          <div class="tp-algae-prompt">
            <div class="tp-prompt-label">What do you currently see in your pool?</div>
            <div class="algae-btn-row" id="genAlgaePicker">
              ${[
                { id: 'none',     label: 'Clear',    emoji: '✓',  color: '#22c55e' },
                { id: 'slight',   label: 'Slight',   emoji: '🟡', color: '#eab308' },
                { id: 'moderate', label: 'Moderate', emoji: '🟠', color: '#f97316' },
                { id: 'heavy',    label: 'Heavy',    emoji: '🔴', color: '#ef4444' },
                { id: 'swamp',    label: 'Swamp',    emoji: '🐸', color: '#16a34a' },
              ].map(l => `
                <button class="algae-btn${l.id === 'none' ? ' active' : ''}" data-algae="${l.id}"
                  style="${l.id === 'none' ? `border-color:${l.color};background:${l.color}22;color:${l.color}` : ''}">
                  <span class="algae-btn-emoji">${l.emoji}</span>
                  <span class="algae-btn-label">${l.label}</span>
                </button>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" id="generatePlanBtn" style="margin-top:var(--space-lg)">
            🧪 Generate Treatment Plan
          </button>
          <div class="tp-hint">
            Make sure your <a href="#quick-entry/test" class="tp-link">water test</a> and
            <a href="#settings" class="tp-link">chemical inventory</a> are up to date for the best plan.
          </div>
        </div>
      </div>`;
  },

  bindGenerate(container) {
    let selectedAlgae = 'none';
    const levels = [
      { id: 'none', color: '#22c55e' }, { id: 'slight', color: '#eab308' },
      { id: 'moderate', color: '#f97316' }, { id: 'heavy', color: '#ef4444' },
      { id: 'swamp', color: '#16a34a' },
    ];

    document.querySelectorAll('#genAlgaePicker .algae-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedAlgae = btn.dataset.algae;
        document.querySelectorAll('#genAlgaePicker .algae-btn').forEach(b => {
          const spec = levels.find(l => l.id === b.dataset.algae);
          if (b.dataset.algae === selectedAlgae && spec) {
            b.classList.add('active');
            b.style.borderColor = spec.color;
            b.style.background = spec.color + '22';
            b.style.color = spec.color;
          } else {
            b.classList.remove('active');
            b.style.borderColor = '';
            b.style.background = '';
            b.style.color = '';
          }
        });
      });
    });

    document.getElementById('generatePlanBtn')?.addEventListener('click', async () => {
      if (this._generating) return;
      this._generating = true;
      const btn = document.getElementById('generatePlanBtn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating plan...'; }
      try {
        const plan = await API.generateTreatmentPlan({ algae_level: selectedAlgae });
        this._plan = plan;
        container.innerHTML = this.buildPlanHTML(plan);
        this.bindPlan();
      } catch (err) {
        Toast.error('Failed to generate plan: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '🧪 Generate Treatment Plan'; }
      } finally {
        this._generating = false;
      }
    });
  },

  // ── Plan View ─────────────────────────────────────────────────

  buildPlanHTML(plan) {
    const total = plan.steps_total || plan.steps?.length || 0;
    const done = plan.steps_completed || plan.steps?.filter(s => s.is_completed).length || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const conditionColors = {
      maintenance: '#22c55e',
      minor_correction: '#3b82f6',
      significant_correction: '#f97316',
      chemistry_correction: '#f97316',
      algae_mild: '#eab308',
      algae_moderate: '#f97316',
      algae_severe: '#ef4444',
    };
    const headerColor = conditionColors[plan.plan_type] || '#3b82f6';
    const isComplete = plan.status === 'completed';

    const steps = (plan.steps || []).sort((a, b) => a.step_order - b.step_order);

    return `
      <div class="page-header">
        <div class="page-title">🧪 Treatment Plan</div>
      </div>
      <div class="container page">

        <div class="tp-plan-header card" style="border-left:4px solid ${headerColor}">
          <div class="tp-plan-title">${plan.condition_label}</div>
          <div class="tp-plan-meta">
            ${plan.pool_gallons ? `${plan.pool_gallons.toLocaleString()} gal` : ''}
            ${plan.estimated_days ? ` · Est. ${plan.estimated_days} day${plan.estimated_days !== 1 ? 's' : ''}` : ''}
            · Started ${this._formatDate(plan.created_at)}
          </div>
          ${isComplete ? `<div class="tp-complete-badge">✅ Completed</div>` : `
          <div class="tp-progress-wrap">
            <div class="tp-progress-bar">
              <div class="tp-progress-fill" style="width:${pct}%;background:${headerColor}"></div>
            </div>
            <div class="tp-progress-label">${done} of ${total} steps complete</div>
          </div>`}
        </div>

        ${this._aiStatus && this._aiStatus.enabled ? `
        <div class="tp-ai-block">
          <div class="tp-ai-intro" id="tpAiIntro"></div>
          <button class="btn btn-secondary btn-block tp-explain-btn" id="tpExplainBtn">✨ Explain this plan</button>
        </div>` : ''}

        <div class="tp-steps-list" id="tpStepsList">
          ${steps.map((step, idx) => this.buildStepHTML(step, idx, steps)).join('')}
        </div>

        <div class="tp-plan-actions">
          ${!isComplete ? `
            <button class="btn btn-outline btn-sm" id="newPlanBtn">↺ New Plan</button>
          ` : `
            <button class="btn btn-primary btn-block" id="newPlanBtn">🧪 Generate New Plan</button>
          `}
        </div>
      </div>`;
  },

  buildStepHTML(step, idx, allSteps) {
    const actionIcons = {
      add_chemical: '⚗️',
      mechanical: '🔧',
      wait: '⏳',
      test: '🧪',
      run_pump: '🔄',
    };

    const isCompleted = step.is_completed;
    const prevCompleted = idx === 0 || allSteps[idx - 1]?.is_completed;
    const isUnlocked = idx === 0 || prevCompleted;
    const isCurrent = !isCompleted && isUnlocked && !allSteps.slice(0, idx).some(s => !s.is_completed);

    let stateClass = 'tp-step-waiting';
    let stateBadge = `<span class="tp-step-badge">⬜ Waiting</span>`;
    if (isCompleted) {
      stateClass = 'tp-step-done';
      stateBadge = `<span class="tp-step-badge tp-badge-done">✅ Done</span>`;
    } else if (isCurrent) {
      stateClass = 'tp-step-current';
      stateBadge = `<span class="tp-step-badge tp-badge-current">▶ Up Next</span>`;
    }

    const completedDate = step.completed_at ? this._formatDate(step.completed_at) : null;

    const amountHtml = step.product_name && step.amount
      ? `<div class="tp-step-amount">
          <span class="tp-amount-num">${step.bags_needed && step.bags_needed > 1 ? step.bags_needed + ' bags (' : ''}${step.amount} ${step.unit}${step.bags_needed && step.bags_needed > 1 ? ')' : ''}</span>
          <span class="tp-amount-product">of ${step.product_name}</span>
        </div>`
      : step.amount ? `<div class="tp-step-amount"><span class="tp-amount-num">${step.amount} ${step.unit}</span></div>` : '';

    const waitHtml = step.wait_hours_after && step.wait_hours_after > 0
      ? `<div class="tp-step-wait">⏱ Wait ${this._formatHours(step.wait_hours_after)} before next step</div>` : '';

    const safetyHtml = step.safety_notes
      ? `<div class="tp-step-safety">⚠️ ${step.safety_notes}</div>` : '';

    const whyHtml = step.why
      ? `<details class="tp-step-why"><summary>Why this step?</summary><p>${step.why}</p></details>` : '';

    const altHtml = (step.alternative_products?.length)
      ? `<div class="tp-step-alts">
          <span style="color:var(--text-muted);font-size:var(--fs-xs)">Also works: </span>
          ${step.alternative_products.map(a => `<span class="tp-alt-badge">${a.name}</span>`).join('')}
        </div>` : '';

    const actionBtn = !isCompleted && isUnlocked
      ? `<button class="btn btn-primary tp-complete-btn" data-step-id="${step.id}" data-plan-id="${step.plan_id}">
          Mark Complete ✓
        </button>`
      : isCompleted
      ? `<button class="btn btn-outline tp-undo-btn" data-step-id="${step.id}" data-plan-id="${step.plan_id}">
          Undo
        </button>` : '';

    const noteTestBtn = step.action_type === 'test'
      ? `<a href="#quick-entry/test" class="btn btn-outline tp-test-link">Log Water Test →</a>` : '';

    return `
      <div class="tp-step ${stateClass}" id="step-${step.id}">
        <div class="tp-step-header">
          <div class="tp-step-num-icon">
            <span class="tp-step-action-icon">${actionIcons[step.action_type] || '•'}</span>
            <span class="tp-step-num">${step.step_order}</span>
          </div>
          <div class="tp-step-main">
            <div class="tp-step-title">${step.title}</div>
            ${stateBadge}
          </div>
        </div>
        ${isCompleted && completedDate ? `<div class="tp-step-done-date">Completed ${completedDate}</div>` : ''}
        ${step.description ? `<div class="tp-step-desc">${step.description}</div>` : ''}
        ${amountHtml}
        ${waitHtml}
        ${safetyHtml}
        ${whyHtml}
        <div class="tp-ai-why" id="aiwhy-${step.step_order}"></div>
        ${altHtml}
        ${step.user_notes ? `<div class="tp-step-user-note">📝 ${step.user_notes}</div>` : ''}
        <div class="tp-step-footer">
          ${noteTestBtn}
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
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Thinking...'; }
    try {
      const res = await API.getPlanRationale(this._plan.id);
      const introEl = document.getElementById('tpAiIntro');
      if (introEl && res.intro) {
        introEl.innerHTML = `<span class="ai-badge">✨ AI Insights</span><p class="ai-briefing-text">${this._escape(res.intro)}</p>`;
        introEl.classList.add('filled');
      }
      Object.entries(res.step_why || {}).forEach(([order, why]) => {
        const el = document.getElementById('aiwhy-' + order);
        if (el) {
          el.innerHTML = `<span class="tp-ai-why-label">✨ Why:</span> ${this._escape(why)}`;
          el.classList.add('filled');
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
        btn.textContent = '⏳...';
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

  // ── Helpers ──────────────────────────────────────────────────

  _formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  _formatHours(hours) {
    if (!hours) return '';
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours === 1) return '1 hour';
    if (hours % 24 === 0) return `${hours / 24} day${hours / 24 !== 1 ? 's' : ''}`;
    if (hours > 24) {
      const d = Math.floor(hours / 24);
      const h = hours % 24;
      return h > 0 ? `${d}d ${h}h` : `${d} day${d !== 1 ? 's' : ''}`;
    }
    return `${hours} hours`;
  },
};
