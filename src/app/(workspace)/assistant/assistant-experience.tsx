'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocationContext, type SharedLocation, type SharedPeriod } from '@/components/providers/location-context';
import type { SourceId } from '@/lib/earth-data/types';

import assistantGuide from '../../../../ux/Agrishif AI Explores Earth (0.75x).gif';
import styles from './assistant.module.css';

interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface EvidenceItem {
  source_id: SourceId;
  dataset: string;
  product_id: string;
  variable: string;
  value: number | string;
  unit: string;
  observation_time: string;
  observation_coordinates: { latitude: number; longitude: number };
  spatial_resolution: string;
  quality_flags: string[];
  provenance: string;
}

interface SourceStatus {
  source_id: SourceId;
  dataset?: string;
  product_id?: string;
  spatial_resolution?: string;
  availability: string;
  retrieval_status: string;
  observation_count: number;
  valid_observation_count: number;
  missing_observation_count: number;
  model_observation_count?: number;
  error_http_status?: number | null;
  error_message?: string | null;
}

interface EvidenceSummary {
  source_id: SourceId;
  product_id: string;
  variable: string;
  unit: string;
  observation_coordinates: { latitude: number; longitude: number };
  observation_count: number;
  first_observation_time: string;
  last_observation_time: string;
  minimum?: number;
  maximum?: number;
  arithmetic_mean?: number;
  latest_value: number | string;
  latest_observation_time: string;
}

interface AssistantResult {
  answer: string;
  evidence: EvidenceItem[];
  evidence_summary?: EvidenceSummary[];
  limitations: string[];
  sources_used: SourceId[];
  source_statuses: SourceStatus[];
  generated_at: string;
}

interface ChatMessage extends AssistantTurn {
  result?: AssistantResult;
}

interface LocationCandidate {
  id: string | number;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  resultType: string;
  countryCode?: string;
  regionName?: string;
}

const sourceNames: Record<SourceId, string> = {
  power: 'NASA POWER',
  gpm: 'NASA GPM IMERG',
  smap: 'NASA SMAP',
  modis: 'NASA MODIS',
  firms: 'NASA FIRMS',
  soilgrids: 'ISRIC SoilGrids',
  chirps: 'CHIRPS',
};

const starterQuestions = [
  'Check farming conditions in my area.',
  'Understand rainfall around my farm.',
  'Explore the health of vegetation.',
  'Find out what is happening around my land.',
];

const variableLabels: Record<string, string> = {
  T2M: 'Average air temperature',
  T2M_MAX: 'Daily high temperature',
  T2M_MIN: 'Daily low temperature',
  PRECTOTCORR: 'POWER estimated precipitation',
  RH2M: 'Relative humidity',
  ALLSKY_SFC_SW_DWN: 'Solar radiation',
  NDVI: 'Vegetation greenness (NDVI)',
  EVI: 'Enhanced vegetation index (EVI)',
  precipitation: 'GPM precipitation',
  sm_surface: 'Surface soil moisture',
  sm_rootzone: 'Root-zone soil moisture',
  brightness: 'Fire detection brightness',
  frp: 'Fire radiative power',
  confidence: 'Fire detection confidence',
};

function dayOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isEvidenceSummary(value: unknown): value is EvidenceSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  const coordinates = summary.observation_coordinates;
  return typeof summary.source_id === 'string'
    && summary.source_id in sourceNames
    && typeof summary.product_id === 'string'
    && typeof summary.variable === 'string'
    && typeof summary.unit === 'string'
    && typeof coordinates === 'object'
    && coordinates !== null
    && 'latitude' in coordinates
    && typeof coordinates.latitude === 'number'
    && 'longitude' in coordinates
    && typeof coordinates.longitude === 'number'
    && typeof summary.observation_count === 'number'
    && Number.isFinite(summary.observation_count)
    && typeof summary.first_observation_time === 'string'
    && typeof summary.last_observation_time === 'string'
    && typeof summary.latest_observation_time === 'string'
    && (typeof summary.latest_value === 'string'
      || (typeof summary.latest_value === 'number' && Number.isFinite(summary.latest_value)))
    && (summary.minimum === undefined || (typeof summary.minimum === 'number' && Number.isFinite(summary.minimum)))
    && (summary.maximum === undefined || (typeof summary.maximum === 'number' && Number.isFinite(summary.maximum)))
    && (summary.arithmetic_mean === undefined
      || (typeof summary.arithmetic_mean === 'number' && Number.isFinite(summary.arithmetic_mean)));
}

