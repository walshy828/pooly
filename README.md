# Pooly

A self-hosted pool management app. Log water chemistry, track maintenance tasks, monitor your pump and temperature, and get reminders when something needs attention — all from a clean mobile-first web UI and optionally through Home Assistant.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Using the App](#using-the-app)
  - [Quick Entry](#quick-entry)
  - [Pool Care Reminders](#pool-care-reminders)
  - [Backdating Entries](#backdating-entries)
  - [Notes](#notes)
  - [Deep Links](#deep-links)
- [Home Assistant Integration](#home-assistant-integration)
  - [Push Mode vs. Pull Mode](#push-mode-vs-pull-mode)
  - [Setting Up Push Mode (Recommended)](#setting-up-push-mode-recommended)
  - [Setting Up Pull Mode](#setting-up-pull-mode)
  - [Outbound Notifications](#outbound-notifications)
- [Database Migrations](#database-migrations)
- [Weather Integration](#weather-integration)

---

## Quick Start

**1. Copy the example env file and edit it:**

```bash
cp .env.example .env
```

Edit `.env` with your database password, timezone, and any optional integrations.

**2. Start Pooly with a local database:**

```bash
docker compose --profile local-db up -d
```

Or if you have an external PostgreSQL server, set `DB_HOST` in `.env` and start without the profile:

```bash
docker compose up -d
```

**3. Run database migrations:**

```bash
docker compose exec api alembic upgrade head
```

**4. Open the app:**

Navigate to `http://<your-host>:8080` (or whatever port you set as `APP_PORT`).

---

## Configuration Reference

All settings are read from environment variables. Copy `.env.example` to `.env` and fill in what you need.

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `pooly` | PostgreSQL user |
| `DB_PASSWORD` | — | PostgreSQL password |
| `DB_NAME` | `pooly` | PostgreSQL database name |
| `APP_PORT` | `8080` | Host port Pooly listens on |
| `TZ` | `America/New_York` | Timezone for scheduling and display |
| `APP_PIN` | *(empty)* | Optional 4-digit PIN to gate app access |
| `HA_URL` | *(empty)* | Home Assistant base URL — used for outbound notifications |
| `HA_TOKEN` | *(empty)* | HA long-lived access token — used for outbound notifications |
| `HA_PUSH_MODE` | `false` | See [Push Mode vs. Pull Mode](#push-mode-vs-pull-mode) |
| `HA_TEMP_ENTITY` | *(empty)* | HA entity ID for pool temperature — pull mode only |
| `HA_PUMP_ENTITY` | *(empty)* | HA entity ID for pump switch — pull mode only |
| `HA_PUMP_ENERGY_ENTITY` | *(empty)* | HA entity ID for pump energy sensor — pull mode only |
| `SENSOR_RETENTION_DAYS` | `30` | Days of sensor history to keep (older rows pruned nightly) |
| `WEATHER_API_KEY` | *(empty)* | OpenWeatherMap API key |
| `WEATHER_LAT` | *(empty)* | Latitude for weather lookups |
| `WEATHER_LON` | *(empty)* | Longitude for weather lookups |

---

## Using the App

### Quick Entry

The **➕ Add** tab at the bottom of the app provides a five-panel quick-entry interface:

| Tab | Purpose |
|-----|---------|
| 🔬 Water Test | Log pH, chlorine, alkalinity, CYA, and other readings with a pool health score |
| 💧 Chemicals | Log chemical additions (chlorine tabs/granular, pH up/down, algaecide, etc.) and pool shock |
| 🔧 Pool Care | Log physical maintenance tasks (clean filter, backwash, add water, brush walls) |
| ✅ Quick Check | Tap-to-log status checks (skimmer, robot, vacuum, basket) |
| 📝 Note | Save a freeform note about pool conditions |

Each entry panel also has an optional **Notes** field for associating context with any log entry.

### Pool Care Reminders

The dashboard shows your maintenance schedule with urgency badges. Tapping a reminder reveals action buttons:

- **Physical tasks** (Clean Filter, Add Water, Backwash, Brush Walls, Clean Skimmer, Robot Run, Vacuum, Empty Basket) — tapping **Done** shows a quick inline log form with date presets and an optional note. The journal entry is created immediately and the reminder clock resets.

- **Chemistry and chemical tasks** (Test Water Chemistry, Add Chlorine, Check CYA Level, Shock Pool) — tapping **→ Log Now** navigates directly to the relevant entry form. When you submit the form, the corresponding reminder is automatically marked complete:
  - Submitting a water test → completes **Test Water Chemistry** and **Check CYA Level** (if CYA was entered)
  - Logging a chlorine addition → completes **Add Chlorine**
  - Logging a pool shock → completes **Shock Pool**

- **Skip** on any task resets the schedule clock without creating a journal entry (useful for snoozing a reminder you addressed informally).

> This linkage works both ways: logging a water test from the Quick Entry tab also advances the Test Water Chemistry reminder clock, not just when you tap "Log Now" from the reminder.

### Backdating Entries

All entry forms show a **📅 date row** at the top that defaults to Today. Tap it to open the date picker and select a past date.

When you backdate an entry, the journal timestamp and the maintenance schedule clock both reflect the date you entered. For example, logging "I cleaned the filter 3 days ago" sets the filter's `last_completed` to 3 days ago and calculates `next_due` from that date.

The **inline log form** for physical task reminders also has quick date presets: Today, Yesterday, 2 days ago, 3 days ago, and a custom date picker.

### Notes

Every entry type supports an optional notes field:

- **Water Test, Chemicals**: notes appear in the entry form and are saved with the journal record.
- **Pool Care, Quick Check**: notes are entered in a separate section at the bottom of the panel with its own **Save Note** button, creating a standalone note entry associated with the pool care session.
- **Standalone notes**: the dedicated 📝 Note tab saves a freeform journal entry with no other data attached.

All notes appear in the Journal view alongside their parent entries.

### Deep Links

The app supports hash-based URLs so you can bookmark or share direct links to any section. These work as home screen shortcuts on iOS and Android:

| URL fragment | Destination |
|---|---|
| `#dashboard` | Home dashboard |
| `#journal` | Journal / history |
| `#settings` | Settings |
| `#quick-entry/test` | Add water test |
| `#quick-entry/chem` | Add chemicals |
| `#quick-entry/maint` | Log pool care |
| `#quick-entry/status` | Quick check |
| `#quick-entry/note` | Add a note |

Browser back and forward navigate between pages as expected. Switching tabs within Quick Entry does not create extra history entries.

---

## Home Assistant Integration

Pooly has a companion [HACS integration](https://github.com/walshy828/pooly_connector) that surfaces pool data as native HA entities and lets you interact with maintenance tasks directly from HA dashboards and automations.

### Push Mode vs. Pull Mode

Pooly can receive sensor data (pool temperature, pump state, energy usage) from Home Assistant in two ways. **You must pick one.** Running both simultaneously writes every sensor reading twice and inflates the database unnecessarily.

| | Push Mode | Pull Mode |
|---|---|---|
| **How it works** | HA sends data to Pooly when a sensor state changes (`POST /api/ha/sensor`) | Pooly's background worker polls HA's REST API every 5 minutes |
| **Config flag** | `HA_PUSH_MODE=true` | `HA_PUSH_MODE=false` *(default)* |
| **Requires** | HACS integration installed in HA | `HA_URL`, `HA_TOKEN`, and at least one entity ID set in `.env` |
| **When to use** | Using the HACS integration | No HACS integration; Pooly reaches HA directly |
| **Recommended** | Yes | Only if you cannot use HACS |

> **If you install the HACS integration, set `HA_PUSH_MODE=true` in your `.env` and restart the worker.** This is the only setting change required — everything else happens automatically.

### Setting Up Push Mode (Recommended)

Push mode is the right choice when you have the [Pooly HACS integration](https://github.com/walshy828/pooly_connector) installed. HA becomes the authoritative source for sensor data and delivers readings to Pooly in real time whenever a state change occurs.

**Step 1 — Set the flag in `.env`:**

```env
HA_PUSH_MODE=true
```

`HA_URL` and `HA_TOKEN` are still useful if you want Pooly to send maintenance reminder notifications back to HA (see [Outbound Notifications](#outbound-notifications)), but they are not required for sensor data in push mode.

The `HA_TEMP_ENTITY`, `HA_PUMP_ENTITY`, and `HA_PUMP_ENERGY_ENTITY` variables are ignored in push mode and can be left blank.

**Step 2 — Restart the worker container:**

```bash
docker compose restart worker
```

You should see this line in the worker logs confirming push mode is active:

```
[Worker] HA push-mode active — sensor polling disabled (HACS integration is the source)
```

**Step 3 — Install the HACS integration in Home Assistant:**

See the [HACS integration README](https://github.com/walshy828/pooly_connector) for installation steps. Once installed, configure it with your Pooly host and port. The integration will immediately begin pushing sensor data on state changes.

**Step 4 — Add HA automations to push sensor readings:**

The HACS integration handles maintenance status and controls automatically. For sensor data (temperature, pump state, energy), add automations that call the `pooly.push_sensor` service when the relevant entity changes:

```yaml
# Push pool temperature whenever it changes
automation:
  - alias: "Pooly — push pool temperature"
    trigger:
      - platform: state
        entity_id: sensor.pool_thermometer
    action:
      - service: pooly.push_sensor
        data:
          sensor_type: pool_temp
          value: "{{ states('sensor.pool_thermometer') | float }}"
          unit: "°F"
          entity_id: sensor.pool_thermometer

  - alias: "Pooly — push pump state"
    trigger:
      - platform: state
        entity_id: switch.pool_pump
    action:
      - service: pooly.push_sensor
        data:
          sensor_type: pump_state
          value: "{{ 1 if is_state('switch.pool_pump', 'on') else 0 }}"
          entity_id: switch.pool_pump

  - alias: "Pooly — push pump energy"
    trigger:
      - platform: state
        entity_id: sensor.pool_pump_energy
    action:
      - service: pooly.push_sensor
        data:
          sensor_type: pump_energy
          value: "{{ states('sensor.pool_pump_energy') | float }}"
          unit: kWh
          entity_id: sensor.pool_pump_energy
```

Valid `sensor_type` values: `pool_temp`, `pump_state`, `pump_energy`

### Setting Up Pull Mode

Use pull mode only if you are not running the HACS integration and want Pooly to fetch sensor data from HA on its own schedule (every 5 minutes).

**Requirements:** `HA_URL`, `HA_TOKEN`, and at least one of the three entity ID variables must be set. `HA_PUSH_MODE` must be `false` (or omitted, since `false` is the default).

```env
HA_PUSH_MODE=false

HA_URL=http://homeassistant.local:8123
HA_TOKEN=your_long_lived_access_token

HA_TEMP_ENTITY=sensor.pool_thermometer
HA_PUMP_ENTITY=switch.pool_pump
HA_PUMP_ENERGY_ENTITY=sensor.pool_pump_energy
```

Restart the worker after changes:

```bash
docker compose restart worker
```

The worker logs will confirm pull mode is active:

```
[Worker] HA pull-mode enabled — sensor polling registered
```

> **Do not set pull mode entity IDs and install the HACS integration at the same time.** The push automations and the scheduler will both write sensor readings, creating duplicates. Pick one approach.

### Outbound Notifications

Regardless of push or pull mode, Pooly's worker can send a notification to HA every 6 hours when maintenance tasks are urgent or overdue. This requires `HA_URL` and `HA_TOKEN` to be set in `.env`.

```env
HA_URL=http://homeassistant.local:8123
HA_TOKEN=your_long_lived_access_token
```

Notifications are sent to the default `notify.notify` service in HA. No other configuration is needed — if these two variables are set, notifications are automatically active.

---

## Database Migrations

Pooly uses Alembic for schema management. Always run migrations after updating to a new version:

```bash
docker compose exec api alembic upgrade head
```

To check the current migration state:

```bash
docker compose exec api alembic current
```

---

## Weather Integration

Pooly can pull current conditions and a short-range forecast from [OpenWeatherMap](https://openweathermap.org/api) (free tier) to show weather context on the dashboard and flag high-evaporation or high-UV days.

Set these three variables in `.env`:

```env
WEATHER_API_KEY=your_openweathermap_api_key
WEATHER_LAT=35.0
WEATHER_LON=-80.0
```

Weather data is fetched once per hour. If these variables are not set, the weather section is hidden in the dashboard.
