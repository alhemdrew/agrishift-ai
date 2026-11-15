"use client";

import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, CloudRain, Droplets, Flame, Layers, Leaf, MapPin, Search, Sparkles, Sun, Wind } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHero } from "@/components/app/page-hero";

const ExploreMap = dynamic(() => import("./explore-map"), {
  ssr: false,
  loading: () => <div className="h-[560px] w-full animate-pulse rounded-3xl bg-brand-100 dark:bg-brand-900" />,
});

const API_URL = "";

type Result = {
  location: { lat: number; lon: number };
  period: { start: string; end: string; days: number };
  source: string;
  summary: {
    avg_temp_c: number | null; max_temp_c: number | null; min_temp_c: number | null;
    total_rain_mm: number | null; rainy_days: number | null; avg_solar_kwh_m2_day: number | null;
    avg_solar_mj_m2_day: number | null;
    avg_wind_ms: number | null; avg_humidity_pct: number | null;
  };
  series: { date: string; prectotcorr: number | null }[];
  fires: { status: string; period: { start: string; end: string }; message: string; count: number; latestObservationTime: string | null; totalFrpMw: number | null };
};
type PlaceResult = { name: string; latitude: number; longitude: number };

const fmt = (v: number | null, unit: string) => (v === null ? "No data" : `${v.toFixed(1)}${unit}`);

function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
}

const layerRows = [
  { name: "Weather", note: "Temperature, wind, humidity", icon: Sun, live: true },
  { name: "Rainfall", note: "Daily totals at this place", icon: CloudRain, live: true },
  { name: "Vegetation", note: "Crop health (MODIS) · coming", icon: Leaf, live: false },
  { name: "Soil moisture", note: "Not connected yet (SMAP)", icon: Droplets, live: false },
  { name: "Fire detections", note: "Recent area summary · NASA FIRMS", icon: Flame, live: true },
];

