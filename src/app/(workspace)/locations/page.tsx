'use client';

import { ArrowRight, CalendarDays, MapPin, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

import { useLocationContext } from '@/components/providers/location-context';

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    dateStyle: 'medium',
  });
}

export default function LocationsPage() {
  const { location, period, hydrated } = useLocationContext();
  const params = new URLSearchParams({
    name: location.name,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start: period.start,
    end: period.end,
  });
  const explorerHref = `/explorer?${params.toString()}` as Route;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-1 py-4 md:py-8">
      <header className="max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <MapPin aria-hidden="true" className="h-4 w-4" /> Your area
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          A closer look at your place.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Your selected area and observation dates stay with you as you explore and ask AgriShif AI.
        </p>
      </header>

      <section aria-label="Your selected area" className="rounded-3xl bg-card p-6 shadow-soft md:p-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {hydrated && location.confirmed ? 'Your selected place' : 'Suggested starting place'}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {hydrated ? location.name : 'Finding your place…'}
            </h2>
            {location.region && <p className="mt-1 text-sm text-muted-foreground">{location.region}</p>}
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              Observations from {formatDate(period.start)} to {formatDate(period.end)}
            </p>
            {!location.confirmed && (
              <p className="mt-3 text-sm text-muted-foreground">
                Confirm this suggested place before asking for local observations.
              </p>
            )}
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="w-fit cursor-pointer font-medium text-primary">Location details</summary>
              <p className="mt-2">
                Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                {location.confirmed ? ' · Confirmed' : ' · Not confirmed'}
              </p>
            </details>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              href="/assistant?changePlace=1"
            >
              <MapPin aria-hidden="true" className="h-4 w-4" />
              {location.confirmed ? 'Change place' : 'Choose a place'}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted"
              href={explorerHref}
            >
              Explore map <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Link
        className="group flex max-w-2xl items-start gap-4 rounded-2xl bg-secondary/70 p-5 transition-colors hover:bg-secondary"
        href="/assistant"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles aria-hidden="true" className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-semibold">Wondering what the observations mean?</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Ask AgriShif AI to explain what is available for this place.
          </span>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Start a conversation <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </span>
      </Link>
    </main>
  );
}
