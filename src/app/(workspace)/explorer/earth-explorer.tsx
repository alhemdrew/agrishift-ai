'use client';

import type { Map as MapLibreMap, MapMouseEvent, Marker as MapLibreMarker } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CloudRain,
  Crosshair,
  Droplets,
  Flame,
  Globe2,
  Info,
  Layers3,
  Leaf,
  LoaderCircle,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  Satellite,
  Thermometer,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLocationContext } from '@/components/providers/location-context';
import { POWER_PARAMETERS, sourceById } from '@/lib/earth-data/catalog';
import type { Observation, ObservationResult, SourceId } from '@/lib/earth-data/types';

import styles from './explorer.module.css';

type SourceState =
  | 'loading'
  | 'success'
  | 'empty'
  | 'processing'
  | 'credentials_required'
  | 'agreement_required'
  | 'error';

interface SelectedLocation {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
  confirmed?: boolean;
}

interface MapLayer {
  id: string;
  sourceId: 'base' | 'gpm' | 'smap' | 'modis' | 'firms';
  label: string;
  productId: string;
  description: string;
  unit: string;
  temporalResolution: string;
  spatialResolution: string;
  gibsLayerId: string;
  visibleByDefault: boolean;
  attribution: string;
  available: boolean;
  gibsTitle?: string;
  observationDate?: string;
  tileMatrixSet?: string;
  gibsTileFormat?: string;
  wmsTileTemplate: string;
}

interface MapCatalog {
  status: string;
  message?: string;
  layers: MapLayer[];
}

interface SearchResult {
  id: number | string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  resultType: string;
  countryCode?: string;
  regionName?: string;
  bounds?: [number, number, number, number];
}

interface CountryProperties {
  ADMIN: string;
  CONTINENT: string;
  ADM0_A3: string;
  ISO_A2: string;
  ISO_A3: string;
  ISO_A3_EH: string;
  LABELRANK: number;
  LABEL_X?: number;
  LABEL_Y?: number;
  CAPITAL?: string;
}

type CountryFeature = Feature<Geometry, CountryProperties>;
type CountryCollection = FeatureCollection<Geometry, CountryProperties>;

