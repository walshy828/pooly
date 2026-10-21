"""Pool chemistry range definitions, color maps, and recommendation engine.

Ranges/zones mirror frontend/js/utils/chemistry.js — keep both in sync.
"""

from typing import Optional

# ── Range Definitions ────────────────────────────────────────────────────────
# min/max/step drive slider mechanics; zones are named color bands for the
# "at a glance" visual and are independent of step granularity. ideal_low/
# ideal_high remain the authoritative thresholds for low/ideal/high status.
CHEMISTRY_RANGES = {
    "ph": {
        "label": "pH",
        "unit": "",
        "min": 6.5, "max": 8.8, "step": 0.1, "decimals": 1,
        "ideal_low": 7.2,
        "ideal_high": 7.6,
        "zones": [
            {"up_to": 6.9, "color": "#E8832A", "label": "Acidic"},
            {"up_to": 7.1, "color": "#D4C738", "label": "Low"},
            {"up_to": 7.6, "color": "#5B9B3E", "label": "Ideal"},
            {"up_to": 7.9, "color": "#3A7B4F", "label": "High"},
            {"up_to": None, "color": "#5B4B8A", "label": "Very High"},
        ],
    },
    "free_chlorine": {
        "label": "Free Chlorine",
        "unit": "ppm",
        "min": 0, "max": 50, "step": 0.2, "decimals": 1,
        "ideal_low": 1.0,
        "ideal_high": 4.0,
        "zones": [
            {"up_to": 0.5, "color": "#F5EBB0", "label": "Very Low"},
            {"up_to": 1.0, "color": "#F0D4C8", "label": "Low"},
            {"up_to": 4.0, "color": "#E8A0B4", "label": "Ideal"},
            {"up_to": 10.0, "color": "#D46B94", "label": "High"},
            {"up_to": 40.0, "color": "#B83878", "label": "Shock Level"},
            {"up_to": None, "color": "#8B1A5C", "label": "Very High"},
        ],
    },
    "total_chlorine": {
        "label": "Total Chlorine",
        "unit": "ppm",
        "min": 0, "max": 50, "step": 0.2, "decimals": 1,
        "ideal_low": 1.0,
        "ideal_high": 4.0,
        "zones": [
            {"up_to": 0.5, "color": "#F5EBB0", "label": "Very Low"},
            {"up_to": 1.0, "color": "#F0D4C8", "label": "Low"},
            {"up_to": 4.0, "color": "#E8A0B4", "label": "Ideal"},
            {"up_to": 10.0, "color": "#D46B94", "label": "High"},
            {"up_to": 40.0, "color": "#B83878", "label": "Shock Level"},
            {"up_to": None, "color": "#8B1A5C", "label": "Very High"},
        ],
    },
    "alkalinity": {
        "label": "Alkalinity",
        "unit": "ppm",
        "min": 0, "max": 300, "step": 10, "decimals": 0,
        "ideal_low": 80,
        "ideal_high": 120,
        "zones": [
            {"up_to": 40, "color": "#D4B83D", "label": "Low"},
            {"up_to": 80, "color": "#A8B545", "label": "Ideal Low"},
            {"up_to": 120, "color": "#5C9E44", "label": "Ideal"},
            {"up_to": 180, "color": "#3B8C4A", "label": "High"},
            {"up_to": 240, "color": "#2A7B7B", "label": "Very High"},
            {"up_to": None, "color": "#1A6B8A", "label": "Excessive"},
        ],
    },
    "cyanuric_acid": {
        "label": "Cyanuric Acid",
        "unit": "ppm",
        "min": 0, "max": 300, "step": 5, "decimals": 0,
        "ideal_low": 30,
        "ideal_high": 50,
        "zones": [
            {"up_to": 30, "color": "#F0D0D8", "label": "Low"},
            {"up_to": 50, "color": "#E0A0B8", "label": "Ideal"},
            {"up_to": 100, "color": "#C87098", "label": "High"},
            {"up_to": 150, "color": "#A84878", "label": "Very High"},
            {"up_to": None, "color": "#6B1040", "label": "Excessive"},
        ],
    },
    "calcium_hardness": {
        "label": "Hardness",
        "unit": "ppm",
        "min": 0, "max": 1000, "step": 25, "decimals": 0,
        "ideal_low": 200,
        "ideal_high": 400,
        "zones": [
            {"up_to": 100, "color": "#D86060", "label": "Very Soft"},
            {"up_to": 200, "color": "#C04888", "label": "Soft"},
            {"up_to": 400, "color": "#8848A8", "label": "Ideal"},
            {"up_to": 800, "color": "#5858C0", "label": "Hard"},
            {"up_to": None, "color": "#3868D0", "label": "Very Hard"},
        ],
    },
    "bromine": {
        "label": "Bromine",
        "unit": "ppm",
        "min": 0, "max": 20, "step": 0.2, "decimals": 1,
        "ideal_low": 2.0,
        "ideal_high": 6.0,
        "zones": [
            {"up_to": 1.0, "color": "#F5EBB0", "label": "Low"},
            {"up_to": 2.0, "color": "#F0D4C8", "label": "Low-Ideal"},
            {"up_to": 6.0, "color": "#E8A0B4", "label": "Ideal"},
            {"up_to": 10.0, "color": "#D46B94", "label": "High"},
            {"up_to": None, "color": "#8B1A5C", "label": "Very High"},
        ],
    },
}


