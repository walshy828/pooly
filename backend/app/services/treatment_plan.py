"""Treatment plan engine — generates ordered, step-by-step pool remediation plans."""

import math
from typing import Any
from app.services.products import CHEMICAL_PRODUCTS, get_products_by_type, get_product

# ─── CONDITION ASSESSMENT ───────────────────────────────────────────────────────

CHEMISTRY_TARGETS = {
    "ph": (7.2, 7.6, 7.4),
    "free_chlorine": (1.0, 4.0, 3.0),
    "alkalinity": (80, 120, 100),
    "cyanuric_acid": (30, 50, 40),
    "calcium_hardness": (200, 400, 300),
}


def _params_out_of_range(measurements: dict) -> list[str]:
    out = []
    for param, (low, high, _target) in CHEMISTRY_TARGETS.items():
        val = measurements.get(param)
        if val is not None and (val < low or val > high):
            out.append(param)
    return out


def assess_condition(
    measurements: dict,
    algae_level: str | None,
    water_clarity: int | None,
    health_score: int | None,
) -> str:
    """Return one of: optimal, minor_correction, significant_correction, algae_mild, algae_moderate, algae_severe."""
    algae = algae_level or "none"
    clarity = water_clarity or 10
    health = health_score or 10

    if algae == "swamp" or clarity <= 2 or health <= 2:
        return "algae_severe"
    if algae == "heavy" or clarity <= 4 or health <= 4:
        return "algae_moderate"
    if algae in ("slight", "moderate") or clarity <= 6 or health <= 6:
        return "algae_mild"

    out_of_range = _params_out_of_range(measurements)
    if len(out_of_range) >= 3:
        return "significant_correction"
    if len(out_of_range) >= 1:
        return "minor_correction"
    return "optimal"


CONDITION_LABELS = {
    "optimal": "Pool Maintenance Check",
    "minor_correction": "Minor Chemistry Adjustment",
    "significant_correction": "Chemistry Correction Plan",
    "algae_mild": "Early Algae Treatment Plan",
    "algae_moderate": "Green Pool Recovery Plan",
    "algae_severe": "Swamp Pool Recovery Plan",
}

CONDITION_ESTIMATED_DAYS = {
    "optimal": 1,
    "minor_correction": 1,
    "significant_correction": 2,
    "algae_mild": 3,
    "algae_moderate": 5,
    "algae_severe": 7,
}


# ─── DOSAGE CALCULATORS ─────────────────────────────────────────────────────────

def _round_up_half(val: float) -> float:
    """Round up to nearest 0.5."""
    return math.ceil(val * 2) / 2


def _fmt_amount(amount: float, unit: str) -> str:
    if amount == int(amount):
        return f"{int(amount)} {unit}"
    return f"{amount:.1f} {unit}"


def calc_dose_to_target(
    pool_gal: float,
    current_fc: float,
    target_fc: float,
    product: dict,
) -> dict:
    """Return shock dosage dict needed to raise FC from current_fc to target_fc."""
    ppm_raise = max(0, target_fc - current_fc)
    if ppm_raise <= 0:
        ppm_raise = 10.0  # at minimum, raise by 10 ppm for maintenance

    ppm_per_unit = product.get("ppm_per_unit_per_10k", 10.0)
    pkg_unit = product.get("package_unit", "lbs")
    pkg_size = product.get("package_size", 1)
    volume_factor = pool_gal / 10000

    raw_amount = (ppm_raise / ppm_per_unit) * volume_factor
    rounded = _round_up_half(raw_amount)
    bags = math.ceil(rounded / pkg_size)

    return {
        "amount": rounded,
        "unit": pkg_unit,
        "bags_needed": bags,
        "target_fc": target_fc,
        "ppm_raise": ppm_raise,
        "description": f"{rounded} {pkg_unit} of {product['name']} (raises FC by ~{ppm_raise:.0f} ppm)",
    }


def calc_shock(
    pool_gal: float,
    current_fc: float,
    combined_cl: float,
    algae_level: str,
    product: dict,
) -> dict:
    """Return shock dosage dict with amount, unit, bags, and description."""
    # Determine target FC based on algae level and combined chlorine
    algae_targets = {
        "none": 10.0,
        "slight": 22.0,
        "moderate": 30.0,
        "heavy": 40.0,
        "swamp": 40.0,
    }
    target_fc = algae_targets.get(algae_level, 10.0)

    # Breakpoint chlorination: if combined chlorine is high, override target
    # Target = 10x combined chlorine to reach breakpoint
    if combined_cl > 0.5:
        breakpoint_target = combined_cl * 10
        target_fc = max(target_fc, breakpoint_target)

    return calc_dose_to_target(pool_gal, current_fc, target_fc, product)