interface SelectedCountry {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  continent: string;
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

interface DataState {
  status: SourceState;
  message?: string;
  result?: ObservationResult;
  taskId?: string;
}

const pilots: SelectedLocation[] = [
  { name: 'Kaduna', latitude: 10.5225, longitude: 7.4389, region: 'Kaduna State' },
  { name: 'Zaria', latitude: 11.1114, longitude: 7.7227, region: 'Kaduna State' },
  { name: 'Kano', latitude: 12.0022, longitude: 8.5919, region: 'Kano State' },
];

const powerLabels: Record<string, string> = {
  T2M: 'Air temperature',
  T2M_MAX: 'Maximum temperature',
  T2M_MIN: 'Minimum temperature',
  PRECTOTCORR: 'Precipitation',
  RH2M: 'Relative humidity',
  ALLSKY_SFC_SW_DWN: 'Solar radiation',
};

const pointDefaults: Record<SourceId, string> = {
  power: 'T2M',
  gpm: 'precipitation',
  smap: 'surface',
  modis: 'NDVI',
  firms: 'fire',
  soilgrids: 'clay',
  chirps: 'precipitation',
};

const sourceDocs: Record<SourceId, string> = {
  power: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',
  gpm: 'https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDF_07/summary',
  smap: 'https://nsidc.org/data/spl4smgp/versions/8',
  modis: 'https://appeears.earthdatacloud.nasa.gov/',
  firms: 'https://firms.modaps.eosdis.nasa.gov/api/area/',
  soilgrids: 'https://soilgrids.org/',
  chirps: 'https://data.chc.ucsb.edu/products/CHIRPS-2.0/',
};

const sourceDescriptions: Record<SourceId, string> = {
  power: 'Meteorological and solar conditions',
  gpm: 'Rainfall intensity and precipitation',
  smap: 'Soil moisture and hydrology',
  modis: 'Vegetation health and land cover',
  firms: 'Active fires and thermal anomalies',
  soilgrids: 'Soil texture and properties',
  chirps: 'Rainfall climatology and anomalies',
};

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function laterDate(first: string, second: string): string {
  return first > second ? first : second;
}

function earlierDate(first: string, second: string): string {
  return first < second ? first : second;
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

const basemapStyles = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

const layerSwatchClasses: Record<MapLayer['sourceId'], string> = {
  base: styles.layerSwatchSatellite,
  gpm: styles.layerSwatchWater,
  smap: styles.layerSwatchSoil,
  modis: styles.layerSwatchVegetation,
  firms: styles.layerSwatchFire,
};

const countryLabelLayerId = 'country-labels';

function featureBounds(feature: CountryFeature): [[number, number], [number, number]] {
  const bounds: [[number, number], [number, number]] = [[Infinity, Infinity], [-Infinity, -Infinity]];
  const visit = (coordinate: unknown) => {
    if (!Array.isArray(coordinate)) return;
    if (typeof coordinate[0] === 'number' && typeof coordinate[1] === 'number') {
      bounds[0][0] = Math.min(bounds[0][0], coordinate[0]);
      bounds[0][1] = Math.min(bounds[0][1], coordinate[1]);
      bounds[1][0] = Math.max(bounds[1][0], coordinate[0]);
      bounds[1][1] = Math.max(bounds[1][1], coordinate[1]);
      return;
    }
    coordinate.forEach(visit);
  };
  if ('coordinates' in feature.geometry) visit(feature.geometry.coordinates);
  else feature.geometry.geometries.forEach((geometry) => {
    if ('coordinates' in geometry) visit(geometry.coordinates);
  });
  return bounds;
}

function countryFromFeature(feature: CountryFeature): SelectedCountry {
  const properties = feature.properties;
  const bounds = featureBounds(feature);
  const center: [number, number] = [
    Number.isFinite(properties.LABEL_X) ? properties.LABEL_X as number : (bounds[0][0] + bounds[1][0]) / 2,
    Number.isFinite(properties.LABEL_Y) ? properties.LABEL_Y as number : (bounds[0][1] + bounds[1][1]) / 2,
  ];
  return {
    id: properties.ADM0_A3,
    name: properties.ADMIN,
    iso2: properties.ISO_A2,
    iso3: properties.ISO_A3_EH || properties.ISO_A3,
    continent: properties.CONTINENT,
    center,
    bounds,
  };
}

function installCountryLayers(map: MapLibreMap, collection: CountryCollection, dark: boolean) {
  if (!map.getSource('country-boundaries')) {
    map.addSource('country-boundaries', {
      type: 'geojson',
      data: collection,
      promoteId: 'ADM0_A3',
      tolerance: 0.35,
      buffer: 64,
    });
  }

  const labelFeatures: FeatureCollection<Point, CountryProperties> = {
    type: 'FeatureCollection',
    features: collection.features.flatMap((feature) => {
      const { LABEL_X, LABEL_Y } = feature.properties;
      if (!Number.isFinite(LABEL_X) || !Number.isFinite(LABEL_Y)) return [];
      return [{
        type: 'Feature' as const,
        id: feature.properties.ADM0_A3,
        properties: feature.properties,
        geometry: { type: 'Point' as const, coordinates: [LABEL_X as number, LABEL_Y as number] },
      }];
    }),
  };
  if (!map.getSource('country-label-anchors')) {
    map.addSource('country-label-anchors', {
      type: 'geojson',
      data: labelFeatures,
      promoteId: 'ADM0_A3',
    });
  }

  const pilotFeatures: FeatureCollection<Point, { name: string; region: string }> = {
    type: 'FeatureCollection',
    features: pilots.map((pilot) => ({
      type: 'Feature' as const,
      id: pilot.name,
      properties: { name: pilot.name, region: pilot.region ?? '' },
      geometry: { type: 'Point' as const, coordinates: [pilot.longitude, pilot.latitude] },
    })),
  };
  if (!map.getSource('pilot-locations')) {
    map.addSource('pilot-locations', {
      type: 'geojson',
      data: pilotFeatures,
      promoteId: 'name',
    });
  }

  const firstSymbolLayer = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
  if (!map.getLayer('country-fill')) {
    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'country-boundaries',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], dark ? '#20C982' : '#4E9A64',
          ['boolean', ['feature-state', 'hover'], false], dark ? '#B7F0CB' : '#A7D9B5',
          dark ? '#42B978' : '#A7D9B5',
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 0.3,
          ['boolean', ['feature-state', 'hover'], false], 0.2,
          dark ? 0.1 : 0.07,
        ],
        'fill-opacity-transition': { duration: 180, delay: 0 },
      },
    }, firstSymbolLayer);
  }
  if (!map.getLayer('country-outline')) {
    map.addLayer({
      id: 'country-outline',
      type: 'line',
      source: 'country-boundaries',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], dark ? '#F3C96F' : '#D99A35',
          ['boolean', ['feature-state', 'hover'], false], dark ? '#D8F7E1' : '#4E9A64',
          dark ? '#9EDDB4' : '#174B3A',
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          0, ['case', ['boolean', ['feature-state', 'selected'], false], 2.2, ['boolean', ['feature-state', 'hover'], false], 1.5, 0.7],
          3, ['case', ['boolean', ['feature-state', 'selected'], false], 3, ['boolean', ['feature-state', 'hover'], false], 2, 1],
          7, ['case', ['boolean', ['feature-state', 'selected'], false], 3.8, ['boolean', ['feature-state', 'hover'], false], 2.6, 1.45],
        ],
        'line-opacity': dark ? 0.9 : 0.84,
        'line-blur': 0.1,
        'line-color-transition': { duration: 160, delay: 0 },
        'line-width-transition': { duration: 160, delay: 0 },
      },
    }, firstSymbolLayer);
  }
  if (!map.getLayer(countryLabelLayerId)) {
    map.addLayer({
      id: countryLabelLayerId,
      type: 'symbol',
      source: 'country-label-anchors',
      layout: {
        'text-field': ['get', 'ADMIN'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 2.5, 10.5, 5, 12, 8, 14],
        'text-max-width': 9,
        'text-padding': 3,
        'text-variable-anchor': ['center', 'left', 'right', 'top', 'bottom'],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': ['get', 'LABELRANK'],
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], dark ? '#FFE09A' : '#102A24',
          ['boolean', ['feature-state', 'hover'], false], dark ? '#D8F7E1' : '#174B3A',
          dark ? '#F0F8F1' : '#243333',
        ],
        'text-halo-color': dark ? '#071710' : '#F6F8F4',
        'text-halo-width': 1.6,
        'text-opacity': 0.96,
      },
      filter: [
        'any',
        ['<=', ['get', 'LABELRANK'], 3],
        ['all', ['>=', ['zoom'], 1.2], ['<=', ['get', 'LABELRANK'], 6]],
        ['all', ['>=', ['zoom'], 2.6], ['<=', ['get', 'LABELRANK'], 10]],
        ['all', ['>=', ['zoom'], 4.2], ['<=', ['get', 'LABELRANK'], 18]],
        ['>=', ['zoom'], 5.4],
      ],
    }, firstSymbolLayer);
  }

  if (!map.getLayer('pilot-location-points')) {
    map.addLayer({
      id: 'pilot-location-points',
      type: 'circle',
      source: 'pilot-locations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 4, 4.4, 7, 6.2],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#F3C96F',
          ['boolean', ['feature-state', 'hover'], false], '#E7FFE9',
          dark ? '#21CE83' : '#174B3A',
        ],
        'circle-stroke-color': dark ? '#E9FFF0' : '#FFFFFF',
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 1.5],
        'circle-opacity': 0.98,
        'circle-radius-transition': { duration: 160, delay: 0 },
      },
    }, firstSymbolLayer);
  }

  if (!map.getLayer('pilot-location-labels')) {
    map.addLayer({
      id: 'pilot-location-labels',
      type: 'symbol',
      source: 'pilot-locations',
      minzoom: 4.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 10, 7, 12],
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-padding': 3,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': dark ? '#F0F8F1' : '#243333',
        'text-halo-color': dark ? '#071710' : '#F6F8F4',
        'text-halo-width': 1.5,
      },
    }, firstSymbolLayer);
  }
}

function latestValueByVariable(observations: Observation[]): Observation[] {
  const latest = new Map<string, Observation>();
  for (const observation of observations) {
    const current = latest.get(observation.variable);
    if (
      !current
      || (observation.value !== null && (current.value === null || observation.observationTime > current.observationTime))
      || (observation.value === null && current.value === null && observation.observationTime > current.observationTime)
    ) {
      latest.set(observation.variable, observation);
    }
  }
  return Array.from(latest.values());
}

function emptyDataState(status: SourceState, message: string): DataState {
  return { status, message };
}

