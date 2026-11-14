"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ChevronRight, CloudRain, Droplets, Globe2, Info, Leaf, Sparkles, Thermometer } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status = "low" | "moderate" | "high" | "info" | "no_data" | "unavailable";
type Indicator = { key: string; name: string; status: Status; observed: string; why: string; limitation: string };
type Point = { date: string; t2m: number | null; t2m_max: number | null; prectotcorr: number | null };
type Result = {
  location: { lat: number; lon: number };
  period: { start: string; end: string; days: number };
  source: string;
  summary: { avg_temp_c: number | null; total_rain_mm: number; rainy_days: number };
  series: Point[];
  overall: Status;
  indicators: Indicator[];
  method_notes: string[];
};

const tone: Record<Status, { ring: string; text: string; label: string }> = {
  low: { ring: "border-emerald-400", text: "text-emerald-600 dark:text-emerald-300", label: "Stable" },
  moderate: { ring: "border-amber-400", text: "text-amber-600 dark:text-amber-300", label: "Watch" },
  high: { ring: "border-red-400", text: "text-red-600 dark:text-red-300", label: "Attention" },
  info: { ring: "border-sky-400", text: "text-sky-600 dark:text-sky-300", label: "Context" },
  no_data: { ring: "border-brand-300", text: "text-brand-600 dark:text-brand-300", label: "No data" },
  unavailable: { ring: "border-brand-300", text: "text-brand-600 dark:text-brand-300", label: "Unavailable" },
};

const iconFor: Record<string, React.ComponentType<{ className?: string }>> = {
  heat_stress: Thermometer,
  dry_spell: Droplets,
  heavy_rain: CloudRain,
  rainfall_total: CloudRain,
  soil_moisture: Droplets,
};