def calc_ph_adjustment(pool_gal: float, current_ph: float, target_ph: float, product: dict) -> dict:
    delta = abs(current_ph - target_ph)
    # dose_per_unit_change_per_10k = oz per 0.1 pH change per 10k gal
    oz_per_0_1 = product.get("dose_per_unit_change_per_10k", 3.0)
    volume_factor = pool_gal / 10000
    oz_needed = (delta / 0.1) * oz_per_0_1 * volume_factor
    oz_needed = max(oz_needed, oz_per_0_1 * volume_factor)  # minimum 1 unit change worth

    if oz_needed >= 16:
        lbs = oz_needed / 16
        rounded = _round_up_half(lbs)
        return {"amount": rounded, "unit": "lbs", "description": f"{rounded} lbs"}
    else:
        rounded = math.ceil(oz_needed)
        return {"amount": rounded, "unit": "oz", "description": f"{rounded} oz"}


def calc_alkalinity(pool_gal: float, current_alk: float, target_alk: float, product: dict) -> dict:
    delta = abs(current_alk - target_alk)
    # dose_per_unit_change_per_10k = lbs per 10 ppm change per 10k gal
    lbs_per_10ppm = product.get("dose_per_unit_change_per_10k", 1.5)
    volume_factor = pool_gal / 10000
    lbs_needed = (delta / 10) * lbs_per_10ppm * volume_factor
    rounded = _round_up_half(max(lbs_needed, 0.5))
    return {"amount": rounded, "unit": "lbs", "description": f"{rounded} lbs"}


def calc_cya(pool_gal: float, current_cya: float, target_cya: float, product: dict) -> dict:
    delta = abs(current_cya - target_cya)
    lbs_per_10ppm = product.get("dose_per_unit_change_per_10k", 1.1)
    volume_factor = pool_gal / 10000
    lbs_needed = (delta / 10) * lbs_per_10ppm * volume_factor
    rounded = _round_up_half(max(lbs_needed, 0.5))
    return {"amount": rounded, "unit": "lbs", "description": f"{rounded} lbs"}


def calc_calcium(pool_gal: float, current_ca: float, target_ca: float, product: dict) -> dict:
    delta = abs(current_ca - target_ca)
    lbs_per_10ppm = product.get("dose_per_unit_change_per_10k", 1.25)
    volume_factor = pool_gal / 10000
    lbs_needed = (delta / 10) * lbs_per_10ppm * volume_factor
    rounded = _round_up_half(max(lbs_needed, 0.5))
    return {"amount": rounded, "unit": "lbs", "description": f"{rounded} lbs"}


def calc_clarifier(pool_gal: float, product: dict) -> dict:
    # Standard dose: 1 oz per 5,000 gal
    oz_needed = pool_gal / 5000
    rounded = math.ceil(oz_needed)
    return {"amount": rounded, "unit": "oz", "description": f"{rounded} oz"}


def calc_algaecide(pool_gal: float, product: dict, is_treatment: bool = False) -> dict:
    # Preventive: 3 oz per 10,000 gal; Treatment: 6 oz per 10,000 gal
    base_oz_per_10k = 6.0 if is_treatment else 3.0
    oz_needed = base_oz_per_10k * (pool_gal / 10000)
    rounded = math.ceil(oz_needed)
    return {"amount": rounded, "unit": "oz", "description": f"{rounded} oz"}


# ─── PRODUCT SELECTION ───────────────────────────────────────────────────────────

def _pick_product(chemical_type: str, inventory: list[dict]) -> dict | None:
    """Find best product from user inventory for the given chemical type."""
    for item in inventory:
        product = CHEMICAL_PRODUCTS.get(item.get("product_id", ""))
        if product and product["type"] == chemical_type and item.get("quantity", 0) > 0:
            return {"id": item["product_id"], **product}
    # Fall back to a recommended default if nothing in inventory
    defaults = {
        "shock": "hth_shock_advanced",
        "algaecide": "hth_algae_guard_60",
        "clarifier": "hth_super_clarifier",
        "ph_up": "hth_ph_up",
        "ph_down": "hth_ph_down",
        "alkalinity_up": "hth_alkalinity_up",
        "cya": "hth_stabilizer",
        "hardness": "hth_hardness_plus",
    }
    default_id = defaults.get(chemical_type)
    if default_id and default_id in CHEMICAL_PRODUCTS:
        return {"id": default_id, **CHEMICAL_PRODUCTS[default_id]}
    return None


def _alt_products(chemical_type: str, exclude_id: str) -> list[dict]:
    """Return alternative product names for a given type."""
    alts = []
    for pid, p in CHEMICAL_PRODUCTS.items():
        if p["type"] == chemical_type and pid != exclude_id:
            alts.append({"id": pid, "name": p["name"], "brand": p["brand"]})
    return alts[:3]


# ─── STEP BUILDERS ───────────────────────────────────────────────────────────────

