import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CloudRain,
  Database,
  Droplets,
  Flame,
  FileText,
  Globe2,
  Layers,
  MapPin,
  Plus,
  Sparkles,
  Sprout,
  Thermometer,
} from "lucide-react";

const card = "rounded-2xl border border-brand-200 bg-white shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none";

const modules = [
  { title: "Earth Explorer", body: "Search any place, or click the map, to see its recent weather and rainfall.", href: "/explore", icon: Globe2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { title: "Intelligence", body: "Explainable indicators for heat, dry spells and heavy rain.", href: "/app/intelligence", icon: BarChart3, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { title: "Environmental Layers", body: "See the land through each NASA layer, and what is live today.", href: "/app/layers", icon: Layers, tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  { title: "Reports", body: "A printable summary of the evidence, sources and limitations for a place.", href: "/app/reports", icon: FileText, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
];

const sources = [
  { name: "NASA POWER", use: "Weather, rainfall, sunshine, wind", icon: CloudRain, connected: true },
  { name: "NASA GPM IMERG", use: "Satellite rainfall estimates", icon: Droplets, connected: false },
  { name: "NASA SMAP", use: "Soil moisture", icon: Sprout, connected: false },
  { name: "NASA MODIS", use: "Vegetation health", icon: Thermometer, connected: false },
  { name: "NASA FIRMS", use: "Active fire detections", icon: Flame, connected: false },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Hero: a dark banner in both themes, as in the design */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-brand-950 shadow-2xl shadow-brand-900/20">
        <img src="/assets/landscape-banner.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-950/85 to-brand-950/10" />
        <div className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Dashboard
            </span>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Understand your land through{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-amber-300 bg-clip-text text-transparent">Earth observation</span>
            </h1>
            <p className="max-w-xl text-base text-brand-100/90">
              Save the places you farm, watch their environmental conditions, and get explanations grounded in NASA data.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-brand-950 shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-300">
                Explore the Earth <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/app/assistant" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                Ask the AI Assistant
              </Link>
            </div>
          </div>
          <div className="hidden items-center justify-center lg:flex">
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-brand-200">
                <span>Data status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live</span>
              </div>
              <p className="mt-3 text-4xl font-semibold text-white">1<span className="text-lg text-brand-200"> of 5</span></p>
              <p className="text-sm text-brand-200">NASA sources connected</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/5 rounded-full bg-gradient-to-r from-emerald-400 to-amber-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conditions banner */}
      <section aria-label="Conditions to monitor" className="flex items-start gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-gradient-to-r dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-100">Conditions to monitor</p>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
            No farms are saved yet. Risk alerts for drought, heat, vegetation stress and fire will appear here once a farm has real NASA data.
          </p>
        </div>
      </section>

      {/* Tools */}
      <section aria-labelledby="tools" className="space-y-4">
        <h2 id="tools" className="text-lg font-semibold text-brand-900 dark:text-white">Your tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map(({ title, body, href, icon: Icon, tone }) => {
            const inner = (
              <div className={`group relative h-full p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${card}`}>
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-brand-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-700 dark:text-brand-200/80">{body}</p>
                <p className={`mt-4 flex items-center gap-1 text-sm font-medium ${href ? "text-brand-700 dark:text-emerald-300" : "text-brand-400 dark:text-brand-300/60"}`}>
                  {href ? (<>Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></>) : "Coming soon"}
                </p>
              </div>
            );
            return href ? (
              <Link key={title} href={href} className="block h-full">{inner}</Link>
            ) : (
              <div key={title} aria-disabled="true" className="h-full opacity-80">{inner}</div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Farms */}
        <section aria-labelledby="farms" className={`relative overflow-hidden p-6 lg:col-span-3 ${card}`}>
          <div className="flex items-center justify-between">
            <h2 id="farms" className="font-semibold text-brand-900 dark:text-white">Your farms</h2>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-white/10 dark:text-brand-100">0 saved</span>
          </div>
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-emerald-400/50 px-6 py-12 text-center">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-300">
              <MapPin className="h-6 w-6" />
            </span>
            <p className="mt-5 text-lg font-semibold text-brand-900 dark:text-white">Save your first farm</p>
            <p className="mt-1 max-w-sm text-sm text-brand-700 dark:text-brand-200/80">
              Find your land in the Earth Explorer, then analyse it. Saving farms is the next feature to ship.
            </p>
            <Link href="/explore" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-emerald-400 dark:text-brand-950 dark:hover:bg-emerald-300">
              <Plus className="h-4 w-4" /> Find a location
            </Link>
          </div>
        </section>

        {/* AI teaser: now live */}
        <section aria-labelledby="ai" className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-white p-6 shadow-sm lg:col-span-2 dark:border-emerald-400/20 dark:bg-gradient-to-b dark:from-emerald-400/15 dark:to-brand-900/60 dark:shadow-none">
          <img src="/assets/ai-robot.webp" alt="" className="pointer-events-none absolute -right-4 -top-2 h-44 w-auto opacity-90 drop-shadow-xl" />
          <div className="relative max-w-[60%] space-y-3">
            <h2 id="ai" className="text-lg font-semibold text-brand-900 dark:text-white">Ask AgriShift AI</h2>
            <p className="text-sm text-brand-700 dark:text-brand-100/85">Understand the environmental signals behind any location.</p>
          </div>
          <div className="relative mt-24 flex flex-wrap gap-2">
            {["What does this pattern indicate?", "Should farmers be concerned?"].map((q) => (
              <span key={q} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs text-brand-700 dark:border-white/15 dark:bg-white/5 dark:text-brand-100/70">{q}</span>
            ))}
          </div>
          <Link href="/app/assistant" className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-emerald-400 dark:text-brand-950 dark:hover:bg-emerald-300">
            <Sparkles className="h-4 w-4" /> Open the assistant
          </Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="sources" className={`p-6 ${card}`}>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <h2 id="sources" className="font-semibold text-brand-900 dark:text-white">NASA data sources</h2>
          </div>
          <ul className="mt-5 space-y-3">
            {sources.map(({ name, use, icon: Icon, connected }) => (
              <li key={name} className="flex items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm dark:bg-white/5 dark:text-brand-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-brand-700 dark:text-brand-200/70">{use}</p>
                </div>
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-white/5 dark:text-brand-300/70">In development</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="monitor" className={`p-6 ${card}`}>
          <h2 id="monitor" className="font-semibold text-brand-900 dark:text-white">What to monitor next</h2>
          <p className="mt-1 text-sm text-brand-700 dark:text-brand-200/70">General guidance until your farms have data.</p>
          <ul className="mt-5 space-y-3">
            {["Track changes in rainfall patterns", "Monitor vegetation health", "Watch for increasing heat stress", "Check for dry conditions"].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-brand-800 dark:text-brand-100">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/app/intelligence" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-emerald-300 dark:hover:text-emerald-200">
            <BarChart3 className="h-4 w-4" /> Open Intelligence <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      <p className="text-center text-xs text-brand-600 dark:text-brand-300/60">
        Built for the NASA Space Apps Challenge 2026 using NASA Earth observation data. Not endorsed by NASA.
      </p>
    </div>
  );
}
