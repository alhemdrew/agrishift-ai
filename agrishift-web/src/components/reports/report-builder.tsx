"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Globe2, Printer, Sparkles, Eye, Download, History } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status = "low" | "moderate" | "high" | "info" | "no_data" | "unavailable";
type Indicator = { key: string; name: string; status: Status; observed: string; why: string; limitation: string };
type Report = {
  location: { lat: number; lon: number };
  period: { start: string; end: string; days: number };
  source: string;
  summary: { avg_temp_c: number | null; max_temp_c: number | null; min_temp_c: number | null; total_rain_mm: number; rainy_days: number; avg_solar_kwh_m2_day: number | null; avg_wind_ms: number | null; avg_humidity_pct: number | null };
  series: { date: string; prectotcorr: number | null }[];
  overall: Status;
  indicators: Indicator[];
  method_notes: string[];
};

const statusTone: Record<Status, string> = {
  low: "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
  no_data: "bg-slate-100 text-slate-700",
  unavailable: "bg-slate-100 text-slate-600",
};
const statusLabel: Record<Status, string> = { low: "Low", moderate: "Moderate", high: "High", info: "Context", no_data: "No data", unavailable: "In development" };

const PRINT = `
@media print {
  header, nav, .no-print { display: none !important; }
  body, main { background: #ffffff !important; }
  .brief-sheet { box-shadow: none !important; border: none !important; }
}
`;

