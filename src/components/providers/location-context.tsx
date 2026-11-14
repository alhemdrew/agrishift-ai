'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface SharedLocation {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
  confirmed: boolean;
}

export interface SharedPeriod {
  start: string;
  end: string;
}

interface LocationContextValue {
  location: SharedLocation;
  period: SharedPeriod;
  hydrated: boolean;
  setLocation: (location: SharedLocation) => void;
  setPeriod: (period: SharedPeriod) => void;
}

const storageKey = 'phantomgreen-session-context';
const defaultLocation: SharedLocation = {
  name: 'Kaduna',
  latitude: 10.5225,
  longitude: 7.4389,
  region: 'Kaduna State',
  confirmed: false,
};

function dayOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidLocation(value: unknown): value is SharedLocation {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string'
    && record.name.length > 0
    && record.name.length <= 120
    && typeof record.latitude === 'number'
    && Number.isFinite(record.latitude)
    && record.latitude >= -90
    && record.latitude <= 90
    && typeof record.longitude === 'number'
    && Number.isFinite(record.longitude)
    && record.longitude >= -180
    && record.longitude <= 180
    && typeof record.confirmed === 'boolean'
    && (record.region === undefined || typeof record.region === 'string');
}

function isValidPeriod(value: unknown): value is SharedPeriod {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.start === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.start)
    && typeof record.end === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.end)
    && record.start <= record.end;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationContextProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState(defaultLocation);
  const [period, setPeriodState] = useState<SharedPeriod>({
    start: dayOffset(-7),
    end: dayOffset(-1),
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          if (isValidLocation(record.location)) setLocationState(record.location);
          if (isValidPeriod(record.period)) setPeriodState(record.period);
        }
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify({ location, period }));
  }, [hydrated, location, period]);

  const setLocation = useCallback((nextLocation: SharedLocation) => {
    setLocationState(nextLocation);
  }, []);
  const setPeriod = useCallback((nextPeriod: SharedPeriod) => {
    setPeriodState(nextPeriod);
  }, []);
  const value = useMemo(() => ({
    location,
    period,
    hydrated,
    setLocation,
    setPeriod,
  }), [location, period, hydrated, setLocation, setPeriod]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationContext must be used inside LocationContextProvider.');
  return context;
}
