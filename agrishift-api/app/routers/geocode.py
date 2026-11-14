"""Place search and place names, through OpenStreetMap's Nominatim geocoder (no API key).

Nominatim's usage policy asks for an identifying User-Agent, at most one request per second,
and caching. This module does all three. Set GEOCODE_USER_AGENT in .env to a contact address
for your team before a public demo.
"""
import threading
import time

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter(prefix="/api/geocode", tags=["geocode"])

NOMINATIM_URL = settings.nominatim_url
USER_AGENT = settings.geocode_user_agent
CACHE_SECONDS = 24 * 60 * 60
MIN_GAP_SECONDS = 1.0

_cache: dict[tuple, tuple[float, object]] = {}
_lock = threading.Lock()
_last_call = 0.0


def _nominatim(path: str, params: dict):
    global _last_call
    key = (path, tuple(sorted(params.items())))
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_SECONDS:
        return cached[1]

    with _lock:  # one request at a time, at most one per second
        wait = MIN_GAP_SECONDS - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.time()

    try:
        response = httpx.get(
            f"{NOMINATIM_URL}{path}",
            params={**params, "format": "jsonv2"},
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="The place search isn't responding right now. Try again shortly, or enter coordinates.")
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="The place search is busy. Try again in a moment.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="The place search returned an error.")

    data = response.json()
    _cache[key] = (now, data)
    return data


@router.get("/search")
def search_places(q: str = Query(min_length=2, max_length=120), limit: int = Query(5, ge=1, le=8)):
    items = _nominatim("/search", {"q": q.strip(), "limit": limit, "addressdetails": 0})
    results = []
    for item in items:
        try:
            results.append({"name": item["display_name"], "lat": float(item["lat"]), "lon": float(item["lon"])})
        except (KeyError, ValueError):
            continue
    return {"results": results}


@router.get("/reverse")
def place_name(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180)):
    item = _nominatim("/reverse", {"lat": lat, "lon": lon, "zoom": 10})
    return {"name": item.get("display_name") if isinstance(item, dict) else None}
