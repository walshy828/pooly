"""Pool chemistry range definitions, color maps, and recommendation engine.

Ranges and colors are based on standard 7-way test strips (the image provided by the user).
"""

from typing import Optional

# ── Range Definitions ────────────────────────────────────────────────────────
# Each tuple: (low_limit, ideal_low, ideal_high, high_limit, unit)
CHEMISTRY_RANGES = {
    "ph": {
        "label": "pH",
        "unit": "",
        "low": 7.2,
        "ideal_low": 7.2,
        "ideal_high": 7.6,
        "high": 7.8,
        "options": [6.2, 6.8, 7.2, 7.8, 8.4],
        "colors": ["#E8832A", "#D4C738", "#5B9B3E", "#3A7B4F", "#5B4B8A"],
        "color_labels": ["Acidic", "Low", "Ideal", "High", "Very High"],
    },
    "free_chlorine": {
        "label": "Free Chlorine",
        "unit": "ppm",
        "low": 1.0,
        "ideal_low": 1.0,
        "ideal_high": 4.0,
        "high": 5.0,
        "options": [0, 0.5, 1, 3, 5, 10],
        "colors": ["#F5EBB0", "#F0D4C8", "#E8A0B4", "#D46B94", "#B83878", "#8B1A5C"],
        "color_labels": ["None", "Very Low", "Low", "Ideal", "High", "Very High"],
    },
    "total_chlorine": {
        "label": "Total Chlorine",
        "unit": "ppm",
        "low": 1.0,
        "ideal_low": 1.0,
        "ideal_high": 4.0,
        "high": 5.0,
        "options": [0, 0.5, 1, 3, 5, 10],
        "colors": ["#F5EBB0", "#F0D4C8", "#E8A0B4", "#D46B94", "#B83878", "#8B1A5C"],
        "color_labels": ["None", "Very Low", "Low", "Ideal", "High", "Very High"],
    },
    "alkalinity": {
        "label": "Alkalinity",
        "unit": "ppm",
        "low": 80,
        "ideal_low": 80,
        "ideal_high": 120,
        "high": 180,
        "options": [0, 40, 80, 120, 180, 240],
        "colors": ["#D4B83D", "#A8B545", "#5C9E44", "#3B8C4A", "#2A7B7B", "#1A6B8A"],
        "color_labels": ["None", "Low", "Ideal Low", "Ideal", "High", "Very High"],
    },
    "cyanuric_acid": {
        "label": "Cyanuric Acid",
        "unit": "ppm",
        "low": 30,
        "ideal_low": 30,
        "ideal_high": 50,
        "high": 100,
        "options": [0, 30, 50, 100, 150, 240],
        "colors": ["#F0D0D8", "#E0A0B8", "#C87098", "#A84878", "#8B2858", "#6B1040"],
        "color_labels": ["None", "Low-Ideal", "Ideal", "High", "Very High", "Excessive"],
    },
    "calcium_hardness": {
        "label": "Hardness",
        "unit": "ppm",
        "low": 200,
        "ideal_low": 200,
        "ideal_high": 400,
        "high": 500,
        "options": [0, 100, 200, 400, 800],
        "colors": ["#D86060", "#C04888", "#8848A8", "#5858C0", "#3868D0"],
        "color_labels": ["Very Soft", "Soft", "Ideal Low", "Ideal", "Hard"],
    },
    "bromine": {
        "label": "Bromine",
        "unit": "ppm",
        "low": 2.0,
        "ideal_low": 2.0,
        "ideal_high": 6.0,
        "high": 10.0,
        "options": [0, 1, 2, 4, 6, 10],
        "colors": ["#F5EBB0", "#F0D4C8", "#E8A0B4", "#D46B94", "#B83878", "#8B1A5C"],
        "color_labels": ["None", "Very Low", "Low", "Ideal", "High", "Very High"],
    },
}


