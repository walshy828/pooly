/** Pooly Insights — rule-based pool intelligence engine.
 *  Produces a prioritised action list and a brief text summary from dashboard data.
 */
const Insights = {

  /** Compute actionable items from dashboard API response.
   *  Returns array of { priority, icon, message, action, actionLabel }
   *  sorted critical → warning → info.
   */
  compute(d, activePlan = null) {
    const items = [];
    const ORDER = { critical: 0, warning: 1, info: 2, success: 3 };

    // 1. Days since last water test
    const hoursOld = d.chemistry_age_hours;
    if (hoursOld == null && (!d.chemistry || d.chemistry.length === 0)) {
      items.push({
        priority: 'critical', icon: '🧪',
        message: 'No water test on record — add your first test to get started.',
        action: 'test', actionLabel: 'Test Now',
      });
    } else if (hoursOld != null && hoursOld > 21 * 24) {
      items.push({
        priority: 'critical', icon: '🧪',
        message: `Water hasn't been tested in ${Math.round(hoursOld / 24)} days — test soon.`,
        action: 'test', actionLabel: 'Test Now',
      });
    } else if (hoursOld != null && hoursOld > 7 * 24) {
      items.push({
        priority: 'warning', icon: '🧪',
        message: `Water tested ${Math.round(hoursOld / 24)} days ago — consider testing again.`,
        action: 'test', actionLabel: 'Test Now',
      });
    }

    // 2. Chemistry parameters out of range (from backend d.chemistry array)
    const PARAM_LABELS = {
      ph: 'pH', free_chlorine: 'Free Chlorine', total_chlorine: 'Total Chlorine',
      alkalinity: 'Alkalinity', cyanuric_acid: 'CYA / Stabilizer',
      calcium_hardness: 'Calcium Hardness', bromine: 'Bromine',
    };
    (d.chemistry || []).forEach(c => {
      if (c.status === 'low' || c.status === 'high') {
        const label = PARAM_LABELS[c.parameter] || c.parameter;
        const dir   = c.status === 'low' ? 'too low' : 'too high';
        const val   = c.value != null ? ` (${c.value}${c.unit ? ' ' + c.unit : ''})` : '';
        items.push({
          priority: 'warning', icon: c.status === 'low' ? '📉' : '📈',
          message: `${label} is ${dir}${val} — adjust to bring it into range.`,
          action: 'chemical', actionLabel: 'Add Chemical',
        });
      }
    });

    // 3. Backend recommendations (critical chemistry corrections from API)
    (d.recommendations || []).filter(r => r.severity === 'critical').forEach(r => {
      // Avoid duplicating a chemistry item already added above
      const alreadyCovered = items.some(i => i.message.includes(r.category));
      if (!alreadyCovered) {
        items.push({
          priority: 'critical', icon: r.icon || '⚠️',
          message: r.message || r.category,
          action: 'chemical', actionLabel: 'Fix Now',
        });
      }
    });

    // 4. Overdue / urgent maintenance tasks
    (d.reminders || []).filter(r => r.urgency === 'urgent' || r.urgency === 'overdue').forEach(r => {
      const when = r.days_since != null
        ? `last done ${r.days_since}d ago`
        : 'never done';
      items.push({
        priority: r.urgency === 'urgent' ? 'critical' : 'warning',
        icon: r.icon || '🔧',
        message: `${r.display_name} — ${when} (every ${r.interval_days}d).`,
        action: 'care', actionLabel: 'Log',
      });
    });

    // 5. Low health score
    if (d.health_score != null && d.health_score <= 4) {
      items.push({
        priority: 'critical', icon: '🌊',
        message: `Pool health is ${d.health_score}/10 — check water clarity and chemistry immediately.`,
        action: 'observe', actionLabel: 'Log Observation',
      });
    } else if (d.health_score != null && d.health_score <= 6) {
      items.push({
        priority: 'warning', icon: '🌊',
        message: `Pool health is ${d.health_score}/10 — ${d.health_label || 'some improvement needed'}.`,
        action: 'observe', actionLabel: 'Log Observation',
      });
    }

    // 6. Active treatment plan has pending steps
    if (activePlan && activePlan.status === 'active') {
      const pending = (activePlan.steps_total || 0) - (activePlan.steps_completed || 0);
      if (pending > 0) {
        items.push({
          priority: 'info', icon: '📋',
          message: `Active treatment plan has ${pending} step${pending > 1 ? 's' : ''} remaining.`,
          action: 'plan', actionLabel: 'View Plan',
        });
      }
    }

    // Sort by priority
    items.sort((a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9));

    // Cap at 6 items to keep the card scannable
    return items.slice(0, 6);
  },

  /** Generate a plain-language brief for the Daily Brief card (non-AI fallback). */
  generateBrief(d, items) {
    const poolName = d.pool_name || 'Your pool';

    if (!d.chemistry || d.chemistry.length === 0) {
      return `Welcome to Pooly! Add your first water test to get ${poolName.toLowerCase() === 'your pool' ? 'personalised' : poolName + "'s"} chemistry insights and recommendations.`;
    }

    const criticals = items.filter(i => i.priority === 'critical');
    const warnings  = items.filter(i => i.priority === 'warning');
    const score     = d.health_score;
    const scoreLabel= d.health_label || '';

    if (criticals.length === 0 && warnings.length === 0) {
      if (score && score >= 9) {
        return `${poolName} is in ${scoreLabel} condition. Chemistry is balanced and all maintenance is up to date. Outstanding job — enjoy your pool! 🌊`;
      }
      if (score && score >= 7) {
        return `${poolName} is looking good with a health score of ${score}/10. All chemistry readings are within range and no urgent tasks need attention.`;
      }
      return `${poolName} chemistry looks balanced. Keep up the regular testing schedule to stay on top of things.`;
    }

    const total = criticals.length + warnings.length;
    const plural = total > 1 ? `${total} items` : `1 item`;

    if (criticals.length > 0) {
      const topMsg = criticals[0].message;
      const extra  = criticals.length > 1 ? ` Plus ${criticals.length - 1} more critical item${criticals.length > 2 ? 's' : ''}.` : '';
      return `${plural} need${total === 1 ? 's' : ''} attention today. Priority: ${topMsg}${extra}`;
    }

    const topMsg = warnings[0].message;
    const extra  = warnings.length > 1 ? ` And ${warnings.length - 1} more item${warnings.length > 2 ? 's' : ''} to address.` : '';
    return `${plural} to address today. ${topMsg}${extra}`;
  },
};
