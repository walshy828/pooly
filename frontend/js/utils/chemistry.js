/** Chemistry range definitions and color maps — mirrors backend. */
const Chemistry = {
  ranges: {
    ph: {
      label: 'pH', unit: '',
      min: 6.5, max: 8.8, step: 0.1, decimals: 1,
      idealLow: 7.2, idealHigh: 7.6,
      zones: [
        { upTo: 6.9, color: '#E8832A', label: 'Acidic' },
        { upTo: 7.1, color: '#D4C738', label: 'Low' },
        { upTo: 7.6, color: '#5B9B3E', label: 'Ideal' },
        { upTo: 7.9, color: '#3A7B4F', label: 'High' },
        { upTo: null, color: '#5B4B8A', label: 'Very High' },
      ],
    },
    free_chlorine: {
      label: 'Free Chlorine', unit: 'ppm',
      min: 0, max: 50, step: 0.2, decimals: 1,
      idealLow: 1.0, idealHigh: 4.0,
      zones: [
        { upTo: 0.5, color: '#F5EBB0', label: 'Very Low' },
        { upTo: 1.0, color: '#F0D4C8', label: 'Low' },
        { upTo: 4.0, color: '#E8A0B4', label: 'Ideal' },
        { upTo: 10.0, color: '#D46B94', label: 'High' },
        { upTo: 40.0, color: '#B83878', label: 'Shock Level' },
        { upTo: null, color: '#8B1A5C', label: 'Very High' },
      ],
    },
    total_chlorine: {
      label: 'Total Chlorine', unit: 'ppm',
      min: 0, max: 50, step: 0.2, decimals: 1,
      idealLow: 1.0, idealHigh: 4.0,
      zones: [
        { upTo: 0.5, color: '#F5EBB0', label: 'Very Low' },
        { upTo: 1.0, color: '#F0D4C8', label: 'Low' },
        { upTo: 4.0, color: '#E8A0B4', label: 'Ideal' },
        { upTo: 10.0, color: '#D46B94', label: 'High' },
        { upTo: 40.0, color: '#B83878', label: 'Shock Level' },
        { upTo: null, color: '#8B1A5C', label: 'Very High' },
      ],
    },
    alkalinity: {
      label: 'Alkalinity', unit: 'ppm',
      min: 0, max: 300, step: 10, decimals: 0,
      idealLow: 80, idealHigh: 120,
      zones: [
        { upTo: 40, color: '#D4B83D', label: 'Low' },
        { upTo: 80, color: '#A8B545', label: 'Ideal Low' },
        { upTo: 120, color: '#5C9E44', label: 'Ideal' },
        { upTo: 180, color: '#3B8C4A', label: 'High' },
        { upTo: 240, color: '#2A7B7B', label: 'Very High' },
        { upTo: null, color: '#1A6B8A', label: 'Excessive' },
      ],
    },
    cyanuric_acid: {
      label: 'Cyanuric Acid', unit: 'ppm',
      min: 0, max: 300, step: 5, decimals: 0,
      idealLow: 30, idealHigh: 50,
      zones: [
        { upTo: 30, color: '#F0D0D8', label: 'Low' },
        { upTo: 50, color: '#E0A0B8', label: 'Ideal' },
        { upTo: 100, color: '#C87098', label: 'High' },
        { upTo: 150, color: '#A84878', label: 'Very High' },
        { upTo: null, color: '#6B1040', label: 'Excessive' },
      ],
    },
    calcium_hardness: {
      label: 'Hardness', unit: 'ppm',
      min: 0, max: 1000, step: 25, decimals: 0,
      idealLow: 200, idealHigh: 400,
      zones: [
        { upTo: 100, color: '#D86060', label: 'Very Soft' },
        { upTo: 200, color: '#C04888', label: 'Soft' },
        { upTo: 400, color: '#8848A8', label: 'Ideal' },
        { upTo: 800, color: '#5858C0', label: 'Hard' },
        { upTo: null, color: '#3868D0', label: 'Very Hard' },
      ],
    },
    bromine: {
      label: 'Bromine', unit: 'ppm',
      min: 0, max: 20, step: 0.2, decimals: 1,
      idealLow: 2.0, idealHigh: 6.0,
      zones: [
        { upTo: 1.0, color: '#F5EBB0', label: 'Low' },
        { upTo: 2.0, color: '#F0D4C8', label: 'Low-Ideal' },
        { upTo: 6.0, color: '#E8A0B4', label: 'Ideal' },
        { upTo: 10.0, color: '#D46B94', label: 'High' },
        { upTo: null, color: '#8B1A5C', label: 'Very High' },
      ],
    },
  },

  getStatus(param, value) {
    const spec = this.ranges[param];
    if (!spec || value == null) return { status: 'unknown', color: '#666', label: 'No Reading' };
    let zone = spec.zones[spec.zones.length - 1];
    for (const z of spec.zones) {
      if (z.upTo == null || value <= z.upTo) { zone = z; break; }
    }
    let status = 'ideal';
    if (value < spec.idealLow) status = 'low';
    else if (value > spec.idealHigh) status = 'high';
    return { status, color: zone.color, label: zone.label };
  },

  formatValue(param, value) {
    const spec = this.ranges[param];
    if (!spec || value == null) return '—';
    return value.toFixed(spec.decimals ?? 1);
  },

  // Chemical types for the form
  chemicals: [
    { type: 'shock',        label: 'Shock',       icon: '⚡' },
    { type: 'chlorine',     label: 'Chlorine',    icon: '🧪' },
    { type: 'ph_up',        label: 'pH Up',       icon: '⬆️' },
    { type: 'ph_down',      label: 'pH Down',     icon: '⬇️' },
    { type: 'alkalinity',   label: 'Alkalinity+', icon: '⚖️' },
    { type: 'cyanuric_acid', label: 'Stabilizer', icon: '☀️' },
    { type: 'hardener',     label: 'Hardener',    icon: '💎' },
    { type: 'algaecide',    label: 'Algaecide',   icon: '🦠' },
    { type: 'clarifier',    label: 'Clarifier',   icon: '✨' },
  ],

  // Maps quick-entry chemical type → product catalog type (null = no catalog products)
  chemToCatalogType: {
    shock:        'shock',
    ph_up:        'ph_up',
    ph_down:      'ph_down',
    alkalinity:   'alkalinity_up',
    cyanuric_acid: 'cya',
    hardener:     'hardness',
    algaecide:    'algaecide',
    clarifier:    'clarifier',
    chlorine:     null,
  },

  // extra: 'fullness' | 'inches' | null — drives contextual options after selection
  poolCareActions: [
    { type: 'clean_skimmer',   icon: '🗑️', label: 'Empty Skimmer',         extra: 'fullness' },
    { type: 'empty_basket',    icon: '🗑️', label: 'Empty Pump Basket',      extra: 'fullness' },
    { type: 'robot_run',       icon: '🌀', label: 'Run Robot Vacuum',        extra: null       },
    { type: 'vacuum',          icon: '🧹', label: 'Vacuum Pool',             extra: null       },
    { type: 'brush_walls',     icon: '🪥', label: 'Brush Walls',            extra: null       },
    { type: 'clean_cartridge', icon: '⚙️', label: 'Clean Filter Cartridge', extra: null       },
    { type: 'backwash',        icon: '♻️', label: 'Backwash Filter',        extra: null       },
    { type: 'add_water',       icon: '💧', label: 'Add Water',              extra: 'inches'   },
  ],

  healthLabels: {
    1: 'Swamp 🐸', 2: 'Very Poor', 3: 'Needs Attention',
    4: 'Needs Work', 5: 'Cloudy', 6: 'Slightly Hazy',
    7: 'Okay', 8: 'Looking Good', 9: 'Clear', 10: 'Crystal Clear 🌊✨',
  },
};
