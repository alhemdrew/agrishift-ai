"""AI Assistant. Answers only from the NASA-based evidence for one location.

The backend builds the evidence (indicators, summary, monthly rainfall), sends it to Gemini
with strict instructions, and returns the answer together with the chart, which is built
from the data rather than written by the model.

Configuration (in the backend .env file): GEMINI_API_KEY (required), GEMINI_MODEL (optional).
"""
import json
import logging
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import ENV_FILE, settings
from app.routers.intelligence import location_intelligence

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
log = logging.getLogger("agrishift.assistant")

DEFAULT_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = """You are the AgriShift AI Assistant. AgriShift helps farmers and extension officers understand environmental conditions using NASA Earth observation data.

Rules you must follow:
1. Answer only from the EVIDENCE provided in the user's message. Quote numbers exactly as given. Never invent measurements, dates or statistics.
2. If the evidence does not answer the question, say so plainly and explain what data would be needed.
3. Describe past conditions only. Never make forecasts or promise outcomes.
4. Explain why an indicator matters for agriculture, and state its limitations, using the limitations given in the evidence.
5. Do not give specific crop, planting or chemical recommendations. Suggest that a local agronomist or extension officer be consulted for decisions.
6. Keep answers clear and short, suitable for a farmer reading on a phone.
7. If the question is unrelated to environmental conditions or agriculture, politely say you can only help with this location's environmental data.

Respond with JSON only, in exactly this shape:
{"answer": "...", "key_insights": ["...", "..."], "uncertainty": "...", "suggested_questions": ["...", "..."]}
Use at most 4 key insights and 3 suggested questions."""


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    text: str = Field(max_length=2000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    history: list[Turn] = Field(default_factory=list, max_length=12)


def monthly_rainfall(series: list[dict]) -> tuple[list[str], list[float]]:
    totals: dict[str, float] = {}
    for day in series:
        if day["prectotcorr"] is None:
            continue
        key = day["date"][:7]
        totals[key] = totals.get(key, 0.0) + day["prectotcorr"]
    keys = sorted(totals)
    labels = [date.fromisoformat(f"{k}-01").strftime("%b %Y") for k in keys]
    return labels, [round(totals[k], 1) for k in keys]


def build_evidence(data: dict, labels: list[str], values: list[float]) -> str:
    lines = [
        f"Location: {data['location']['lat']}, {data['location']['lon']}",
        f"Period: {data['period']['start']} to {data['period']['end']} ({data['period']['days']} days)",
        f"Source: {data['source']}",
        "Summary:",
        f"- Average temperature: {data['summary']['avg_temp_c']} °C",
        f"- Total rainfall: {data['summary']['total_rain_mm']} mm",
        f"- Rainy days (1 mm or more): {data['summary']['rainy_days']}",
        f"- Average sunshine: {data['summary']['avg_solar_kwh_m2_day']} kWh/m²/day",
        "Indicators:",
    ]
    for ind in data["indicators"]:
        lines.append(f"- {ind['name']} (status: {ind['status']}): {ind['observed']} Limitation: {ind['limitation']}")
    if labels:
        lines.append("Monthly rainfall:")
        lines += [f"- {label}: {value} mm" for label, value in zip(labels, values)]
    lines.append("Method notes:")
    lines += [f"- {note}" for note in data["method_notes"]]
    return "\n".join(lines)


def usable_models() -> list[str]:
    """Names of Gemini models this key can use for text generation. Never includes the key."""
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="No GEMINI_API_KEY is set in the backend .env file.")
    try:
        response = httpx.get(f"{settings.gemini_base_url}/v1beta/models", headers={"x-goog-api-key": api_key}, timeout=15)
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach Google to list models.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail=f"Google returned {response.status_code} when listing models.")
    return [
        m["name"].removeprefix("models/")
        for m in response.json().get("models", [])
        if "generateContent" in m.get("supportedGenerationMethods", [])
    ]


