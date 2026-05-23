/** Pooly API client — wraps all fetch calls to the backend. */
const API = {
  base: '/api',

  async _fetch(path, options = {}) {
    const url = `${this.base}${path}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    try {
      const resp = await fetch(url, config);
      if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);
      return await resp.json();
    } catch (err) {
      console.error(`[API] ${options.method || 'GET'} ${path} failed:`, err);
      throw err;
    }
  },

  // Dashboard
  getDashboard() { return this._fetch('/dashboard'); },

  // Measurements
  addMeasurement(data) { return this._fetch('/measurements', { method: 'POST', body: data }); },
  getChemistryConfig() { return this._fetch('/measurements/chemistry-config'); },

  // Chemicals
  addChemical(data) { return this._fetch('/chemicals', { method: 'POST', body: data }); },

  // Maintenance
  addMaintenance(data) { return this._fetch('/maintenance', { method: 'POST', body: data }); },
  dismissMaintenance(taskType) { return this._fetch(`/maintenance/dismiss/${taskType}`, { method: 'POST' }); },
  addShock(data) { return this._fetch('/shock', { method: 'POST', body: data }); },
  addObservation(data) { return this._fetch('/observations', { method: 'POST', body: data }); },
  addQuickStatus(data) { return this._fetch('/quick-status', { method: 'POST', body: data }); },
  addNote(notes) { return this._fetch(`/notes?notes=${encodeURIComponent(notes)}`, { method: 'POST' }); },

  // Journal
  getJournal(page = 1, pageSize = 20, filters = {}) {
    let url = `/journal?page=${page}&page_size=${pageSize}`;
    if (filters.entryType) url += `&entry_type=${filters.entryType}`;
    if (filters.startDate) url += `&start_date=${filters.startDate}`;
    if (filters.endDate) url += `&end_date=${filters.endDate}`;
    if (filters.subType) url += `&sub_type=${filters.subType}`;
    return this._fetch(url);
  },
  getEntry(id) { return this._fetch(`/journal/${id}`); },
  updateEntry(id, data) { return this._fetch(`/journal/${id}`, { method: 'PUT', body: data }); },
  deleteEntry(id) { return this._fetch(`/journal/${id}`, { method: 'DELETE' }); },
  getTrends(days = 30) { return this._fetch(`/journal/trends?days=${days}`); },

  // Sensors
  getTemperature(hours = 24) { return this._fetch(`/sensors/temperature?hours=${hours}`); },
  getPump() { return this._fetch('/sensors/pump'); },
  getWeather() { return this._fetch('/weather'); },

  // Reminders (from dashboard)

  // Settings
  getSettings() { return this._fetch('/settings'); },
  updatePool(data) { return this._fetch('/settings/pool', { method: 'PUT', body: data }); },
  updateSchedule(taskType, data) { return this._fetch(`/settings/schedule/${taskType}`, { method: 'PUT', body: data }); },
  openPool(notes = '') { return this._fetch(`/settings/pool/open${notes ? '?notes=' + encodeURIComponent(notes) : ''}`, { method: 'POST' }); },
  closePool(notes = '') { return this._fetch(`/settings/pool/close${notes ? '?notes=' + encodeURIComponent(notes) : ''}`, { method: 'POST' }); },
  checkPinRequired() { return this._fetch('/settings/pin-required'); },
  verifyPin(pin) { return this._fetch(`/settings/verify-pin?pin=${encodeURIComponent(pin)}`, { method: 'POST' }); },

  // Health check
  health() { return this._fetch('/health'); },
};
