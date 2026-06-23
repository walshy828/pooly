"""Optional AI insights layer supporting Claude (Anthropic) and Gemini (Google).

This is *additive narration only*. The deterministic engines in
``services/chemistry.py`` and ``services/treatment_plan.py`` remain the source
of truth for every recommendation and dosage — the model explains, it never
computes amounts.

Everything degrades gracefully: when AI is disabled or unconfigured, or any
call fails, the functions return ``None`` so callers can fall back silently.
"""

from __future__ import annotations

import json
from typing import Optional

import anthropic

from app.config import settings as app_settings

try:
    from google import genai as _google_genai
    from google.genai import types as _google_types
    _GEMINI_AVAILABLE = True
except ImportError:  # pragma: no cover
    _GEMINI_AVAILABLE = False

DEFAULT_CLAUDE_MODEL = "claude-opus-4-8"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

BRIEFING_SYSTEM = (
    "You are Pooly's friendly, knowledgeable pool-care assistant. "
    "Given a snapshot of the user's pool (water chemistry, weather, trends, and "
    "due tasks), write a short daily briefing in plain language: what's going on, "
    "why it matters, and what to focus on today. "
    "Rules: 3-5 sentences, warm and encouraging, no markdown headers or bullet "
    "lists, no emoji spam (one or two is fine). Lead with the most important thing. "
    "NEVER invent chemical dosages or amounts — if a correction is needed, refer "
    "the user to the listed recommendations or their treatment plan. "
    "Output only the briefing text, nothing else."
)

ENRICH_SYSTEM = (
    "You are an experienced pool technician explaining an already-finalized, "
    "step-by-step treatment plan to a homeowner. The steps, products, amounts, and "
    "order are FIXED and correct — do not change, second-guess, or restate them. "
    "Write a short encouraging intro (2-3 sentences) framing the overall job, then "
    "for each step a clear 1-2 sentence explanation of why it matters and how it "
    "sets up the next step. Be practical and reassuring. Never mention amounts or "
    "products that aren't in the step. Respond with JSON only."
)

ENRICH_SCHEMA = {
    "type": "object",
    "properties": {
        "intro": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "order": {"type": "integer"},
                    "why": {"type": "string"},
                },
                "required": ["order", "why"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["intro", "steps"],
    "additionalProperties": False,
}

# Gemini response_schema omits additionalProperties (not supported)
ENRICH_SCHEMA_GEMINI = {
    "type": "object",
    "properties": {
        "intro": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "order": {"type": "integer"},
                    "why": {"type": "string"},
                },
                "required": ["order", "why"],
            },
        },
    },
    "required": ["intro", "steps"],
}


# ── Config helpers ────────────────────────────────────────────────────────

def provider_for(pool_cfg) -> str:
    if pool_cfg is not None and getattr(pool_cfg, "ai_provider", None):
        return pool_cfg.ai_provider
    return "claude"


def resolve_key(pool_cfg) -> Optional[str]:
    """DB-stored key wins; fall back to the provider-specific env var."""
    if pool_cfg is not None and getattr(pool_cfg, "ai_api_key", None):
        return pool_cfg.ai_api_key
    if provider_for(pool_cfg) == "gemini":
        return app_settings.GOOGLE_API_KEY
    return app_settings.ANTHROPIC_API_KEY


def model_for(pool_cfg) -> str:
    if pool_cfg is not None and getattr(pool_cfg, "ai_model", None):
        return pool_cfg.ai_model
    return DEFAULT_CLAUDE_MODEL


def ai_available(pool_cfg) -> bool:
    return bool(pool_cfg is not None and pool_cfg.ai_enabled and resolve_key(pool_cfg))


def _claude_client(key: str) -> "anthropic.AsyncAnthropic":
    return anthropic.AsyncAnthropic(api_key=key)


def _gemini_client(key: str):
    if not _GEMINI_AVAILABLE:
        raise RuntimeError("google-genai package is not installed")
    return _google_genai.Client(api_key=key)