def pick_flash(models: list[str]) -> str | None:
    """Prefers a stable Flash model, then any Flash model, then the first usable model."""
    flash = [m for m in models if "flash" in m and "preview" not in m and "tts" not in m and "image" not in m]
    if flash:
        return sorted(flash, key=lambda m: ("lite" not in m, m), reverse=True)[0]
    return models[0] if models else None


def call_gemini(contents: list[dict], allow_fallback: bool = True) -> dict:
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="The AI assistant isn't set up yet. Add GEMINI_API_KEY to the backend .env file, then restart the server. Check /api/assistant/status.")
    model = settings.gemini_model or DEFAULT_MODEL
    base = settings.gemini_base_url
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
    }
    try:
        response = httpx.post(
            f"{base}/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": api_key, "content-type": "application/json"},
            json=body,
            timeout=30,
        )
    except httpx.HTTPError as exc:
        log.error("Could not reach Gemini: %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=503,
            detail=f"The backend can't reach Google from this computer ({type(exc).__name__}). Check your internet connection, VPN or firewall, then open /api/assistant/status.",
        )
    if response.status_code == 404 and allow_fallback:
        fallback = pick_flash(usable_models())
        if fallback and fallback != model:
            log.warning("Model %s not available; retrying with %s", model, fallback)
            settings.gemini_model = fallback
            return call_gemini(contents, allow_fallback=False)
    if response.status_code == 404:
        log.error("Gemini model %s not available: %s", model, response.text[:300])
        raise HTTPException(
            status_code=503,
            detail=f"The model '{model}' isn't available for this key. Open /api/assistant/models to see which models you can use, then set GEMINI_MODEL in the backend .env and restart.",
        )
    if response.status_code != 200:
        log.error("Gemini returned %s: %s", response.status_code, response.text[:300])
        raise HTTPException(status_code=503, detail="The AI assistant couldn't respond right now. Please try again.")
    try:
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, ValueError):
        raise HTTPException(status_code=502, detail="The AI assistant returned an unexpected answer. Please try again.")


def _google_check() -> dict:
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return {"reachable": False, "reason": "no key set"}
    try:
        response = httpx.get(f"{settings.gemini_base_url}/v1beta/models", headers={"x-goog-api-key": api_key}, timeout=8)
        return {"reachable": True, "http_status": response.status_code}
    except httpx.HTTPError as exc:
        return {"reachable": False, "reason": type(exc).__name__, "detail": str(exc)[:200]}


@router.get("/status")
def assistant_status():
    """Shows whether the key is loaded and whether Google can be reached. It never shows the key itself."""
    return {
        "configured": bool(settings.gemini_api_key.strip()),
        "model": settings.gemini_model,
        "env_file": str(ENV_FILE),
        "env_file_found": ENV_FILE.exists(),
        "google": _google_check(),
    }


@router.get("/models")
def list_models():
    """Lists the Gemini models this key can use. Shows names only, never the key."""
    return {"current_model": settings.gemini_model, "usable_models": usable_models(), "auto_pick": pick_flash(usable_models())}


@router.post("/chat")
def chat(body: ChatIn):
    data = location_intelligence(lat=body.lat, lon=body.lon, days=90)
    labels, values = monthly_rainfall(data["series"])

    contents = [
        {"role": "user" if turn.role == "user" else "model", "parts": [{"text": turn.text}]}
        for turn in body.history[-8:]
    ]
    evidence = build_evidence(data, labels, values)
    contents.append({"role": "user", "parts": [{"text": f"EVIDENCE:\n{evidence}\n\nQUESTION: {body.message}"}]})

    result = call_gemini(contents)
    return {
        "answer": str(result.get("answer", "")),
        "key_insights": [str(x) for x in result.get("key_insights", [])][:4],
        "uncertainty": str(result.get("uncertainty", "")),
        "suggested_questions": [str(x) for x in result.get("suggested_questions", [])][:3],
        "chart": {"title": "Monthly rainfall", "unit": "mm", "labels": labels, "values": values} if values else None,
        "source": f"NASA POWER · {data['period']['start']} to {data['period']['end']}",
        "location": data["location"],
    }
