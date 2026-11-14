"""Location intelligence. Public, like the Explorer.

Turns recent NASA POWER observations into explainable indicators. Every indicator shows
the evidence behind it, why it matters, and its limitation. Thresholds are rule-of-thumb
starting points and need agronomic validation before they are used for real decisions.
"""
from fastapi import APIRouter, Query

from app.routers.explore import explore_point

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])

HEAT_DAY_C = 35.0      # daily maximum temperature (°C) counted as a heat-stress day
DRY_DAY_MM = 1.0       # a day with less rain than this counts as dry
HEAVY_RAIN_MM = 20.0   # a day with at least this much rain counts as heavy

LEVEL_ORDER = {"no_data": -1, "low": 0, "moderate": 1, "high": 2}

METHOD_NOTES = [
    "Observations come from NASA POWER daily data, on grid cells of roughly 50 km. They are not from a local weather station.",
    "The period covers the most recent 90 days with data. Results describe past conditions, not forecasts.",
    "Thresholds (35 °C, 1 mm, 20 mm) are general starting points. Crop-specific thresholds need validation by agronomists.",
    "Soil moisture and vegetation indicators will be added when NASA SMAP and MODIS are integrated.",
]


def _level(count: int, moderate_at: int, high_at: int) -> str:
    if count >= high_at:
        return "high"
    if count >= moderate_at:
        return "moderate"
    return "low"


def longest_dry_spell(rain: list) -> int:
    """Longest run of consecutive days below DRY_DAY_MM. A missing day ends a run, which is the conservative choice."""
    best = current = 0
    for value in rain:
        if value is not None and value < DRY_DAY_MM:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def build_indicators(series: list[dict]) -> list[dict]:
    tmax = [d["t2m_max"] for d in series if d["t2m_max"] is not None]
    rain = [d["prectotcorr"] for d in series]
    known_rain = [r for r in rain if r is not None]

    indicators = []

    if tmax:
        hot_days = sum(1 for t in tmax if t >= HEAT_DAY_C)
        peak = round(max(tmax), 1)
        indicators.append({
            "key": "heat_stress",
            "name": "Heat stress",
            "status": _level(hot_days, moderate_at=1, high_at=5),
            "observed": f"{hot_days} of {len(tmax)} days reached {HEAT_DAY_C:.0f} °C or more. Highest daily maximum: {peak} °C.",
            "why": "Sustained high temperatures can stress crops during flowering and grain filling, and raise water demand.",
            "limitation": "35 °C is a general starting point. Crop-specific thresholds need validation. The data is for a grid cell of about 50 km.",
        })
    else:
        indicators.append({"key": "heat_stress", "name": "Heat stress", "status": "no_data",
                           "observed": "No temperature observations available for this period.",
                           "why": "Sustained high temperatures can stress crops.",
                           "limitation": "Without temperature data, this indicator cannot be assessed."})

    if known_rain:
        dry = longest_dry_spell(rain)
        indicators.append({
            "key": "dry_spell",
            "name": "Dry spell",
            "status": _level(dry, moderate_at=7, high_at=14),
            "observed": f"Longest run of dry days (under {DRY_DAY_MM:g} mm of rain): {dry} days.",
            "why": "Long dry spells reduce soil moisture, especially where crops depend on rain.",
            "limitation": "A dry day is counted by daily rain only. It ignores how much water the soil holds and when rain falls.",
        })

        heavy = sum(1 for r in known_rain if r >= HEAVY_RAIN_MM)
        indicators.append({
            "key": "heavy_rain",
            "name": "Heavy rain",
            "status": _level(heavy, moderate_at=1, high_at=3),
            "observed": f"{heavy} days with {HEAVY_RAIN_MM:g} mm or more of rain.",
            "why": "Intense rain can cause waterlogging, runoff and soil loss.",
            "limitation": "Uses daily totals only, so it cannot show how intense rain was within the day. Drainage is not included.",
        })

        indicators.append({
            "key": "rainfall_total",
            "name": "Total rainfall",
            "status": "info",
            "observed": f"{round(sum(known_rain), 1)} mm of rain over {len(series)} days.",
            "why": "Totals give the other indicators context.",
            "limitation": "No long-term average is used yet, so this is not compared with normal rainfall for the area.",
        })
    else:
        indicators.append({"key": "dry_spell", "name": "Dry spell", "status": "no_data",
                           "observed": "No rainfall observations available for this period.",
                           "why": "Long dry spells reduce soil moisture.",
                           "limitation": "Without rainfall data, this indicator cannot be assessed."})

    indicators.append({
        "key": "soil_moisture",
        "name": "Soil moisture",
        "status": "unavailable",
        "observed": "Not yet available in AgriShift.",
        "why": "Soil moisture shows how much water is available to crops.",
        "limitation": "Requires NASA SMAP data, which is in development.",
    })

    return indicators


def overall_status(indicators: list[dict]) -> str:
    levels = [i["status"] for i in indicators if i["status"] in LEVEL_ORDER and i["status"] != "no_data"]
    if not levels:
        return "no_data"
    return max(levels, key=lambda s: LEVEL_ORDER[s])


@router.get("/location")
def location_intelligence(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    days: int = Query(90, ge=30, le=90),
):
    data = explore_point(lat=lat, lon=lon, days=days)
    indicators = build_indicators(data["series"])
    return {
        "location": data["location"],
        "period": data["period"],
        "source": data["source"],
        "summary": data["summary"],
        "series": data["series"],
        "overall": overall_status(indicators),
        "indicators": indicators,
        "method_notes": METHOD_NOTES,
    }