export function EarthExplorer() {
  const {
    location: sharedLocationValue,
    period: sharedPeriod,
    hydrated: sharedHydrated,
    setLocation: setSharedLocation,
    setPeriod: setSharedPeriod,
  } = useLocationContext();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const countryCollectionRef = useRef<CountryCollection | null>(null);
  const selectedCountryIdRef = useRef<string | null>(null);
  const hoveredCountryIdRef = useRef<string | null>(null);
  const hoveredPilotNameRef = useRef<string | null>(null);
  const initialCountryAssignedRef = useRef(false);
  const countryEventsMapRef = useRef<MapLibreMap | null>(null);
  const countryTooltipRef = useRef<HTMLDivElement>(null);
  const basemapThemeRef = useRef<'light' | 'dark'>('light');
  const activeLayersRef = useRef<Set<string>>(new Set());
  const [location, setLocation] = useState<SelectedLocation>(pilots[0]);
  const [countryCollection, setCountryCollection] = useState<CountryCollection | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState('');
  const [sourceId, setSourceId] = useState<SourceId>('power');
  const [variable, setVariable] = useState('T2M');
  const [pointStart, setPointStart] = useState(dateOffset(-7));
  const [pointEnd, setPointEnd] = useState(dateOffset(-1));
  const [dataState, setDataState] = useState<DataState>(emptyDataState('loading', 'Requesting NASA POWER observations.'));
  const [mapCatalog, setMapCatalog] = useState<MapCatalog | null>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapMessage, setMapMessage] = useState('Loading global map and country boundaries.');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('modis-ndvi');
  const [visibleLayerIds, setVisibleLayerIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [layersOpen, setLayersOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globeMode, setGlobeMode] = useState(true);
  const [mapStyleRevision, setMapStyleRevision] = useState(0);
  const [requestNumber, setRequestNumber] = useState(0);
  const { resolvedTheme } = useTheme();
  const resolvedThemeRef = useRef<'light' | 'dark'>(resolvedTheme === 'dark' ? 'dark' : 'light');
  resolvedThemeRef.current = resolvedTheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (!sharedHydrated) return;
    setLocation(sharedLocationValue);
    setPointStart(sharedPeriod.start);
    setPointEnd(sharedPeriod.end);
  }, [
    sharedHydrated,
    sharedLocationValue,
    sharedPeriod,
  ]);

  const updateLocation = useCallback((nextLocation: SelectedLocation) => {
    const confirmedLocation = { ...nextLocation, confirmed: true };
    setLocation(confirmedLocation);
    setSharedLocation(confirmedLocation);
  }, [setSharedLocation]);

  const updatePeriod = useCallback((start: string, end: string) => {
    setPointStart(start);
    setPointEnd(end);
    setSharedPeriod({ start, end });
  }, [setSharedPeriod]);

  const selectedSource = sourceById[sourceId];
  const layers = mapCatalog?.layers ?? [];
  const selectedMapLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const displayPointRows = dataState.result ? latestValueByVariable(dataState.result.observations) : [];
  const activeMapLayers = visibleLayerIds.flatMap((id) => {
    const layer = layers.find((item) => item.id === id);
    return layer && layer.available ? [layer] : [];
  });
  const assistantParams = new URLSearchParams({
    name: location.name,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start: pointStart,
    end: pointEnd,
  });

  const focusCountry = useCallback((country: SelectedCountry) => {
    const map = mapRef.current;
    if (!map) return;
    if (country.bounds[1][0] - country.bounds[0][0] > 300) {
      map.flyTo({ center: country.center, zoom: 3.4, duration: 900 });
      return;
    }
    map.fitBounds(country.bounds, {
      padding: { top: 100, bottom: 86, left: 70, right: 70 },
      maxZoom: 9,
      duration: 900,
    });
  }, []);

  const selectCountryFeature = useCallback((feature: CountryFeature, zoomToCountry = true, updatePoint = true) => {
    const country = countryFromFeature(feature);
    setSelectedCountry(country);
    if (updatePoint) {
      updateLocation({ name: country.name, latitude: country.center[1], longitude: country.center[0] });
    }
    if (zoomToCountry) focusCountry(country);
  }, [focusCountry, updateLocation]);

  const selectPilot = useCallback((pilot: SelectedLocation) => {
    const nigeria = countryCollectionRef.current?.features.find((feature) => feature.properties.ADM0_A3 === 'NGA');
    setSelectedCountry(nigeria ? countryFromFeature(nigeria) : null);
    updateLocation(pilot);
    mapRef.current?.flyTo({ center: [pilot.longitude, pilot.latitude], zoom: 7, duration: 900 });
    setSearchText('');
    setSearchResults([]);
  }, [updateLocation]);

  useEffect(() => {
    let cancelled = false;
    let localMap: MapLibreMap | null = null;
    const activeLayerIds = activeLayersRef.current;

    async function initializeMap() {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !mapContainerRef.current) return;
        const initialTheme = resolvedThemeRef.current;
        basemapThemeRef.current = initialTheme;
        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: basemapStyles[initialTheme],
          center: [12, 11],
          zoom: 2.3,
          pitch: 0,
          maxPitch: 60,
          minZoom: 0.5,
          maxZoom: 12,
          renderWorldCopies: false,
          attributionControl: false,
          cooperativeGestures: true,
        });
        localMap = map;
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');
        map.on('style.load', () => {
          if (cancelled) return;
          map.setProjection({ type: 'globe' });
          hoveredCountryIdRef.current = null;
          hoveredPilotNameRef.current = null;
          setHoveredCountry('');
          setMapStatus('ready');
          setMapMessage('Global map ready. Country boundaries and labels are available.');
          setMapStyleRevision((revision) => revision + 1);
          map.resize();
        });
        map.on('error', (event) => {
          if (event.error && !cancelled) setMapMessage(`Map service: ${event.error.message}`);
        });

        void fetch('/api/earth/layers')
          .then(async (response) => {
            const catalog = (await response.json()) as MapCatalog;
            if (!response.ok || catalog.status !== 'success') throw new Error(catalog.message || 'NASA GIBS layer catalog is unavailable.');
            if (!cancelled) {
              setMapCatalog(catalog);
              setVisibleLayerIds(catalog.layers
                .filter((layer) => layer.visibleByDefault && layer.available)
                .map((layer) => layer.id));
            }
          })
          .catch((error: unknown) => {
            if (!cancelled) setMapMessage(error instanceof Error ? `NASA GIBS metadata unavailable: ${error.message}` : 'NASA GIBS metadata unavailable.');
          });
      } catch (error) {
        if (!cancelled) {
          setMapStatus('error');
          setMapMessage(error instanceof Error ? error.message : 'NASA GIBS could not be loaded.');
        }
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      localMap?.remove();
      mapRef.current = null;
      activeLayerIds.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/ne_10m_admin_0_countries.geojson')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Country boundaries returned HTTP ${response.status}.`);
        return response.json() as Promise<CountryCollection>;
      })
      .then((collection) => {
        if (cancelled) return;
        countryCollectionRef.current = collection;
        setCountryCollection(collection);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapStatus('error');
          setMapMessage(error instanceof Error ? error.message : 'Country boundaries could not be loaded.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!countryCollection || initialCountryAssignedRef.current) return;
    initialCountryAssignedRef.current = true;
    if (!pilots.some((pilot) => pilot.name === location.name)) return;
    const nigeria = countryCollection.features.find((feature) => feature.properties.ADM0_A3 === 'NGA');
    if (nigeria) setSelectedCountry(countryFromFeature(nigeria));
  }, [countryCollection, location.name]);

  useEffect(() => {
    const map = mapRef.current;
    const nextTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
    if (!map || basemapThemeRef.current === nextTheme) return;
    basemapThemeRef.current = nextTheme;
    map.setStyle(basemapStyles[nextTheme]);
  }, [resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !countryCollection || !map.isStyleLoaded()) return;
    const dark = resolvedTheme === 'dark';
    installCountryLayers(map, countryCollection, dark);
    if (selectedCountryIdRef.current) {
      map.setFeatureState({ source: 'country-boundaries', id: selectedCountryIdRef.current }, { selected: true });
      map.setFeatureState({ source: 'country-label-anchors', id: selectedCountryIdRef.current }, { selected: true });
    }
    if (pilots.some((pilot) => pilot.name === location.name)) {
      map.setFeatureState({ source: 'pilot-locations', id: location.name }, { selected: true });
    }

    const updateHover = (event: MapMouseEvent) => {
      const pilotFeature = map.getLayer('pilot-location-points')
        ? map.queryRenderedFeatures(event.point, { layers: ['pilot-location-points'] })[0]
        : undefined;
      if (pilotFeature) {
        const pilotName = pilotFeature.properties?.name as string | undefined;
        if (hoveredCountryIdRef.current) {
          if (map.getSource('country-boundaries')) {
            map.setFeatureState({ source: 'country-boundaries', id: hoveredCountryIdRef.current }, { hover: false });
          }
          if (map.getSource('country-label-anchors')) {
            map.setFeatureState({ source: 'country-label-anchors', id: hoveredCountryIdRef.current }, { hover: false });
          }
          hoveredCountryIdRef.current = null;
        }
        if (hoveredPilotNameRef.current !== pilotName) {
          if (hoveredPilotNameRef.current) {
            map.setFeatureState({ source: 'pilot-locations', id: hoveredPilotNameRef.current }, { hover: false });
          }
          hoveredPilotNameRef.current = pilotName ?? null;
          if (pilotName) map.setFeatureState({ source: 'pilot-locations', id: pilotName }, { hover: true });
          setHoveredCountry(pilotName ?? '');
        }
        if (countryTooltipRef.current) {
          countryTooltipRef.current.style.left = `${event.point.x}px`;
          countryTooltipRef.current.style.top = `${event.point.y}px`;
        }
        map.getCanvas().style.cursor = 'pointer';
        return;
      }

      if (hoveredPilotNameRef.current) {
        if (map.getSource('pilot-locations')) {
          map.setFeatureState({ source: 'pilot-locations', id: hoveredPilotNameRef.current }, { hover: false });
        }
        hoveredPilotNameRef.current = null;
        setHoveredCountry('');
      }
      const feature = map.getLayer('country-fill')
        ? map.queryRenderedFeatures(event.point, { layers: ['country-fill'] })[0]
        : undefined;
      const countryId = feature?.properties?.ADM0_A3 as string | undefined;
      if (hoveredCountryIdRef.current !== countryId) {
        if (hoveredCountryIdRef.current && map.getSource('country-boundaries')) {
          map.setFeatureState({ source: 'country-boundaries', id: hoveredCountryIdRef.current }, { hover: false });
        }
        if (hoveredCountryIdRef.current && map.getSource('country-label-anchors')) {
          map.setFeatureState({ source: 'country-label-anchors', id: hoveredCountryIdRef.current }, { hover: false });
        }
        hoveredCountryIdRef.current = countryId ?? null;
        if (countryId) {
          if (map.getSource('country-boundaries')) {
            map.setFeatureState({ source: 'country-boundaries', id: countryId }, { hover: true });
          }
          if (map.getSource('country-label-anchors')) {
            map.setFeatureState({ source: 'country-label-anchors', id: countryId }, { hover: true });
          }
        }
        setHoveredCountry(feature?.properties?.ADMIN as string || '');
      }
      if (countryTooltipRef.current) {
        countryTooltipRef.current.style.left = `${event.point.x}px`;
        countryTooltipRef.current.style.top = `${event.point.y}px`;
      }
      map.getCanvas().style.cursor = feature ? 'pointer' : '';
    };
    const clearHover = () => {
      if (hoveredCountryIdRef.current && map.getSource('country-boundaries')) {
        map.setFeatureState({ source: 'country-boundaries', id: hoveredCountryIdRef.current }, { hover: false });
      }
      if (hoveredCountryIdRef.current && map.getSource('country-label-anchors')) {
        map.setFeatureState({ source: 'country-label-anchors', id: hoveredCountryIdRef.current }, { hover: false });
      }
      if (hoveredPilotNameRef.current && map.getSource('pilot-locations')) {
        map.setFeatureState({ source: 'pilot-locations', id: hoveredPilotNameRef.current }, { hover: false });
      }
      hoveredCountryIdRef.current = null;
      hoveredPilotNameRef.current = null;
      setHoveredCountry('');
      map.getCanvas().style.cursor = '';
    };
    const selectFeatureAtPoint = (event: MapMouseEvent) => {
      const pilotFeature = map.getLayer('pilot-location-points')
        ? map.queryRenderedFeatures(event.point, { layers: ['pilot-location-points'] })[0]
        : undefined;
      if (pilotFeature) {
        const pilot = pilots.find((item) => item.name === pilotFeature.properties?.name);
        if (pilot) {
          selectPilot(pilot);
          return;
        }
      }
      const feature = map.queryRenderedFeatures(event.point, { layers: ['country-fill'] })[0];
      const countryId = feature?.properties?.ADM0_A3 as string | undefined;
      const countryFeature = countryCollectionRef.current?.features.find((item) => item.properties.ADM0_A3 === countryId);
      if (countryFeature) {
        selectCountryFeature(countryFeature);
        return;
      }
      setSelectedCountry(null);
      updateLocation({
        name: 'Map selection',
        latitude: Number(event.lngLat.lat.toFixed(5)),
        longitude: Number(event.lngLat.lng.toFixed(5)),
      });
    };

    if (countryEventsMapRef.current !== map) {
      map.on('mousemove', updateHover);
      map.on('mouseout', clearHover);
      map.on('click', selectFeatureAtPoint);
      countryEventsMapRef.current = map;
    }
  }, [countryCollection, location.name, mapStyleRevision, resolvedTheme, selectCountryFeature, selectPilot, updateLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const previousId = selectedCountryIdRef.current;
    const nextId = selectedCountry?.id ?? null;
    if (previousId !== nextId && previousId && map?.getSource('country-boundaries')) {
      map.setFeatureState({ source: 'country-boundaries', id: previousId }, { selected: false });
      map.setFeatureState({ source: 'country-label-anchors', id: previousId }, { selected: false });
    }
    selectedCountryIdRef.current = nextId;
    if (nextId && map?.getSource('country-boundaries')) {
      map.setFeatureState({ source: 'country-boundaries', id: nextId }, { selected: true });
      map.setFeatureState({ source: 'country-label-anchors', id: nextId }, { selected: true });
    }
    if (map?.getSource('pilot-locations')) {
      for (const pilot of pilots) {
        map.setFeatureState({ source: 'pilot-locations', id: pilot.name }, { selected: pilot.name === location.name });
      }
    }
  }, [location.name, mapStyleRevision, selectedCountry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapCatalog || !map.isStyleLoaded()) return;

    const wanted = new Set(activeMapLayers.map((layer) => layer.id));
    for (const layer of activeMapLayers) {
      const sourceKey = `nasa-${layer.id}`;
      const mapLayerKey = `raster-${layer.id}`;
      if (!map.getSource(sourceKey)) {
        map.addSource(sourceKey, {
          type: 'raster',
          tiles: [layer.wmsTileTemplate],
          tileSize: 256,
          attribution: layer.attribution,
        });
      }
      if (!map.getLayer(mapLayerKey)) {
        map.addLayer({
          id: mapLayerKey,
          type: 'raster',
          source: sourceKey,
          paint: {
            'raster-opacity': layer.sourceId === 'firms'
              ? 1
              : layer.sourceId === 'gpm'
                ? 0.62
                : layer.sourceId === 'modis'
                  ? 0.76
                  : 0.9,
            'raster-fade-duration': 250,
          },
        }, map.getLayer('country-fill') ? 'country-fill' : undefined);
      }
      activeLayersRef.current.add(layer.id);
    }

    for (const oldId of Array.from(activeLayersRef.current)) {
      if (wanted.has(oldId)) continue;
      const mapLayerKey = `raster-${oldId}`;
      const sourceKey = `nasa-${oldId}`;
      if (map.getLayer(mapLayerKey)) map.removeLayer(mapLayerKey);
      if (map.getSource(sourceKey)) map.removeSource(sourceKey);
      activeLayersRef.current.delete(oldId);
    }
  }, [activeMapLayers, mapCatalog, mapStyleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    markerRef.current?.remove();
    void import('maplibre-gl').then((maplibre) => {
      if (cancelled || mapRef.current !== map) return;
      const markerElement = document.createElement('div');
      markerElement.className = styles.locationMarker;
      markerElement.setAttribute('aria-label', `Selected location: ${location.name}`);
      const markerLabel = document.createElement('span');
      markerLabel.className = styles.locationMarkerLabel;
      markerLabel.textContent = location.name;
      const markerPin = document.createElement('span');
      markerPin.className = styles.locationMarkerPin;
      markerElement.append(markerLabel, markerPin);
      markerRef.current = new maplibre.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
    });
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [location, mapStyleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setProjection({ type: globeMode ? 'globe' : 'mercator' });
  }, [globeMode]);

  useEffect(() => {
    if (searchText.trim().length < 2) {
      setSearchResults([]);
      setSearchError('');
      return;
    }
    let cancelled = false;
    const query = searchText.trim().toLocaleLowerCase();
    const countryCodeQuery = query.toLocaleUpperCase();
    const localCountries = (countryCollection?.features ?? [])
      .filter((feature) => feature.properties.ADMIN.toLocaleLowerCase().includes(query)
        || feature.properties.ISO_A2.toLocaleUpperCase() === countryCodeQuery
        || feature.properties.ISO_A3_EH.toLocaleUpperCase() === countryCodeQuery)
      .sort((left, right) => {
        const codeMatch = (feature: CountryFeature) => Number(
          feature.properties.ISO_A2.toLocaleUpperCase() === countryCodeQuery
          || feature.properties.ISO_A3_EH.toLocaleUpperCase() === countryCodeQuery,
        );
        return codeMatch(right) - codeMatch(left);
      })
      .slice(0, 4)
      .map((feature): SearchResult => {
        const country = countryFromFeature(feature);
        return {
          id: `country-${country.id}`,
          name: country.name,
          displayName: `${country.continent} · ${country.iso2}`,
          latitude: country.center[1],
          longitude: country.center[0],
          resultType: 'Country',
          countryCode: country.iso2,
        };
      });
    setSearchResults(localCountries);
    setSearchLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/earth/geocode?q=${encodeURIComponent(searchText.trim())}`, { signal: controller.signal });
        const body = (await response.json()) as { results?: SearchResult[]; message?: string };
        if (!response.ok) throw new Error(body.message || 'Location search failed.');
        if (!cancelled) {
          const remoteResults = (body.results ?? []).filter((result) =>
            !localCountries.some((country) => country.name.toLocaleLowerCase() === result.name.toLocaleLowerCase()),
          );
          setSearchResults([...localCountries, ...remoteResults].slice(0, 8));
          setSearchError('');
        }
      } catch (error) {
        if (!cancelled) setSearchError(error instanceof Error ? error.message : 'Location search failed.');
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 1000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [countryCollection, searchText]);

  useEffect(() => {
    let cancelled = false;
    setDataState(emptyDataState('loading', `Requesting ${sourceById[sourceId].name} observations.`));

    async function retrievePointData() {
      let taskId: string | undefined;
      for (let attempt = 0; attempt < 18; attempt += 1) {
        try {
          const response = await fetch('/api/earth/observations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceId,
              latitude: location.latitude,
              longitude: location.longitude,
              startDate: pointStart,
              endDate: pointEnd,
              variable,
              taskId,
            }),
          });
          const body = (await response.json()) as ObservationResult & { message?: string; status: string; taskId?: string };
          if (!response.ok) {
            const errorStatus = body.status === 'credentials_required' || body.status === 'agreement_required'
              ? body.status
              : 'error';
            if (!cancelled) setDataState(emptyDataState(errorStatus, body.message || `Data request returned HTTP ${response.status}.`));
            return;
          }
          if (body.status === 'processing' && body.taskId) {
            taskId = body.taskId;
            if (!cancelled) setDataState({ status: 'processing', message: body.message, taskId });
            await new Promise((resolve) => window.setTimeout(resolve, 2500));
            continue;
          }
          if (!cancelled) setDataState({ status: body.status as SourceState, message: body.message, result: body, taskId });
          return;
        } catch {
          if (!cancelled) setDataState(emptyDataState('error', 'Network request failed. Check your connection and retry.'));
          return;
        }
      }
      if (!cancelled) setDataState(emptyDataState('processing', 'NASA AppEEARS is still processing. Retry this location shortly.'));
    }

    void retrievePointData();
    return () => {
      cancelled = true;
    };
  }, [sourceId, variable, location, pointStart, pointEnd, requestNumber]);

  function setObservationSource(nextSource: SourceId, nextVariable = pointDefaults[nextSource]) {
    setSourceId(nextSource);
    setVariable(nextVariable);
    if (nextSource === 'firms' && pointStart < shiftDate(pointEnd, -4)) {
      updatePeriod(shiftDate(pointEnd, -4), pointEnd);
    }
  }

  function chooseSource(nextSource: SourceId, nextVariable = pointDefaults[nextSource]) {
    setObservationSource(nextSource, nextVariable);
    setSearchText('');
    setSearchResults([]);
  }

  function selectMapLayer(layer: MapLayer, visible: boolean) {
    setSelectedLayerId(layer.id);
    const nextSource = layer.sourceId === 'base' ? 'power' : layer.sourceId;
    setObservationSource(nextSource, layer.sourceId === 'smap'
      ? layer.id === 'smap-rootzone' ? 'rootzone' : 'surface'
      : pointDefaults[nextSource]);
    setVisibleLayerIds((current) => visible
      ? Array.from(new Set([...current, layer.id]))
      : current.filter((id) => id !== layer.id));
    setLayersOpen(false);
  }

  function selectSearchResult(result: SearchResult) {
    const countryFeature = countryCollectionRef.current?.features.find((feature) =>
      feature.properties.ISO_A2.toLocaleUpperCase() === result.countryCode?.toLocaleUpperCase()
      || feature.properties.ISO_A3_EH.toLocaleUpperCase() === result.countryCode?.toLocaleUpperCase()
      || feature.properties.ADMIN.toLocaleLowerCase() === result.name.toLocaleLowerCase(),
    );
    if (result.resultType === 'Country' && countryFeature) {
      selectCountryFeature(countryFeature);
    } else {
      setSelectedCountry(countryFeature ? countryFromFeature(countryFeature) : null);
      updateLocation({ name: result.name, latitude: result.latitude, longitude: result.longitude, region: result.regionName });
      const map = mapRef.current;
      if (map && result.bounds) {
        map.fitBounds([[result.bounds[0], result.bounds[1]], [result.bounds[2], result.bounds[3]]], {
          padding: { top: 100, bottom: 86, left: 70, right: 70 },
          maxZoom: 9,
          duration: 1000,
        });
      } else if (map) {
        map.flyTo({ center: [result.longitude, result.latitude], zoom: 7.5, duration: 1000 });
      }
    }
    setSearchText('');
    setSearchResults([]);
  }

  function mapZoom(direction: 1 | -1) {
    const map = mapRef.current;
    if (map) map.zoomTo(map.getZoom() + direction, { duration: 250 });
  }

  function locatePilot() {
    const map = mapRef.current;
    if (map) map.flyTo({ center: [location.longitude, location.latitude], zoom: 7, duration: 800 });
  }

  function showWorld() {
    setSelectedCountry(null);
    mapRef.current?.flyTo({ center: [8, 18], zoom: 0.7, pitch: 0, duration: 900 });
  }

  const sourceIcon = (id: SourceId | 'base') => {
    if (id === 'power') return Thermometer;
    if (id === 'gpm') return CloudRain;
    if (id === 'smap') return Droplets;
    if (id === 'modis') return Leaf;
    if (id === 'firms') return Flame;
    return Satellite;
  };

  function renderSourceGroup(id: SourceId) {
    const definition = sourceById[id];
    const Icon = sourceIcon(id);
    const groupLayers = layers.filter((layer) => layer.sourceId === id);
    const pointOnly = id === 'power';
    return (
      <section className={styles.sourceGroup} key={id}>
        <div className={styles.groupHeading}>
          <div className={styles.sourceTitle}>
            <Icon size={16} aria-hidden="true" />
            <span>{definition.name}</span>
          </div>
          <span className={styles.availabilityDot} title={pointOnly ? 'Live point API' : 'NASA GIBS map layer available'} />
        </div>
        <p className={styles.groupMeta}>{sourceDescriptions[id]}</p>
        {pointOnly ? (
          <div className={styles.pointLayerList}>
            {POWER_PARAMETERS.map((parameter) => (
              <button
                className={`${styles.pointLayer} ${sourceId === id && variable === parameter ? styles.pointLayerActive : ''}`}
                key={parameter}
                onClick={() => chooseSource('power', parameter)}
                type="button"
              >
                <span>{powerLabels[parameter]}</span>
                <small>{sourceById.power.variables.find((item) => item.id === parameter)?.unit}</small>
              </button>
            ))}
            <p className={styles.rasterNote}>NASA POWER is a gridded point-data API, not a global raster map layer.</p>
          </div>
        ) : (
          <div className={styles.mapLayerList}>
            {groupLayers.map((layer) => {
              const isActive = selectedLayerId === layer.id;
              const visible = visibleLayerIds.includes(layer.id);
              return (
                <div className={`${styles.mapLayerRow} ${isActive ? styles.mapLayerRowActive : ''}`} key={layer.id}>
                  <button
                    aria-label={`${visible ? 'Hide' : 'Show'} ${layer.label} map layer`}
                    aria-pressed={visible}
                    className={`${styles.layerSwitch} ${visible ? styles.layerSwitchOn : ''}`}
                    onClick={() => selectMapLayer(layer, !visible)}
                    type="button"
                  >
                    {visible && <Check size={11} />}
                  </button>
                  <button className={styles.layerName} onClick={() => selectMapLayer(layer, visible || layer.visibleByDefault)} type="button">
                    <span>{layer.label}</span>
                    <small>{layer.unit}</small>
                  </button>
                  <span aria-hidden="true" className={`${styles.layerSwatch} ${layerSwatchClasses[layer.sourceId]}`} />
                </div>
              );
            })}
            {!groupLayers.length && <p className={styles.unavailableNote}>No map layer is registered for this source.</p>}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={styles.explorerPage}>
      <header className={styles.topbar}>
        <Link aria-label="AgriShif AI home" className={styles.brand} href="/">
          <Image alt="" className={`${styles.brandMark} brand-logo`} height={48} src="/logo.png" width={66} />
          <span className={styles.brandText}>AgriShif AI</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Product navigation">
          <Link className={styles.navActive} href="/explorer"><Globe2 size={16} aria-hidden="true" />Explore Earth</Link>
          <Link href="/assistant"><Activity size={16} aria-hidden="true" />Intelligence</Link>
          <Link href="/layers"><Layers3 size={16} aria-hidden="true" />Environmental Data</Link>
          <Link href="/#about"><Info size={16} aria-hidden="true" />About</Link>
        </nav>
        <div className={styles.topbarRight}>
          <div className={styles.searchWrap}>
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search a location"
              autoComplete="off"
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchResults[0]) selectSearchResult(searchResults[0]);
                if (event.key === 'Escape') { setSearchText(''); setSearchResults([]); }
              }}
              placeholder="Search countries, cities, or places"
              value={searchText}
            />
            {searchLoading && <LoaderCircle className={styles.spin} size={15} aria-label="Searching" />}
            {searchText && <button aria-label="Clear search" onClick={() => { setSearchText(''); setSearchResults([]); }} type="button"><X size={14} /></button>}
            {searchText.trim().length >= 2 && (
              <div className={styles.searchResults}>
                {searchResults.map((result) => (
                  <button key={result.id} onClick={() => selectSearchResult(result)} type="button">
                    <MapPin size={15} />
                    <span>
                      <b>{result.name}</b>
                      <small className={styles.searchResultType}>{result.resultType}{result.countryCode ? ` · ${result.countryCode}` : ''}</small>
                      <small>{result.displayName}</small>
                    </span>
                  </button>
                ))}
                {!searchLoading && !searchError && !searchResults.length && <p>No matching countries or places found.</p>}
                {searchError && <p>{searchError}</p>}
                {searchLoading && <p>Searching countries and places…</p>}
                <small className={styles.searchAttribution}>Country boundaries: Natural Earth · Places: OpenStreetMap Nominatim</small>
              </div>
            )}
          </div>
          <ThemeToggle />
          <button aria-label="Toggle navigation" className={styles.mobileMenuButton} onClick={() => setMobileNavOpen((open) => !open)} type="button">
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {mobileNavOpen && (
          <nav className={styles.mobileNav} aria-label="Mobile product navigation">
            <Link href="/explorer" onClick={() => setMobileNavOpen(false)}>Explore Earth</Link>
            <Link href="/assistant" onClick={() => setMobileNavOpen(false)}>Intelligence</Link>
            <Link href="/layers" onClick={() => setMobileNavOpen(false)}>Environmental Data</Link>
            <Link href="/#about" onClick={() => setMobileNavOpen(false)}>About</Link>
          </nav>
        )}
      </header>

      <main className={styles.explorerLayout}>
        <aside aria-label="Earth observation layers" className={`${styles.layerRail} ${layersOpen ? styles.layerRailOpen : ''}`}>
          <div className={styles.railHeader}>
            <div><span className={styles.eyebrow}>Explore Earth</span><h1>Earth Explorer</h1></div>
            <button aria-label="Close layer panel" className={styles.closeLayers} onClick={() => setLayersOpen(false)} type="button"><X size={18} /></button>
          </div>

          <div className={styles.railSummary}>
            <span className={styles.livePulse} />
            <span>Multi-source observation</span>
            <button aria-label="Source details" title="Each layer shows its own product period and resolution"><Activity size={15} /></button>
          </div>

          <div className={styles.layerList}>
            <section className={styles.sourceGroup}>
              <div className={styles.groupHeading}>
                <div className={styles.sourceTitle}><Satellite size={16} /><span>NASA imagery overlay</span></div>
                <span className={styles.availabilityDot} title="NASA GIBS imagery" />
              </div>
              {layers.filter((layer) => layer.id === 'base').map((layer) => (
                <div className={`${styles.mapLayerRow} ${selectedLayerId === layer.id ? styles.mapLayerRowActive : ''}`} key={layer.id}>
                    <button aria-label={`${visibleLayerIds.includes(layer.id) ? 'Hide' : 'Show'} NASA satellite imagery`} aria-pressed={visibleLayerIds.includes(layer.id)} className={`${styles.layerSwitch} ${visibleLayerIds.includes(layer.id) ? styles.layerSwitchOn : ''}`} onClick={() => selectMapLayer(layer, !visibleLayerIds.includes(layer.id))} type="button">
                    {visibleLayerIds.includes(layer.id) && <Check size={11} />}
                  </button>
                    <button className={styles.layerName} onClick={() => selectMapLayer(layer, true)} type="button"><span>{layer.label}</span><small>{layer.observationDate || 'Latest browse imagery'} · optional overlay</small></button>
                </div>
              ))}
            </section>
            {renderSourceGroup('power')}
            {renderSourceGroup('gpm')}
            {renderSourceGroup('smap')}
            {renderSourceGroup('modis')}
            {renderSourceGroup('firms')}
          </div>

          <div className={styles.railFooter}>
            <Layers3 size={15} />
            <span>Map: CARTO and OpenStreetMap. NASA GIBS imagery is optional; point observations keep their own period and resolution.</span>
          </div>
        </aside>

        <section aria-label="Interactive Earth map" className={styles.mapStage}>
          <div className={styles.mapCanvas} ref={mapContainerRef} />
          <div className={styles.mapTopline}>
            <div className={styles.locationChip}><MapPin size={14} /><span>{location.name}</span><i /></div>
            <div className={styles.layerPill}><span>Active layer</span><strong>{selectedMapLayer?.label ?? 'Reference layer'}</strong></div>
            <span className={styles.coordinates}>{formatCoordinate(location.latitude, 'N', 'S')} · {formatCoordinate(location.longitude, 'E', 'W')}</span>
          </div>

          <nav aria-label="Geographic context" className={styles.geographyBreadcrumb}>
            <button onClick={showWorld} type="button">World</button>
            {selectedCountry && <>
              <span aria-hidden="true">/</span>
              <button onClick={() => {
                const continentFeatures = countryCollection?.features.filter((feature) => feature.properties.CONTINENT === selectedCountry.continent) ?? [];
                const bounds = continentFeatures.map(featureBounds).reduce((current, next) => [
                  [Math.min(current[0][0], next[0][0]), Math.min(current[0][1], next[0][1])],
                  [Math.max(current[1][0], next[1][0]), Math.max(current[1][1], next[1][1])],
                ] as [[number, number], [number, number]], [[Infinity, Infinity], [-Infinity, -Infinity]]);
                mapRef.current?.fitBounds(bounds, { padding: 70, maxZoom: 3.2, duration: 850 });
              }} type="button">{selectedCountry.continent}</button>
              <span aria-hidden="true">/</span>
              <button onClick={() => focusCountry(selectedCountry)} type="button">{selectedCountry.name}</button>
              {location.region && <>
                <span aria-hidden="true">/</span>
                <button onClick={() => mapRef.current?.flyTo({ center: [location.longitude, location.latitude], zoom: 5.2, duration: 850 })} type="button">{location.region}</button>
              </>}
              {location.name !== selectedCountry.name && <>
                <span aria-hidden="true">/</span>
                <button onClick={locatePilot} type="button">{location.name}</button>
              </>}
            </>}
          </nav>

          {hoveredCountry && (
            <div className={styles.countryTooltip} ref={countryTooltipRef}>
              {hoveredCountry}
            </div>
          )}

          <button aria-expanded={layersOpen} className={styles.mobileLayerButton} onClick={() => setLayersOpen((open) => !open)} type="button">
            <Layers3 size={16} /> Layers <ChevronDown size={14} />
          </button>

          <div className={styles.mapToolRail}>
            <button aria-label={globeMode ? 'Switch to flat map' : 'Switch to 3D globe'} className={styles.mapModeButton} onClick={() => setGlobeMode((current) => !current)} title={globeMode ? '3D globe' : 'Flat map'} type="button"><Globe2 size={16} /><span>{globeMode ? '3D' : '2D'}</span></button>
            <button aria-label="Zoom in" onClick={() => mapZoom(1)} type="button"><Plus size={17} /></button>
            <button aria-label="Zoom out" onClick={() => mapZoom(-1)} type="button"><Minus size={17} /></button>
            <button aria-label="Center selected location" onClick={locatePilot} type="button"><Crosshair size={16} /></button>
          </div>

          {mapStatus === 'loading' && <div className={styles.mapLoading}><LoaderCircle className={styles.spin} size={18} /><span>{mapMessage}</span></div>}
          {mapStatus === 'error' && <div className={styles.mapError}><AlertCircle size={17} /><span>{mapMessage}</span><button onClick={() => window.location.reload()} type="button">Retry</button></div>}
          {mapStatus === 'ready' && mapMessage.startsWith('Map service:') && <div className={styles.mapWarning}><AlertCircle size={14} />{mapMessage}</div>}

          <div className={styles.mapAttribution}>
            © OpenStreetMap contributors · © CARTO · Natural Earth{activeMapLayers.length ? ` · NASA EOSDIS GIBS ${activeMapLayers.map((layer) => layer.sourceId.toUpperCase()).join(' + ')}` : ''}
          </div>
        </section>

        <aside aria-label="Selected location information" className={styles.inspector}>
          <div className={styles.inspectorHead}>
            <div><span className={styles.eyebrow}>Selected location</span><h2>{location.name}</h2></div>
            <span className={styles.selectedPin}><MapPin size={16} /></span>
          </div>
          <div className={styles.coordinateCard}>
            <div><span>Latitude</span><b>{location.latitude.toFixed(4)}°</b></div>
            <div><span>Longitude</span><b>{location.longitude.toFixed(4)}°</b></div>
          </div>
          <Link
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            href={`/assistant?${assistantParams.toString()}`}
          >
            Ask AgriShif AI
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>

          {selectedCountry && (
            <section aria-label="Selected country details" className={styles.countryCard}>
              <div className={styles.sectionHeading}>
                <span>Country context</span>
                <button aria-label="Clear selected country" className={styles.clearCountry} onClick={() => setSelectedCountry(null)} type="button"><X size={14} /></button>
              </div>
              <h3>{selectedCountry.name}</h3>
              <div className={styles.countryFacts}>
                <span><small>ISO alpha-2</small><b>{selectedCountry.iso2 !== '-99' ? selectedCountry.iso2 : 'Not assigned'}</b></span>
                <span><small>ISO alpha-3</small><b>{selectedCountry.iso3 !== '-99' ? selectedCountry.iso3 : 'Not assigned'}</b></span>
                <span><small>Continent</small><b>{selectedCountry.continent}</b></span>
              </div>
              <p>Environmental observations below are point-based, not country averages.</p>
            </section>
          )}

          <section className={styles.pilotSection}>
            <div className={styles.sectionHeading}><span>Pilot locations</span><span>Nigeria</span></div>
            <div className={styles.pilotChips}>
              {pilots.map((pilot) => <button className={location.name === pilot.name ? styles.pilotActive : ''} key={pilot.name} onClick={() => selectPilot(pilot)} type="button">{pilot.name}</button>)}
            </div>
          </section>

          <section className={styles.observationSection}>
            <div className={styles.sectionHeading}><span>Point observations</span><button aria-label="Refresh observations" className={styles.iconButton} onClick={() => setRequestNumber((number) => number + 1)} type="button"><Activity size={14} /></button></div>
            <div className={styles.selectedSourceLine}>
              <span className={styles.sourceMiniIcon}>{(() => { const Icon = sourceIcon(sourceId); return <Icon size={15} />; })()}</span>
              <span><b>{selectedSource.name}</b><small>{selectedSource.productId}</small></span>
            </div>

            <div className={styles.dataSummaryCard}>
              <span>Selected map layer</span>
              <strong>{selectedMapLayer?.label ?? selectedSource.name}</strong>
              <small>{selectedMapLayer?.description ?? sourceDescriptions[sourceId]}</small>
            </div>

            <div className={styles.periodControls}>
              <label><CalendarDays size={13} /><span>From</span><input
                aria-label="Observation start date"
                min={sourceId === 'firms' ? shiftDate(pointEnd, -4) : undefined}
                max={pointEnd}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  let nextEnd = pointEnd;
                  if (sourceId === 'firms' && pointEnd > shiftDate(nextStart, 4)) {
                    nextEnd = earlierDate(dateOffset(0), shiftDate(nextStart, 4));
                  }
                  updatePeriod(nextStart, nextEnd);
                }}
                type="date"
                value={pointStart}
              /></label>
              <label><CalendarDays size={13} /><span>To</span><input
                aria-label="Observation end date"
                min={pointStart}
                max={sourceId === 'firms' ? earlierDate(dateOffset(0), shiftDate(pointStart, 4)) : dateOffset(0)}
                onChange={(event) => {
                  const nextEnd = event.target.value;
                  let nextStart = pointStart;
                  if (sourceId === 'firms' && pointStart < shiftDate(nextEnd, -4)) {
                    nextStart = laterDate(dateOffset(-365), shiftDate(nextEnd, -4));
                  }
                  updatePeriod(nextStart, nextEnd);
                }}
                type="date"
                value={pointEnd}
              /></label>
            </div>

            {dataState.status === 'loading' || dataState.status === 'processing' ? (
              <div className={styles.dataState}><LoaderCircle className={styles.spin} size={17} /><span>{dataState.message || 'Loading source observations...'}</span></div>
            ) : dataState.status === 'credentials_required' ? (
              <div className={styles.dataStateAlert}>
                <AlertCircle size={17} />
                <div><b>Credentials required</b><p>{dataState.message}</p><small>Credentials are read by server routes only; they are never sent to the browser.</small></div>
              </div>
            ) : dataState.status === 'agreement_required' ? (
              <div className={styles.dataStateAlert}>
                <AlertCircle size={17} />
                <div><b>Data-use agreement required</b><p>{dataState.message}</p><button onClick={() => setRequestNumber((number) => number + 1)} type="button">Retry request</button></div>
              </div>
            ) : dataState.status === 'error' ? (
              <div className={styles.dataStateAlert}><AlertCircle size={17} /><div><b>Source unavailable</b><p>{dataState.message}</p><button onClick={() => setRequestNumber((number) => number + 1)} type="button">Retry request</button></div></div>
            ) : dataState.status === 'empty' ? (
              <div className={styles.dataStateEmpty}>
                <span>No observations were returned for this location and date range.</span>
                <small>Try a wider period or switch to a dataset that matches the selected layer.</small>
              </div>
            ) : (
              <div className={styles.observationList}>
                {displayPointRows.map((observation) => (
                  <article className={styles.observationRow} key={`${observation.variable}-${observation.observationTime}`}>
                    <div><span>{powerLabels[observation.variable] || observation.variable}</span><small>{observation.observationTime}{observation.qualityFlags?.length ? ` · ${observation.qualityFlags.join(', ')}` : ''}</small></div>
                    <b>{observation.value === null ? 'No data' : typeof observation.value === 'number' ? observation.value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : observation.value}<small>{observation.unit}</small></b>
                  </article>
                ))}
                <div className={styles.successNote}><Check size={13} /> Retrieved from {selectedSource.name}</div>
              </div>
            )}

            {dataState.result && (
              <div className={styles.provenance}>
                <div><span>Observation period</span><b>{dataState.result.period.start} to {dataState.result.period.end}</b></div>
                <div><span>Spatial resolution</span><b>{dataState.result.spatialResolution}</b></div>
                <div><span>Retrieved</span><b>{new Date(dataState.result.retrievedAt).toLocaleString()}</b></div>
                <a href={sourceDocs[sourceId]} rel="noreferrer" target="_blank">Source and methods <ArrowUpRight size={13} /></a>
              </div>
            )}
          </section>

          <section className={styles.mapLayerInfo}>
            <div className={styles.sectionHeading}><span>Map layer</span><span className={styles.dataBadge}>NASA GIBS</span></div>
            {selectedMapLayer ? (
              <>
                <h3>{selectedMapLayer.label}</h3>
                <p>{selectedMapLayer.description}</p>
                <div className={styles.mapMeta}><span>Map observation</span><b>{selectedMapLayer.observationDate || 'Latest date not supplied'}</b></div>
                <div className={styles.mapMeta}><span>Product period</span><b>{selectedMapLayer.temporalResolution}</b></div>
                <div className={styles.mapMeta}><span>Spatial resolution</span><b>{selectedMapLayer.spatialResolution}</b></div>
                <div className={styles.mapMeta}><span>Legend units</span><b>{selectedMapLayer.unit}</b></div>
                <div className={styles.layerLegendPreview}>
                  <span>Layer palette</span>
                  <i aria-hidden="true" className={`${styles.layerSwatch} ${layerSwatchClasses[selectedMapLayer.sourceId]}`} />
                </div>
                <p className={styles.layerCitation}>{selectedMapLayer.attribution}</p>
                {selectedMapLayer.sourceId !== 'base' && (
                  <p className={styles.periodNote}>Map tiles use their own NASA GIBS observation time. The point series above uses the selected date range and a separate point-data product.</p>
                )}
              </>
            ) : (
              <p className={styles.layerCitation}>Loading official NASA layer metadata.</p>
            )}
          </section>

          <div className={styles.sourceFooter}>
            <div className={styles.nasaAttribution}>
              <Image alt="NASA" height={34} src="/nasa-logo.svg" width={41} />
              <span>NASA Earth observation data<small>NASA does not endorse AgriShif.</small></span>
            </div>
            <Link href="/">Back to AgriShif AI</Link>
          </div>
        </aside>

        {layersOpen && <button aria-label="Close layer panel backdrop" className={styles.mobileBackdrop} onClick={() => setLayersOpen(false)} type="button" />}
      </main>
    </div>
  );
}