def _step(
    order: int,
    action_type: str,
    title: str,
    description: str,
    why: str,
    safety_notes: str = "",
    wait_hours_after: float | None = None,
    product: dict | None = None,
    dosage: dict | None = None,
    alt_products: list | None = None,
) -> dict:
    s: dict[str, Any] = {
        "step_order": order,
        "action_type": action_type,
        "title": title,
        "description": description,
        "why": why,
        "safety_notes": safety_notes,
        "wait_hours_after": wait_hours_after,
        "product_id": None,
        "product_name": None,
        "amount": None,
        "unit": None,
        "bags_needed": None,
        "alternative_products": alt_products or [],
    }
    if product:
        s["product_id"] = product.get("id")
        s["product_name"] = product.get("name")
    if dosage:
        s["amount"] = dosage.get("amount")
        s["unit"] = dosage.get("unit")
        s["bags_needed"] = dosage.get("bags_needed")
    return s


def _brush_step(order: int, intensity: str = "normal") -> dict:
    desc = "Brush all pool walls, floor, and steps to dislodge algae and debris." if intensity == "aggressive" \
        else "Brush pool walls and floor to circulate chemistry and remove surface buildup."
    return _step(
        order, "mechanical", "Brush Pool Surfaces", desc,
        why="Brushing breaks up algae colonies and biofilm so chemicals can penetrate and kill them.",
        safety_notes="Use a nylon brush for vinyl/fiberglass; steel bristle for plaster pools.",
        wait_hours_after=0,
    )


def _backwash_step(order: int, filter_type: str = "cartridge") -> dict:
    if filter_type == "cartridge":
        title = "Clean Cartridge Filter"
        desc = "Remove and rinse cartridge filter thoroughly with a hose. For very dirty filters, use a filter cleaner spray."
    elif filter_type == "sand":
        title = "Backwash Sand Filter"
        desc = "Set filter to BACKWASH and run until water runs clear (~2 minutes). Then set to RINSE for 30 seconds. Return to FILTER."
    else:
        title = "Backwash / Clean Filter"
        desc = "Backwash your filter or clean filter media until water runs clear."
    return _step(
        order, "mechanical", title, desc,
        why="A dirty filter can't circulate chemicals effectively. Clean it before shocking so the pump can do its job.",
        wait_hours_after=0,
    )


def _pump_step(order: int, hours: int, context: str = "") -> dict:
    return _step(
        order, "run_pump", f"Run Pump Continuously — {hours} Hours",
        f"Keep your pump running non-stop for {hours} hours{(' — ' + context) if context else ''}.",
        why="Continuous circulation distributes chemicals evenly and helps the filter trap dead algae and debris.",
        safety_notes="Do not swim during this period.",
        wait_hours_after=float(hours),
    )


def _retest_step(order: int, what_to_check: str, expect: str) -> dict:
    return _step(
        order, "test", "Test Water",
        f"Test your pool water and check: {what_to_check}",
        why="Chemistry changes throughout the treatment — retesting confirms you're on track before the next step.",
        safety_notes=expect,
        wait_hours_after=None,
    )


# ─── PLAN TEMPLATES ─────────────────────────────────────────────────────────────