def get_chemistry_status(parameter: str, value: Optional[float]) -> dict:
    """Evaluate a chemistry reading against its ranges.

    Returns a dict with: status (low/ideal/high), color, label.
    """
    if value is None or parameter not in CHEMISTRY_RANGES:
        return {"status": "unknown", "color": "#666", "label": "No Reading"}

    spec = CHEMISTRY_RANGES[parameter]

    zone = spec["zones"][-1]
    for z in spec["zones"]:
        if z["up_to"] is None or value <= z["up_to"]:
            zone = z
            break

    if value < spec["ideal_low"]:
        status = "low"
    elif value > spec["ideal_high"]:
        status = "high"
    else:
        status = "ideal"

    return {
        "status": status,
        "color": zone["color"],
        "label": zone["label"],
    }


def _fmt_oz(oz: float) -> str:
    """Format oz amount, converting to lbs if large enough."""
    if oz >= 32:
        return f"{oz / 16:.1f} lbs"
    return f"{round(oz)} oz"


def get_recommendations(measurement: dict, pool_volume: int = 17000) -> list[dict]:
    """Generate chemistry correction recommendations based on a measurement.

    Args:
        measurement: dict of parameter -> value
        pool_volume: pool volume in gallons (default for 27' round × 4' deep)

    Returns:
        List of recommendation dicts with category, message, severity, icon.
    """
    recs = []
    volume_factor = pool_volume / 10000  # dosage calculations are per 10,000 gallons

    ph = measurement.get("ph")
    if ph is not None:
        if ph < 7.2:
            delta = 7.4 - ph
            oz_needed = 30 * delta * volume_factor
            recs.append({
                "category": "pH Low",
                "message": f"pH is {ph} (target 7.4). Add approximately {_fmt_oz(oz_needed)} of pH Increaser (Soda Ash).",
                "severity": "critical" if ph < 6.8 else "warning",
                "icon": "⬆️",
                "consequences": [
                    "Chlorine loses up to 50% of its sanitizing power",
                    "Eye and skin irritation for swimmers",
                    "Corrosion of metal fittings, ladder, and equipment",
                ],
                "impact_tags": ["health", "cost", "equipment"],
                "impact_score": 3,
            })
        elif ph > 7.6:
            delta = ph - 7.4
            oz_needed = 30 * delta * volume_factor
            recs.append({
                "category": "pH High",
                "message": f"pH is {ph} (target 7.4). Add approximately {_fmt_oz(oz_needed)} of pH Decreaser (Muriatic Acid).",
                "severity": "critical" if ph > 8.0 else "warning",
                "icon": "⬇️",
                "consequences": [
                    "Chlorine becomes up to 90% less effective at this level",
                    "Cloudy water and scale buildup on surfaces",
                    "Eye and skin irritation for swimmers",
                ],
                "impact_tags": ["health", "cost", "water"],
                "impact_score": 3,
            })

    fc = measurement.get("free_chlorine")
    if fc is not None:
        if fc < 1.0:
            delta = 3.0 - fc
            oz_liquid = 10 * delta * volume_factor
            oz_granular = 2 * delta * volume_factor
            recs.append({
                "category": "Low Chlorine",
                "message": (
                    f"Free Chlorine is {fc} ppm (target 3 ppm). Add approximately "
                    f"{_fmt_oz(oz_liquid)} liquid chlorine (10%) "
                    f"or {_fmt_oz(oz_granular)} granular (Cal-Hypo 68%)."
                ),
                "severity": "critical",
                "icon": "🧪",
                "consequences": [
                    "Bacteria and algae can grow unchecked within 24–48 hours",
                    "Risk of illness — swimmers' ear, skin rashes, GI issues",
                    "Green water requires far more product to fix than prevention",
                ],
                "impact_tags": ["health", "water", "cost"],
                "impact_score": 3,
            })
        elif fc > 5.0:
            recs.append({
                "category": "High Chlorine",
                "message": f"Free Chlorine is {fc} ppm. Avoid swimming until it drops below 5 ppm. Wait or dilute with fresh water.",
                "severity": "warning",
                "icon": "⚠️",
                "consequences": [
                    "Eye, skin, and respiratory irritation while swimming",
                    "Bleaching of swimsuits and hair",
                ],
                "impact_tags": ["health"],
                "impact_score": 2,
            })

    alk = measurement.get("alkalinity")
    if alk is not None:
        if alk < 80:
            delta = 100 - alk
            lbs_needed = 1.5 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Alkalinity",
                "message": f"Alkalinity is {alk} ppm (target 100 ppm). Add approximately {lbs_needed:.1f} lbs of Alkalinity Increaser (Baking Soda).",
                "severity": "warning",
                "icon": "⬆️",
                "consequences": [
                    "pH bounces wildly and becomes nearly impossible to stabilize",
                    "Etching and staining of pool plaster and surfaces",
                    "Corrosion of metal equipment and fittings",
                ],
                "impact_tags": ["equipment", "water"],
                "impact_score": 2,
            })
        elif alk > 120:
            delta = alk - 100
            oz_acid = 26 * (delta / 10) * volume_factor
            recs.append({
                "category": "High Alkalinity",
                "message": f"Alkalinity is {alk} ppm (target 100 ppm). Add approximately {_fmt_oz(oz_acid)} of Muriatic Acid. Adjust pH first.",
                "severity": "info",
                "icon": "⬇️",
                "consequences": [
                    "pH becomes locked high and resistant to correction",
                    "Cloudy water and scale deposits on surfaces and pipes",
                    "Chlorine efficiency decreases",
                ],
                "impact_tags": ["water", "cost"],
                "impact_score": 2,
            })

    cya = measurement.get("cyanuric_acid")
    if cya is not None:
        if cya < 30:
            delta = 40 - cya
            oz_needed = 13 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Stabilizer",
                "message": f"Cyanuric Acid is {cya} ppm (target 40 ppm). Add approximately {_fmt_oz(oz_needed)} of CYA Stabilizer.",
                "severity": "warning",
                "icon": "☀️",
                "consequences": [
                    "UV burns off chlorine 2–5× faster — need to dose daily instead of weekly",
                    "Significantly higher chlorine costs over the season",
                ],
                "impact_tags": ["cost"],
                "impact_score": 2,
            })
        elif cya > 50:
            recs.append({
                "category": "High Stabilizer",
                "message": f"Cyanuric Acid is {cya} ppm (ideal 30–50 ppm). Consider partial water replacement to dilute.",
                "severity": "info" if cya <= 100 else "warning",
                "icon": "💧",
                "consequences": [
                    "Chlorine effectiveness is reduced (\"chlorine lock\")",
                    "Higher chlorine levels needed to achieve safe sanitation",
                    "Only fix is diluting with fresh water — slow and costly",
                ],
                "impact_tags": ["health", "cost"],
                "impact_score": 2,
            })

    ch = measurement.get("calcium_hardness")
    if ch is not None:
        if ch < 200:
            delta = 300 - ch
            lbs_needed = 1.25 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Hardness",
                "message": f"Calcium Hardness is {ch} ppm (target 300 ppm). Add approximately {lbs_needed:.1f} lbs of Calcium Hardness Increaser.",
                "severity": "info",
                "icon": "⬆️",
                "consequences": [
                    "Soft water pulls calcium from plaster and concrete surfaces",
                    "Permanent etching and erosion of pool walls and floor",
                    "Corrosion of metal fittings and equipment",
                ],
                "impact_tags": ["equipment"],
                "impact_score": 2,
            })
        elif ch > 400:
            recs.append({
                "category": "High Hardness",
                "message": f"Calcium Hardness is {ch} ppm (ideal 200–400 ppm). Dilute with fresh water to prevent scaling.",
                "severity": "warning",
                "icon": "💧",
                "consequences": [
                    "White scale forms on surfaces, pipes, and the heater",
                    "Scale buildup clogs filters and reduces equipment lifespan",
                    "Cloudy water and reduced circulation",
                ],
                "impact_tags": ["equipment", "water"],
                "impact_score": 2,
            })

    # Check combined chlorine (total - free)
    tc = measurement.get("total_chlorine")
    if tc is not None and fc is not None:
        combined = tc - fc
        if combined > 0.5:
            shock_lbs = round(volume_factor, 1)
            recs.append({
                "category": "High Combined Chlorine",
                "message": f"Combined chlorine is {combined:.1f} ppm (should be < 0.5). Shock the pool with approximately {shock_lbs} lbs of shock treatment to break down chloramines.",
                "severity": "warning",
                "icon": "⚡",
                "consequences": [
                    "Chloramines cause burning eyes and that strong \"chlorine smell\"",
                    "Sanitization weakens — algae risk increases",
                    "Respiratory irritation for sensitive swimmers and children",
                ],
                "impact_tags": ["health", "water"],
                "impact_score": 2,
            })

    return recs
