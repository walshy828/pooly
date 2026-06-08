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