def _chemistry_correction_steps(
    measurements: dict,
    pool_gal: float,
    filter_type: str,
    inventory: list[dict],
) -> list[dict]:
    steps = []
    n = 1
    out = _params_out_of_range(measurements)

    # Mechanical first
    steps.append(_brush_step(n)); n += 1
    if filter_type:
        steps.append(_backwash_step(n, filter_type)); n += 1

    # 1. Alkalinity (must be corrected before pH)
    alk = measurements.get("alkalinity")
    if alk is not None and ("alkalinity" in out):
        if alk < 80:
            product = _pick_product("alkalinity_up", inventory)
            dosage = calc_alkalinity(pool_gal, alk, 100, product) if product else None
            steps.append(_step(
                n, "add_chemical", "Raise Total Alkalinity",
                f"Add {dosage['description'] if dosage else 'alkalinity increaser'} of {product['name'] if product else 'baking soda / sodium bicarbonate'} "
                f"by broadcasting it around the pool perimeter.",
                why="Alkalinity buffers pH. You must correct it first or pH adjustments won't hold.",
                safety_notes="Add in sections; wait 10 min between doses if adding large amounts.",
                wait_hours_after=4,
                product=product, dosage=dosage,
                alt_products=_alt_products("alkalinity_up", product["id"] if product else ""),
            )); n += 1
            steps.append(_pump_step(n, 4, "to circulate alkalinity increaser")); n += 1

    # 2. pH
    ph = measurements.get("ph")
    if ph is not None and ("ph" in out):
        if ph < 7.2:
            product = _pick_product("ph_up", inventory)
            dosage = calc_ph_adjustment(pool_gal, ph, 7.4, product) if product else None
            steps.append(_step(
                n, "add_chemical", "Raise pH",
                f"Add {dosage['description'] if dosage else 'pH Up (soda ash)'} of {product['name'] if product else 'pH Up'} "
                f"by broadcasting slowly in front of return jets with pump running.",
                why="pH directly affects chlorine effectiveness. At pH 7.2–7.6, chlorine is 50–90% active.",
                safety_notes="Broadcast in front of return jets. Never add more than 1 lb at a time in a small pool.",
                wait_hours_after=4,
                product=product, dosage=dosage,
                alt_products=_alt_products("ph_up", product["id"] if product else ""),
            )); n += 1
        elif ph > 7.6:
            product = _pick_product("ph_down", inventory)
            dosage = calc_ph_adjustment(pool_gal, ph, 7.4, product) if product else None
            steps.append(_step(
                n, "add_chemical", "Lower pH",
                f"Add {dosage['description'] if dosage else 'pH Down'} of {product['name'] if product else 'pH Down (sodium bisulfate)'} "
                f"near return jets with pump running.",
                why="High pH reduces chlorine effectiveness and causes cloudy water and scale.",
                safety_notes="For muriatic acid: dilute in a bucket of water first. Never add water to acid.",
                wait_hours_after=4,
                product=product, dosage=dosage,
                alt_products=_alt_products("ph_down", product["id"] if product else ""),
            )); n += 1
        steps.append(_pump_step(n, 4, "to distribute pH adjustment")); n += 1

    # 3. Shock if FC is low or combined chlorine is elevated
    fc = measurements.get("free_chlorine", 0) or 0
    tc = measurements.get("total_chlorine", 0) or 0
    combined = max(0, (tc or fc) - fc)
    needs_shock = ("free_chlorine" in out and fc < 1.0) or combined > 0.5

    if needs_shock:
        product = _pick_product("shock", inventory)
        dosage = calc_shock(pool_gal, fc, combined, "none", product) if product else None
        steps.append(_step(
            n, "add_chemical", "Shock Pool",
            f"Add {dosage['description'] if dosage else 'shock'} of {product['name'] if product else 'pool shock'} "
            f"by dissolving in a bucket of water (granular) or pouring slowly around perimeter (liquid). Shock at dusk for best results.",
            why="Shocking kills bacteria and breaks down combined chlorine (chloramines) that cause eye irritation and odor.",
            safety_notes="Never add shock directly into skimmer. Pre-dissolve granular shock in a bucket of water first. Do not swim for 8+ hours.",
            wait_hours_after=24,
            product=product, dosage=dosage,
            alt_products=_alt_products("shock", product["id"] if product else ""),
        )); n += 1
        steps.append(_pump_step(n, 8, "overnight after shocking")); n += 1

    # 4. CYA stabilizer if low
    cya = measurements.get("cyanuric_acid")
    if cya is not None and cya < 30:
        product = _pick_product("cya", inventory)
        dosage = calc_cya(pool_gal, cya, 40, product) if product else None
        steps.append(_step(
            n, "add_chemical", "Add CYA Stabilizer",
            f"Add {dosage['description'] if dosage else 'CYA stabilizer'} of {product['name'] if product else 'cyanuric acid stabilizer'} "
            f"by placing it in a sock in the skimmer basket or dissolving in a bucket first.",
            why="CYA protects chlorine from UV degradation. Without it, chlorine burns off in hours in direct sunlight.",
            safety_notes="Takes 24–48 hours to fully dissolve. Do not backwash for 48 hours after adding.",
            wait_hours_after=24,
            product=product, dosage=dosage,
        )); n += 1

    # 5. Calcium hardness if low
    ca = measurements.get("calcium_hardness")
    if ca is not None and ca < 200:
        product = _pick_product("hardness", inventory)
        dosage = calc_calcium(pool_gal, ca, 300, product) if product else None
        steps.append(_step(
            n, "add_chemical", "Raise Calcium Hardness",
            f"Add {dosage['description'] if dosage else 'calcium hardness increaser'} of {product['name'] if product else 'calcium chloride'} "
            f"pre-dissolved in a bucket of water, then poured slowly around the pool.",
            why="Low calcium causes water to draw minerals from pool surfaces (plaster etching, liner degradation).",
            safety_notes="Pre-dissolve in a bucket — this generates significant heat. Pour slowly. Do not add all at once.",
            wait_hours_after=24,
            product=product, dosage=dosage,
        )); n += 1

    # 6. Retest
    steps.append(_retest_step(n, "pH, free chlorine, alkalinity",
        "After corrections, all values should be in the green. If not, a second adjustment may be needed.")); n += 1

    return steps


