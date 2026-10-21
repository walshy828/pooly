"""Pool care guide — chemical cheat-sheet and how-to articles

Revision ID: 011_pool_care_guide
Revises: 010_slam_treatment
Create Date: 2026-07-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '011_pool_care_guide'
down_revision: Union[str, None] = '010_slam_treatment'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEED_CHEMICALS = [
    {
        "slug": "alkalinity-up",
        "product_name": "Alkalinity Up / Alkalinity Increaser",
        "chemical_name": "Sodium bicarbonate",
        "common_name": "Baking soda",
        "purpose": "Raises total alkalinity (small pH effect)",
        "buy_cheaper": "Buy plain 100% sodium bicarbonate — grocery-store baking soda or bulk bags from a feed/restaurant supply store. Identical to branded alkalinity increaser at a fraction of the price.",
        "warnings": None,
        "active_ingredient": "sodium_bicarbonate",
        "sort_order": 1,
    },
    {
        "slug": "ph-up",
        "product_name": "pH Up / pH Increaser",
        "chemical_name": "Sodium carbonate",
        "common_name": "Washing soda (soda ash)",
        "purpose": "Raises pH (also raises alkalinity somewhat)",
        "buy_cheaper": "Buy Arm & Hammer Super Washing Soda (laundry aisle) or bulk soda ash. Check the label for 100% sodium carbonate.",
        "warnings": "Pre-dissolve in a bucket of water to avoid clouding.",
        "active_ingredient": "soda_ash",
        "sort_order": 2,
    },
    {
        "slug": "ph-down",
        "product_name": "pH Down / pH Decreaser",
        "chemical_name": "Sodium bisulfate",
        "common_name": "Dry acid",
        "purpose": "Lowers pH and total alkalinity",
        "buy_cheaper": "Generic sodium bisulfate (dry acid) is the same product without the pool branding. Muriatic acid is even cheaper per dose if you're comfortable handling liquid acid.",
        "warnings": "Adds sulfates to the water over time; heavy long-term use can affect plaster and salt cells.",
        "active_ingredient": "sodium_bisulfate",
        "sort_order": 3,
    },
    {
        "slug": "muriatic-acid",
        "product_name": "Muriatic Acid",
        "chemical_name": "Hydrochloric acid (~31.45%)",
        "common_name": "Muriatic acid",
        "purpose": "Lowers pH and alkalinity; cleans filter grids, concrete, and scale off surfaces",
        "buy_cheaper": "Hardware-store muriatic acid (paint/masonry aisle) is the same as pool-store acid. Also great for acid-washing filter grids and removing scale.",
        "warnings": "Strong fumes — use outdoors. ALWAYS add acid to water, never water to acid. Wear gloves and eye protection. Store away from chlorine.",
        "active_ingredient": "muriatic_acid",
        "sort_order": 4,
    },
    {
        "slug": "liquid-chlorine",
        "product_name": "Liquid Chlorinator / Liquid Shock",
        "chemical_name": "Sodium hypochlorite (10–12.5%)",
        "common_name": "Liquid chlorine / bleach",
        "purpose": "Sanitizes and shocks — adds nothing but chlorine and a little salt",
        "buy_cheaper": "Pool-store 10–12.5% liquid chlorine is usually the best value. Plain unscented household bleach (6%) works too — just avoid splashless/scented versions and check the freshness date, since it loses strength over time.",
        "warnings": "Degrades in heat and sunlight — buy fresh, store cool and shaded.",
        "active_ingredient": "sodium_hypo",
        "sort_order": 5,
    },
    {
        "slug": "cal-hypo",
        "product_name": "Pool Shock (Cal-Hypo)",
        "chemical_name": "Calcium hypochlorite (65–73%)",
        "common_name": "Cal-hypo",
        "purpose": "Powerful granular shock, no stabilizer added",
        "buy_cheaper": "Compare price per pound of available chlorine — buy the highest % per dollar. Skip fancy 'multi-function' shock blends.",
        "warnings": "Raises calcium hardness with every dose. Never mix with other chemicals (fire/explosion risk). Pre-dissolve or broadcast carefully over the deep end.",
        "active_ingredient": "cal_hypo",
        "sort_order": 6,
    },
    {
        "slug": "dichlor",
        "product_name": "Stabilized Shock (Dichlor)",
        "chemical_name": "Sodium dichloro-s-triazinetrione",
        "common_name": "Dichlor",
        "purpose": "Chlorine plus stabilizer in one — useful early season when CYA is low",
        "buy_cheaper": "Generic dichlor is identical to branded 'stabilized shock'. But once your CYA is in range, switch to liquid chlorine or cal-hypo.",
        "warnings": "Every pound adds ~9 ppm CYA per 10,000 gallons. Routine use drives stabilizer sky-high and makes chlorine sluggish.",
        "active_ingredient": "dichlor",
        "sort_order": 7,
    },
    {
        "slug": "trichlor",
        "product_name": "Chlorine Tablets (3\" Tabs)",
        "chemical_name": "Trichloro-s-triazinetrione",
        "common_name": "Trichlor tabs",
        "purpose": "Slow-dissolving sanitizer for floaters and inline feeders",
        "buy_cheaper": "Buy by % available chlorine (99% trichlor) — warehouse-club buckets are usually cheapest. Avoid 'blue' multi-function tabs with copper.",
        "warnings": "Adds CYA continuously and lowers pH. Watch for CYA creep over the season; don't let tabs sit in the skimmer with the pump off.",
        "active_ingredient": "trichlor",
        "sort_order": 8,
    },
    {
        "slug": "cya",
        "product_name": "Stabilizer / Conditioner",
        "chemical_name": "Cyanuric acid",
        "common_name": "CYA / pool stabilizer",
        "purpose": "Protects chlorine from being burned off by sunlight",
        "buy_cheaper": "Generic cyanuric acid is identical to branded 'conditioner'. Dissolve slowly via a sock in front of a return jet.",
        "warnings": "Dose carefully — too much CYA can only be fixed by partially draining the pool. Target 30–50 ppm (60–80 for salt pools).",
        "active_ingredient": "cyanuric_acid",
        "sort_order": 9,
    },
    {
        "slug": "calcium-up",
        "product_name": "Calcium Hardness Increaser",
        "chemical_name": "Calcium chloride",
        "common_name": "Calcium chloride (ice melt)",
        "purpose": "Raises calcium hardness to protect plaster and equipment",
        "buy_cheaper": "Pure calcium chloride ice melt (90%+ purity, e.g. Peladow) is the same chemical — check the label for no additives or anti-caking agents.",
        "warnings": "Gets hot when dissolving — add slowly to water, never the reverse.",
        "active_ingredient": "calcium_chloride",
        "sort_order": 10,
    },
    {
        "slug": "algaecide",
        "product_name": "Algaecide 60",
        "chemical_name": "Polyquaternium (WSCP) 60%",
        "common_name": "Polyquat 60",
        "purpose": "Non-foaming, non-staining algae preventive",
        "buy_cheaper": "Buy by the percentage — any brand of 60% polyquat is the same product. Skip cheap copper-based or linear-quat algaecides (staining and foaming).",
        "warnings": "Preventive, not a cure — chlorine kills algae; polyquat helps keep it from coming back.",
        "active_ingredient": "poly_quat_60",
        "sort_order": 11,
    },
    {
        "slug": "borax",
        "product_name": "Borate / pH Buffer Products",
        "chemical_name": "Sodium tetraborate",
        "common_name": "Borax (20 Mule Team)",
        "purpose": "Raises pH without raising alkalinity; borates at 30–50 ppm improve water feel and suppress algae",
        "buy_cheaper": "20 Mule Team Borax from the laundry aisle instead of branded borate products like ProTeam Supreme.",
        "warnings": "Adding borates requires acid to offset the pH rise; test with borate strips.",
        "active_ingredient": None,
        "sort_order": 12,
    },
    {
        "slug": "clarifier-floc",
        "product_name": "Clarifier / Flocculant",
        "chemical_name": "Polymers / aluminum sulfate (alum)",
        "common_name": "Clarifier, floc",
        "purpose": "Clumps fine particles so the filter can catch them (clarifier) or so they sink for vacuuming (floc)",
        "buy_cheaper": "Rarely needed at all — good filtration plus correct chlorine levels clears most water. If you must, generic polymer clarifier is fine.",
        "warnings": "Floc requires vacuuming to waste — don't use it with a cartridge filter. Fix water chemistry first; clarifier is a band-aid.",
        "active_ingredient": None,
        "sort_order": 13,
    },
    {
        "slug": "phosphate-remover",
        "product_name": "Phosphate Remover",
        "chemical_name": "Lanthanum chloride",
        "common_name": "Phosphate remover",
        "purpose": "Binds phosphates (algae food) out of the water",
        "buy_cheaper": "Usually unnecessary — maintained free chlorine keeps algae dead regardless of phosphates. A heavily marketed category; save your money unless phosphates are extreme (>1000 ppb).",
        "warnings": "Clouds the water temporarily and loads the filter.",
        "active_ingredient": None,
        "sort_order": 14,
    },
]


ARTICLE_HOW_TO_SHOCK = """## When to shock

