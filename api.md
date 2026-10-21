# Pooly API Reference

This document covers all API endpoints. The Home Assistant integration sections are marked **[HA]**.

---

## Integration Architecture

The recommended approach is a **Home Assistant custom integration** (HACS) that communicates with the Pooly backend over HTTP.

```
Home Assistant                     Pooly Backend
─────────────────────────────────────────────────
Coordinator (poll every 5 min)  →  GET /api/ha/status
                                →  GET /api/ha/maintenance

HA sensor entities              ←  maintenance task state + attributes

HA button (physical tasks only) →  POST /api/ha/maintenance/{task}/complete
HA button (all tasks)           →  POST /api/ha/maintenance/{task}/dismiss

HA automation (state change)    →  POST /api/ha/sensor   (push temp/pump data)
```

### Task completion model

Maintenance tasks fall into two categories that determine how they can be completed:

**Physical tasks** — can be marked complete from HA. A button entity is created for each.

| task_type | Action |
|-----------|--------|
| `clean_cartridge` | Creates a `MaintenanceAction` journal entry |
| `add_water` | Creates a `MaintenanceAction` journal entry |
| `backwash` | Creates a `MaintenanceAction` journal entry |
| `brush_walls` | Creates a `MaintenanceAction` journal entry |
| `clean_skimmer` | Creates a `QuickStatus` journal entry |
| `robot_run` | Creates a `QuickStatus` journal entry |
| `vacuum` | Creates a `QuickStatus` journal entry |
| `empty_basket` | Creates a `QuickStatus` journal entry |

**Pooly app only tasks** — must be completed by logging a journal entry in the Pooly app. The `/complete` endpoint returns **405** for these task types. They auto-complete when the matching journal entry is saved:

| task_type | Completed automatically when… |
|-----------|-------------------------------|
| `test_water` | A measurement entry is saved (`POST /api/measurements`) |
| `check_cya` | A measurement entry including CYA is saved |
| `add_chlorine` | A chlorine chemical addition is saved (`POST /api/chemicals`) |
| `shock_pool` | A shock entry is saved (`POST /api/shock`) |

HA can still **dismiss** (snooze) any task type regardless of category.

### Recommended HA entity model

| Pooly concept | HA entity type | State value |
|---|---|---|
| Maintenance task | `sensor` | `urgent` / `overdue` / `due_soon` / `good` |
| Pool status | `binary_sensor` | `on` = open, `off` = closed |
| Health score | `sensor` | 1–10 |
| Pool temperature | `sensor` | °F value |
| Pump state | `binary_sensor` | `on` / `off` |
| Mark task complete (physical only) | `button` | triggers POST complete |
| Dismiss task (all tasks) | `button` | triggers POST dismiss |

### Authentication

The API currently has no authentication. For a local network deployment this is acceptable. If you expose Pooly externally, add a reverse proxy with authentication before deploying.

---

## Base URL

```
http://<pooly-host>:<port>/api
```

All paths below are relative to this base.

---

## Home Assistant Endpoints

### GET /ha/status **[HA]**

Combined status poll — everything HA needs in one request.

**Response**

