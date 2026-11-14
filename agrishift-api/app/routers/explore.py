"""Public Explorer endpoints. No sign-in required.

Serves recent NASA POWER daily weather for any point on Earth. Responses are cached in memory
so repeated clicks don't call NASA again, which keeps us clear of NASA's rate limits.
"""
import os
import time
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/explore", tags=["explore"])

NASA_POWER_URL = os.environ.get("NASA_POWER_URL", "https://power.larc.nasa.gov/api/temporal/daily/point")
# T2M: air temp at 2 m (°C) · T2M_MAX / T2M_MIN (°C) · PRECTOTCORR: precipitation (mm/day)
# ALLSKY_SFC_SW_DWN: solar radiation (kWh/m²/day) · WS2M: wind at 2 m (m/s) · RH2M: relative humidity (%)
PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "WS2M", "RH2M"]
FILL_VALUE = -999  # NASA's marker for missing data
CACHE_SECONDS = 6 * 60 * 60
_cache: dict[tuple, tuple[float, dict]] = {}


def _avg(values: list) -> float | None:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def _summarise(series: list[dict]) -> dict:
    temp = [d["t2m"] for d in series]
    rain = [d["prectotcorr"] for d in series]
    rain_known = [r for r in rain if r is not None]
    tmax = [d["t2m_max"] for d in series if d["t2m_max"] is not None]
    tmin = [d["t2m_min"] for d in series if d["t2m_min"] is not None]
    return {
        "avg_temp_c": _avg(temp),
        "max_temp_c": round(max(tmax), 1) if tmax else None,
        "min_temp_c": round(min(tmin), 1) if tmin else None,
        "total_rain_mm": round(sum(rain_known), 1),
        "rainy_days": sum(1 for r in rain_known if r >= 1.0),
        "avg_solar_kwh_m2_day": _avg([d["allsky_sfc_sw_dwn"] for d in series]),
        "avg_wind_ms": _avg([d["ws2m"] for d in series]),
        "avg_humidity_pct": _avg([d["rh2m"] for d in series]),
    }


@router.get("/point")
def explore_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    days: int = Query(30, ge=7, le=90),
):
    key = (round(lat, 2), round(lon, 2), days)
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_SECONDS:
        return cached[1]

    # NASA POWER data lags by a day or two, so end two days ago
    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=days - 1)
    query = {
        "parameters": ",".join(PARAMS),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "LST",
    }
    try:
        response = httpx.get(NASA_POWER_URL, params=query, timeout=20)
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="NASA POWER isn't responding right now. Please try again shortly.")
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="NASA POWER is busy. Please try again in a minute.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="NASA POWER returned an error for this location.")

    try:
        parameter = response.json()["properties"]["parameter"]
        dates = sorted(parameter["PRECTOTCORR"].keys())
    except (KeyError, ValueError):
        raise HTTPException(status_code=502, detail="NASA POWER returned data in an unexpected format.")

    def value(param: str, day: str):
        v = parameter.get(param, {}).get(day, FILL_VALUE)
        return None if v == FILL_VALUE else v

    series = []
    for d in dates:
        series.append({
            "date": f"{d[:4]}-{d[4:6]}-{d[6:]}",
            "t2m": value("T2M", d),
            "t2m_max": value("T2M_MAX", d),
            "t2m_min": value("T2M_MIN", d),
            "prectotcorr": value("PRECTOTCORR", d),
            "allsky_sfc_sw_dwn": value("ALLSKY_SFC_SW_DWN", d),
            "ws2m": value("WS2M", d),
            "rh2m": value("RH2M", d),
        })

    result = {
        "location": {"lat": lat, "lon": lon},
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "source": "NASA POWER daily data (satellite and model based, roughly 50 km grid cells, not a weather station)",
        "summary": _summarise(series),
        "series": series,
    }
    _cache[key] = (now, result)
    return result