function isAssistantResult(value: unknown): value is AssistantResult {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return typeof response.answer === 'string'
    && Array.isArray(response.evidence)
    && Array.isArray(response.limitations)
    && Array.isArray(response.sources_used)
    && Array.isArray(response.source_statuses)
    && (response.evidence_summary === undefined
      || (Array.isArray(response.evidence_summary) && response.evidence_summary.every(isEvidenceSummary)))
    && typeof response.generated_at === 'string';
}

function samePlace(first: SharedLocation, second: LocationCandidate): boolean {
  return first.name.trim().toLocaleLowerCase() === second.name.trim().toLocaleLowerCase()
    && Math.abs(first.latitude - second.latitude) < 0.00001
    && Math.abs(first.longitude - second.longitude) < 0.00001;
}

function extractPlace(question: string): string | null {
  const match = question.match(/\b(?:in|around|near|at|from)\s+([^?.!,;]+)/i);
  const rawPlace = match?.[1]?.trim();
  if (!rawPlace || /^(?:my farm|my area|my land|here|this area|this location|the farm)\b/i.test(rawPlace)) return null;
  if (/^(?:mind\b|simple terms?\b|other words\b|this context\b|these (?:observations|readings|measurements|data)\b|the (?:observations|readings|measurements|data)\b|available (?:observations|readings|data)\b)/i.test(rawPlace)) return null;
  const place = rawPlace.replace(/^the\s+/i, '').trim();
  if (!place || place.length < 2 || place.length > 80) return null;
  if (/^(?:farm|area|land|here|this area|this location|farming|agriculture|today|this week)$/i.test(place)) {
    return null;
  }
  return place;
}

function formatObservationDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', dateStyle: 'medium' });
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function displayUnit(unit: string): string {
  if (unit === 'C') return '°C';
  if (unit === 'm^3/m^3') return 'm³/m³';
  return unit;
}

function displayValue(value: number | string): string {
  return typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : value;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    success: 'Measurements available',
    empty: 'No measurements for this period',
    processing: 'Still preparing observations',
    credentials_required: 'Server credentials required',
    agreement_required: 'Data-use agreement required',
    error: 'Temporarily unavailable',
    timeout: 'Taking too long to respond',
  };
  return labels[status] ?? 'Status not available';
}

function sourceFriendlyName(sourceId: SourceId): string {
  const labels: Record<SourceId, string> = {
    power: 'Weather',
    gpm: 'Rainfall',
    smap: 'Soil moisture',
    modis: 'Vegetation',
    firms: 'Fire activity',
    soilgrids: 'Soil properties',
    chirps: 'Rainfall pattern',
  };
  return labels[sourceId];
}

function friendlyAssistantError(status: string | null, message: string): string {
  if (status === 'configuration_error') return 'AgriShif AI is not ready to answer just now. Please try again later.';
  if (status === 'rate_limited') return 'We’re receiving lots of questions. Please wait a moment and try again.';
  if (status === 'timeout') return 'That took too long. Please try your question again.';
  if (status === 'provider_error' || status === 'observation_error') {
    return 'I couldn’t prepare an answer just now. Your question is safe to retry.';
  }
  return message;
}

function renderInline(text: string): React.ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return chunks.map((chunk, index) => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      return <code className="rounded bg-muted px-1 py-0.5 text-[0.92em]" key={index}>{chunk.slice(1, -1)}</code>;
    }
    return <span key={index}>{chunk}</span>;
  });
}