Shock the pool when any of these happen:

- Combined chlorine (CC) is **0.5 ppm or higher** — the "chlorine smell" is CC, not too much chlorine
- After a big swim day, heavy rain, or a storm dumps debris in the pool
- Water looks dull, hazy, or you see the first hint of algae
- Opening the pool for the season

## What to shock with

- **Liquid chlorine (10–12.5%)** — best default. Nothing added but chlorine; works immediately.
- **Cal-hypo (65–73%)** — cheap and strong, but raises calcium hardness. Fine if your CH is low/normal.
- **Avoid dichlor for routine shocking** — every pound adds ~9 ppm CYA per 10k gallons and your stabilizer creeps up all season.

## How much

Aim to raise free chlorine to roughly **10× your combined chlorine**, or for a routine shock take FC up by ~10 ppm.

Per **10,000 gallons**, to raise FC by 10 ppm:

| Product | Amount |
|---|---|
| Liquid chlorine 12.5% | ~1 gallon |
| Liquid chlorine 10% | ~1.25 gallons |
| Plain bleach 6% | ~2 gallons |
| Cal-hypo 73% | ~1.1 lb |

## The procedure

1. Test the water first — record FC, CC, and pH. Shock works best with pH around 7.2–7.5.
2. Shock **at dusk** so the sun doesn't burn off the chlorine while it works.
3. With the pump running, pour liquid chlorine slowly around the perimeter (or pre-dissolve cal-hypo in a bucket of water and pour that in).
4. **Run the pump overnight** — at least 8 hours of circulation.
5. Brush the walls and floor to expose anything hiding in the surface film.
6. Retest in the morning. Don't swim until FC is back below ~5 ppm (at typical CYA levels).

