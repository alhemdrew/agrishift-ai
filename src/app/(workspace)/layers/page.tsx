import { LayersCatalog } from './layers-catalog';

export default function LayersPage() {
  return <div className="space-y-8">
    <header className="shell-surface rounded-2xl p-6 md:p-8">
      <p className="text-sm font-semibold text-primary">Environmental Layers</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Earth observation layers</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
        Layer availability is read from the existing NASA GIBS capabilities service. Map rendering remains in the MapLibre explorer.
      </p>
    </header>
    <LayersCatalog />
  </div>;
}