def _text(message) -> str:
    return "".join(b.text for b in message.content if b.type == "text").strip()


# ── Connection test ───────────────────────────────────────────────────────

async def test_key(key: str, model: str, provider: str = "claude") -> tuple[bool, str]:
    """Validate a key/model with a tiny call. Returns (ok, message)."""
    if provider == "gemini":
        return await _test_gemini_key(key, model)
    return await _test_claude_key(key, model)


async def _test_claude_key(key: str, model: str) -> tuple[bool, str]:
    try:
        client = _claude_client(key)
        await client.messages.create(
            model=model,
            max_tokens=16,
            messages=[{"role": "user", "content": "Reply with the single word: ok"}],
        )
        return True, "Connection successful"
    except anthropic.AuthenticationError:
        return False, "Invalid API key"
    except anthropic.NotFoundError:
        return False, f"Model '{model}' not available for this key"
    except anthropic.APIStatusError as e:  # pragma: no cover
        return False, f"API error ({e.status_code})"
    except Exception as e:  # pragma: no cover
        return False, f"Connection failed: {e}"


async def _test_gemini_key(key: str, model: str) -> tuple[bool, str]:
    try:
        client = _gemini_client(key)
        await client.aio.models.generate_content(
            model=model,
            contents="Reply with the single word: ok",
            config=_google_types.GenerateContentConfig(max_output_tokens=16),
        )
        return True, "Connection successful"
    except Exception as e:
        msg = str(e).lower()
        if "api key" in msg or "permission" in msg or "403" in msg or "401" in msg:
            return False, "Invalid API key"
        if "not found" in msg or "404" in msg:
            return False, f"Model '{model}' not found"
        return False, f"Connection failed: {e}"  # pragma: no cover


# ── Daily briefing ────────────────────────────────────────────────────────

def _summarize_dashboard(d: dict) -> str:
    lines: list[str] = []

    score = d.get("health_score")
    if score is not None:
        lines.append(f"Pool health score: {score}/10 ({d.get('health_label') or 'n/a'}).")

    age = d.get("chemistry_age_hours")
    if age is None:
        lines.append("Water has never been tested.")
    elif age < 24:
        lines.append(f"Last water test: {round(age)}h ago.")
    else:
        lines.append(f"Last water test: {round(age / 24)}d ago.")

    chem = [c for c in d.get("chemistry", []) if c.get("value") is not None]
    if chem:
        lines.append("Latest readings:")
        for c in chem:
            unit = f" {c['unit']}" if c.get("unit") else ""
            lines.append(f"  - {c['parameter']}: {c['value']}{unit} — {c.get('status')}")

    recs = d.get("recommendations", [])
    if recs:
        lines.append("Engine recommendations (authoritative — quote these for amounts):")
        for r in recs:
            lines.append(f"  - [{r.get('severity')}] {r.get('category')}: {r.get('message')}")

    w = d.get("weather")
    if w and w.get("air_temp_f") is not None:
        bits = [f"{round(w['air_temp_f'])}°F"]
        if w.get("condition"):
            bits.append(str(w["condition"]))
        if w.get("uv_index") is not None:
            bits.append(f"UV {round(w['uv_index'])}")
        if w.get("humidity") is not None:
            bits.append(f"{round(w['humidity'])}% humidity")
        lines.append("Weather: " + ", ".join(bits) + ".")
        for impact in (w.get("pool_impact") or [])[:4]:
            lines.append(f"  - {impact}")

    tasks = [
        r for r in d.get("reminders", [])
        if r.get("urgency") in ("urgent", "overdue", "due_soon")
    ]
    if tasks:
        lines.append("Care tasks coming up:")
        for r in tasks[:6]:
            lines.append(f"  - [{r['urgency']}] {r.get('display_name')}")

    return "\n".join(lines)


