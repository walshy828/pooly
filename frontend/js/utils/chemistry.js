/** Chemistry range definitions and color maps — mirrors backend. */
const Chemistry = {
  ranges: {
    ph: {
      label: 'pH', unit: '',
      options: [6.2, 6.8, 7.2, 7.8, 8.4],
      colors: ['#E8832A', '#D4C738', '#5B9B3E', '#3A7B4F', '#5B4B8A'],
      colorLabels: ['Acidic', 'Low', 'Ideal', 'High', 'Very High'],
      idealLow: 7.2, idealHigh: 7.6,
    },
    free_chlorine: {
      label: 'Free Chlorine', unit: 'ppm',
      options: [0, 0.5, 1, 3, 5, 10],
      colors: ['#F5EBB0', '#F0D4C8', '#E8A0B4', '#D46B94', '#B83878', '#8B1A5C'],
      colorLabels: ['None', 'Very Low', 'Low', 'Ideal', 'High', 'Very High'],
      idealLow: 1.0, idealHigh: 4.0,
    },
    total_chlorine: {
      label: 'Total Chlorine', unit: 'ppm',
      options: [0, 0.5, 1, 3, 5, 10],
      colors: ['#F5EBB0', '#F0D4C8', '#E8A0B4', '#D46B94', '#B83878', '#8B1A5C'],
      colorLabels: ['None', 'Very Low', 'Low', 'Ideal', 'High', 'Very High'],
      idealLow: 1.0, idealHigh: 4.0,
    },
    alkalinity: {
      label: 'Alkalinity', unit: 'ppm',
      options: [0, 40, 80, 120, 180, 240],
      colors: ['#D4B83D', '#A8B545', '#5C9E44', '#3B8C4A', '#2A7B7B', '#1A6B8A'],
      colorLabels: ['None', 'Low', 'Ideal Low', 'Ideal', 'High', 'Very High'],
      idealLow: 80, idealHigh: 120,
    },
    cyanuric_acid: {
      label: 'Cyanuric Acid', unit: 'ppm',
      options: [0, 30, 50, 100, 150, 240],
      colors: ['#F0D0D8', '#E0A0B8', '#C87098', '#A84878', '#8B2858', '#6B1040'],
      colorLabels: ['None', 'Low-Ideal', 'Ideal', 'High', 'Very High', 'Excessive'],
      idealLow: 30, idealHigh: 50,
    },
    calcium_hardness: {
      label: 'Hardness', unit: 'ppm',
      options: [0, 100, 200, 400, 800],
      colors: ['#D86060', '#C04888', '#8848A8', '#5858C0', '#3868D0'],
      colorLabels: ['Very Soft', 'Soft', 'Ideal Low', 'Ideal', 'Hard'],
      idealLow: 200, idealHigh: 400,
    },
    bromine: {
      label: 'Bromine', unit: 'ppm',
      options: [0, 1, 2, 4, 6, 10],
      colors: ['#F5EBB0', '#F0D4C8', '#E8A0B4', '#D46B94', '#B83878', '#8B1A5C'],
      colorLabels: ['None', 'Very Low', 'Low', 'Ideal', 'High', 'Very High'],
      idealLow: 2.0, idealHigh: 6.0,
    },
  },

  getStatus(param, value) {
    const spec = this.ranges[param];
    if (!spec || value == null) return { status: 'unknown', color: '#666', label: 'No Reading' };
    let closestIdx = 0, minDiff = Math.abs(value - spec.options[0]);
    spec.options.forEach((opt, i) => {
      const diff = Math.abs(value - opt);
      if (diff < minDiff) { minDiff = diff; closestIdx = i; }
    });
    let status = 'ideal';
    if (value < spec.idealLow) status = 'low';
    else if (value > spec.idealHigh) status = 'high';
    return { status, color: spec.colors[closestIdx], label: spec.colorLabels[closestIdx] };
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