```json
{
  "pool_status": "open",
  "pool_name": "My Pool",
  "pool_opened_at": "2026-05-01T12:00:00+00:00",
  "pool_closed_at": null,
  "health_score": 8,
  "health_label": "Looking Good",
  "maintenance_summary": {
    "urgent_count": 1,
    "overdue_count": 2,
    "due_soon_count": 0,
    "good_count": 9,
    "total_enabled": 12
  },
  "pool_temp_f": 82.5,
  "pump_state": "on",
  "last_updated": "2026-06-04T14:30:00+00:00"
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `pool_status` | `open` / `closed` | Suppresses maintenance reminders when closed |
| `health_score` | 1–10 or `null` | `null` if no observations logged |
| `pool_temp_f` | float or `null` | `null` if no sensor data |
| `pump_state` | `"on"` / `"off"` / `null` | `null` if no sensor data |

---

### GET /ha/maintenance **[HA]**

All maintenance tasks as sensor-friendly objects.

**Response**

```json
[
  {
    "task_type": "test_water",
    "display_name": "Test Water Chemistry",
    "state": "overdue",
    "priority": "high",
    "icon": "🔬",
    "interval_days": 3,
    "last_completed": "2026-06-01T10:00:00+00:00",
    "next_due": "2026-06-04T10:00:00+00:00",
    "days_since": 3,
    "days_until_due": 0,
    "recommendation": "Last done 3 days ago. Due every 3 days.",
    "enabled": true
  }
]
```

| State | Meaning |
|-------|---------|
| `urgent` | Never completed, or overdue by 3+ days |
| `overdue` | Overdue by 0–2 days |
| `due_soon` | Due within 1 day |
| `good` | Not yet due |

---

### GET /ha/maintenance/{task_type} **[HA]**

Single maintenance task status. Useful for refreshing one entity after an action.

**Errors:** `404` if `task_type` not found.

---

### POST /ha/maintenance/{task_type}/complete **[HA]**

Mark a **physical** maintenance task as complete from Home Assistant.

Creates the appropriate journal entry and advances the schedule clock.

> **Note:** This endpoint returns `405 Method Not Allowed` for Pooly app only tasks (`test_water`, `add_chlorine`, `check_cya`, `shock_pool`). Those tasks auto-complete when the matching journal entry is saved in the Pooly app. Use **Dismiss** from HA if you need to snooze the reminder.

**Request body** (optional)

```json
{ "notes": "Cleaned thoroughly, replaced O-ring" }
```

**Response**

```json
{
  "task_type": "clean_cartridge",
  "status": "completed",
  "completed_at": "2026-06-04T14:30:00+00:00",
  "next_due": "2026-07-04T14:30:00+00:00"
}
```

**Errors**

| Code | Meaning |
|------|---------|
| 404 | `task_type` not found |
| 405 | Task requires a Pooly app journal entry to complete (`test_water`, `add_chlorine`, `check_cya`, `shock_pool`) |

---

### POST /ha/maintenance/{task_type}/dismiss **[HA]**

Dismiss/skip any maintenance task from Home Assistant.

Resets the schedule clock (advances `next_due` by `interval_days`) **without** creating a journal entry. Available for all task types including Pooly app only tasks.

**No request body.**

**Response**

```json
{
  "task_type": "test_water",
  "status": "dismissed",
  "dismissed_at": "2026-06-04T14:30:00+00:00",
  "next_due": "2026-06-07T14:30:00+00:00"
}
```

**Errors:** `404` if `task_type` not found.

---

### POST /ha/sensor **[HA]**

Push sensor data from Home Assistant to Pooly.

**Request body**

```json
{
  "sensor_type": "pool_temp",
  "value": 82.5,
  "unit": "°F",
  "entity_id": "sensor.pool_thermometer"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `sensor_type` | Yes | `pool_temp`, `pump_state`, or `pump_energy` |
| `value` | Yes | Numeric. For `pump_state`: `1` = on, `0` = off |
| `unit` | No | `"°F"`, `"kWh"`, etc. |
| `entity_id` | No | HA entity ID for traceability |

**Response**

```json
{
  "sensor_type": "pool_temp",
  "value": 82.5,
  "status": "recorded",
  "read_at": "2026-06-04T14:30:00+00:00"
}
```

`status` is `"unchanged"` when the new value matches the most recently stored value (deduplication — pump state and pool temp only; `pump_energy` is always written).

**Errors:** `400` for invalid `sensor_type`.

---

## Entry Endpoints

All entry creation endpoints accept an optional `entry_date` field (ISO 8601 datetime string). When omitted the backend uses the current time. When provided, the journal timestamp, the child record timestamp (`measured_at`, `performed_at`, etc.), and the maintenance schedule clock all use the supplied date — supporting backdated logging.

---

### POST /measurements

Log a water chemistry reading.

**Request body**

```json
{
  "ph": 7.4,
  "free_chlorine": 3.0,
  "total_chlorine": 3.5,
  "alkalinity": 100,
  "cyanuric_acid": 40,
  "calcium_hardness": 250,
  "bromine": null,
  "notes": "After adding pH down yesterday",
  "entry_date": "2026-06-02T12:00:00+00:00"
}
```

All chemistry fields are optional floats/integers. Omit fields you didn't measure.

**Auto-advances schedules:** `test_water` always; `check_cya` when `cyanuric_acid` is provided.

**Response:** `MeasurementResponse` with `id`, `journal_entry_id`, `measured_at`, and all chemistry fields.

---

### POST /chemicals

Log a chemical addition.

**Request body**

```json
{
  "chemical_type": "chlorine",
  "form": "tabs",
  "amount": 3,
  "unit": "3\" tabs",
  "notes": "Topped up the floater",
  "entry_date": null
}
```

| Field | Values |
|-------|--------|
| `chemical_type` | `chlorine`, `ph_up`, `ph_down`, `alkalinity`, `cyanuric_acid`, `hardener`, `algaecide`, `clarifier` |
| `form` | `tabs`, `granular` (chlorine only) |
| `unit` | `oz`, `lbs`, `cups`, `gallons`, `3" tabs` |

**Auto-advances schedules:** `add_chlorine` when `chemical_type` is `chlorine`; `check_cya` when `chemical_type` is `cyanuric_acid`.

---

### POST /shock

Log a pool shock treatment.

**Request body**

```json
{
  "shock_type": "bottle",
  "units": 2,
  "notes": "Shocked after heavy rain",
  "entry_date": null
}
```

| Field | Values |
|-------|--------|
| `shock_type` | `bottle`, `granular` |
| `units` | Number of bottles or bags |

**Auto-advances schedule:** `shock_pool`.

---

### POST /maintenance

Log a physical pool maintenance action.

**Request body**

```json
{
  "action_type": "clean_cartridge",
  "notes": "Soaked in filter cleaner overnight",
  "entry_date": "2026-06-01T12:00:00+00:00"
}
```

| `action_type` | Schedule advanced |
|---|---|
| `clean_cartridge` | `clean_cartridge` |
| `add_water` | `add_water` |
| `backwash` | `backwash` |
| `brush_walls` | `brush_walls` |

---

### POST /observations

Log a pool health score observation.

**Request body**

```json
{
  "health_score": 8,
  "notes": "Clarity has improved since last week",
  "entry_date": null
}
```

`health_score` must be an integer 1–10.

---

### POST /quick-status

Log a quick status check.

**Request body**

```json
{
  "status_type": "clean_skimmer",
  "entry_date": null
}
```

| `status_type` | Schedule advanced |
|---|---|
| `clean_skimmer` | `clean_skimmer` |
| `robot_run` | `robot_run` |
| `vacuumed` | `vacuum` |
| `basket_emptied` | `empty_basket` |
| `clear_water` | *(none)* |

---

### POST /notes

Save a freeform journal note.

**Request body**

```json
{
  "notes": "Noticed slight green tinge near the steps — will monitor.",
  "entry_date": null
}
```

---

### POST /maintenance/dismiss/{task_type}

Reset a maintenance schedule clock without creating a journal entry. Useful for snoozing reminders.

**Response**

```json
{
  "task_type": "clean_skimmer",
  "status": "dismissed",
  "reset_at": "2026-06-04T14:30:00+00:00"
}
```

---

## Settings Endpoints

### GET /settings

Pool configuration and all maintenance schedules.

**Response includes:**
- `pool` — name, volume, shape, filter type, sanitizer type, pool status
- `schedules` — all 12 schedules with `interval_days`, `last_completed`, `next_due`, `priority`, `enabled`

---

### PUT /settings/pool

Update pool configuration.

**Request body** (all fields optional)

```json
{
  "name": "Backyard Pool",
  "volume_gallons": 15000,
  "pool_shape": "rectangle",
  "filter_type": "cartridge",
  "sanitizer_type": "chlorine"
}
```

---

### PUT /settings/schedule/{task_type}

Update a maintenance schedule.

**Request body** (all fields optional)

```json
{
  "interval_days": 5,
  "enabled": true,
  "priority": "high"
}
```

---

### POST /settings/pool/open

Mark the pool as open for the season.

**Query parameter:** `notes` (optional string)

---

### POST /settings/pool/close

Mark the pool as closed / winterized.

**Query parameter:** `notes` (optional string)

---

## Journal Endpoints

### GET /journal

Paginated journal of all logged activities.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `page_size` | 20 | Items per page (max 100) |
| `entry_type` | — | Filter: `measurement`, `chemical`, `maintenance`, `quick_status`, `note`, `shock`, `observation`, `pool_event` |
| `start_date` | — | ISO date string |
| `end_date` | — | ISO date string |
| `sub_type` | — | Secondary filter (e.g. specific `action_type` or `chemical_type`) |

---

### GET /journal/{id}

Single journal entry with full detail.

---

### PUT /journal/{id}

Update a journal entry (edit notes, change values).

---

### DELETE /journal/{id}

Delete a journal entry.

---

### GET /journal/trends

Chemistry trends for sparkline charts.

**Query parameter:** `days` (default 30) — how many days back to include.

---

## Dashboard Endpoint

### GET /dashboard

Full dashboard payload. Heavier than `/ha/status` — use this when you need chemistry readings, recommendations, or weather in addition to maintenance status.

**Response includes:**
- `pool_status`, `health_score`, `health_label`
- `chemistry` — array of parameters with `status` (`ok` / `low` / `high` / `critical`) and `value`
- `reminders` — maintenance reminders with urgency, `days_since`, `interval_days`
- `sensors` — latest pool_temp, pump_state, pump_energy
- `weather` — current conditions and pool impact analysis
- `recommendations` — chemistry dosage recommendations

---

## Task Types Reference

| task_type | Display Name | Interval | Priority | Completion method |
|-----------|-------------|---------|----------|-------------------|
| `test_water` | Test Water Chemistry | 3 days | high | Pooly app only |
| `add_chlorine` | Add Chlorine | 3 days | high | Pooly app only |
| `shock_pool` | Shock Pool | 14 days | normal | Pooly app only |
| `check_cya` | Check CYA Level | 30 days | normal | Pooly app only |
| `clean_cartridge` | Clean Filter Cartridge | 30 days | normal | HA or Pooly app |
| `backwash` | Backwash / Deep Clean Filter | 30 days | normal | HA or Pooly app |
| `clean_skimmer` | Clean Skimmer Basket | 7 days | normal | HA or Pooly app |
| `empty_basket` | Empty Pump Basket | 7 days | normal | HA or Pooly app |
| `robot_run` | Run Pool Robot | 7 days | low | HA or Pooly app |
| `vacuum` | Vacuum Pool | 14 days | low | HA or Pooly app |
| `add_water` | Check Water Level | 7 days | low | HA or Pooly app |
| `brush_walls` | Brush Pool Walls | 7 days | low | HA or Pooly app |

---

## Sensor Types Reference

| sensor_type | Unit | Notes |
|-------------|------|-------|
| `pool_temp` | `°F` | Pool water temperature; deduplicated within 0.5°F |
| `pump_state` | — | `1` = on, `0` = off; deduplicated on exact match |
| `pump_energy` | `kWh` | Pump energy consumption; always written |

---

## Example HA Integration Flow

### Startup

1. `GET /ha/maintenance` — create one `sensor` entity per task. For physical tasks, also create a "Mark Complete" `button`. For all tasks, create a "Dismiss" `button`.
2. `GET /ha/status` — create pool status `binary_sensor`, health score `sensor`, temperature `sensor`, pump `binary_sensor`.

### Coordinator update (every 5 min)

1. `GET /ha/status` — update pool-level entities.
2. `GET /ha/maintenance` — update all task sensor states and attributes.

### User presses "Mark Complete" button (physical task)

1. `POST /api/ha/maintenance/{task_type}/complete` with optional `{ "notes": "..." }`.
2. On success, immediately refresh from `GET /api/ha/maintenance/{task_type}`.

### Pooly app only task completes automatically

When the user logs a water test in the Pooly app (`POST /api/measurements`), the backend calls `update_schedule_completion("test_water")` automatically. The next coordinator poll will see the task move to `good` — no HA action required.

### User presses "Dismiss" button (any task)

1. `POST /api/ha/maintenance/{task_type}/dismiss`.
2. Refresh the entity state.

### Push sensor data from HA

```yaml
action:
  - service: pooly.push_sensor
    data:
      sensor_type: pool_temp
      value: "{{ states('sensor.pool_thermometer') | float }}"
      unit: "°F"
      entity_id: sensor.pool_thermometer
```
