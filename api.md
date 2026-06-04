# Pooly API Reference

This document covers all API endpoints relevant to the Home Assistant integration.

---

## Integration Architecture

The recommended approach is a **Home Assistant custom integration** (custom component or HACS) that communicates with the Pooly backend over HTTP. This gives you full HA entity lifecycle management, lovelace card support, and service calls.

### How it works

```
Home Assistant                     Pooly Backend
─────────────────────────────────────────────────
Coordinator (poll every N min)  →  GET /api/ha/status
                                →  GET /api/ha/maintenance

HA sensor entities              ←  maintenance task state + attributes

HA button / service call        →  POST /api/ha/maintenance/{task}/complete
                                →  POST /api/ha/maintenance/{task}/dismiss

HA automation (state change)    →  POST /api/ha/sensor   (push temp/pump data)
```

### Recommended HA entity model

| Pooly concept         | HA entity type | State value              |
|-----------------------|----------------|--------------------------|
| Maintenance task      | `sensor`       | `urgent` / `overdue` / `due_soon` / `good` |
| Pool status           | `binary_sensor`| `on` = open, `off` = closed |
| Health score          | `sensor`       | 1–10                     |
| Pool temperature      | `sensor`       | °F value                 |
| Pump state            | `binary_sensor`| `on` / `off`             |
| Mark task complete    | `button`       | triggers POST complete   |
| Dismiss task          | `button`       | triggers POST dismiss    |

### Polling interval

- `/api/ha/status` — poll every 5–10 minutes via the HA DataUpdateCoordinator
- `/api/ha/maintenance` — poll every 5–10 minutes, or on demand after an action

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

These endpoints are purpose-built for the HA integration, returning sensor-friendly payloads.

---

### GET /ha/status

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

**Field notes**

| Field | Values | Notes |
|-------|--------|-------|
| `pool_status` | `open` / `closed` | Suppresses maintenance reminders when closed |
| `health_score` | 1–10 or `null` | `null` if no observations logged |
| `pool_temp_f` | float or `null` | `null` if no sensor data |
| `pump_state` | `"on"` / `"off"` / `null` | `null` if no sensor data |

---

### GET /ha/maintenance

All maintenance tasks as sensor-friendly objects. Suitable for entity creation at startup.

**Response**

```json
[
  {
    "task_type": "test_water",
    "display_name": "Test Water Chemistry",
    "state": "urgent",
    "priority": "high",
    "icon": "🔬",
    "interval_days": 3,
    "last_completed": null,
    "next_due": null,
    "days_since": null,
    "days_until_due": null,
    "recommendation": null,
    "enabled": true
  },
  {
    "task_type": "clean_skimmer",
    "display_name": "Clean Skimmer Basket",
    "state": "good",
    "priority": "normal",
    "icon": "🧹",
    "interval_days": 7,
    "last_completed": "2026-06-02T10:00:00+00:00",
    "next_due": "2026-06-09T10:00:00+00:00",
    "days_since": 2,
    "days_until_due": 5,
    "recommendation": null,
    "enabled": true
  }
]
```

**State values**

| State | Meaning |
|-------|---------|
| `urgent` | Never completed, or overdue by 3+ days |
| `overdue` | Overdue by 0–2 days |
| `due_soon` | Due within 1 day |
| `good` | Not yet due |

**Sensor attributes**

Map all fields except `state` as HA entity attributes.

---

### GET /ha/maintenance/{task_type}

Single maintenance task status. Useful for refreshing one entity after an action.