function AssistantAnswer({ answer }: { answer: string }) {
  const lines = answer.split(/\r?\n/);
  return (
    <div className={styles.answer}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line || /^[-*_]{3,}$/.test(line)) return null;
        if (line.startsWith('### ')) return <h3 key={index}>{renderInline(line.slice(4))}</h3>;
        if (line.startsWith('## ')) return <h3 key={index}>{renderInline(line.slice(3))}</h3>;
        if (/^[-*]\s+/.test(line)) return <ul key={index}><li>{renderInline(line.replace(/^[-*]\s+/, ''))}</li></ul>;
        if (/^\d+[.)]\s+/.test(line)) return <ul key={index}><li>{renderInline(line.replace(/^\d+[.)]\s+/, ''))}</li></ul>;
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function observationSentence(item: EvidenceItem): string {
  const measure = variableLabels[item.variable] ?? item.variable.replaceAll('_', ' ');
  const value = displayValue(item.value);
  const unit = displayUnit(item.unit);
  return `The recorded ${measure.toLocaleLowerCase()} was ${value}${unit ? ` ${unit}` : ''} on ${formatObservationDate(item.observation_time)}.`;
}

function buildExplorerHref(location: SharedLocation, period: SharedPeriod): string {
  const params = new URLSearchParams({
    name: location.name,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start: period.start,
    end: period.end,
  });
  return `/explorer?${params.toString()}`;
}

function locationKey(location: SharedLocation): string {
  return `${location.latitude}:${location.longitude}`;
}

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return false;
  if (message.role === 'user') return message.content.length <= 1_000;
  return message.content.length <= 12_000 && (!message.result || isAssistantResult(message.result));
}