If the water was green or CC won't drop, a single shock may not be enough — see **The SLAM Method**.
"""

ARTICLE_SLAM = """SLAM = **S**hock, **L**evel, **A**nd **M**aintain. It's the reliable way to clear algae or persistent combined chlorine: raise free chlorine to a target based on your CYA and *hold it there* until the pool is clean — instead of one big shock that fades overnight.

## Step 1 — Test CYA and find your shock target

Your FC shock level depends on stabilizer:

| CYA (ppm) | Shock FC target |
|---|---|
| 30 | 12 |
| 40 | 16 |
| 50 | 20 |
| 60 | 24 |
| 70 | 28 |

If CYA is above ~70, consider partially draining first — holding a 30+ FC level is expensive and slow.

## Step 2 — Raise and hold

- Use **liquid chlorine** — you'll be dosing repeatedly and don't want to stack calcium or CYA.
- Bring FC up to the target, then **test every few hours** (as often as you can) and re-dose back up to the target each time.
- pH test results are unreliable at FC > 10, so get pH to ~7.2 *before* starting.

## Step 3 — Physical work, daily

- **Brush** the entire pool every day — algae hides in a biofilm the chlorine can't reach.
- Vacuum up dead algae; clean or backwash the filter when pressure rises.
- Run the pump 24/7 during the SLAM.

