"""SLAM (Shock, Level, and Maintain) engine — dynamic, retest-driven algae recovery.

Based on Trouble Free Pool's SLAM method: shock to a CYA-based target FC level,
retest and redose until an Overnight Chlorine Loss Test (OCLT) passes, combined
chlorine is low, and the water is visually clear.
"""

from datetime import datetime, timezone

from app.services.treatment_plan import (
    calc_dose_to_target,
    _pick_product,
    _alt_products,
    _step,
    _brush_step,
)

# ─── CYA → TARGET FC CHART ───────────────────────────────────────────────────
# Approximate values from TFP's chlorine/CYA chart. This table is the only
# place these numbers live — adjust here, not in the engine logic below.
CYA_TARGET_FC_TABLE: list[tuple[float, float]] = [
    (0, 5), (10, 7), (20, 9), (30, 12), (40, 16),
    (50, 19), (60, 22), (70, 24), (80, 26), (90, 28), (100, 30),
]


def target_fc_for_cya(cya: float) -> float:
    """Piecewise-linear interpolation over the CYA/target-FC chart, clamped at the ends."""
    table = CYA_TARGET_FC_TABLE
    if cya <= table[0][0]:
        return table[0][1]
    if cya >= table[-1][0]:
        return table[-1][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x0 <= cya <= x1:
            if x1 == x0:
                return y0
            frac = (cya - x0) / (x1 - x0)
            return round(y0 + frac * (y1 - y0), 1)
    return table[-1][1]


def suggest_retest_interval(dose_count: int, hours_since_last_dose: float | None) -> str:
    """Advisory-only hint for how soon to retest. Testing tapers as chlorine demand drops."""
    if dose_count <= 2:
        return "2-3 hours"
    if dose_count <= 5:
        return "4-6 hours"
    return "8-12 hours"


def slam_exit_ready(cc: float, oclt_passed: bool, water_clarity: int | None, algae_level: str | None) -> bool:
    """All three SLAM exit criteria: low CC, OCLT pass, clear water/no algae."""
    clear_enough = (water_clarity or 0) >= 8 and (algae_level in (None, "none", "slight"))
    return cc <= 0.5 and oclt_passed and clear_enough


# ─── STATE HELPERS ────────────────────────────────────────────────────────────

def _new_slam_state(cya: float | None) -> dict:
    target_fc = target_fc_for_cya(cya) if cya is not None else None
    return {
        "cya": cya,
        "target_fc": target_fc,
        "day_count": 1,
        "dose_count": 0,
        "last_dose_at": None,
        "phase": "dosing_loop" if cya is not None else "awaiting_cya",
        "oclt": {
            "status": "not_started",
            "evening_fc": None,
            "evening_logged_at": None,
            "morning_fc": None,
            "loss": None,
        },
    }


def _combined_chlorine(measurement: dict) -> float:
    fc = measurement.get("free_chlorine") or 0
    tc = measurement.get("total_chlorine") or 0
    return max(0, tc - fc)


def _cya_test_step(order: int) -> dict:
    return _step(
        order, "test", "Test Cyanuric Acid (CYA)",
        "SLAM's shock target depends on your CYA level. Test CYA before continuing.",
        why="SLAM shocks to a target FC level calculated from CYA — without a CYA reading, "
            "we can't calculate a safe, effective target.",
        wait_hours_after=None,
    )


def _shock_dose_step(order: int, dose_count: int, dosage: dict | None, product: dict | None, target_fc: float) -> dict:
    return _step(
        order, "add_chemical", f"Shock Dose #{dose_count}",
        f"Add {dosage['description'] if dosage else 'shock'} of "
        f"{product['name'] if product else 'pool shock'} to bring FC up to the SLAM target of {target_fc:.0f} ppm. "
        f"Pre-dissolve granular shock in a bucket of water first.",
        why=f"Your CYA level requires an FC of {target_fc:.0f} ppm to actively kill algae (SLAM shock level).",
        safety_notes="Do not swim while actively SLAMing. Pre-dissolve granular shock — never add powder directly to the pool.",
        wait_hours_after=None,
        product=product, dosage=dosage,
        alt_products=_alt_products("shock", product["id"] if product else ""),
    )


def _retest_wait_step(order: int, interval_hint: str) -> dict:
    return _step(
        order, "test", "Retest Water",
        f"Retest FC (and CC) in about {interval_hint}. Redose with shock if FC has dropped below your SLAM target.",
        why="Chlorine demand from dying algae changes quickly — frequent retesting is how SLAM adjusts to actual conditions "
            "instead of following a fixed schedule.",
        wait_hours_after=None,
    )


def _oclt_ready_step(order: int) -> dict:
    return _step(
        order, "oclt_evening", "Ready for Overnight Test",
        "FC is holding at target and combined chlorine is low. You're ready to run the Overnight Chlorine Loss Test (OCLT): "
        "log an evening FC reading, then a morning FC reading ~8 hours later with nothing added in between.",
        why="OCLT confirms there's no more active chlorine demand (i.e. no more algae to kill) — "
            "losing more than 1 ppm overnight means the SLAM isn't done yet.",
        wait_hours_after=None,
    )


def _oclt_evening_wait_step(order: int) -> dict:
    return _step(
        order, "oclt_morning", "Log Morning OCLT Reading",
        "Come back in about 8 hours (first thing tomorrow morning) and log your FC reading. "
        "Don't add any chemicals or run anything unusual overnight.",
        why="The overnight FC loss tells us whether algae is still consuming chlorine.",
        wait_hours_after=8,
    )


def _oclt_fail_step(order: int, loss: float) -> dict:
    return _step(
        order, "test", "OCLT Failed — Resume Shock/Redose Loop",
        f"Overnight FC loss was {loss:.1f} ppm (more than 1.0 ppm), so the pool isn't done SLAMing yet. "
        f"Shock back up to your target FC and continue retesting.",
        why="A loss over 1 ppm overnight means something (usually remaining algae) is still consuming chlorine.",
        wait_hours_after=None,
    )


def _slam_complete_step(order: int) -> dict:
    return _step(
        order, "test", "SLAM Complete 🎉",
        "Combined chlorine is low, the OCLT passed, and the water is clear. "
        "Your pool has cleared the algae bloom — you can return to normal maintenance levels.",
        why="All three SLAM exit criteria are met: CC ≤ 0.5 ppm, OCLT passed, and the water is visually clear.",
        wait_hours_after=None,
    )


# ─── MAIN ENGINE ──────────────────────────────────────────────────────────────

def initial_slam_steps(measurements: dict, algae_level: str | None) -> tuple[list[dict], dict]:
    """Build the first step(s) for a brand-new SLAM plan. Returns (steps, slam_state)."""
    cya = measurements.get("cyanuric_acid")
    state = _new_slam_state(cya)
    steps: list[dict] = [_brush_step(1, "aggressive")]

    if cya is None:
        steps.append(_cya_test_step(2))
        return steps, state

    return steps, state


def evaluate_slam(
    plan_slam_state: dict,
    measurements: dict,
    water_clarity: int | None,
    algae_level: str | None,
    pool_gal: float,
    inventory: list[dict],
    next_order: int,
) -> dict:
    """Given the plan's current SLAM state and the latest measurement, return
    {"steps": [...new step dicts...], "slam_state": {...updated state...}, "plan_completed": bool}.
    """
    state = dict(plan_slam_state)
    steps: list[dict] = []
    order = next_order
    plan_completed = False

    phase = state.get("phase", "awaiting_cya")
    cya = measurements.get("cyanuric_acid", state.get("cya"))
    fc = measurements.get("free_chlorine") or 0
    cc = _combined_chlorine(measurements)

    if phase == "awaiting_cya":
        if cya is not None:
            state["cya"] = cya
            state["target_fc"] = target_fc_for_cya(cya)
            state["phase"] = "dosing_loop"
            phase = "dosing_loop"
        else:
            steps.append(_cya_test_step(order))
            return {"steps": steps, "slam_state": state, "plan_completed": False}

    if phase == "dosing_loop":
        target_fc = state.get("target_fc") or target_fc_for_cya(cya or 0)
        if fc < target_fc:
            product = _pick_product("shock", inventory)
            dosage = calc_dose_to_target(pool_gal, fc, target_fc, product) if product else None
            state["dose_count"] = state.get("dose_count", 0) + 1
            state["last_dose_at"] = datetime.now(timezone.utc).isoformat()
            steps.append(_shock_dose_step(order, state["dose_count"], dosage, product, target_fc))
            order += 1
            interval = suggest_retest_interval(state["dose_count"], None)
            steps.append(_retest_wait_step(order, interval))
        elif cc <= 0.5:
            state["phase"] = "awaiting_oclt"
            steps.append(_oclt_ready_step(order))
        else:
            # FC at target but CC still elevated — keep retesting, no redose needed yet
            interval = suggest_retest_interval(state.get("dose_count", 0), None)
            steps.append(_retest_wait_step(order, interval))

    elif phase == "awaiting_oclt":
        # No-op here; OCLT flow is driven by the dedicated evening/morning endpoints.
        steps.append(_oclt_ready_step(order))

    return {"steps": steps, "slam_state": state, "plan_completed": plan_completed}


def start_oclt_evening(plan_slam_state: dict, evening_fc: float, next_order: int) -> dict:
    """Record the evening OCLT reading. Returns {"steps": [...], "slam_state": {...}}."""
    state = dict(plan_slam_state)
    state["oclt"] = {
        "status": "evening_logged",
        "evening_fc": evening_fc,
        "evening_logged_at": datetime.now(timezone.utc).isoformat(),
        "morning_fc": None,
        "loss": None,
    }
    steps = [_oclt_evening_wait_step(next_order)]
    return {"steps": steps, "slam_state": state}


def complete_oclt_morning(
    plan_slam_state: dict,
    morning_fc: float,
    cc: float,
    water_clarity: int | None,
    algae_level: str | None,
    next_order: int,
) -> dict:
    """Score the OCLT and return {"steps": [...], "slam_state": {...}, "passed": bool, "loss": float, "plan_completed": bool}."""
    state = dict(plan_slam_state)
    oclt = dict(state.get("oclt") or {})
    evening_fc = oclt.get("evening_fc") or 0
    loss = round(evening_fc - morning_fc, 2)
    passed = loss <= 1.0

    oclt["morning_fc"] = morning_fc
    oclt["loss"] = loss
    oclt["status"] = "passed" if passed else "failed"
    state["oclt"] = oclt

    steps: list[dict] = []
    plan_completed = False

    if passed and slam_exit_ready(cc, True, water_clarity, algae_level):
        state["phase"] = "complete"
        steps.append(_slam_complete_step(next_order))
        plan_completed = True
    else:
        state["phase"] = "dosing_loop"
        state["oclt"] = {
            "status": "not_started",
            "evening_fc": None,
            "evening_logged_at": None,
            "morning_fc": None,
            "loss": None,
        }
        steps.append(_oclt_fail_step(next_order, loss))

    return {"steps": steps, "slam_state": state, "passed": passed, "loss": loss, "plan_completed": plan_completed}
