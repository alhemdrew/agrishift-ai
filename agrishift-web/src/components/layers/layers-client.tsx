"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudRain, Droplets, Flame, Leaf, Sparkles, Sun, CheckCircle2, CircleDashed } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

type Layer = {
  key: string;
  name: string;
  status: "available" | "partial" | "not_connected";
  statusText: string;
  source: string;
  resolution: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

const layers: Layer[] = [
  {
    key: "weather",
    name: "Weather",
    status: "available",
    statusText: "Available at a place",
    source: "NASA POWER · daily",
    resolution: "About 50 km grid cells",
    description: "Temperature, wind and humidity for any point, from the last 30 to 90 days. Open a place in the Explorer to see it.",
    icon: Sun,
    tone: "from-amber-300 to-orange-500",
  },
  {
    key: "rainfall",
    name: "Rainfall",
    status: "partial",
    statusText: "Available at a place",
    source: "NASA POWER · daily (GPM IMERG coming)",
    resolution: "About 50 km grid cells",
    description: "Daily rainfall totals and dry spells for a place. Satellite rainfall maps from GPM IMERG are in development.",
    icon: CloudRain,
    tone: "from-sky-400 to-cyan-500",
  },
  {
    key: "soil",
    name: "Soil moisture",
    status: "not_connected",
    statusText: "Not connected",
    source: "NASA SMAP",
    resolution: "To be confirmed with the dataset",
    description: "How much water the top layer of soil holds. Needs NASA SMAP data, which is being connected.",
    icon: Droplets,
    tone: "from-yellow-400 to-amber-500",
  },
  {
    key: "vegetation",
    name: "Vegetation",
    status: "not_connected",
    statusText: "Not connected",
    source: "NASA MODIS",
    resolution: "To be confirmed with the dataset",
    description: "Greenness of crops and natural vegetation over time. Needs NASA MODIS data, which is being connected.",
    icon: Leaf,
    tone: "from-lime-400 to-green-600",
  },
  {
    key: "fire",
    name: "Fire detections",
    status: "not_connected",
    statusText: "Not connected",
    source: "NASA FIRMS",
    resolution: "Near real time",
    description: "Recent fire detections close to the land you farm. Needs a NASA FIRMS key, which is being connected.",
    icon: Flame,
    tone: "from-orange-400 to-red-600",
  },
];

const statusDot: Record<Layer["status"], string> = {
  available: "bg-emerald-400",
  partial: "bg-emerald-400",
  not_connected: "bg-brand-400",
};

export function LayersClient() {
  const [activeKey, setActiveKey] = useState("rainfall");
  const active = layers.find((l) => l.key === activeKey) ?? layers[0];
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Agricultural Earth observation"
        title="One landscape. Five perspectives."
        subtitle="Integrated environmental layers to understand what is happening on your land, from weather to vegetation and risk."
        image="/assets/landscape-banner.webp"
        imagePosition="object-right"
        aside={
          <img
            src="/assets/environmental-layers.webp"
            alt="Illustration of stacked satellite layers over a farm: rain, soil, vegetation and fire"
            className="mx-auto w-full max-w-md rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Selected layer */}
        <section className="space-y-6 rounded-3xl border border-brand-200 bg-white p-6 shadow-xl sm:p-8 dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <div className="flex flex-wrap items-start gap-5">
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${active.tone} text-white shadow-lg`}>
              <ActiveIcon className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-brand-900 dark:text-white">{active.name}</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">
                  <span className={`h-2 w-2 rounded-full ${statusDot[active.status]}`} /> {active.statusText}
                </span>
              </div>
              <p className="mt-2 text-brand-700 dark:text-brand-200/80">{active.description}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Source", active.source],
              ["Spatial resolution", active.resolution],
              ["Use it for", "Explore a place, then analyse it"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs uppercase tracking-wider text-brand-600 dark:text-brand-300/70">{label}</p>
                <p className="mt-1 text-sm font-medium text-brand-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110">
              View on the map <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/app/assistant" className="inline-flex items-center gap-2 rounded-xl border border-brand-300 px-5 py-3 text-sm font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
              <Sparkles className="h-4 w-4" /> Ask AI to explain
            </Link>
          </div>
        </section>

        {/* Layer list */}
        <aside className="space-y-3">
          {layers.map((layer) => {
            const Icon = layer.icon;
            const isActive = layer.key === activeKey;
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => setActiveKey(layer.key)}
                aria-pressed={isActive}
                className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition ${
                  isActive
                    ? "border-emerald-400 bg-emerald-50 shadow-emerald-400/20 dark:bg-emerald-400/10"
                    : "border-brand-200 bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-brand-900/60 dark:hover:border-emerald-400/40"
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${layer.tone} text-white`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-brand-900 dark:text-white">{layer.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-200/80">
                    {layer.status === "not_connected" ? <CircleDashed className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                    {layer.statusText}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-brand-500 transition group-hover:translate-x-1 dark:text-brand-300" />
              </button>
            );
          })}
          <div className="relative mt-4 hidden overflow-hidden rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-50 to-white p-4 lg:block dark:from-emerald-400/10 dark:to-transparent">
            <div className="flex items-center gap-3">
              <img src="/assets/ai-robot.webp" alt="" className="h-16 w-auto rounded-2xl" />
              <p className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow dark:bg-brand-950 dark:text-brand-100">Choose a layer to explore.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