function parseCoord(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Seven-day rolling average, so the trend shows through daily noise
function rolling(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

function RainLine({ values }: { values: (number | null)[] }) {
  const avg = useMemo(() => rolling(values), [values]);
  const known = values.filter((v): v is number => v !== null);
  const max = Math.max(1, ...known, ...avg.filter((v): v is number => v !== null));
  const w = 900, h = 260, pad = 12;
  const x = (i: number) => pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const toPath = (arr: (number | null)[]) => {
    let d = "";
    arr.forEach((v, i) => { if (v !== null) d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; });
    return d.trim();
  };
  const dailyBars = values.map((v, i) => ({ i, v })).filter((p) => p.v !== null) as { i: number; v: number }[];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-64 w-full" role="img" aria-label="Daily rainfall with a seven-day average over the period">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} className="stroke-brand-200 dark:stroke-white/10" strokeDasharray="4 6" />
      ))}
      {dailyBars.map((p) => (
        <rect key={p.i} x={x(p.i) - 3} width="6" y={y(p.v)} height={Math.max(1, h - pad - y(p.v))} rx="2" className="fill-sky-300/50 dark:fill-sky-400/30" />
      ))}
      <path d={toPath(avg)} fill="none" stroke="#34d399" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function IntelligenceClient({ lat, lon }: { lat: string; lon: string }) {
  const latNum = parseCoord(lat, -90, 90);
  const lonNum = parseCoord(lon, -180, 180);
  const hasLocation = latNum !== null && lonNum !== null;

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasLocation) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setResult(null);
    fetch(`${API_URL}/api/intelligence/location?lat=${latNum}&lon=${lonNum}&days=90`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Could not load the analysis for this location.");
        return data as Result;
      })
      .then((data) => { if (!cancelled) setResult(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the analysis."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hasLocation, latNum, lonNum]);

  if (!hasLocation) {
    return (
      <div className="space-y-8">
        <PageHero eyebrow="Active intelligence" title="See change. Plan your next move." subtitle="Choose a place first. Intelligence explains what the NASA observations show for it." image="/assets/landscape-banner.webp" imagePosition="object-right" />
        <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <Globe2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xl font-semibold text-brand-900 dark:text-white">Choose a location to analyse</h2>
          <p className="text-brand-700 dark:text-brand-200/80">Search for a place in the Earth Explorer, then select Analyse this location.</p>
          <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white hover:brightness-110">
            Open Earth Explorer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const rainfallIndicator = result?.indicators.find((i) => i.key === "rainfall_total");
  const rainfallValues = result?.series.map((d) => d.prectotcorr) ?? [];
  const firstDate = result?.series[0]?.date;
  const lastDate = result?.series[result.series.length - 1]?.date;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Active intelligence"
        title="See change. Plan your next move."
        subtitle={`Last ${result?.period.days ?? 90} days of NASA observations for ${latNum?.toFixed(3)}, ${lonNum?.toFixed(3)}.`}
        image="/assets/landscape-banner.webp"
        imagePosition="object-right"
      >
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/10">
          <Globe2 className="h-4 w-4" /> Change location
        </Link>
      </PageHero>

      {loading && <p className="text-brand-700 dark:text-brand-200">Analysing the last 90 days of NASA observations…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {result && (
        <>
          {/* Summary tiles */}
          <section className="grid gap-4 md:grid-cols-3">
            {result.indicators.filter((i) => ["heat_stress", "dry_spell", "heavy_rain"].includes(i.key)).map((ind) => {
              const Icon = iconFor[ind.key] ?? Info;
              const t = tone[ind.status];
              return (
                <article key={ind.key} className={`rounded-2xl border-l-4 bg-white p-5 shadow-lg dark:bg-brand-900/60 ${t.ring}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-white/5"><Icon className={`h-5 w-5 ${t.text}`} /></span>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${t.text}`}>{t.label}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-brand-900 dark:text-white">{ind.name}</h3>
                  <p className="mt-1 text-sm text-brand-700 dark:text-brand-200/80">{ind.observed}</p>
                </article>
              );
            })}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Chart */}
            <section className="rounded-3xl border border-brand-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"><CloudRain className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-semibold text-brand-900 dark:text-white">Daily rainfall</h2>
                    <p className="text-sm text-brand-700 dark:text-brand-200/80">{firstDate} to {lastDate} · bars are days, line is the 7-day average</p>
                  </div>
                </div>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-white/10 dark:text-brand-100">{result.summary.total_rain_mm} mm total</span>
              </div>
              <div className="mt-6"><RainLine values={rainfallValues} /></div>
              <div className="mt-2 flex justify-between text-xs text-brand-600 dark:text-brand-300"><span>{firstDate}</span><span>{lastDate}</span></div>
            </section>

            {/* What changed */}
            <section className="space-y-4 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-brand-900 dark:text-white"><BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> What the data shows</h2>
                <p className="text-sm text-brand-700 dark:text-brand-200/80">{result.overall === "low" ? "No elevated indicators in this period." : "Some conditions need a closer look."}</p>
              </div>
              {result.indicators.filter((i) => i.key !== "soil_moisture").map((ind) => (
                <div key={ind.key} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-semibold text-brand-900 dark:text-white">{ind.name}</p>
                  <p className="mt-1 text-sm text-brand-800 dark:text-brand-100">{ind.observed}</p>
                  <p className="mt-2 text-xs text-brand-600 dark:text-brand-300/80">Limitation: {ind.limitation}</p>
                </div>
              ))}
              {rainfallIndicator && <p className="text-xs text-brand-600 dark:text-brand-300/70">Soil moisture: in development. It needs NASA SMAP data.</p>}
            </section>
          </div>

          {/* Crop scenarios: designed, coming soon until agronomic rules are validated */}
          <section className="space-y-5 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl sm:p-8 dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-brand-900 dark:text-white"><Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> Explore crop scenarios</h2>
              <p className="text-sm text-brand-700 dark:text-brand-200/80">Compare what common crops need against the rainfall seen here. Coming soon: this needs validated agronomic rules.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr_280px]">
              {[
                { name: "Maize", image: "/assets/maize.webp" },
                { name: "Sorghum", image: "/assets/sorghum.webp" },
              ].map((crop) => (
                <div key={crop.name} aria-disabled="true" className="group relative h-64 overflow-hidden rounded-2xl opacity-90">
                  <img src={crop.image} alt={`${crop.name} in a field`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-5">
                    <div>
                      <p className="text-2xl font-semibold text-white">{crop.name}</p>
                      <p className="text-sm text-brand-100/90">Scenario comparison · coming soon</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"><ChevronRight className="h-5 w-5" /></span>
                  </div>
                </div>
              ))}
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <p className="text-xs uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Rainfall, this period</p>
                  <p className="mt-1 text-2xl font-semibold text-brand-900 dark:text-white">{result.summary.total_rain_mm} mm</p>
                  <p className="text-sm text-brand-700 dark:text-brand-200/80">{result.summary.rainy_days} rainy days</p>
                </div>
                <button type="button" disabled className="rounded-xl bg-brand-200 px-4 py-3 text-sm font-semibold text-brand-600 dark:bg-white/10 dark:text-brand-300/70">Compare requirements · coming soon</button>
                <p className="text-xs text-brand-600 dark:text-brand-300/70">Suitability needs local soil and crop information.</p>
              </div>
            </div>
          </section>

          {/* Sources */}
          <details className="group rounded-3xl border border-brand-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-brand-900 dark:text-white">
              Sources and assumptions
              <ChevronRight className="h-5 w-5 transition group-open:rotate-90" />
            </summary>
            <div className="mt-4 space-y-3 text-sm text-brand-700 dark:text-brand-200/80">
              <p>{result.source}</p>
              <ul className="list-inside list-disc space-y-1">{result.method_notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <Link href={`/app/assistant?lat=${latNum}&lon=${lonNum}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white hover:brightness-110">
              <Sparkles className="h-4 w-4" /> Ask AI about this place
            </Link>
            <Link href={`/app/reports/create?type=risk&lat=${latNum}&lon=${lonNum}`} className="inline-flex items-center gap-2 rounded-xl border border-brand-300 px-5 py-3 text-sm font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
              Create a report <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