function parseCoord(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function ReportBuilder({ type, lat, lon }: { type: "environmental" | "risk"; lat: string; lon: string }) {
  const router = useRouter();
  const latNum = parseCoord(lat, -90, 90);
  const lonNum = parseCoord(lon, -180, 180);
  const hasLocation = latNum !== null && lonNum !== null;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLon, setFormLon] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!hasLocation) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_URL}/api/intelligence/location?lat=${latNum}&lon=${lonNum}&days=90`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Could not build the report for this location.");
        return data as Report;
      })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not build the report."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hasLocation, latNum, lonNum]);

  function useCoordinates(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const la = parseCoord(formLat, -90, 90);
    const lo = parseCoord(formLon, -180, 180);
    if (la === null || lo === null) {
      setFormError("Enter a latitude between -90 and 90, and a longitude between -180 and 180.");
      return;
    }
    router.push(`/app/reports/create?type=${type}&lat=${la}&lon=${lo}`);
  }

  function changeType(next: "environmental" | "risk") {
    if (hasLocation) router.push(`/app/reports/create?type=${next}&lat=${latNum}&lon=${lonNum}`);
  }

  const title = type === "risk" ? "Risk Assessment" : "Environmental Overview";
  const rainfallDays = report?.series.filter((d) => d.prectotcorr !== null).length ?? 0;

  return (
    <div className="space-y-8">
      <style>{PRINT}</style>
      <div className="no-print">
        <Link href="/app/reports" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-emerald-300 dark:hover:text-emerald-200">
          <ArrowLeft className="h-4 w-4" /> All reports
        </Link>
      </div>

      <PageHero
        eyebrow="Reports"
        title="Turn observations into a clear story."
        subtitle="Field briefs that combine NASA evidence, indicators and their limits, ready to print or save as a PDF."
        image="/assets/landscape-banner.webp"
        imagePosition="object-right"
        aside={<img src="/assets/ai-robot.webp" alt="" className="mx-auto hidden h-60 w-auto rounded-3xl drop-shadow-2xl lg:block" />}
      />

      {!hasLocation && (
        <div className="no-print mx-auto max-w-xl space-y-6 rounded-3xl border border-brand-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white"><FileText className="h-6 w-6" /></span>
            <div>
              <h2 className="text-xl font-semibold text-brand-900 dark:text-white">{title}</h2>
              <p className="text-sm text-brand-700 dark:text-brand-200/80">Which place should this brief cover?</p>
            </div>
          </div>
          <form onSubmit={useCoordinates} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm text-brand-800 dark:text-brand-100">Latitude
                <input value={formLat} onChange={(e) => setFormLat(e.target.value)} placeholder="10.52" inputMode="decimal" className="w-full rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-brand-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </label>
              <label className="space-y-1 text-sm text-brand-800 dark:text-brand-100">Longitude
                <input value={formLon} onChange={(e) => setFormLon(e.target.value)} placeholder="7.44" inputMode="decimal" className="w-full rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-brand-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </label>
            </div>
            {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white hover:brightness-110">Build field brief</button>
          </form>
          <p className="text-center text-sm text-brand-700 dark:text-brand-200/80">
            Not sure of the coordinates? <Link href="/explore" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Search for the place in the Explorer</Link>.
          </p>
        </div>
      )}

      {loading && <p className="no-print text-brand-700 dark:text-brand-200">Building the brief from the last 90 days of NASA observations…</p>}
      {error && <div role="alert" className="no-print rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {report && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* The brief: always on paper, like the design */}
          <article className="brief-sheet space-y-7 overflow-hidden rounded-3xl border border-brand-200 bg-[#fbfaf5] p-7 text-slate-900 shadow-2xl sm:p-10">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/assets/brand-mark.webp" alt="" className="h-10 w-10 object-contain" />
                <div>
                  <p className="text-lg font-semibold">AgriShift <span className="font-normal text-slate-500">/ Field brief</span></p>
                </div>
              </div>
              <span className="no-print rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">{title}</span>
            </header>

            <div>
              <h2 className="text-3xl font-semibold text-slate-900">{report.location.lat}, {report.location.lon}</h2>
              <p className="mt-1 text-slate-600">{report.period.start} to {report.period.end} · {report.period.days} days of daily NASA observations</p>
            </div>

            <img src="/assets/landscape-banner.webp" alt="Farm landscape" className="h-44 w-full rounded-2xl object-cover" />

            <section className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-900">Overview</h3>
              <p className="leading-relaxed text-slate-700">
                Over the last {report.period.days} days, {report.summary.total_rain_mm} mm of rain fell on {report.summary.rainy_days} days (1 mm or more),
                based on {rainfallDays} days with data. The average temperature was {report.summary.avg_temp_c ?? "not available"}{report.summary.avg_temp_c !== null ? " °C" : ""}, with a highest daily maximum of {report.summary.max_temp_c ?? "not available"}{report.summary.max_temp_c !== null ? " °C" : ""}.
              </p>
            </section>

            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["Rainfall", `${report.summary.total_rain_mm} mm`],
                ["Rainy days", `${report.summary.rainy_days}`],
                ["Avg temperature", report.summary.avg_temp_c === null ? "No data" : `${report.summary.avg_temp_c} °C`],
                ["Avg sunshine", report.summary.avg_solar_kwh_m2_day === null ? "No data" : `${report.summary.avg_solar_kwh_m2_day} kWh/m²`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <section className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">Indicators{type === "risk" ? ", by level" : ""}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {report.indicators.map((ind) => (
                  <div key={ind.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{ind.name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[ind.status]}`}>{statusLabel[ind.status]}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800"><span className="font-medium">Observed:</span> {ind.observed}</p>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Limitation:</span> {ind.limitation}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">Evidence and limitations</h3>
              <ul className="space-y-2">
                {report.method_notes.map((note) => (
                  <li key={note} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{note}</li>
                ))}
              </ul>
              <p className="text-sm text-slate-600"><span className="font-medium">Source:</span> {report.source}</p>
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Describes past conditions only. Not a forecast, and not a substitute for local advice.</span>
              <span>Built for the NASA Space Apps Challenge 2026 using NASA Earth observation data. Not endorsed by NASA.</span>
            </footer>
          </article>

          {/* Builder */}
          <aside className="no-print space-y-5">
            <div className="space-y-5 rounded-3xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-white p-6 shadow-xl dark:to-brand-900/60">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900 dark:text-white"><FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /> Build your field brief</h2>
                <p className="mt-1 text-sm text-brand-700 dark:text-brand-200/80">Choose the type, then print or save it as a PDF.</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Report type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["environmental", "risk"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => changeType(t)} aria-pressed={type === t} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${type === t ? "border-emerald-500 bg-emerald-500 text-white" : "border-brand-200 bg-white text-brand-800 hover:border-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-brand-100"}`}>
                      {t === "environmental" ? "Environmental overview" : "Risk assessment"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Include</p>
                {[
                  { label: "Field overview", on: true, required: true },
                  { label: "Environmental trends", on: true, required: true },
                  { label: "Sources and limitations", on: true, required: true },
                  { label: "AI explanation (coming soon)", on: false, required: false },
                ].map((item) => (
                  <label key={item.label} className={`flex items-center gap-3 text-sm ${item.required ? "text-brand-900 dark:text-white" : "text-brand-500 dark:text-brand-300/60"}`}>
                    <input type="checkbox" checked={item.on} disabled readOnly className="h-4 w-4 accent-emerald-600" />
                    {item.label}{item.required && <span className="text-xs text-brand-500">(required)</span>}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300/70">Format</p>
                <p className="rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 dark:border-white/10 dark:bg-white/5 dark:text-white">PDF (use Print, then Save as PDF)</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110">
                  <Download className="h-4 w-4" /> Generate
                </button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 px-3 py-3 text-sm font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
                  <Eye className="h-4 w-4" /> Preview
                </button>
              </div>
              <button type="button" onClick={() => window.print()} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"><Printer className="h-4 w-4" /> Print this brief</button>
            </div>

            <div className="rounded-3xl border border-brand-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
              <h2 className="flex items-center gap-2 font-semibold text-brand-900 dark:text-white"><History className="h-4 w-4 text-brand-600 dark:text-brand-300" /> Previous briefs</h2>
              <p className="mt-2 text-sm text-brand-700 dark:text-brand-200/80">No saved briefs yet. Saving briefs to your account comes in a later release.</p>
              <Link href="/app/assistant" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"><Globe2 className="h-4 w-4" /> Ask the assistant about this place</Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