def _algae_mild_steps(
    measurements: dict,
    pool_gal: float,
    filter_type: str,
    inventory: list[dict],
) -> list[dict]:
    steps = []
    n = 1
    fc = measurements.get("free_chlorine", 0) or 0
    tc = measurements.get("total_chlorine", 0) or 0
    combined = max(0, (tc or fc) - fc)
    ph = measurements.get("ph") or 7.5

    steps.append(_brush_step(n, "aggressive")); n += 1
    steps.append(_backwash_step(n, filter_type)); n += 1

    # Lower pH to 7.2 for maximum shock effectiveness
    if ph > 7.3:
        product = _pick_product("ph_down", inventory)
        dosage = calc_ph_adjustment(pool_gal, ph, 7.2, product) if product else None
        steps.append(_step(
            n, "add_chemical", "Lower pH to 7.2",
            f"Add {dosage['description'] if dosage else 'pH Down'} of {product['name'] if product else 'pH Down'} "
            f"to bring pH to 7.2. Lower pH makes shock significantly more effective.",
            why="Chlorine is most effective as a disinfectant at lower pH. At 7.2, chlorine is ~73% active vs ~55% at 7.6.",
            safety_notes="Do not go below 7.0. For muriatic acid: dilute in bucket first, never add water to acid.",
            wait_hours_after=2,
            product=product, dosage=dosage,
            alt_products=_alt_products("ph_down", product["id"] if product else ""),
        )); n += 1

    # Shock at 1.5× normal dose
    shock_product = _pick_product("shock", inventory)
    dosage = calc_shock(pool_gal, fc, combined, "slight", shock_product) if shock_product else None
    steps.append(_step(
        n, "add_chemical", "Shock Treatment (1.5× Dose)",
        f"Add {dosage['description'] if dosage else 'shock'} of {shock_product['name'] if shock_product else 'pool shock'} "
        f"dissolved in a bucket first, then poured slowly around the pool perimeter at dusk.",
        why="A higher shock dose is needed to kill algae. Standard dose may not be enough to break through the algae bloom.",
        safety_notes="Shock at dusk to prevent UV from burning off the chlorine before it works. Pre-dissolve granular shock. Do not swim for 8+ hours.",
        wait_hours_after=12,
        product=shock_product, dosage=dosage,
        alt_products=_alt_products("shock", shock_product["id"] if shock_product else ""),
    )); n += 1

    steps.append(_pump_step(n, 24, "continuously after shocking")); n += 1

    steps.append(_retest_step(
        n, "water color and free chlorine",
        "Pool should be turning from green to blue-grey. If still very green, a second shock dose may be needed."
    )); n += 1

    # Add clarifier when clearing
    clarifier = _pick_product("clarifier", inventory)
    cl_dosage = calc_clarifier(pool_gal, clarifier) if clarifier else None
    steps.append(_step(
        n, "add_chemical", "Add Clarifier",
        f"Once water starts turning blue-grey, add {cl_dosage['description'] if cl_dosage else '1 oz per 5,000 gal'} "
        f"of {clarifier['name'] if clarifier else 'pool clarifier'} to help the filter capture dead algae particles.",
        why="Clarifier clumps tiny dead algae particles together so the filter can trap them, speeding up clearing.",
        safety_notes="Run pump continuously for 24 hours after adding clarifier.",
        wait_hours_after=4,
        product=clarifier, dosage=cl_dosage,
    )); n += 1

    steps.append(_backwash_step(n, filter_type)); n += 1

    steps.append(_step(
        n, "wait", "Wait for Chlorine to Drop",
        "Wait until free chlorine drops below 5 ppm before adding algaecide. Check with a test strip.",
        why="Algaecide is deactivated by high chlorine. Adding it too early wastes product.",
        safety_notes="Typically 24–48 hours after shocking.",
        wait_hours_after=24,
    )); n += 1

    algaecide = _pick_product("algaecide", inventory)
    alg_dosage = calc_algaecide(pool_gal, algaecide, is_treatment=True) if algaecide else None
    steps.append(_step(
        n, "add_chemical", "Add Algaecide",
        f"Add {alg_dosage['description'] if alg_dosage else 'algaecide'} of {algaecide['name'] if algaecide else 'PolyQuat 60% algaecide'} "
        f"by pouring slowly around the pool perimeter with pump running.",
        why="Algaecide kills remaining algae spores and prevents regrowth after shocking.",
        safety_notes="Use PolyQuat-based algaecide to avoid staining. Do not add until FC < 5 ppm.",
        wait_hours_after=24,
        product=algaecide, dosage=alg_dosage,
    )); n += 1

    steps.append(_retest_step(n, "all chemistry parameters",
        "Rebalance any remaining chemistry now that the algae is cleared.")); n += 1

    return steps


