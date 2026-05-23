/** Formatting utilities */
const Fmt = {
  timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  },

  date(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  dateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  dateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  },

  entryTypeLabel(type) {
    const labels = {
      measurement: '🔬 Measurement', chemical: '💧 Chemical Added',
      maintenance: '🔧 Maintenance', shock: '⚡ Pool Shock',
      observation: '👁️ Observation', quick_status: '✅ Quick Status',
      note: '📝 Note', pool_event: '📅 Pool Season Event',
    };
    return labels[type] || type;
  },

  entryTypeIcon(type) {
    const icons = { measurement: '🔬', chemical: '💧', maintenance: '🔧',
      shock: '⚡', observation: '👁️', quick_status: '✅', note: '📝', pool_event: '📅' };
    return icons[type] || '📋';
  },

  entryTypeColor(type) {
    const colors = {
      measurement: '#3498DB', chemical: '#2ECC71', maintenance: '#F39C12',
      shock: '#E74C3C', observation: '#9B59B6', quick_status: '#1ABC9C', note: '#95A5A6',
      pool_event: '#34495E',
    };
    return colors[type] || '#666';
  },

  statusTypeLabel(type) {
    const labels = {
      clear_water: 'Water Clear', clean_skimmer: 'Skimmer Cleaned',
      robot_run: 'Robot Run', vacuumed: 'Pool Vacuumed',
      basket_emptied: 'Pump Basket Emptied', brush_walls: 'Walls Brushed',
      clean_cartridge: 'Filter Cartridge Cleaned', add_water: 'Water Level Adjusted',
      backwash: 'Filter Backwashed',
    };
    return labels[type] || type;
  },

  chemicalLabel(type) {
    const labels = {
      chlorine: 'Chlorine', ph_up: 'pH Up', ph_down: 'pH Down',
      alkalinity: 'Alkalinity+', cyanuric_acid: 'Stabilizer',
      hardener: 'Hardener', algaecide: 'Algaecide',
      clarifier: 'Clarifier', shock: 'Shock',
    };
    return labels[type] || type;
  },

  temp(val) { return val != null ? `${Math.round(val)}°F` : '--'; },
  number(val, dec = 1) { return val != null ? Number(val).toFixed(dec) : '--'; },
};