**Path parameter:** `task_type` — see [Task Types Reference](#task-types-reference)

**Response:** Same shape as one object from the list above.

**Errors**

| Code | Meaning |
|------|---------|
| 404 | `task_type` not found |

---

### POST /ha/maintenance/{task_type}/complete

Mark a maintenance task as complete from Home Assistant.

Creates an appropriate journal entry in Pooly and advances the schedule clock.

**Path parameter:** `task_type`

**Request body** (optional, send `{}` or omit body)

```json
{
  "notes": "Cleaned thoroughly, replaced O-ring"
}
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

**Journal record created by task type**

| Task type | Journal record created |
|-----------|----------------------|
| `clean_cartridge` | `MaintenanceAction` (action_type: clean_cartridge) |
| `add_water` | `MaintenanceAction` (action_type: add_water) |
| `backwash` | `MaintenanceAction` (action_type: backwash) |
| `brush_walls` | `MaintenanceAction` (action_type: brush_walls) |
| `clean_skimmer` | `QuickStatus` (status_type: clean_skimmer) |
| `robot_run` | `QuickStatus` (status_type: robot_run) |
| `vacuum` | `QuickStatus` (status_type: vacuumed) |
| `empty_basket` | `QuickStatus` (status_type: basket_emptied) |
| `test_water` | Note entry ("Completed via Home Assistant") |
| `add_chlorine` | Note entry ("Completed via Home Assistant") |
| `check_cya` | Note entry ("Completed via Home Assistant") |
| `shock_pool` | Note entry ("Completed via Home Assistant") |

**Errors**

| Code | Meaning |
|------|---------|
| 404 | `task_type` not found |

---

### POST /ha/maintenance/{task_type}/dismiss

Dismiss/skip a maintenance task from Home Assistant.

Resets the schedule clock (advances `next_due` by `interval_days`) **without** creating a journal entry. Use this when you want to snooze a reminder without recording the task as done.

**Path parameter:** `task_type`

**No request body.**

**Response**

```json
{
  "task_type": "clean_skimmer",
  "status": "dismissed",
  "dismissed_at": "2026-06-04T14:30:00+00:00",
  "next_due": "2026-06-11T14:30:00+00:00"
}
```

**Errors**

| Code | Meaning |
|------|---------|
| 404 | `task_type` not found |

---

### POST /ha/sensor

Push sensor data from Home Assistant to Pooly. Call this from HA automations when the relevant entity state changes so the data appears on the Pooly dashboard.

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
| `value` | Yes | Numeric value. For `pump_state` use `1` = on, `0` = off |
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

**Errors**

| Code | Meaning |
|------|---------|
| 400 | Invalid `sensor_type` |

---

## Other Endpoints Useful for HA

These are the existing Pooly API endpoints that the HA integration may also want to call.

---

### GET /dashboard

Full dashboard payload. Use this if you need chemistry readings, recommendations, or weather data in addition to maintenance status. Heavier than `/ha/status` — prefer `/ha/status` for routine polling.

**Response includes:**
- `pool_status`, `health_score`, `health_label`
- `chemistry` — array of chemistry parameters with `status` (ok/low/high/critical) and `value`
- `reminders` — maintenance reminders with urgency
- `sensors` — latest pool_temp, pump_state, pump_energy
- `weather` — current conditions and pool impact analysis
- `recommendations` — dosage recommendations

---

### GET /settings

Pool configuration and all maintenance schedules.

**Response includes:**
- `pool` — name, volume, shape, filter type, sanitizer type, pool status
- `schedules` — all schedules with `interval_days`, `last_completed`, `next_due`, `priority`, `enabled`

---

### PUT /settings/schedule/{task_type}

Update a maintenance schedule's configuration.

**Request body**

```json
{
  "interval_days": 5,
  "enabled": true,
  "priority": "high"
}
```

All fields optional. Only provided fields are updated.

---

### POST /settings/pool/open

Mark the pool as open for the season.

**Request body** (optional)

```json
{ "notes": "Opened for 2026 season" }
```

---

### POST /settings/pool/close

Mark the pool as closed / winterized.

**Request body** (optional)

```json
{ "notes": "Winterized, added closing chemical kit" }
```

---

### POST /maintenance/dismiss/{task_type}

Existing dismiss endpoint (same behaviour as `/ha/maintenance/{task_type}/dismiss`). Included for completeness — prefer the `/ha/` prefixed version in new integrations.

---

### GET /journal

Paginated journal of all logged activities.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `page_size` | 20 | Items per page (max 100) |
| `entry_type` | — | Filter: measurement, chemical, maintenance, quick_status, note, shock, observation, pool_event |
| `start_date` | — | ISO date string |
| `end_date` | — | ISO date string |

---

### GET /journal/trends

Chemistry trends for charting.

**Query parameter:** `days` (default 30) — how many days back to include.

---

## Task Types Reference

These are the valid `task_type` values for the maintenance endpoints:

| task_type | Display Name | Default Interval | Priority |
|-----------|-------------|-----------------|----------|
| `test_water` | Test Water Chemistry | 3 days | high |
| `add_chlorine` | Add Chlorine | 3 days | high |
| `clean_cartridge` | Clean Filter Cartridge | 30 days | normal |
| `shock_pool` | Shock Pool | 14 days | normal |
| `clean_skimmer` | Clean Skimmer Basket | 7 days | normal |
| `robot_run` | Run Pool Robot | 7 days | low |
| `vacuum` | Vacuum Pool | 14 days | low |
| `empty_basket` | Empty Pump Basket | 7 days | normal |
| `add_water` | Check Water Level | 7 days | low |
| `brush_walls` | Brush Pool Walls | 7 days | low |
| `check_cya` | Check CYA Level | 30 days | normal |
| `backwash` | Backwash / Deep Clean Filter | 30 days | normal |

---

## Sensor Types Reference

Valid `sensor_type` values for `POST /ha/sensor`:

| sensor_type | Unit | Notes |
|-------------|------|-------|
| `pool_temp` | `°F` | Pool water temperature |
| `pump_state` | — | `1` = on, `0` = off |
| `pump_energy` | `kWh` | Pump energy consumption |

---

## Example HA Integration Flow

### Startup

1. Call `GET /ha/maintenance` — create one `sensor` entity per task, one `button` entity each for complete and dismiss.
2. Call `GET /ha/status` — create pool status `binary_sensor`, health score `sensor`, temp `sensor`, pump `binary_sensor`.

### Coordinator update (every 5 min)

1. Call `GET /ha/status` — update pool-level entities.
2. Call `GET /ha/maintenance` — update all maintenance sensor states and attributes.

### User presses "Mark Complete" button in HA

1. Call `POST /ha/maintenance/{task_type}/complete` with optional `{ "notes": "..." }`.
2. On success, immediately refresh the entity from `GET /ha/maintenance/{task_type}`.

### User presses "Dismiss" button in HA

1. Call `POST /ha/maintenance/{task_type}/dismiss`.
2. Refresh the entity state.

### Push sensor data from HA

In a HA automation triggered by `state_changed` on your pool thermometer:

```yaml
action:
  - service: rest_command.pooly_push_temp
    data:
      sensor_type: pool_temp
      value: "{{ states('sensor.pool_thermometer') | float }}"
      unit: "°F"
      entity_id: sensor.pool_thermometer
```

Where `rest_command.pooly_push_temp` is defined in `configuration.yaml`:

```yaml
rest_command:
  pooly_push_temp:
    url: http://your-pooly-host/api/ha/sensor
    method: POST
    content_type: application/json
    payload: '{"sensor_type": "{{ sensor_type }}", "value": {{ value }}, "unit": "{{ unit }}", "entity_id": "{{ entity_id }}"}'
```
