'use client';

import { AlertCircle, LoaderCircle, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocationContext } from '@/components/providers/location-context';
import { dashboardMetrics, formatMetricUnit, formatMetricValue, sourceSummaries } from '@/lib/adapters/observation-presentation';
import { fetchObservationHub } from '@/lib/services/earth-api';
import type { ObservationHubResult } from '@/lib/earth-data/types';

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'success') return 'success';
  if (status === 'empty' || status === 'processing') return 'warning';
  if (status === 'error' || status === 'timeout' || status === 'credentials_required') return 'danger';
  return 'secondary';
}

export function IntelligenceDashboard() {
  const { location, period, hydrated } = useLocationContext();
  const [hub, setHub] = useState<ObservationHubResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    fetchObservationHub({
      latitude: location.latitude,
      longitude: location.longitude,
      startDate: period.start,
      endDate: period.end,
    }, controller.signal)
      .then(setHub)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setHub(undefined);
          setError(cause instanceof Error ? cause.message : 'Environmental observations could not be loaded.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [hydrated, location.latitude, location.longitude, period.end, period.start]);

  const metrics = useMemo(() => (hub ? dashboardMetrics(hub) : []), [hub]);
  const sources = useMemo(() => (hub ? sourceSummaries(hub) : []), [hub]);

  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-soft md:p-8">
        <Badge variant="secondary" className="gap-2 bg-primary-foreground/10 text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Live environmental intelligence
        </Badge>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Understand what is happening around your area.</h1>
        <p className="mt-3 max-w-2xl text-sm text-primary-foreground/80 md:text-base">
          Genuine observations from the configured Earth data services, interpreted without replacing missing measurements.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-primary-foreground/80">
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{location.name}</span>
          <span>{period.start} to {period.end}</span>
        </div>
      </header>

      {loading ? (
        <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Retrieving observations from configured sources…</CardContent></Card>
      ) : null}
      {error ? (
        <Card className="border-danger/40"><CardContent className="flex items-start gap-3 p-6 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></CardContent></Card>
      ) : null}

      {!loading && !error && hub ? (
        <>
          <section aria-labelledby="metrics-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><h2 id="metrics-title" className="text-2xl font-semibold">Latest measured signals</h2><p className="mt-1 text-sm text-muted-foreground">Only valid values returned for the selected period are shown.</p></div>
              <Badge variant="outline">{metrics.length} signals</Badge>
            </div>
            {metrics.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No valid measurements were returned for this period.</CardContent></Card> : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.slice(0, 8).map((metric) => (
                  <Card key={metric.id}>
                    <CardHeader className="pb-3"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-3xl">{formatMetricValue(metric)} <span className="text-sm font-normal text-muted-foreground">{formatMetricUnit(metric.unit)}</span></CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground">{metric.sourceId.toUpperCase()} · {metric.observationTime?.slice(0, 10) ?? 'Date unavailable'}</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
          <section aria-labelledby="sources-title">
            <div className="mb-4"><h2 id="sources-title" className="text-2xl font-semibold">Source availability</h2><p className="mt-1 text-sm text-muted-foreground">A partial source response is reported as partial, never as zero.</p></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => (
                <Card key={source.sourceId}><CardContent className="flex items-start justify-between gap-4 p-5"><div><div className="font-semibold">{source.sourceId.toUpperCase()}</div><div className="mt-1 text-xs text-muted-foreground">{source.validObservationCount} valid of {source.observationCount} observations</div>{source.errorMessage ? <p className="mt-2 text-xs text-muted-foreground">{source.errorMessage}</p> : null}</div><Badge variant={statusVariant(source.status)}>{source.status.replaceAll('_', ' ')}</Badge></CardContent></Card>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {!hydrated ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Preparing your selected location…</CardContent></Card> : null}
    </div>
  );
}