export function ExploreClient() {
  const router = useRouter();
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; nonce: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);

  async function loadPlaceName(lat: number, lon: number) {
    try {
      const res = await fetch(`${API_URL}/api/geocode/reverse?lat=${lat}&lon=${lon}`);
      if (!res.ok) return;
      const data = await res.json();
      setPlaceName(data.name ?? null);
    } catch {
      setPlaceName(null);
    }
  }

  async function handleSelect(lat: number, lon: number, knownName?: string) {
    setSelected({ lat, lon });
    setLoading(true);
    setError("");
    setPlaceName(knownName ?? null);
    setPlaces([]);
    if (!knownName) loadPlaceName(lat, lon);
    try {
      const res = await fetch(`${API_URL}/api/explore/point?lat=${lat}&lon=${lon}&days=30`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Could not load data for this location.");
      setResult(data as Result);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not load data for this location.");
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    setSearchError("");
    const coords = parseCoordinates(text);
    if (coords) {
      setFocus({ ...coords, nonce: Date.now() });
      handleSelect(coords.lat, coords.lon);
      return;
    }
    setSearching(true);
    setPlaces([]);
    try {
      const res = await fetch(`${API_URL}/api/geocode/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "The place search didn't work. Try again.");
      if (data.results.length === 0) setSearchError("No places found. Try another name, or enter coordinates like 10.52, 7.44.");
      setPlaces(data.results as PlaceResult[]);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "The place search didn't work. Try again.");
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(place: PlaceResult) {
    setQuery(place.name);
    setFocus({ lat: place.latitude, lon: place.longitude, nonce: Date.now() });
    handleSelect(place.latitude, place.longitude, place.name);
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const maxRain = result ? Math.max(1, ...result.series.map((d) => d.prectotcorr ?? 0)) : 1;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-brand-200 bg-white/70 px-4 py-3 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-brand-950/80">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goBack} aria-label="Go back" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 text-brand-800 hover:bg-brand-100 dark:border-white/10 dark:text-brand-100 dark:hover:bg-brand-800">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          <Link href="/" className="hidden rounded-lg px-3 py-2 font-medium text-brand-700 hover:bg-brand-100 sm:inline-block dark:text-brand-200 dark:hover:bg-brand-800">Home</Link>
          <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-800">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <PageHero
          eyebrow="Earth Explorer · no account needed"
          title="A closer look at your land."
          subtitle="Search a place or click the map to see satellite-based weather, rainfall and sunshine from NASA POWER."
          image="/assets/landscape-banner.webp"
          imagePosition="object-right"
        />

        <form onSubmit={onSearch} role="search" className="space-y-3">
          <label htmlFor="place-search" className="sr-only">Search for a place or enter coordinates</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
              <input
                id="place-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a place, or enter coordinates (10.52, 7.44)"
                className="w-full rounded-2xl border border-brand-200 bg-white py-3.5 pl-11 pr-4 text-sm text-brand-900 shadow-sm outline-none placeholder:text-brand-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-brand-900/70 dark:text-white dark:placeholder:text-brand-300/60"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={searching || query.trim() === ""} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-50">
                {searching ? "Searching…" : "Search"}
              </button>
              <button type="button" disabled className="rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-medium text-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-brand-300/60" title="Coming soon">
                <Bookmark className="inline h-4 w-4" /> Save farm
              </button>
            </div>
          </div>
          {searchError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{searchError}</p>}
          {places.length > 0 && (
            <ul aria-label="Search results" className="divide-y divide-brand-200 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-lg dark:divide-white/10 dark:border-white/10 dark:bg-brand-900/90">
              {places.map((place) => (
                <li key={`${place.latitude},${place.longitude}`}>
                  <button type="button" onClick={() => pickPlace(place)} className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-brand-800 hover:bg-emerald-50 dark:text-brand-100 dark:hover:bg-white/5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span>{place.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="grid gap-6 xl:grid-cols-[260px_1fr_340px]">
          {/* Layers */}
          <aside className="space-y-3 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-brand-900/70 dark:shadow-none">
            <p className="flex items-center gap-2 font-semibold text-brand-900 dark:text-white"><Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> Layers</p>
            {layerRows.map(({ name, note, icon: Icon, live }) => (
              <div key={name} className={`flex items-center gap-3 rounded-2xl p-3 ${live ? "bg-emerald-50 dark:bg-emerald-400/10" : "opacity-60"}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${live ? "bg-emerald-500 text-white" : "bg-brand-100 text-brand-600 dark:bg-white/10 dark:text-brand-200"}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-brand-700 dark:text-brand-200/80">{note}</p>
                </div>
              </div>
            ))}
            <p className="pt-2 text-xs text-brand-600 dark:text-brand-300/70">Satellite imagery from NASA GIBS is shown on the map.</p>
          </aside>

          {/* Map */}
          <section className="relative overflow-hidden rounded-3xl border border-brand-200 shadow-xl dark:border-white/10">
            <ExploreMap selected={selected} focus={focus} onSelect={(lat, lon) => { setQuery(""); handleSelect(lat, lon); }} />
            {!selected && (
              <p className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-white/90 px-3 py-2 text-xs text-brand-800 shadow dark:bg-brand-950/90 dark:text-brand-100">Search, or click the map to choose a place.</p>
            )}
          </section>

          {/* Place panel */}
          <aside className="space-y-5 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-brand-900/70 dark:shadow-none">
            {loading && <p className="text-brand-700 dark:text-brand-200">Loading data for this place…</p>}
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
            {!selected && !loading && <p className="text-sm text-brand-700 dark:text-brand-200/80">Choose a place to see its recent conditions here.</p>}
            {result && !loading && (
              <>
                <div>
                  <h2 className="text-2xl font-semibold text-brand-900 dark:text-white">{placeName ?? "Selected place"}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-200/80"><MapPin className="h-3.5 w-3.5" /> {result.location.lat}, {result.location.lon}</p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Recent rainfall</p>
                    <p className="text-xs text-brand-600 dark:text-brand-300/70">{result.period.days} days</p>
                  </div>
                  <p className="mt-1 text-3xl font-semibold text-brand-900 dark:text-white">{result.summary.total_rain_mm === null ? "No data" : (Math.round(result.summary.total_rain_mm * 10) / 10).toFixed(1)} {result.summary.total_rain_mm !== null && <span className="text-base font-normal">mm</span>}</p>
                  <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Daily rainfall for the last 30 days">
                    {result.series.map((d) => {
                      const v = d.prectotcorr;
                      return (
                        <div key={d.date} className="flex h-full flex-1 items-end" title={`${d.date}: ${v === null ? "no data" : `${v} mm`}`}>
                          <div className="w-full rounded-t bg-gradient-to-t from-sky-600 to-cyan-300" style={{ height: v === null ? "0%" : `${Math.max(3, (v / maxRain) * 100)}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-brand-600 dark:text-brand-300/70"><span>{result.series[0]?.date}</span><span>{result.series[result.series.length - 1]?.date}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Temperature", value: fmt(result.summary.avg_temp_c, "°C"), icon: Sun },
                    { label: "Solar radiation", value: fmt(result.summary.avg_solar_mj_m2_day, " MJ/m²/day"), icon: Sun },
                    { label: "Wind (2 m)", value: fmt(result.summary.avg_wind_ms, " m/s"), icon: Wind },
                    { label: "Humidity", value: fmt(result.summary.avg_humidity_pct, "%"), icon: Droplets },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-brand-200 p-3 dark:border-white/10">
                      <p className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-200/80"><Icon className="h-3.5 w-3.5" /> {label}</p>
                      <p className="mt-1 text-sm font-semibold text-brand-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-brand-200 p-3 dark:border-white/10">
                  <p className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-200/80"><Flame className="h-3.5 w-3.5" /> NASA FIRMS thermal anomalies</p>
                  <p className="mt-1 text-sm font-semibold text-brand-900 dark:text-white">
                    {result.fires.status === "success"
                      ? `${result.fires.count} detection${result.fires.count === 1 ? "" : "s"}`
                      : result.fires.status === "empty" ? "No detections" : "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-300/70">
                    {result.fires.period.start} to {result.fires.period.end} · {result.fires.latestObservationTime ?? result.fires.message}
                  </p>
                  <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-300/70">A satellite hotspot is not confirmation of an agricultural fire.</p>
                  {result.fires.count > 0 && result.fires.totalFrpMw !== null && (
                    <p className="mt-1 text-xs text-brand-600 dark:text-brand-300/80">
                      {result.fires.totalFrpMw.toFixed(2)} MW total radiative power
                    </p>
                  )}
                </div>
                <Link href={`/app/intelligence?lat=${result.location.lat}&lon=${result.location.lon}`} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-300 px-4 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5">
                  Analyse this place <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={`/app/assistant?lat=${result.location.lat}&lon=${result.location.lon}`} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110">
                  <Sparkles className="h-4 w-4" /> Ask AI about this place
                </Link>
                <div className="rounded-2xl bg-brand-50 p-4 text-xs text-brand-700 dark:bg-white/5 dark:text-brand-200/80">
                  {result.source}. Describes past conditions, not a forecast, and is not from a local weather station.
                </div>
              </>
            )}
          </aside>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-emerald-300/50 bg-gradient-to-r from-emerald-50 to-white p-6 sm:flex-row sm:items-center dark:border-emerald-400/20 dark:from-emerald-400/10 dark:to-transparent">
          <div>
            <p className="font-semibold text-brand-900 dark:text-white">Farming on this land?</p>
            <p className="text-sm text-brand-700 dark:text-brand-200/80">Create a free account to save your fields, get alerts, and ask the assistant about them.</p>
          </div>
          <Link href="/signup" className="rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-emerald-400 dark:text-brand-950 dark:hover:bg-emerald-300">Create free account</Link>
        </div>
        <p className="text-center text-xs text-brand-600 dark:text-brand-300/70">Built for the NASA Space Apps Challenge 2026 using NASA Earth observation data. Not endorsed by NASA.</p>
      </main>
    </div>
  );
}
