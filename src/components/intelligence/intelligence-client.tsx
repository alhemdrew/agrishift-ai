"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ChevronRight, CloudRain, Droplets, Globe2, Info, Leaf, Sparkles, Thermometer } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

const API_URL = "";

type Status = "low" | "moderate" | "high" | "info" | "no_data" | "unavailable";
type Indicator = { key: string; name: string; status: Status; observed: string; why: string; limitation: string };
type Point = { date: string; t2m: number | null; t2m_max: number | null; prectotcorr: number | null };
type Result = {
  location: { lat: number; lon: number };
  period: { start: string; end: string; days: number };
  source: string;
  summary: { avg_temp_c: number | null; total_rain_mm: number | null; rainy_days: number | null };
  series: Point[];
  overall: Status;
  indicators: Indicator[];
  method_notes: string[];
  source_health: Array<{
    providerName: string;
    status: "healthy" | "degraded" | "pending" | "unavailable" | "not_configured";
    lastSuccessfulRetrieval: string | null;
    latestObservationTime: string | null;
    observationPeriod: { start: string; end: string } | null;
    taskId: string | null;
    observationCount: number;
    latestObservations: Array<{ variable: string; value: number | string; unit: string; observationTime: string }>;
    attribution: string;
    retrievalDurationMs: number | null;
    errorCategory: string | null;
    message: string;
    dataOrigin: "genuine_provider" | "none";
  }>;
  agriculture: AgricultureResult;
};
type CropAssessment = {
  crop: string;
  status: "potentially_suitable" | "uncertain" | "not_in_window";
  supportingEvidence: string[];
  limitingFactors: string[];
  plantingWindow: string;
  confidence: "low" | "moderate";
};
type AgricultureResult = {
  season: "main_rainfed" | "dry_season" | "transition";
  environmentalEvidence: {
    soil: { status: string; observationCount: number };
  };
  crops: CropAssessment[];
  risks: Array<{ id: string; level: "watch" | "unknown"; evidence: string; limitation: string }>;
  nextSteps: string[];
  missingInformation: string[];
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

const providerStatusLabel: Record<Result["source_health"][number]["status"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  pending: "Pending",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

function parseCoord(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

type ObservationResponse = {
  status?: string;
  taskId?: string;
  observations?: Array<{ variable: string; value: number | string | null; unit: string; observationTime: string }>;
  retrievedAt?: string;
  attribution?: string;
  message?: string;
};

async function pollPendingProviders(
  initial: Result,
  signal: AbortSignal,
  isCancelled: () => boolean,
  setResult: React.Dispatch<React.SetStateAction<Result | null>>,
) {
  let providers = initial.source_health;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pending = providers.filter((provider) =>
      ["NASA GPM IMERG", "NASA SMAP L4", "NASA MODIS"].includes(provider.providerName)
      && provider.status === "pending"
      && provider.taskId,
    );
    if (!pending.length || signal.aborted || isCancelled()) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (signal.aborted || isCancelled()) return;

    const updates = await Promise.all(pending.map(async (provider) => {
      const sourceId = provider.providerName === "NASA GPM IMERG" ? "gpm"
        : provider.providerName === "NASA SMAP L4" ? "smap" : "modis";
      const started = Date.now();
      try {
        const response = await fetch("/api/earth/observations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal,
          body: JSON.stringify({
            sourceId,
            latitude: initial.location.lat,
            longitude: initial.location.lon,
            startDate: initial.period.start,
            endDate: initial.period.end,
            taskId: provider.taskId,
          }),
        });
        const payload = await response.json() as ObservationResponse;
        const observations = payload.observations ?? [];
        const valid = observations.filter((item) => item.value !== null)
          .sort((a, b) => b.observationTime.localeCompare(a.observationTime));
        const processing = payload.status === "processing";
        const credentialsRequired = payload.status === "credentials_required" || payload.status === "agreement_required";
        const status = processing ? "pending" : credentialsRequired ? "not_configured"
          : response.ok && ["success", "empty"].includes(payload.status ?? "") ? "healthy"
            : "unavailable";
        return {
          providerName: provider.providerName,
          status,
          taskId: processing ? payload.taskId ?? provider.taskId : null,
          lastSuccessfulRetrieval: status === "healthy" ? payload.retrievedAt ?? new Date().toISOString() : provider.lastSuccessfulRetrieval,
          latestObservationTime: valid[0]?.observationTime ?? provider.latestObservationTime,
          observationPeriod: { start: initial.period.start, end: initial.period.end },
          observationCount: valid.length,
          latestObservations: valid.slice(0, 3).map(({ variable, value, unit, observationTime }) => ({
            variable, value: value as number | string, unit, observationTime,
          })),
          attribution: payload.attribution ?? provider.attribution,
          retrievalDurationMs: Date.now() - started,
          errorCategory: credentialsRequired ? "credentials" : status === "unavailable" ? "provider" : null,
          message: processing ? "Provider processing is still pending."
            : credentialsRequired ? "Provider credentials or data-use agreement are required."
              : status === "healthy" && !valid.length ? payload.message ?? "Retrieval succeeded; no observations were returned."
                : status === "healthy" ? "Genuine provider observations retrieved."
                  : "Provider result could not be retrieved or validated.",
          dataOrigin: valid.length ? "genuine_provider" : "none",
        } satisfies Result["source_health"][number];
      } catch {
        return {
          ...provider,
          status: "unavailable" as const,
          errorCategory: "provider",
          message: "Provider result could not be retrieved or validated.",
          retrievalDurationMs: Date.now() - started,
          taskId: null,
        };
      }
    }));

    providers = providers.map((provider) =>
      updates.find((update) => update.providerName === provider.providerName) ?? provider,
    );
    setResult((current) => current ? { ...current, source_health: providers } : current);
  }
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
  const [agriculture, setAgriculture] = useState<AgricultureResult | null>(null);
  const [agricultureError, setAgricultureError] = useState("");
  const [farmProfile, setFarmProfile] = useState({ farmSizeHa: "", previousCrop: "", plantingDate: "", waterSource: "none" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasLocation) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setAgricultureError("");
    setResult(null);
    setAgriculture(null);
    fetch(`${API_URL}/api/intelligence/location?lat=${latNum}&lon=${lonNum}&days=90`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Could not load the analysis for this location.");
        return data as Result;
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setAgriculture(data.agriculture);
          void pollPendingProviders(data, controller.signal, () => cancelled, setResult);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Could not load the analysis.";
          setError(message);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
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

  async function saveFarmProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasLocation) return;
    setAgricultureError("");
    const params = new URLSearchParams({ lat: String(latNum), lon: String(lonNum), days: "90", waterSource: farmProfile.waterSource });
    if (farmProfile.farmSizeHa) params.set("farmSizeHa", farmProfile.farmSizeHa);
    if (farmProfile.previousCrop) params.set("previousCrop", farmProfile.previousCrop);
    if (farmProfile.plantingDate) params.set("plantingDate", farmProfile.plantingDate);
    try {
      const response = await fetch(`/api/agriculture/assessment?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not update the agricultural assessment.");
      setAgriculture(data as AgricultureResult);
      setProfileSaved(true);
    } catch (err) {
      setAgricultureError(err instanceof Error ? err.message : "Could not update the agricultural assessment.");
    }
  }

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
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-white/10 dark:text-brand-100">{result.summary.total_rain_mm === null ? "No rainfall data" : `${(Math.round(result.summary.total_rain_mm * 10) / 10).toFixed(1)} mm total`}</span>
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

          <section aria-labelledby="provider-coverage-title" className="space-y-4 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
            <div>
              <h2 id="provider-coverage-title" className="font-semibold text-brand-900 dark:text-white">Earth data source coverage</h2>
              <p className="text-sm text-brand-700 dark:text-brand-200/80">Provider health is independent of crop screening. Empty results are shown separately from failed retrievals.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.source_health.map((source) => (
                <article key={source.providerName} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-brand-900 dark:text-white">{source.providerName}</h3>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${source.status === "healthy" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200" : source.status === "pending" ? "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200" : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"}`}>
                      {providerStatusLabel[source.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-brand-700 dark:text-brand-200/80">{source.observationCount} valid observations · {source.retrievalDurationMs === null ? "duration unavailable" : `${source.retrievalDurationMs} ms`}</p>
                  {source.observationPeriod && <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-300/70">Data period: {source.observationPeriod.start} to {source.observationPeriod.end}</p>}
                  {source.latestObservations.map((observation) => (
                    <p key={`${observation.variable}:${observation.observationTime}`} className="mt-2 text-xs text-brand-800 dark:text-brand-100">
                      {observation.variable}: {observation.value} {observation.unit} · {observation.observationTime}
                    </p>
                  ))}
                  {!source.latestObservations.length && <p className="mt-2 text-xs text-brand-700 dark:text-brand-200/80">{source.message}</p>}
                  <p className="mt-2 text-[11px] text-brand-600 dark:text-brand-300/70">
                    {source.latestObservationTime ? `Latest observation: ${source.latestObservationTime}` : source.lastSuccessfulRetrieval ? `Last successful retrieval: ${source.lastSuccessfulRetrieval}` : "No successful retrieval recorded in this server session."}
                  </p>
                  <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-300/70">{source.dataOrigin === "genuine_provider" ? "Provider observations" : source.message}</p>
                  <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-300/70">{source.attribution}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Crop screening from the agricultural knowledge layer */}
          <section className="space-y-5 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl sm:p-8 dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-brand-900 dark:text-white"><Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> Agricultural screening</h2>
              <p className="text-sm text-brand-700 dark:text-brand-200/80">A transparent first screen using the agricultural calendar and the observations retrieved for this point. It is not a yield prediction.</p>
            </div>
            {agricultureError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{agricultureError}</p>}
            <div className="grid gap-5 lg:grid-cols-2">
              {(agriculture?.crops ?? []).map((crop) => (
                <article key={crop.crop} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-brand-900 dark:text-white">{crop.crop}</p>
                      <p className="mt-1 text-xs uppercase tracking-wider text-brand-600 dark:text-brand-300/70">{crop.status.replaceAll("_", " ")} · {crop.confidence} confidence</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-brand-400" />
                  </div>
                  <p className="mt-4 text-sm text-brand-800 dark:text-brand-100">Rain-fed screening window: {crop.plantingWindow}</p>
                  <ul className="mt-3 space-y-2 text-sm text-brand-700 dark:text-brand-200/80">
                    {crop.supportingEvidence.slice(0, 2).map((evidence) => <li key={evidence}>✓ {evidence}</li>)}
                    {crop.limitingFactors.slice(0, 2).map((factor) => <li key={factor}>! {factor}</li>)}
                  </ul>
                </article>
              ))}
              {agriculture && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5 dark:border-amber-300/20 dark:bg-amber-400/10">
                  <p className="text-xs uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Season context</p>
                  <p className="mt-1 text-lg font-semibold text-brand-900 dark:text-white">{agriculture.season.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm text-brand-800 dark:text-brand-100">SoilGrids: {agriculture.environmentalEvidence.soil.status.replaceAll("_", " ")} ({agriculture.environmentalEvidence.soil.observationCount} observations).</p>
                  <p className="mt-3 text-xs text-brand-700 dark:text-brand-200/80">Missing farm details: {agriculture.missingInformation.join(", ")}.</p>
                </div>
              )}
            </div>
            {agriculture?.risks.length ? <div className="rounded-2xl border border-brand-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><p className="font-semibold text-brand-900 dark:text-white">Agricultural watch items</p>{agriculture.risks.map((risk) => <p key={risk.id} className="mt-2 text-sm text-brand-700 dark:text-brand-200/80"><span className="font-medium">{risk.level}:</span> {risk.evidence} {risk.limitation}</p>)}</div> : null}
            {agriculture && <p className="text-xs text-brand-600 dark:text-brand-300/70">Next steps: {agriculture.nextSteps.join(" ")}</p>}
            <form onSubmit={saveFarmProfile} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-900 dark:text-white">Add farm context</p>
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-300/70">Optional details improve confidence; they are kept in this assessment request.</p>
                </div>
                {profileSaved && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Profile applied</span>}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-brand-700 dark:text-brand-200">Farm size (ha)<input value={farmProfile.farmSizeHa} onChange={(event) => setFarmProfile({ ...farmProfile, farmSizeHa: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-brand-950" /></label>
                <label className="text-xs text-brand-700 dark:text-brand-200">Previous crop<input value={farmProfile.previousCrop} onChange={(event) => setFarmProfile({ ...farmProfile, previousCrop: event.target.value })} className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-brand-950" /></label>
                <label className="text-xs text-brand-700 dark:text-brand-200">Planting date<input type="date" value={farmProfile.plantingDate} onChange={(event) => setFarmProfile({ ...farmProfile, plantingDate: event.target.value })} className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-brand-950" /></label>
                <label className="text-xs text-brand-700 dark:text-brand-200">Water source<select value={farmProfile.waterSource} onChange={(event) => setFarmProfile({ ...farmProfile, waterSource: event.target.value })} className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-brand-950"><option value="none">Rain-fed / none</option><option value="well">Well</option><option value="river">River</option><option value="irrigation">Irrigation</option></select></label>
              </div>
              <button type="submit" className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Apply farm context</button>
            </form>
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