## Step 4 — Know when you're done

You pass the SLAM when **all three** are true:

1. Water is crystal clear
2. Combined chlorine is **below 0.5 ppm**
3. You pass an **overnight chlorine loss test (OCLT)**: test FC at dusk after the sun is off the pool, don't add anything, retest before sunrise — loss must be **under 1 ppm**

Then just let FC drift back down to your normal range. Don't stop early — a SLAM abandoned at "mostly clear" comes back.

> This app can generate and track a SLAM for you: start a **SLAM treatment plan** from the Plan tab and it will compute your shock target and walk the steps day by day.
"""

SEED_ARTICLES = [
    {
        "slug": "how-to-shock",
        "title": "How to Shock the Pool",
        "summary": "When to shock, what to use (and avoid), dosing per 10k gallons, and the dusk-to-morning procedure.",
        "content_md": ARTICLE_HOW_TO_SHOCK,
    },
    {
        "slug": "slam-procedure",
        "title": "The SLAM Method",
        "summary": "Clear algae for good: raise FC to a CYA-based target and hold it until the water passes all three exit criteria.",
        "content_md": ARTICLE_SLAM,
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text(
        "CREATE TABLE IF NOT EXISTS guide_chemicals ("
        "id SERIAL PRIMARY KEY, "
        "slug VARCHAR(100) UNIQUE NOT NULL, "
        "product_name VARCHAR(150) NOT NULL, "
        "chemical_name VARCHAR(150) NOT NULL, "
        "common_name VARCHAR(150), "
        "purpose VARCHAR(200), "
        "buy_cheaper TEXT, "
        "warnings TEXT, "
        "active_ingredient VARCHAR(100), "
        "sort_order INTEGER NOT NULL DEFAULT 0, "
        "is_builtin BOOLEAN NOT NULL DEFAULT FALSE, "
        "created_at TIMESTAMPTZ DEFAULT now(), "
        "updated_at TIMESTAMPTZ DEFAULT now()"
        ")"
    ))
    conn.execute(sa.text(
        "CREATE TABLE IF NOT EXISTS guide_articles ("
        "id SERIAL PRIMARY KEY, "
        "slug VARCHAR(100) UNIQUE NOT NULL, "
        "title VARCHAR(200) NOT NULL, "
        "summary VARCHAR(300), "
        "content_md TEXT NOT NULL, "
        "is_builtin BOOLEAN NOT NULL DEFAULT FALSE, "
        "created_at TIMESTAMPTZ DEFAULT now(), "
        "updated_at TIMESTAMPTZ DEFAULT now()"
        ")"
    ))

    for chem in SEED_CHEMICALS:
        conn.execute(
            sa.text(
                "INSERT INTO guide_chemicals "
                "(slug, product_name, chemical_name, common_name, purpose, buy_cheaper, "
                "warnings, active_ingredient, sort_order, is_builtin) "
                "VALUES (:slug, :product_name, :chemical_name, :common_name, :purpose, "
                ":buy_cheaper, :warnings, :active_ingredient, :sort_order, TRUE) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            chem,
        )

    for article in SEED_ARTICLES:
        conn.execute(
            sa.text(
                "INSERT INTO guide_articles (slug, title, summary, content_md, is_builtin) "
                "VALUES (:slug, :title, :summary, :content_md, TRUE) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            article,
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS guide_articles"))
    conn.execute(sa.text("DROP TABLE IF EXISTS guide_chemicals"))