export function AssistantExperience() {
  const {
    location: sharedLocation,
    period: sharedPeriod,
    hydrated,
    setLocation: setSharedLocation,
    setPeriod: setSharedPeriod,
  } = useLocationContext();
  const [location, setLocation] = useState<SharedLocation>(sharedLocation);
  const [period, setPeriod] = useState<SharedPeriod>(sharedPeriod);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [locationPrompt, setLocationPrompt] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [placeResults, setPlaceResults] = useState<LocationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<LocationCandidate | null>(null);
  const [placeError, setPlaceError] = useState('');
  const [placeLoading, setPlaceLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const initialContextApplied = useRef(false);
  const initialQuestionApplied = useRef(false);

  useEffect(() => {
    if (!hydrated || initialContextApplied.current) return;
    initialContextApplied.current = true;
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const latitude = Number(params.get('latitude'));
    const longitude = Number(params.get('longitude'));
    let nextLocation = sharedLocation;
    if (
      name
      && name.length <= 120
      && Number.isFinite(latitude)
      && latitude >= -90
      && latitude <= 90
      && Number.isFinite(longitude)
      && longitude >= -180
      && longitude <= 180
    ) {
      nextLocation = { name, latitude, longitude, confirmed: true };
      setLocation(nextLocation);
      setSharedLocation(nextLocation);
    } else {
      setLocation(sharedLocation);
    }

    const start = params.get('start');
    const end = params.get('end');
    const nextPeriod = isValidDate(start) && isValidDate(end) && start <= end
      ? { start, end }
      : sharedPeriod;
    setPeriod(nextPeriod);
    setSharedPeriod(nextPeriod);
    setContextReady(true);
  }, [hydrated, sharedLocation, sharedPeriod, setSharedLocation, setSharedPeriod]);

  useEffect(() => {
    if (!hydrated || !initialContextApplied.current) return;
    setLocation(sharedLocation);
    setPeriod(sharedPeriod);
  }, [hydrated, sharedLocation, sharedPeriod]);

  useEffect(() => {
    if (!contextReady || conversationReady) return;
    try {
      const saved = window.sessionStorage.getItem('phantomgreen-assistant-conversation');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          if (record.locationKey === locationKey(location) && Array.isArray(record.messages)) {
            setMessages(record.messages.filter(isStoredMessage).slice(-30));
          }
        }
      }
    } catch {
      window.sessionStorage.removeItem('phantomgreen-assistant-conversation');
    }
    setConversationReady(true);
  }, [contextReady, conversationReady, location]);

  useEffect(() => {
    if (!conversationReady) return;
    try {
      window.sessionStorage.setItem(
        'phantomgreen-assistant-conversation',
        JSON.stringify({ locationKey: locationKey(location), messages: messages.slice(-30) }),
      );
    } catch {
      setError('This browser could not save the conversation for this session.');
    }
  }, [conversationReady, location, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, locationPrompt, placeResults]);

  const previousHistory = useCallback((source: ChatMessage[]) =>
    source.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 800) })),
  []);

  const askAssistant = useCallback(async (
    text: string,
    history: AssistantTurn[],
    selectedLocation: SharedLocation,
    appendUser = true,
  ) => {
    setError('');
    setErrorDetail('');
    setLastQuestion(text);
    if (appendUser) setMessages((current) => [...current, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          location: {
            name: selectedLocation.name,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          },
          period,
          history,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
        const message = record && typeof record.message === 'string'
          ? record.message
          : 'The assistant could not complete this request.';
        const status = record && typeof record.status === 'string' ? record.status : null;
        setErrorDetail(record && typeof record.diagnostic === 'string'
          ? `${record.diagnostic}: ${message}`
          : message);
        throw new Error(friendlyAssistantError(status, message));
      }
      if (!isAssistantResult(payload)) throw new Error('The assistant returned an invalid response.');
      setMessages((current) => [...current, { role: 'assistant', content: payload.answer, result: payload }]);
      setLastQuestion('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant request failed.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const searchPlaces = useCallback(async (query: string) => {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setPlaceError('Enter a town, city, farm area, or region name.');
      setPlaceResults([]);
      return;
    }
    setPlaceLoading(true);
    setPlaceError('');
    setSelectedCandidate(null);
    try {
      const response = await fetch(`/api/earth/geocode?q=${encodeURIComponent(searchTerm)}`);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'message' in payload
          && typeof payload.message === 'string'
          ? payload.message
          : 'Location search is temporarily unavailable.';
        throw new Error(message);
      }
      const results = payload && typeof payload === 'object' && 'results' in payload
        && Array.isArray(payload.results)
        ? payload.results as LocationCandidate[]
        : [];
      setPlaceResults(results.filter((result) =>
        typeof result.name === 'string'
        && Number.isFinite(result.latitude)
        && Number.isFinite(result.longitude),
      ));
      if (results.length === 0) setPlaceError('No matching places found. Try adding a state, province, or country.');
    } catch (searchError) {
      setPlaceResults([]);
      setPlaceError(searchError instanceof Error ? searchError.message : 'Location search failed. Try again.');
    } finally {
      setPlaceLoading(false);
    }
  }, []);

  const chooseQuestion = useCallback(async (value: string) => {
    const text = value.trim();
    if (loading || text.length < 2) return;
    setQuestion('');
    setError('');
    const place = extractPlace(text);
    if (place && (!location.confirmed || place.toLocaleLowerCase() !== location.name.toLocaleLowerCase())) {
      setPendingQuestion(text);
      setLocationPrompt(true);
      setLocationSearch(place);
      setPlaceResults([]);
      setSelectedCandidate(null);
      await searchPlaces(place);
      return;
    }
    if (!location.confirmed) {
      setPendingQuestion(text);
      setLocationPrompt(true);
      setPlaceError('');
      setPlaceResults([]);
      return;
    }
    const history = previousHistory(messages);
    await askAssistant(text, history, location);
  }, [askAssistant, loading, location, messages, previousHistory, searchPlaces]);

  useEffect(() => {
    if (!contextReady || !conversationReady || initialQuestionApplied.current) return;
    initialQuestionApplied.current = true;
    const params = new URLSearchParams(window.location.search);
    const starter = params.get('question');
    params.delete('question');
    const shouldChangePlace = params.get('changePlace') === '1';
    params.delete('changePlace');
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
    );
    if (shouldChangePlace) setLocationPrompt(true);
    if (starter && starter.length <= 1_000) void chooseQuestion(starter);
  }, [chooseQuestion, contextReady, conversationReady]);

  const confirmLocation = useCallback((candidate: LocationCandidate) => {
    const nextLocation: SharedLocation = {
      name: candidate.name,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      region: candidate.regionName,
      confirmed: true,
    };
    const changed = !samePlace(location, candidate);
    setLocation(nextLocation);
    setSharedLocation(nextLocation);
    if (changed) setMessages([]);
    setLocationPrompt(false);
    setPlaceResults([]);
    setSelectedCandidate(null);
    setLocationSearch('');
    setPlaceError('');
    const followup = pendingQuestion;
    setPendingQuestion('');
    if (followup) {
      void askAssistant(followup, changed ? [] : previousHistory(messages), nextLocation);
    }
  }, [askAssistant, location, messages, pendingQuestion, previousHistory, setSharedLocation]);

  const confirmCurrentLocation = useCallback(() => {
    const nextLocation = { ...location, confirmed: true };
    setLocation(nextLocation);
    setSharedLocation(nextLocation);
    setLocationPrompt(false);
    const followup = pendingQuestion;
    setPendingQuestion('');
    if (followup) void askAssistant(followup, previousHistory(messages), nextLocation);
  }, [askAssistant, location, messages, pendingQuestion, previousHistory, setSharedLocation]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setError('');
    setErrorDetail('');
    setLastQuestion('');
    setPendingQuestion('');
    setLocationPrompt(false);
    setPlaceResults([]);
    setPlaceError('');
  }, []);

  const requestDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPlaceError('Location access is not available in this browser.');
      setLocationPrompt(true);
      return;
    }
    setPlaceLoading(true);
    setPlaceError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const candidate: LocationCandidate = {
          id: 'device-location',
          name: 'Current location',
          displayName: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} · from this device`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          resultType: 'Device location',
        };
        setPlaceResults([candidate]);
        setSelectedCandidate(candidate);
        setLocationSearch('Current location');
        setPlaceLoading(false);
        setLocationPrompt(true);
      },
      () => {
        setPlaceError('Your location was not shared. Search for a town or area instead.');
        setLocationPrompt(true);
        setPlaceLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const explorerHref = useMemo(() => buildExplorerHref(location, period), [location, period]);
  const canSend = question.trim().length >= 2 && !loading;

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        {messages.length === 0 && (
          <section aria-labelledby="assistant-welcome-title" className={styles.welcome}>
            <div className={styles.welcomeCopy}>
              <span className={styles.eyebrow}><Sparkles size={14} /> AgriShif AI</span>
              <h1 id="assistant-welcome-title">Hello! How can I help you today?</h1>
              <p>Understand your farm, explore your land and discover what’s happening around your area.</p>
              <button
                className={styles.welcomeAction}
                onClick={() => composerRef.current?.focus()}
                type="button"
              >
                Ask about your farm <ArrowRight size={16} />
              </button>
            </div>
            <button
              aria-label="Start a conversation with AgriShif AI"
              className={styles.welcomeArtButton}
              onClick={() => composerRef.current?.focus()}
              type="button"
            >
              <Image
                alt="AgriShif AI's animated guide exploring Earth"
                height={390}
                priority
                src={assistantGuide}
                unoptimized
                width={540}
              />
            </button>
          </section>
        )}

        <section aria-label="Active place and observation period" className={styles.contextBar}>
          <div className={styles.contextMain}>
            <span className={styles.pin}><MapPin size={18} /></span>
            <span className="min-w-0">
              <strong>{location.name}{location.region ? ` · ${location.region}` : ''}</strong>
              <small>
                {location.confirmed
                  ? `Your selected area · ${formatObservationDate(period.start)} – ${formatObservationDate(period.end)}`
                  : 'Choose or confirm this starting place before asking'}
              </small>
            </span>
          </div>
          <div className={styles.contextActions}>
            {!location.confirmed && !locationPrompt && (
              <button className={styles.confirmButton} onClick={confirmCurrentLocation} type="button">
                <Check size={14} /> Use {location.name}
              </button>
            )}
            <button
              aria-expanded={locationPrompt}
              className={styles.quietButton}
              onClick={() => {
                setLocationPrompt((open) => !open);
                setPlaceError('');
                setPlaceResults([]);
                setSelectedCandidate(null);
              }}
              type="button"
            >
              <Compass size={14} /> Change place <ChevronDown size={13} />
            </button>
            <Link className={styles.explorerLink} href={explorerHref as Route}>
              Explore map <ArrowRight size={14} />
            </Link>
            <details className={styles.periodDisclosure}>
              <summary>Change dates <ChevronDown size={13} /></summary>
              <div className={styles.periodControls}>
                <label>From
                  <input
                    aria-label="Observation start date"
                    className={styles.dateInput}
                    max={period.end}
                    onChange={(event) => {
                      if (!isValidDate(event.target.value) || event.target.value > period.end) return;
                      const nextPeriod = { ...period, start: event.target.value };
                      setPeriod(nextPeriod);
                      setSharedPeriod(nextPeriod);
                    }}
                    type="date"
                    value={period.start}
                  />
                </label>
                <label>To
                  <input
                    aria-label="Observation end date"
                    className={styles.dateInput}
                    max={dayOffset(0)}
                    min={period.start}
                    onChange={(event) => {
                      if (!isValidDate(event.target.value) || event.target.value < period.start) return;
                      const nextPeriod = { ...period, end: event.target.value };
                      setPeriod(nextPeriod);
                      setSharedPeriod(nextPeriod);
                    }}
                    type="date"
                    value={period.end}
                  />
                </label>
              </div>
            </details>
          </div>
        </section>

        {locationPrompt && (
          <section aria-label="Choose a location" className={styles.placePicker}>
            <h2>Which town or area should I check?</h2>
            <p>
              {pendingQuestion
                ? 'I’ll look up the place you mentioned. Choose the correct match and confirm it before I retrieve observations.'
                : 'Search for a town, city, farm area, or region. We’ll confirm the match before requesting environmental data.'}
            </p>
            <form
              className={styles.searchForm}
              onSubmit={(event) => {
                event.preventDefault();
                void searchPlaces(locationSearch);
              }}
            >
              <input
                aria-label="Search a town or area"
                className={styles.searchInput}
                maxLength={100}
                onChange={(event) => setLocationSearch(event.target.value)}
                placeholder="For example, Zaria or Kano, Nigeria"
                value={locationSearch}
              />
              <button className={styles.confirmButton} disabled={placeLoading} type="submit">
                {placeLoading ? <LoaderCircle className="animate-spin" size={15} /> : <MapPin size={15} />}
                Search
              </button>
            </form>
            <button
              className={`${styles.quietButton} mt-2`}
              disabled={placeLoading}
              onClick={requestDeviceLocation}
              type="button"
            >
              Use my current location (optional)
            </button>
            {!location.confirmed && (
              <button
                className={`${styles.confirmButton} mt-2`}
                onClick={confirmCurrentLocation}
                type="button"
              >
                Use {location.name}
              </button>
            )}
            {placeLoading && <p role="status">Finding matching places…</p>}
            {placeError && <p className="mt-2 text-sm text-destructive" role="alert">{placeError}</p>}
            {placeResults.length > 0 && (
              <div aria-label="Location matches" className={styles.placeResults}>
                <p>Choose the result that matches your area:</p>
                {placeResults.map((result) => (
                  <button
                    aria-pressed={selectedCandidate?.id === result.id}
                    className={styles.placeResult}
                    key={result.id}
                    onClick={() => setSelectedCandidate(result)}
                    type="button"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong>{result.name}</strong>
                      <small>{result.displayName} · {result.resultType}</small>
                    </span>
                  </button>
                ))}
                {selectedCandidate && (
                  <div className={styles.candidateConfirm}>
                    <span>Use <strong>{selectedCandidate.name}</strong> in this area?</span>
                    <button className={styles.confirmButton} onClick={() => confirmLocation(selectedCandidate)} type="button">
                      Confirm place <Check size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {location.confirmed && (
              <button className={`${styles.quietButton} mt-3`} onClick={() => setLocationPrompt(false)} type="button">
                Keep {location.name}
              </button>
            )}
          </section>
        )}

        <section aria-label="Conversation with AgriShif AI" className={styles.chat}>
          <header className={styles.chatHeader}>
            <div>
              <h2>Ask about your place</h2>
              <p>{location.confirmed ? `Here to help with ${location.name}` : 'Choose an area before I check local observations'}</p>
            </div>
            <button
              aria-label="Start a new conversation"
              className={styles.quietButton}
              disabled={loading || messages.length === 0}
              onClick={startNewConversation}
              type="button"
            >
              <RotateCcw size={14} /><span className="hidden sm:inline">New conversation</span>
            </button>
          </header>

          <div aria-live="polite" className={styles.chatScroll}>
            {messages.length === 0 ? (
              <div className={styles.welcomePrompt}>
                <h3>What would you like to understand?</h3>
                <p>
                  Ask naturally. I’ll check your selected area and explain what the available observations show.
                </p>
                <div className={styles.starterQuestions}>
                  {starterQuestions.map((starter) => (
                    <button
                      className={styles.starter}
                      disabled={loading}
                      key={starter}
                      onClick={() => void chooseQuestion(starter)}
                      type="button"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <article
                className={`${styles.message} ${message.role === 'user' ? styles.messageUser : ''}`}
                key={`${message.role}-${index}`}
              >
                <div className={styles.messageRole}>{message.role === 'assistant' ? 'AgriShif AI' : 'You'}</div>
                <div className={`${styles.bubble} ${message.role === 'user' ? styles.bubbleUser : ''}`}>
                  {message.role === 'assistant'
                    ? <AssistantAnswer answer={message.content} />
                    : <p className="m-0 whitespace-pre-wrap">{message.content}</p>}
                </div>
                {message.result && <AssistantEvidence result={message.result} />}
              </article>
            ))}

            {pendingQuestion && locationPrompt && (
              <div className={styles.clarification} role="status">
                <strong>Before I check that</strong>
                I need you to confirm which place you mean. No observations have been requested yet.
              </div>
            )}

            {loading && (
              <div className={styles.typing} role="status">
                <LoaderCircle className="animate-spin text-primary" size={16} />
                Checking available observations for {location.name}…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{error}</span>
              {errorDetail && <details className={styles.errorDetails}>
                <summary>Technical details</summary>
                <p>{errorDetail}</p>
              </details>}
              {lastQuestion && (
                <button
                  disabled={loading}
                  onClick={() => void askAssistant(lastQuestion, previousHistory(messages.slice(0, -1)), location, false)}
                  type="button"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void chooseQuestion(question);
            }}
          >
            <div className={styles.composerForm}>
              <label className="sr-only" htmlFor="assistant-question">Ask me about your farm</label>
              <textarea
                className={styles.composerInput}
                disabled={loading}
                id="assistant-question"
                maxLength={1_000}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void chooseQuestion(question);
                  }
                }}
                placeholder="Ask me about your farm, weather, rainfall, or land…"
                ref={composerRef}
                rows={1}
                value={question}
              />
              <button aria-label="Send question" className={styles.sendButton} disabled={!canSend} type="submit">
                <ArrowUp size={18} />
              </button>
            </div>
            <p className={styles.disclaimer}>
              Answers use the available NASA observations and may have gaps. Missing data is never treated as zero.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function AssistantEvidence({ result }: { result: AssistantResult }) {
  const totalValid = result.source_statuses.reduce((sum, source) => sum + source.valid_observation_count, 0);
  const sampleCount = result.source_statuses.reduce(
    (sum, source) => sum + (source.model_observation_count ?? 0),
    0,
  );
  const evidenceSummaries = result.evidence_summary ?? [];

  return (
    <div className="mt-2 space-y-2">
      <details className={styles.evidence}>
        <summary>
          <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />See the measurements</span>
          <span className="text-muted-foreground">{totalValid} readings</span>
        </summary>
        <div className={styles.evidenceBody}>
          {evidenceSummaries.length ? (
            <>
              <p className={styles.evidenceNote}>
                These summaries cover all {totalValid} usable readings. The AI received the full summaries
                and {sampleCount} representative readings, not every individual record.
              </p>
              {evidenceSummaries.map((summary, index) => {
                const label = variableLabels[summary.variable] ?? summary.variable.replaceAll('_', ' ');
                const periodText = summary.first_observation_time === summary.last_observation_time
                  ? formatObservationDate(summary.first_observation_time)
                  : `${formatObservationDate(summary.first_observation_time)} – ${formatObservationDate(summary.last_observation_time)}`;
                return (
                  <article className={styles.summaryItem} key={`${summary.source_id}-${summary.variable}-${index}`}>
                    <div className={styles.summaryHeading}>
                      <strong>{label}</strong>
                      <span>{sourceFriendlyName(summary.source_id)} · {sourceNames[summary.source_id]}</span>
                    </div>
                    <p>{summary.observation_count} readings · {periodText}</p>
                    {summary.minimum !== undefined && summary.maximum !== undefined && (
                      <p>
                        Range: {displayValue(summary.minimum)}–{displayValue(summary.maximum)} {displayUnit(summary.unit)}
                        {summary.arithmetic_mean !== undefined
                          ? ` · Average ${displayValue(summary.arithmetic_mean)} ${displayUnit(summary.unit)}`
                          : ''}
                      </p>
                    )}
                    <p>
                      Latest: {displayValue(summary.latest_value)} {displayUnit(summary.unit)}
                      {' · '}{formatObservationDate(summary.latest_observation_time)}
                    </p>
                    <details className={styles.observationTechnical}>
                      <summary>Measurement details</summary>
                      <p>
                        {summary.product_id} · {summary.variable} · {summary.unit}
                        {' · '}Point {summary.observation_coordinates.latitude.toFixed(4)}, {summary.observation_coordinates.longitude.toFixed(4)}
                      </p>
                    </details>
                  </article>
                );
              })}
            </>
          ) : totalValid > 0 || result.evidence.length > 0 ? (
            <p className="m-0 text-xs text-muted-foreground">
              This saved answer includes representative readings. Its complete statistical summary is not available in this older conversation.
            </p>
          ) : (
            <p className="m-0 text-xs text-muted-foreground">
              No valid measurements were returned for this place and period. Missing data does not mean zero.
            </p>
          )}
          {result.evidence.length > 0 && (
            <details className={styles.sampleRecords}>
              <summary>View representative readings ({result.evidence.length})</summary>
              {result.evidence.map((item, index) => (
                <article className={styles.observation} key={`${item.source_id}-${item.observation_time}-${index}`}>
                  <p>{observationSentence(item)}</p>
                  <small>{sourceFriendlyName(item.source_id)} · {sourceNames[item.source_id]}</small>
                  <details className={styles.observationTechnical}>
                    <summary>Source details</summary>
                    <p>{item.dataset} · {item.product_id} · {item.variable} ({displayUnit(item.unit)}) · {item.spatial_resolution}</p>
                    <p>
                      Coordinates: {item.observation_coordinates.latitude.toFixed(4)}, {item.observation_coordinates.longitude.toFixed(4)}
                    </p>
                    {item.quality_flags.length > 0 && <p>Quality notes: {item.quality_flags.join(', ')}</p>}
                    <p>Provenance: {item.provenance}</p>
                  </details>
                </article>
              ))}
            </details>
          )}
        </div>
      </details>

      <details className={styles.evidence}>
        <summary>
          <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />Where this information came from</span>
          <span className="text-muted-foreground">{result.sources_used.length} sources with readings</span>
        </summary>
        <div className={styles.sourceGrid}>
          {result.source_statuses.map((source) => (
            <div className={styles.sourceItem} key={source.source_id}>
              <strong>{sourceFriendlyName(source.source_id)}</strong>
              <small>{statusLabel(source.retrieval_status)}</small>
              <small>{sourceNames[source.source_id]}</small>
              <small>
                {source.valid_observation_count} usable readings
                {source.missing_observation_count ? ` · ${source.missing_observation_count} not usable` : ''}
              </small>
              {source.dataset && (
                <details className={styles.observationTechnical}>
                  <summary>Technical details</summary>
                  <p>{source.dataset} · {source.product_id} · {source.spatial_resolution}</p>
                  {source.error_http_status && <p>HTTP {source.error_http_status}</p>}
                  {source.error_message && <p>{source.error_message}</p>}
                </details>
              )}
            </div>
          ))}
        </div>
      </details>

      {result.limitations.length > 0 && (
        <details className={styles.evidence}>
          <summary><span>What I couldn’t confirm</span><span>{result.limitations.length} gaps</span></summary>
          <div className={styles.limitations}>
            <ul>{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          </div>
        </details>
      )}
      <p className="mt-1 flex justify-end text-[10px] text-muted-foreground">
        Updated {formatObservationDate(result.generated_at)}
      </p>
    </div>
  );
}