def _algae_moderate_steps(
    measurements: dict,
    pool_gal: float,
    filter_type: str,
    inventory: list[dict],
) -> list[dict]:
    steps = []
    n = 1
    fc = measurements.get("free_chlorine", 0) or 0
    tc = measurements.get("total_chlorine", 0) or 0
    combined = max(0, (tc or fc) - fc)
    ph = measurements.get("ph") or 7.5

    steps.append(_brush_step(n, "aggressive")); n += 1
    steps.append(_backwash_step(n, filter_type)); n += 1

    if ph > 7.3:
        product = _pick_product("ph_down", inventory)
        dosage = calc_ph_adjustment(pool_gal, ph, 7.2, product) if product else None
        steps.append(_step(
            n, "add_chemical", "Lower pH to 7.2",
            f"Add {dosage['description'] if dosage else 'pH Down'} of {product['name'] if product else 'pH Down'} "
            f"to bring pH to 7.2 before shocking.",
            why="Chlorine is most effective at lower pH. At 7.2, shock is ~30% more effective than at 7.6.",
            safety_notes="Do not go below 7.0. Dilute muriatic acid in bucket first.",
            wait_hours_after=2,
            product=product, dosage=dosage,
        )); n += 1

    # Super-shock: 2-3× normal dose, targeting 30 ppm
    shock_product = _pick_product("shock", inventory)
    dosage = calc_shock(pool_gal, fc, combined, "moderate", shock_product) if shock_product else None
    steps.append(_step(
        n, "add_chemical", "Super-Shock (Target 30 ppm FC)",
        f"Add {dosage['description'] if dosage else 'shock'} of {shock_product['name'] if shock_product else 'pool shock'}. "
        f"Pre-dissolve granular shock in a bucket of water. Pour slowly around the entire pool perimeter. Shock at dusk.",
        why="Green water requires 2–3× the normal shock dose to break through the algae bloom. Do not underdose.",
        safety_notes="Do not swim for 24 hours. Pre-dissolve granular shock — never add powder directly to pool. Shock at dusk.",
        wait_hours_after=12,
        product=shock_product, dosage=dosage,
        alt_products=_alt_products("shock", shock_product["id"] if shock_product else ""),
    )); n += 1

    steps.append(_pump_step(n, 24, "continuously — do not turn off")); n += 1

    steps.append(_step(
        n, "test", "Check Progress at 12 Hours",
        "Check the water color after 12 hours of running the pump. "
        "If water is turning grey-blue: working. If still green: add another round of shock.",
        why="Green water should start clearing within 12–24 hours. If color hasn't changed at all, a second shock application is needed.",
        safety_notes="If you need a second shock dose, calculate the same amount and re-apply.",
        wait_hours_after=0,
    )); n += 1

    steps.append(_backwash_step(n, filter_type)); n += 1
    steps.append(_pump_step(n, 12, "continue filtering")); n += 1

    clarifier = _pick_product("clarifier", inventory)
    cl_dosage = calc_clarifier(pool_gal, clarifier) if clarifier else None
    steps.append(_step(
        n, "add_chemical", "Add Clarifier",
        f"Once water has turned blue-grey, add {cl_dosage['description'] if cl_dosage else '1 oz per 5,000 gal'} "
        f"of {clarifier['name'] if clarifier else 'pool clarifier'} to help capture dead algae particles.",
        why="Clarifier binds dead algae particles into clumps large enough for your filter to catch.",
        safety_notes="Run pump 24+ hours continuously after adding.",
        wait_hours_after=24,
        product=clarifier, dosage=cl_dosage,
    )); n += 1

    steps.append(_step(
        n, "wait", "Wait for Chlorine to Drop Below 5 ppm",
        "Do not add algaecide until free chlorine reads below 5 ppm on a test strip. "
        "This typically takes 24–48 hours after shocking.",
        why="High chlorine neutralizes algaecide before it can work.",
        wait_hours_after=24,
    )); n += 1

    algaecide = _pick_product("algaecide", inventory)
    alg_dosage = calc_algaecide(pool_gal, algaecide, is_treatment=True) if algaecide else None
    steps.append(_step(
        n, "add_chemical", "Add Algaecide",
        f"Add {alg_dosage['description'] if alg_dosage else 'algaecide'} of {algaecide['name'] if algaecide else 'PolyQuat 60% algaecide'} "
        f"by pouring slowly around pool perimeter.",
        why="Kills remaining algae spores and prevents immediate regrowth.",
        safety_notes="Use PolyQuat-based (60%) for no staining risk. Add only when FC < 5 ppm.",
        wait_hours_after=24,
        product=algaecide, dosage=alg_dosage,
    )); n += 1

    steps.append(_retest_step(n, "all chemistry: pH, FC, alkalinity, CYA",
        "Once clear, rebalance all chemistry in proper order: alk first, then pH, then chlorine.")); n += 1

    return steps


