/** Shared continuous measurement slider — badge + color-zone track + ideal-range caption.
 * Used by the Quick Entry water test panel and the History edit modal so both
 * share one implementation of the fine-grained, zone-colored slider UX. */
const MeasurementSlider = {
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  sentinelValue(spec) {
    return spec.min - spec.step;
  },

  /** CSS gradient for the track behind the slider. A fixed-width leading band represents
   * "not tested"; the remaining width is split among zones proportional to their real
   * numeric span (not equal slots), so a huge zone like chlorine's "Shock Level" (10-40ppm)
   * visually reads as the wide band it actually is. */
  buildTrackGradient(spec) {
    const sentinelPct = 6; // fixed minimum width so the "not tested" notch stays tappable
    const span = spec.max - spec.min;
    const stops = [`#1a1a2e 0%`, `#222 ${sentinelPct}%`];
    let prevUpTo = spec.min;
    spec.zones.forEach((zone) => {
      const upTo = zone.upTo == null ? spec.max : zone.upTo;
      const startPct = sentinelPct + ((prevUpTo - spec.min) / span) * (100 - sentinelPct);
      const endPct = sentinelPct + ((upTo - spec.min) / span) * (100 - sentinelPct);
      stops.push(`${zone.color} ${startPct.toFixed(2)}%`, `${zone.color} ${endPct.toFixed(2)}%`);
      prevUpTo = upTo;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  },

  render(param, value, opts = {}) {
    const spec = Chemistry.ranges[param];
    if (!spec) return '';
    const idPrefix = opts.idPrefix || '';
    const lastVal = opts.lastValue;
    const initVal = value ?? null;
    const isNotTested = initVal == null;
    const status = isNotTested ? null : Chemistry.getStatus(param, initVal);
    const badgeColor = status?.color || null;
    const badgeLabel = isNotTested ? 'Not Tested' : status.label;
    const unitStr = spec.unit ? ` ${spec.unit}` : '';
    const badgeNum = isNotTested ? '—' : `${Chemistry.formatValue(param, initVal)}${unitStr}`;
    const gradient = this.buildTrackGradient(spec);
    const lastText = lastVal != null ? `Last: ${Chemistry.formatValue(param, lastVal)}${unitStr}` : '';
    const idealText = spec.idealLow != null ? `Ideal ${spec.idealLow}–${spec.idealHigh}${unitStr}` : '';
    const sliderVal = isNotTested ? this.sentinelValue(spec) : initVal;

    const borderColor = badgeColor || 'rgba(255,255,255,0.07)';
    const bgColor = badgeColor ? this._hexToRgba(badgeColor, 0.1) : 'rgba(255,255,255,0.03)';
    const numColor = badgeColor || 'rgba(245,245,247,0.35)';

    return `
      <div class="bento-card bento-card-sm" data-param="${param}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[13px] font-semibold text-pool-text">${spec.label}${spec.unit ? `<span class="text-[11px] text-pool-muted ml-1">(${spec.unit})</span>` : ''}</span>
          <div class="flex items-center gap-2">
            ${lastText ? `<span class="text-[11px] text-pool-muted">${lastText}</span>` : ''}
            <div class="rounded-xl px-3 py-1 text-center" id="${idPrefix}badge-${param}"
              style="border:1px solid ${borderColor};background:${bgColor};min-width:80px">
              <span class="text-[16px] font-bold block" id="${idPrefix}valnum-${param}" style="color:${numColor}">${badgeNum}</span>
              <span class="text-[10px] font-medium block" id="${idPrefix}vallbl-${param}" style="color:${numColor}">${badgeLabel}</span>
            </div>
          </div>
        </div>
        <div style="position:relative">
          <div style="position:absolute;inset:0;border-radius:3px;pointer-events:none;background:${gradient}"></div>
          <input type="range" class="meas-slider-input" id="${idPrefix}slider-${param}"
            data-param="${param}" min="${this.sentinelValue(spec)}" max="${spec.max}" step="${spec.step}" value="${sliderVal}"
            style="--thumb-color:${badgeColor || '#555'};position:relative;z-index:1;background:transparent">
        </div>
        ${idealText ? `<div class="text-[11px] text-pool-muted mt-1.5">✓ ${idealText}</div>` : ''}
      </div>`;
  },

  updateBadge(param, val, idPrefix = '') {
    const spec = Chemistry.ranges[param];
    const badge = document.getElementById(`${idPrefix}badge-${param}`);
    const numEl = document.getElementById(`${idPrefix}valnum-${param}`);
    const lblEl = document.getElementById(`${idPrefix}vallbl-${param}`);
    const slEl = document.getElementById(`${idPrefix}slider-${param}`);
    if (!badge || !numEl || !lblEl) return;
    const unitStr = spec.unit ? ` ${spec.unit}` : '';
    if (val == null || val < spec.min) {
      badge.style.borderColor = 'rgba(255,255,255,0.07)';
      badge.style.background = 'rgba(255,255,255,0.03)';
      numEl.textContent = '—'; numEl.style.color = 'rgba(245,245,247,0.35)';
      lblEl.textContent = 'Not Tested'; lblEl.style.color = 'rgba(245,245,247,0.35)';
      if (slEl) slEl.style.setProperty('--thumb-color', '#555');
    } else {
      const status = Chemistry.getStatus(param, val);
      numEl.textContent = `${Chemistry.formatValue(param, val)}${unitStr}`; numEl.style.color = status.color;
      lblEl.textContent = status.label; lblEl.style.color = status.color;
      badge.style.borderColor = status.color;
      badge.style.background = this._hexToRgba(status.color, 0.1);
      if (slEl) slEl.style.setProperty('--thumb-color', status.color);
    }
  },

  /** Binds the slider's input event. onChange receives the rounded value, or null when
   * dragged down into the "not tested" sentinel notch. */
  bindSlider(param, onChange, idPrefix = '') {
    const spec = Chemistry.ranges[param];
    const slider = document.getElementById(`${idPrefix}slider-${param}`);
    if (!slider || !spec) return;
    slider.addEventListener('input', () => {
      const raw = parseFloat(slider.value);
      const val = raw >= spec.min ? Math.round(raw / spec.step) * spec.step : null;
      const rounded = val != null ? parseFloat(val.toFixed(spec.decimals ?? 1)) : null;
      this.updateBadge(param, rounded, idPrefix);
      onChange(rounded);
    });
  },
};
