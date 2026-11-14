'use client';

import { AlertCircle, Layers3, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fetchLayerCatalog, type LayerCatalogResponse } from '@/lib/services/earth-api';

export function LayersCatalog() {
  const [catalog, setCatalog] = useState<LayerCatalogResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchLayerCatalog(controller.signal)
      .then(setCatalog)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Environmental layers could not be loaded.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) {
    return <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Checking NASA GIBS layer availability…</CardContent></Card>;
  }
  if (error) {
    return <Card className="border-danger/40"><CardContent className="flex items-start gap-3 p-6 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4" />{error}</CardContent></Card>;
  }
  if (!catalog || catalog.layers.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No environmental layers are currently available.</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {catalog.layers.map((layer) => (
        <Card key={layer.id}>
          <CardContent className="flex items-start gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{layer.label}</h2>
                <Badge variant={layer.available ? 'success' : 'warning'}>{layer.available ? 'Available' : 'Unavailable'}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{layer.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {layer.observationDate ? `Observation date: ${layer.observationDate}` : 'Observation date unavailable'} · {layer.attribution}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
