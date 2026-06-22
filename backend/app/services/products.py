"""Static catalog of common pool chemical products sold at Walmart, Ocean State Job Lots, and Leslie's."""

from typing import TypedDict


class ChemicalProduct(TypedDict):
    name: str
    brand: str
    type: str           # shock, algaecide, clarifier, ph_up, ph_down, alkalinity_up, alkalinity_down, cya, hardness
    active_ingredient: str
    form: str           # granular, liquid, tablet
    package_size: float
    package_unit: str   # lbs, gallons, quarts, oz
    retailers: list[str]  # walmart, ocean_state, leslies
    notes: str
    # Shock-specific — how many ppm FC rise per unit per 10,000 gallons
    ppm_per_unit_per_10k: float | None
    # pH/alkalinity dosage — oz or lbs of product per unit change per 10k gal
    dose_per_unit_change_per_10k: float | None
    dose_unit: str | None  # oz, lbs, quarts, gallons — unit of measurement for dosage


CHEMICAL_PRODUCTS: dict[str, ChemicalProduct] = {
    # ─── SHOCK ──────────────────────────────────────────────────────────────────
    "hth_shock_advanced": {
        "name": "HTH Pool Care Shock Advanced",
        "brand": "HTH",
        "type": "shock",
        "active_ingredient": "cal_hypo",
        "available_chlorine_pct": 68,
        "form": "granular",
        "package_size": 1,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": 10.5,   # ppm FC rise per 1 lb per 10,000 gal
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart", "ocean_state", "leslies"],
        "notes": "Cal-Hypo 68% — fast dissolving; adds calcium hardness; add at dusk",
    },
    "hth_super_shock": {
        "name": "HTH Super Shock",
        "brand": "HTH",
        "type": "shock",
        "active_ingredient": "cal_hypo",
        "available_chlorine_pct": 73,
        "form": "granular",
        "package_size": 1,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": 11.3,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["leslies"],
        "notes": "Cal-Hypo 73% — high-strength; adds calcium hardness",
    },
    "clorox_shock_extra_blue": {
        "name": "Clorox Pool Shock Extra Blue",
        "brand": "Clorox",
        "type": "shock",
        "active_ingredient": "dichlor",
        "available_chlorine_pct": 56,
        "form": "granular",
        "package_size": 1,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": 8.6,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart"],
        "notes": "Dichlor 56% — also adds CYA stabilizer; do not over-use in summer",
    },
    "pool_essentials_shock": {
        "name": "Pool Essentials Shock Treatment",
        "brand": "Pool Essentials",
        "type": "shock",
        "active_ingredient": "dichlor",
        "available_chlorine_pct": 56,
        "form": "granular",
        "package_size": 1,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": 8.6,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart"],
        "notes": "Dichlor 56% — walmart store brand equivalent to Clorox Extra Blue",
    },
    "liquid_shock_12pct": {
        "name": "Liquid Chlorine / Pool Shock (12.5%)",
        "brand": "Generic",
        "type": "shock",
        "active_ingredient": "sodium_hypo",
        "available_chlorine_pct": 12.5,
        "form": "liquid",
        "package_size": 1,
        "package_unit": "gallons",
        "ppm_per_unit_per_10k": 10.0,   # ppm FC rise per 1 gallon per 10,000 gal
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart", "ocean_state", "leslies"],
        "notes": "Sodium Hypochlorite 12.5% — no cyanuric acid added; degrades quickly in heat",
    },
    "leslies_power_powder": {
        "name": "Leslie's Power Powder Plus",
        "brand": "Leslie's",
        "type": "shock",
        "active_ingredient": "cal_hypo",
        "available_chlorine_pct": 73,
        "form": "granular",
        "package_size": 1,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": 11.3,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["leslies"],
        "notes": "Cal-Hypo 73% — Leslie's premium shock; adds calcium hardness",
    },

    # ─── ALGAECIDES ─────────────────────────────────────────────────────────────
    "hth_algae_guard_60": {
        "name": "HTH Algae Guard 60",
        "brand": "HTH",
        "type": "algaecide",
        "active_ingredient": "poly_quat_60",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart", "ocean_state"],
        "notes": "PolyQuat 60% — no staining, no foam, safe for all surfaces; best choice for algae prevention",
    },
    "clorox_algaecide_30": {
        "name": "Clorox Pool & Spa Algaecide",
        "brand": "Clorox",
        "type": "algaecide",
        "active_ingredient": "poly_quat_30",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart"],
        "notes": "PolyQuat 30% — half the concentration of 60; use 2x the dose vs 60%",
    },
    "leslies_algae_control_60": {
        "name": "Leslie's Algae Control 60",
        "brand": "Leslie's",
        "type": "algaecide",
        "active_ingredient": "poly_quat_60",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["leslies"],
        "notes": "PolyQuat 60% — premium Leslie's formula; effective on green/yellow algae",
    },

    # ─── CLARIFIERS ─────────────────────────────────────────────────────────────
    "clorox_clarifier": {
        "name": "Clorox Pool & Spa Super Water Clarifier",
        "brand": "Clorox",
        "type": "clarifier",
        "active_ingredient": "poly_aluminium_chloride",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart"],
        "notes": "Use 1 oz per 5,000 gal; run pump 24 hrs after adding",
    },
    "hth_super_clarifier": {
        "name": "HTH Super Clarifier",
        "brand": "HTH",
        "type": "clarifier",
        "active_ingredient": "poly_aluminium_chloride",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart", "ocean_state"],
        "notes": "Use 1 oz per 5,000 gal; run pump 24 hrs after adding",
    },
    "robarb_super_blue": {
        "name": "Robarb Super Blue Clarifier",
        "brand": "Robarb",
        "type": "clarifier",
        "active_ingredient": "poly_aluminium_chloride",
        "form": "liquid",
        "package_size": 32,
        "package_unit": "oz",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": None,
        "dose_unit": None,
        "retailers": ["walmart", "ocean_state"],
        "notes": "Use 1 oz per 5,000 gal; run pump 24 hrs after adding",
    },

    # ─── pH UP ───────────────────────────────────────────────────────────────────
    "clorox_ph_up": {
        "name": "Clorox Pool pH Up",
        "brand": "Clorox",
        "type": "ph_up",
        "active_ingredient": "soda_ash",
        "form": "granular",
        "package_size": 2,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        # oz of product to raise pH by 0.1 per 10,000 gal (sodium carbonate / soda ash)
        "dose_per_unit_change_per_10k": 3.0,
        "dose_unit": "oz",
        "retailers": ["walmart"],
        "notes": "Sodium carbonate (soda ash) — raises pH 0.1 per 3 oz per 10k gal; broadcast while pump runs",
    },
    "hth_ph_up": {
        "name": "HTH pH Up",
        "brand": "HTH",
        "type": "ph_up",
        "active_ingredient": "soda_ash",
        "form": "granular",
        "package_size": 5,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 3.0,
        "dose_unit": "oz",
        "retailers": ["walmart", "ocean_state"],
        "notes": "Sodium carbonate — raises pH 0.1 per 3 oz per 10k gal",
    },

    # ─── pH DOWN ─────────────────────────────────────────────────────────────────
    "clorox_ph_down": {
        "name": "Clorox Pool pH Down",
        "brand": "Clorox",
        "type": "ph_down",
        "active_ingredient": "sodium_bisulfate",
        "form": "granular",
        "package_size": 2,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        # oz of product to lower pH by 0.1 per 10,000 gal
        "dose_per_unit_change_per_10k": 4.5,
        "dose_unit": "oz",
        "retailers": ["walmart"],
        "notes": "Sodium bisulfate — lowers pH 0.1 per 4.5 oz per 10k gal; add slowly near return jets",
    },
    "hth_ph_down": {
        "name": "HTH pH Down",
        "brand": "HTH",
        "type": "ph_down",
        "active_ingredient": "sodium_bisulfate",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 4.5,
        "dose_unit": "oz",
        "retailers": ["walmart", "ocean_state"],
        "notes": "Sodium bisulfate — lowers pH 0.1 per 4.5 oz per 10k gal",
    },
    "muriatic_acid": {
        "name": "Muriatic Acid (31.45%)",
        "brand": "Generic",
        "type": "ph_down",
        "active_ingredient": "hydrochloric_acid",
        "form": "liquid",
        "package_size": 1,
        "package_unit": "gallons",
        "ppm_per_unit_per_10k": None,
        # oz of product to lower pH by 0.1 per 10,000 gal
        "dose_per_unit_change_per_10k": 2.5,
        "dose_unit": "oz",
        "retailers": ["walmart", "ocean_state", "leslies"],
        "notes": "Caution: very corrosive; dilute in bucket first; add near return jets with pump running",
    },

    # ─── ALKALINITY UP ───────────────────────────────────────────────────────────
    "clorox_alkalinity_increaser": {
        "name": "Clorox Pool Alkalinity Increaser",
        "brand": "Clorox",
        "type": "alkalinity_up",
        "active_ingredient": "sodium_bicarbonate",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        # lbs of product to raise alkalinity by 10 ppm per 10,000 gal
        "dose_per_unit_change_per_10k": 1.5,
        "dose_unit": "lbs",
        "retailers": ["walmart"],
        "notes": "Sodium bicarbonate — raises alk 10 ppm per 1.5 lbs per 10k gal; broadcast while pump runs",
    },
    "hth_alkalinity_up": {
        "name": "HTH Alkalinity Up",
        "brand": "HTH",
        "type": "alkalinity_up",
        "active_ingredient": "sodium_bicarbonate",
        "form": "granular",
        "package_size": 5,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 1.5,
        "dose_unit": "lbs",
        "retailers": ["walmart", "ocean_state"],
        "notes": "Sodium bicarbonate — same as baking soda; raises alk 10 ppm per 1.5 lbs per 10k gal",
    },
    "baking_soda": {
        "name": "Baking Soda (Sodium Bicarbonate)",
        "brand": "Arm & Hammer",
        "type": "alkalinity_up",
        "active_ingredient": "sodium_bicarbonate",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 1.5,
        "dose_unit": "lbs",
        "retailers": ["walmart", "ocean_state"],
        "notes": "100% sodium bicarbonate — same as pool alkalinity increaser but cheaper",
    },

    # ─── CYA STABILIZER ──────────────────────────────────────────────────────────
    "clorox_stabilizer": {
        "name": "Clorox Pool Stabilizer & Conditioner",
        "brand": "Clorox",
        "type": "cya",
        "active_ingredient": "cyanuric_acid",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        # lbs of product to raise CYA by 10 ppm per 10,000 gal
        "dose_per_unit_change_per_10k": 1.1,
        "dose_unit": "lbs",
        "retailers": ["walmart"],
        "notes": "Add via skimmer or dissolved in bucket first; takes 24–48 hrs to fully dissolve",
    },
    "hth_stabilizer": {
        "name": "HTH Stabilizer",
        "brand": "HTH",
        "type": "cya",
        "active_ingredient": "cyanuric_acid",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 1.1,
        "dose_unit": "lbs",
        "retailers": ["walmart", "ocean_state", "leslies"],
        "notes": "Add via skimmer or dissolved in bucket first; takes 24–48 hrs to fully dissolve",
    },

    # ─── CALCIUM HARDNESS ────────────────────────────────────────────────────────
    "clorox_hardness_increaser": {
        "name": "Clorox Pool Calcium Hardness Increaser",
        "brand": "Clorox",
        "type": "hardness",
        "active_ingredient": "calcium_chloride",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        # lbs of product to raise calcium hardness by 10 ppm per 10,000 gal
        "dose_per_unit_change_per_10k": 1.25,
        "dose_unit": "lbs",
        "retailers": ["walmart"],
        "notes": "Pre-dissolve in bucket before adding; generates heat when dissolving",
    },
    "hth_hardness_plus": {
        "name": "HTH Hardness Plus",
        "brand": "HTH",
        "type": "hardness",
        "active_ingredient": "calcium_chloride",
        "form": "granular",
        "package_size": 4,
        "package_unit": "lbs",
        "ppm_per_unit_per_10k": None,
        "dose_per_unit_change_per_10k": 1.25,
        "dose_unit": "lbs",
        "retailers": ["walmart", "ocean_state"],
        "notes": "Pre-dissolve in bucket before adding; generates heat when dissolving",
    },
}


PRODUCT_TYPE_LABELS = {
    "shock": "Shock",
    "algaecide": "Algaecide",
    "clarifier": "Clarifier",
    "ph_up": "pH Increaser",
    "ph_down": "pH Decreaser",
    "alkalinity_up": "Alkalinity Increaser",
    "cya": "CYA Stabilizer",
    "hardness": "Calcium Hardness Increaser",
}


def get_products_by_type(product_type: str) -> dict[str, ChemicalProduct]:
    return {k: v for k, v in CHEMICAL_PRODUCTS.items() if v["type"] == product_type}


def get_product(product_id: str) -> ChemicalProduct | None:
    return CHEMICAL_PRODUCTS.get(product_id)


def get_catalog_grouped() -> dict[str, list[dict]]:
    """Return product catalog grouped by type with id injected."""
    grouped: dict[str, list[dict]] = {}
    for product_id, product in CHEMICAL_PRODUCTS.items():
        ptype = product["type"]
        if ptype not in grouped:
            grouped[ptype] = []
        grouped[ptype].append({"id": product_id, **product})
    return grouped