def _algae_severe_steps(
    measurements: dict,
    pool_gal: float,
    filter_type: str,
    inventory: list[dict],
) -> list[dict]:
    steps = []
    n = 1
    fc = measurements.get("free_chlorine", 0) or 0
    tc = measurements.get("total_chlorine", 0) or 0
    combined = max(0, (tc or fc) - fc)
    ph = measurements.get("ph") or 8.0

    steps.append(_retest_step(n, "pH, free chlorine, and alkalinity if possible",
        "Get a baseline reading even if the water is opaque. This helps calculate the correct shock dose.")); n += 1

    steps.append(_brush_step(n, "aggressive")); n += 1
    steps.append(_backwash_step(n, filter_type)); n += 1

    if ph is None or ph > 7.3:
        product = _pick_product("ph_down", inventory)
        dosage = calc_ph_adjustment(pool_gal, ph or 8.0, 7.0, product) if product else None
        steps.append(_step(
            n, "add_chemical", "Lower pH to 7.0–7.2",
            f"Add {dosage['description'] if dosage else 'pH Down'} of {product['name'] if product else 'muriatic acid or pH Down'} "
            f"to bring pH as low as 7.0. This maximizes shock effectiveness for severe algae.",
            why="The lower the pH (within safe range), the more powerful shock becomes. For swamp conditions, every bit helps.",
            safety_notes="Do not go below 7.0. Muriatic acid must be diluted in a bucket first — never add water to acid.",
            wait_hours_after=2,
            product=product, dosage=dosage,
        )); n += 1

    # Mega-shock: 3–4× normal dose, target 40+ ppm
    shock_product = _pick_product("shock", inventory)
    dosage = calc_shock(pool_gal, fc, combined, "swamp", shock_product) if shock_product else None
    steps.append(_step(
        n, "add_chemical", "Mega-Shock (Target 40+ ppm FC) — First Application",
        f"Add {dosage['description'] if dosage else '4+ lbs per 10,000 gal of pool shock'} of "
        f"{shock_product['name'] if shock_product else 'Cal-Hypo 68% shock'}. "
        f"Pre-dissolve each bag in a bucket of water separately, then pour around the perimeter. Do this at dusk.",
        why="Swamp conditions require 3–4× the normal shock dose. Under-dosing at this stage will fail and waste product.",
        safety_notes="Shock at dusk. Do NOT swim. Pre-dissolve granular shock in buckets — never dump bags directly in pool. Wear eye protection.",
        wait_hours_after=12,
        product=shock_product, dosage=dosage,
        alt_products=_alt_products("shock", shock_product["id"] if shock_product else ""),
    )); n += 1

    steps.append(_pump_step(n, 24, "continuously — do not turn off for any reason")); n += 1

    steps.append(_step(
        n, "mechanical", "Backwash Filter",
        f"After 12 hours of pumping, {'clean your cartridge filter' if filter_type == 'cartridge' else 'backwash the filter'}. "
        f"The filter will be loaded with dead algae. Repeat every 12 hours during treatment.",
        why="A clogged filter slows circulation and can cause pressure buildup. Clean it frequently during heavy algae treatment.",
        wait_hours_after=0,
    )); n += 1

    steps.append(_step(
        n, "test", "Assess Progress at 24 Hours",
        "Check water color after 24 hours. Water should be changing. "
        "If still extremely green/black: apply a second full shock dose.",
        why="Severe algae may require 2–3 applications of mega-shock over multiple days.",
        safety_notes="If adding a second dose, calculate the same amount and re-apply at dusk.",
        wait_hours_after=0,
    )); n += 1

    clarifier = _pick_product("clarifier", inventory)
    cl_dosage = calc_clarifier(pool_gal, clarifier) if clarifier else None
    steps.append(_step(
        n, "add_chemical", "Add Clarifier (When Water Starts Clearing)",
        f"Once water transitions from green toward grey or milky blue, add "
        f"{cl_dosage['description'] if cl_dosage else '1 oz per 5,000 gal'} of "
        f"{clarifier['name'] if clarifier else 'pool clarifier'}.",
        why="Clarifier accelerates clearing by binding fine particles the filter can then capture.",
        wait_hours_after=24,
        product=clarifier, dosage=cl_dosage,
    )); n += 1

    steps.append(_step(
        n, "wait", "Wait for Chlorine to Drop Below 5 ppm",
        "Continue running the pump and checking chlorine daily. When FC reads below 5 ppm, proceed.",
        why="Algaecide is destroyed by high chlorine. Patience here prevents wasting product.",
        wait_hours_after=24,
    )); n += 1

    algaecide = _pick_product("algaecide", inventory)
    alg_dosage = calc_algaecide(pool_gal, algaecide, is_treatment=True) if algaecide else None
    steps.append(_step(
        n, "add_chemical", "Add Algaecide",
        f"Add {alg_dosage['description'] if alg_dosage else 'algaecide'} of "
        f"{algaecide['name'] if algaecide else 'PolyQuat 60% algaecide'}.",
        why="Kills any surviving algae spores and prevents immediate re-bloom after chlorine drops.",
        safety_notes="Only when FC < 5 ppm. Use PolyQuat 60% to avoid staining.",
        wait_hours_after=24,
        product=algaecide, dosage=alg_dosage,
    )); n += 1

    steps.append(_retest_step(n, "all chemistry — full panel",
        "Rebalance all chemistry in order: alkalinity first, then pH, then chlorine, then CYA. "
        "This may take 7–10 days total from start to crystal clear.")); n += 1

    return steps


# ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────────