def get_chemistry_status(parameter: str, value: Optional[float]) -> dict:
    """Evaluate a chemistry reading against its ranges.

    Returns a dict with: status (low/ideal/high), color, label.
    """
    if value is None or parameter not in CHEMISTRY_RANGES:
        return {"status": "unknown", "color": "#666", "label": "No Reading"}

    spec = CHEMISTRY_RANGES[parameter]

    # Find the closest option for the color
    options = spec["options"]
    colors = spec["colors"]
    closest_idx = 0
    min_diff = abs(value - options[0])
    for i, opt in enumerate(options):
        diff = abs(value - opt)
        if diff < min_diff:
            min_diff = diff
            closest_idx = i

    color = colors[closest_idx]
    color_label = spec["color_labels"][closest_idx]

    if value < spec["ideal_low"]:
        status = "low"
    elif value > spec["ideal_high"]:
        status = "high"
    else:
        status = "ideal"

    return {
        "status": status,
        "color": color,
        "label": color_label,
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
            # Soda ash: ~6 oz per 10,000 gal raises pH 0.2 points → 30 oz per point
            delta = 7.4 - ph
            oz_needed = 30 * delta * volume_factor
            recs.append({
                "category": "pH Low",
                "message": f"pH is {ph} (target 7.4). Add approximately {_fmt_oz(oz_needed)} of pH Increaser (Soda Ash).",
                "severity": "critical" if ph < 6.8 else "warning",
                "icon": "⬆️",
            })
        elif ph > 7.6:
            # Muriatic acid: ~6 oz per 10,000 gal lowers pH 0.2 points → 30 oz per point
            delta = ph - 7.4
            oz_needed = 30 * delta * volume_factor
            recs.append({
                "category": "pH High",
                "message": f"pH is {ph} (target 7.4). Add approximately {_fmt_oz(oz_needed)} of pH Decreaser (Muriatic Acid).",
                "severity": "critical" if ph > 8.0 else "warning",
                "icon": "⬇️",
            })

    fc = measurement.get("free_chlorine")
    if fc is not None:
        if fc < 1.0:
            # Liquid chlorine (10%): ~10 oz per 10,000 gal raises 1 ppm
            # Granular (Cal-Hypo 68%): ~2 oz per 10,000 gal raises 1 ppm
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
            })
        elif fc > 5.0:
            recs.append({
                "category": "High Chlorine",
                "message": f"Free Chlorine is {fc} ppm. Avoid swimming until it drops below 5 ppm. Wait or dilute with fresh water.",
                "severity": "warning",
                "icon": "⚠️",
            })

    alk = measurement.get("alkalinity")
    if alk is not None:
        if alk < 80:
            # Baking soda: 1.5 lbs per 10,000 gal raises alkalinity 10 ppm
            delta = 100 - alk
            lbs_needed = 1.5 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Alkalinity",
                "message": f"Alkalinity is {alk} ppm (target 100 ppm). Add approximately {lbs_needed:.1f} lbs of Alkalinity Increaser (Baking Soda).",
                "severity": "warning",
                "icon": "⬆️",
            })
        elif alk > 120:
            # Muriatic acid: ~26 oz per 10,000 gal lowers alkalinity 10 ppm
            delta = alk - 100
            oz_acid = 26 * (delta / 10) * volume_factor
            recs.append({
                "category": "High Alkalinity",
                "message": f"Alkalinity is {alk} ppm (target 100 ppm). Add approximately {_fmt_oz(oz_acid)} of Muriatic Acid. Adjust pH first.",
                "severity": "info",
                "icon": "⬇️",
            })

    cya = measurement.get("cyanuric_acid")
    if cya is not None:
        if cya < 30:
            # CYA stabilizer: ~13 oz per 10,000 gal raises CYA 10 ppm
            delta = 40 - cya
            oz_needed = 13 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Stabilizer",
                "message": f"Cyanuric Acid is {cya} ppm (target 40 ppm). Add approximately {_fmt_oz(oz_needed)} of CYA Stabilizer. Chlorine is degrading quickly in sunlight.",
                "severity": "warning",
                "icon": "☀️",
            })
        elif cya > 50:
            recs.append({
                "category": "High Stabilizer",
                "message": f"Cyanuric Acid is {cya} ppm (ideal 30–50 ppm). Consider partial water replacement to dilute.",
                "severity": "info" if cya <= 100 else "warning",
                "icon": "💧",
            })

    ch = measurement.get("calcium_hardness")
    if ch is not None:
        if ch < 200:
            # Calcium chloride: 1.25 lbs per 10,000 gal raises hardness 10 ppm
            delta = 300 - ch
            lbs_needed = 1.25 * (delta / 10) * volume_factor
            recs.append({
                "category": "Low Hardness",
                "message": f"Calcium Hardness is {ch} ppm (target 300 ppm). Add approximately {lbs_needed:.1f} lbs of Calcium Hardness Increaser to prevent corrosion.",
                "severity": "info",
                "icon": "⬆️",
            })
        elif ch > 400:
            recs.append({
                "category": "High Hardness",
                "message": f"Calcium Hardness is {ch} ppm (ideal 200–400 ppm). Dilute with fresh water to prevent scaling.",
                "severity": "warning",
                "icon": "💧",
            })

    # Check combined chlorine (total - free)
    tc = measurement.get("total_chlorine")
    if tc is not None and fc is not None:
        combined = tc - fc
        if combined > 0.5:
            # Shock (Cal-Hypo 68%): ~1 lb per 10,000 gal raises chlorine ~7 ppm
            shock_lbs = round(volume_factor, 1)
            recs.append({
                "category": "High Combined Chlorine",
                "message": f"Combined chlorine is {combined:.1f} ppm (should be < 0.5). Shock the pool with approximately {shock_lbs} lbs of shock treatment to break down chloramines.",
                "severity": "warning",
                "icon": "⚡",
            })

    return recs