async def generate_briefing(pool_cfg, dashboard: dict) -> Optional[str]:
    key = resolve_key(pool_cfg)
    if not key:
        return None
    context = _summarize_dashboard(dashboard).strip() or "No pool data has been logged yet."
    user_msg = (
        "Here is the current state of my pool:\n\n"
        f"{context}\n\n"
        "Write today's briefing."
    )
    if provider_for(pool_cfg) == "gemini":
        return await _gemini_briefing(key, model_for(pool_cfg), user_msg)
    return await _claude_briefing(key, model_for(pool_cfg), user_msg)


async def _claude_briefing(key: str, model: str, user_msg: str) -> Optional[str]:
    try:
        client = _claude_client(key)
        async with client.messages.stream(
            model=model,
            max_tokens=500,
            system=BRIEFING_SYSTEM,
            thinking={"type": "adaptive"},
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": user_msg}],
        ) as stream:
            message = await stream.get_final_message()
        return _text(message) or None
    except Exception as e:  # pragma: no cover
        print(f"[AI] Claude briefing failed: {e}")
        return None


async def _gemini_briefing(key: str, model: str, user_msg: str) -> Optional[str]:
    try:
        client = _gemini_client(key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_msg,
            config=_google_types.GenerateContentConfig(
                system_instruction=BRIEFING_SYSTEM,
                max_output_tokens=500,
            ),
        )
        return (response.text or "").strip() or None
    except Exception as e:  # pragma: no cover
        print(f"[AI] Gemini briefing failed: {e}")
        return None


# ── Treatment-plan rationale ──────────────────────────────────────────────

def _summarize_plan(plan: dict) -> str:
    lines = [
        f"Condition: {plan.get('condition_label')}",
        f"Pool volume: {plan.get('pool_gallons')} gallons",
        "Steps (fixed — do not change):",
    ]
    for s in plan.get("steps", []):
        amt = ""
        if s.get("amount"):
            amt = f" — {s['amount']} {s.get('unit') or ''}".rstrip()
            if s.get("product_name"):
                amt += f" of {s['product_name']}"
        lines.append(f"  Step {s['order']}: {s['title']}{amt}")
        if s.get("description"):
            lines.append(f"    {s['description']}")
    return "\n".join(lines)


async def enrich_plan(pool_cfg, plan: dict) -> Optional[dict]:
    """Return {'intro': str, 'step_why': {order: why}} or None on failure."""
    key = resolve_key(pool_cfg)
    if not key:
        return None
    user_msg = f"Explain this treatment plan to me:\n\n{_summarize_plan(plan)}"
    if provider_for(pool_cfg) == "gemini":
        return await _gemini_enrich(key, model_for(pool_cfg), user_msg)
    return await _claude_enrich(key, model_for(pool_cfg), user_msg)


async def _claude_enrich(key: str, model: str, user_msg: str) -> Optional[dict]:
    try:
        client = _claude_client(key)
        message = await client.messages.create(
            model=model,
            max_tokens=2000,
            system=ENRICH_SYSTEM,
            thinking={"type": "adaptive"},
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": ENRICH_SCHEMA},
            },
            messages=[{"role": "user", "content": user_msg}],
        )
        data = json.loads(_text(message))
        step_why = {
            int(s["order"]): s["why"]
            for s in data.get("steps", [])
            if "order" in s and "why" in s
        }
        return {"intro": data.get("intro", ""), "step_why": step_why}
    except Exception as e:  # pragma: no cover
        print(f"[AI] Claude plan enrichment failed: {e}")
        return None


async def _gemini_enrich(key: str, model: str, user_msg: str) -> Optional[dict]:
    try:
        client = _gemini_client(key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_msg,
            config=_google_types.GenerateContentConfig(
                system_instruction=ENRICH_SYSTEM,
                max_output_tokens=2000,
                response_mime_type="application/json",
                response_schema=ENRICH_SCHEMA_GEMINI,
            ),
        )
        data = json.loads(response.text)
        step_why = {
            int(s["order"]): s["why"]
            for s in data.get("steps", [])
            if "order" in s and "why" in s
        }
        return {"intro": data.get("intro", ""), "step_why": step_why}
    except Exception as e:  # pragma: no cover
        print(f"[AI] Gemini plan enrichment failed: {e}")
        return None