def generate_plan(
    measurements: dict,
    pool_config: dict,
    algae_level: str | None,
    water_clarity: int | None,
    health_score: int | None,
    inventory: list[dict],
) -> dict:
    """Generate a complete treatment plan from pool state and user inventory."""
    pool_gal = float(pool_config.get("volume_gallons") or 10000)
    filter_type = pool_config.get("filter_type") or "cartridge"

    condition = assess_condition(measurements, algae_level, water_clarity, health_score)

    if condition == "optimal":
        steps = [
            _step(1, "test", "Pool Chemistry Looks Good", "All your chemistry readings are in the optimal range. Keep up the great work!",
                  why="Regular testing is the best way to catch problems before they get expensive.",
                  safety_notes="Test water weekly during peak season.", wait_hours_after=None),
            _step(2, "mechanical", "Weekly Maintenance Reminder",
                  "Brush pool walls and floor, empty skimmer basket, and run pump 8–12 hours per day.",
                  why="Regular maintenance prevents algae growth and keeps your filter working efficiently.",
                  wait_hours_after=None),
        ]
    elif condition in ("minor_correction", "significant_correction"):
        steps = _chemistry_correction_steps(measurements, pool_gal, filter_type, inventory)
    elif condition == "algae_mild":
        steps = _algae_mild_steps(measurements, pool_gal, filter_type, inventory)
    elif condition == "algae_moderate":
        steps = _algae_moderate_steps(measurements, pool_gal, filter_type, inventory)
    else:  # algae_severe
        steps = _algae_severe_steps(measurements, pool_gal, filter_type, inventory)

    plan_type_map = {
        "optimal": "maintenance",
        "minor_correction": "chemistry_correction",
        "significant_correction": "chemistry_correction",
        "algae_mild": "algae_mild",
        "algae_moderate": "algae_moderate",
        "algae_severe": "algae_severe",
    }

    return {
        "plan_type": plan_type_map[condition],
        "condition": condition,
        "condition_label": CONDITION_LABELS[condition],
        "estimated_days": CONDITION_ESTIMATED_DAYS[condition],
        "pool_gallons": int(pool_gal),
        "steps": steps,
    }


# ─── WEATHER ANNOTATION ──────────────────────────────────────────────────────────

WEATHER_SENSITIVITY = {
    "run_pump": "none",
    "wait": "none",
    "mechanical": "low",
    "test": "medium",
    "add_chemical": "medium",
}


def _step_sensitivity(step: dict) -> str:
    if "shock" in step.get("title", "").lower():
        return "high"
    return WEATHER_SENSITIVITY.get(step.get("action_type", ""), "none")


def _find_next_clear_day(daily_forecast: list, from_day: int) -> dict | None:
    for f in daily_forecast:
        if f.get("day_offset", 0) > from_day and not f.get("is_rain_day", False):
            return f
    return None


def annotate_with_weather(steps: list[dict], daily_forecast: list[dict]) -> list[dict]:
    """Add a weather_note to each step that is weather-sensitive and falls on a rainy day.

    Notes are advisory only — they do not reorder or remove steps.
    Day offset is projected from cumulative wait_hours_after of preceding steps.
    """
    if not daily_forecast:
        for step in steps:
            step.setdefault("weather_note", None)
        return steps

    forecast_by_offset = {f["day_offset"]: f for f in daily_forecast}
    cumulative_hours = 0.0

    for step in steps:
        day_offset = int(cumulative_hours // 24)
        weather = forecast_by_offset.get(day_offset)
        sensitivity = _step_sensitivity(step)
        note = None

        if weather and sensitivity != "none":
            day_label = weather.get("weekday", "that day")
            is_rain = weather.get("is_rain_day", False)
            is_heavy = weather.get("is_heavy_rain_day", False)

            if sensitivity == "high" and is_rain:
                clear = _find_next_clear_day(daily_forecast, day_offset)
                if clear:
                    note = f"🌧️ Rain expected {day_label}. Consider delaying until {clear['weekday']}."
                else:
                    note = f"🌧️ Rain expected {day_label}. Monitor forecast and delay if heavy rain."
            elif sensitivity == "medium":
                action = step.get("action_type")
                if is_heavy:
                    if action == "test":
                        note = f"🌧️ Heavy rain expected {day_label} — wait 24h after rain clears before testing."
                    else:
                        note = f"🌧️ Heavy rain expected {day_label}. Best to add chemicals before or after rain."
                elif is_rain:
                    if action == "test":
                        note = f"🌧️ Rain expected {day_label} — wait until rain clears before testing."
                    else:
                        note = f"🌧️ Rain expected {day_label}. Consider timing around rain if possible."
            elif sensitivity == "low" and is_heavy:
                note = f"🌧️ Heavy rain expected {day_label}. Task can still be done but conditions will be wet."

        step["weather_note"] = note
        cumulative_hours += step.get("wait_hours_after") or 0

    return steps
