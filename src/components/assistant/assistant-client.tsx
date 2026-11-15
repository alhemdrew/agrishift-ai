"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudRain, ExternalLink, Globe2, Maximize2, MapPin, MessageSquare, Plus, Send, Sparkles, AlertTriangle, Info, Mic, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";
import {
  ASSISTANT_LANGUAGES,
  DEFAULT_ASSISTANT_LANGUAGE,
  type AssistantLanguage,
} from "@/lib/assistant/languages";
import {
  recognitionErrorMessage,
  recognitionLocale,
  speechTranscript,
  speechLocale,
  speechRecognitionConstructor,
  waitForMatchingSpeechVoice,
  type SpeechRecognitionLike,
  type SpeechRecognitionWindow,
} from "@/lib/assistant/speech";

const API_URL = "";

type Chart = { title: string; unit: string; labels: string[]; values: number[] };
type Reply = { answer: string; key_insights: string[]; uncertainty: string; suggested_questions: string[]; chart: Chart | null; source: string };
type Message = { id: number; role: "user" | "assistant"; text: string; time: string; reply?: Reply; error?: boolean; language?: AssistantLanguage };

const STYLES = `
@keyframes as-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes as-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes as-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes as-dot { 0%,80%,100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-5px); } }
@keyframes as-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
@keyframes as-caret { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
@keyframes as-pulse { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,.5); } 100% { box-shadow: 0 0 0 14px rgba(52,211,153,0); } }
.as-float { animation: as-float 6s ease-in-out infinite; }
.as-grow { transform-origin: bottom; animation: as-grow .8s cubic-bezier(.2,.8,.2,1) both; }
.as-rise { animation: as-rise .55s cubic-bezier(.2,.8,.2,1) both; }
.as-dot { animation: as-dot 1.2s ease-in-out infinite; }
.as-scan { animation: as-scan 2.2s linear infinite; }
.as-caret { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; background: currentColor; animation: as-caret .9s steps(1) infinite; }
.as-pulse { animation: as-pulse 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .as-float, .as-dot, .as-scan, .as-pulse, .as-caret { animation: none; } .as-grow, .as-rise { animation-duration: .01s; } }
`;

const prompts = [
  "Explain the rainfall trend here",
  "Which crops could suit this location?",
  "Compare maize and sorghum for this farm",
  "What should I prepare before the next planting season?",
  "Assess possible drought and water-stress risks",
];

const greeting = "Hi, I'm your field intelligence assistant. Ask me about this place's environment. I answer only from its NASA observations, and I'll tell you when the data isn't enough.";

function parseCoord(value: string, min: number, max: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Typewriter({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const duration = Math.min(1_600, Math.max(240, text.length * 3));
    const startedAt = Date.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      setCount(Math.ceil(text.length * progress));
      if (progress === 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="as-caret" aria-hidden="true" />}
    </>
  );
}

function RainTrendCard({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.values);
  const total = chart.values.reduce((a, b) => a + b, 0);
  return (
    <div className="as-rise rounded-2xl border border-emerald-400/30 bg-white/80 p-5 shadow-xl backdrop-blur dark:bg-brand-950/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"><CloudRain className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold text-brand-900 dark:text-white">{chart.title}</p>
            <p className="text-xs text-brand-600 dark:text-brand-300/80">{chart.labels[0]} to {chart.labels[chart.labels.length - 1]}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-brand-900 dark:text-white">{Math.round(total * 10) / 10} <span className="text-sm font-normal">{chart.unit}</span></p>
          <p className="text-xs text-brand-600 dark:text-brand-300/80">total in period</p>
        </div>
      </div>
      <div className="mt-5 flex h-40 items-end gap-2" role="img" aria-label={`${chart.title}: ${chart.labels.map((l, i) => `${l} ${chart.values[i]} ${chart.unit}`).join(", ")}`}>
        {chart.values.map((v, i) => (
          <div key={chart.labels[i]} className="flex h-full flex-1 flex-col justify-end gap-1" title={`${chart.labels[i]}: ${v} ${chart.unit}`}>
            <span className="text-center text-[10px] text-brand-700 dark:text-sky-200">{v}</span>
            <div className="as-grow w-full rounded-t-lg bg-gradient-to-t from-sky-600 via-sky-400 to-cyan-300 shadow-md shadow-sky-500/20" style={{ height: `${Math.max(5, (v / max) * 100)}%`, animationDelay: `${i * 90}ms` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">{chart.labels.map((l) => <span key={l} className="flex-1 text-center text-[10px] text-brand-600 dark:text-brand-300">{l}</span>)}</div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="as-rise flex items-start gap-4">
      <span className="as-pulse mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 text-white"><Sparkles className="h-5 w-5" /></span>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-white/80 px-5 py-4 shadow-lg backdrop-blur dark:bg-brand-950/70">
        <div className="as-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
        <p className="relative text-sm font-medium text-brand-800 dark:text-emerald-100">Reading the NASA observations for this place</p>
        <div className="relative mt-2 flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="as-dot h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-300" style={{ animationDelay: `${i * 0.18}s` }} />)}
        </div>
      </div>
    </div>
  );
}

export function AssistantClient({ lat, lon }: { lat: string; lon: string }) {
  const latNum = parseCoord(lat, -90, 90);
  const lonNum = parseCoord(lon, -180, 180);
  const hasLocation = latNum !== null && lonNum !== null;

  const idRef = useRef(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(prompts);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openSources, setOpenSources] = useState<number | null>(null);
  const [language, setLanguage] = useState<AssistantLanguage>(DEFAULT_ASSISTANT_LANGUAGE);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");
  const [playback, setPlayback] = useState<{ messageId: number; state: "playing" | "paused" } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionTextRef = useRef("");
  const recognitionErrorRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    mountedRef.current = true;
    setSpeechRecognitionAvailable(
      typeof window !== "undefined"
        && Boolean(speechRecognitionConstructor(window as SpeechRecognitionWindow)),
    );
    return () => {
      mountedRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
      speechRequestRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopSpeech() {
    speechRequestRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setPlayback(null);
  }

  function startNewConversation() {
    recognitionErrorRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setIsRecording(false);
    setInput("");
    setSpeechNotice("");
    stopSpeech();
    setMessages([]);
    setSuggestions(prompts);
  }

  async function playAnswer(text: string, messageId: number, answerLanguage: AssistantLanguage) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setSpeechNotice("Spoken responses are not available in this browser. Text chat is still available.");
      return;
    }
    stopSpeech();
    const requestId = speechRequestRef.current;
    const synthesizer = window.speechSynthesis;
    const voice = await waitForMatchingSpeechVoice(synthesizer, answerLanguage);
    if (!mountedRef.current || requestId !== speechRequestRef.current) return;
    if (!voice) {
      setSpeechNotice(`No ${ASSISTANT_LANGUAGES.find((item) => item.code === answerLanguage)?.name ?? "selected-language"} speech voice is available on this device. The text answer is still available.`);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(answerLanguage);
    utterance.voice = voice;
    utterance.onend = () => {
      if (utteranceRef.current === utterance && requestId === speechRequestRef.current && mountedRef.current) {
        utteranceRef.current = null;
        setPlayback(null);
      }
    };
    utterance.onerror = () => {
      if (utteranceRef.current === utterance && requestId === speechRequestRef.current && mountedRef.current) {
        utteranceRef.current = null;
        setPlayback(null);
        setSpeechNotice("The selected speech voice could not read this response. Text remains available.");
      }
    };
    utteranceRef.current = utterance;
    setSpeechNotice("");
    setPlayback({ messageId, state: "playing" });
    synthesizer.speak(utterance);
  }

  function startRecording() {
    if (busy || recognitionRef.current) return;
    if (typeof window === "undefined") return;
    const Recognition = speechRecognitionConstructor(window as SpeechRecognitionWindow);
    if (!Recognition) {
      setSpeechRecognitionAvailable(false);
      setSpeechNotice("Speech input is not supported in this browser. You can still type your question.");
      return;
    }

    stopSpeech();
    const recognition = new Recognition();
    recognition.lang = recognitionLocale(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionTextRef.current = "";
    recognitionErrorRef.current = false;
    setInput("");
    setSpeechNotice(`Requesting ${ASSISTANT_LANGUAGES.find((item) => item.code === language)?.name} speech recognition. Browser language support varies; review the transcript before sending.`);
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = speechTranscript(event);
      recognitionTextRef.current = transcript.trim();
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      recognitionErrorRef.current = true;
      const message = recognitionErrorMessage(event.error);
      if (mountedRef.current) {
        setSpeechNotice(message);
        setIsRecording(false);
      }
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!mountedRef.current) return;
      setIsRecording(false);
      if (!recognitionErrorRef.current && !recognitionTextRef.current) {
        setSpeechNotice("No speech was transcribed. Try again or type your question.");
      } else if (recognitionTextRef.current) {
        setSpeechNotice("Transcript ready. Edit it if needed, then send your question.");
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      recognitionRef.current = null;
      setIsRecording(false);
      setSpeechNotice("The microphone could not be started. Check browser microphone permissions or continue with text.");
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function cancelRecording() {
    recognitionErrorRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setIsRecording(false);
    recognitionTextRef.current = "";
    setInput("");
    setSpeechNotice("Recording canceled.");
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busyRef.current || !hasLocation) return;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionErrorRef.current = true;
      recognitionRef.current = null;
      recognition.abort();
      setIsRecording(false);
    }
    const answerLanguage = language;
    busyRef.current = true;
    const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", text: question, time: now() }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, language: answerLanguage, lat: latNum, lon: lonNum, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.detail ?? "The assistant couldn't respond. Please try again.");
      const reply = data as Reply;
      const messageId = idRef.current++;
      setMessages((prev) => [...prev, { id: messageId, role: "assistant", text: reply.answer, time: now(), reply, language: answerLanguage }]);
      if (reply.suggested_questions.length) setSuggestions(reply.suggested_questions);
      if (speechEnabled) void playAnswer(reply.answer, messageId, answerLanguage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant couldn't respond. Please try again.";
      setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text: message, time: now(), error: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const userQuestions = messages.filter((m) => m.role === "user");

  if (!hasLocation) {
    return (
      <div className="space-y-8">
        <PageHero eyebrow="AI Assistant" title="Your land has a voice." subtitle="Choose a place first. The assistant talks about one location at a time." image="/assets/robot-banner.webp" imagePosition="object-right" />
        <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <Globe2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xl font-semibold text-brand-900 dark:text-white">Choose a place to talk about</h2>
          <p className="text-brand-700 dark:text-brand-200/80">Search for a place in the Earth Explorer, then open the assistant from there.</p>
          <Link href="/explore" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white hover:brightness-110">
            Open Earth Explorer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{STYLES}</style>
      <PageHero
        eyebrow="AI Assistant"
        title="Your land has a voice."
        subtitle="Let's understand what it is telling you."
        image="/assets/robot-banner.webp"
        imagePosition="object-right"
      >
        {suggestions.slice(0, 2).map((p) => (
          <button key={p} type="button" disabled={busy} onClick={() => send(p)} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50">
            <CloudRain className="h-4 w-4" /> {p} <ArrowRight className="h-4 w-4" />
          </button>
        ))}
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr_290px]">
        {/* Sidebar */}
        <aside className="space-y-5 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <button type="button" onClick={startNewConversation} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110">
            <Plus className="h-4 w-4" /> New conversation
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300/70">Selected place</p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50 px-3 py-3 dark:bg-emerald-400/10">
              <span className="flex min-w-0 items-center gap-2 text-sm text-brand-900 dark:text-white"><MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" /><span className="truncate">{latNum?.toFixed(3)}, {lonNum?.toFixed(3)}</span></span>
              <Link href="/explore" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300">Change</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300/70">This session</p>
            <ul className="mt-2 space-y-2">
              {userQuestions.length === 0 && <li className="text-xs text-brand-600 dark:text-brand-300/70">Your questions will appear here.</li>}
              {userQuestions.slice(-5).reverse().map((m) => (
                <li key={m.id} className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm text-brand-800 hover:bg-brand-50 dark:text-brand-100 dark:hover:bg-white/5">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0"><span className="block truncate">{m.text}</span><span className="text-[11px] text-brand-600 dark:text-brand-300/70">{m.time}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-brand-600 dark:text-brand-300/70">Saved conversations are coming in a later release.</p>
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-xl dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 p-4 dark:border-white/10">
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-brand-800 dark:text-brand-100">
              <span>Answer language</span>
              <select
                value={language}
                onChange={(event) => {
                  if (isRecording) cancelRecording();
                  stopSpeech();
                  setLanguage(event.target.value as AssistantLanguage);
                  setSpeechNotice("Answer language changed. Speech features depend on browser and device support.");
                }}
                aria-label="Assistant response language"
                aria-describedby="assistant-language-help"
                className="rounded-lg border border-brand-200 bg-white px-2.5 py-2 text-sm text-brand-900 outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-brand-950 dark:text-white"
              >
                {ASSISTANT_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-200">
              <input
                type="checkbox"
                checked={speechEnabled}
                onChange={(event) => {
                  setSpeechEnabled(event.target.checked);
                  if (!event.target.checked) stopSpeech();
                  setSpeechNotice(event.target.checked
                    ? "Automatic speech is on for new answers when a matching voice is available."
                    : "Automatic speech is off. You can play an answer individually.");
                }}
                className="h-4 w-4 rounded border-brand-300 accent-emerald-600"
              />
              Automatically speak new answers
            </label>
            <p id="assistant-language-help" className="basis-full text-xs text-brand-600 dark:text-brand-300/70">
              Text answers use this language. Speech recognition and playback are separate browser capabilities.
            </p>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
            {messages.length === 0 && (
              <div className="as-rise flex flex-col items-center gap-6 py-6 text-center">
                <img src="/assets/ai-robot.webp" alt="" className="as-float h-40 w-auto drop-shadow-xl" />
                <div className="max-w-lg rounded-2xl border border-emerald-400/30 bg-emerald-50/70 px-6 py-5 text-left text-brand-900 dark:bg-white/5 dark:text-brand-50">
                  <p className="leading-relaxed"><Typewriter text={greeting} /></p>
                </div>
                <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
                  {prompts.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} className="rounded-2xl border border-brand-200 bg-white p-4 text-left text-sm font-medium text-brand-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`as-rise flex items-start gap-4 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"><Sparkles className="h-5 w-5" /></span>
                )}
                <div className={`min-w-0 max-w-[min(42rem,88%)] space-y-4 ${m.role === "user" ? "text-right" : ""}`}>
                  <div className={`flex flex-wrap items-baseline gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                    <div className={`inline-block rounded-2xl px-5 py-3.5 text-left text-[15px] leading-relaxed shadow-md ${
                      m.role === "user"
                        ? "rounded-br-md bg-brand-800 text-white dark:bg-emerald-500"
                        : m.error
                          ? "rounded-bl-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                          : "rounded-bl-md border border-brand-200 bg-brand-50 text-brand-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-50"
                    }`}>
                      {m.role === "assistant" && m.id === lastAssistantId && !m.error ? <Typewriter text={m.text} /> : m.text}
                    </div>
                    <span className="text-xs text-brand-600 dark:text-brand-300/70">{m.time}</span>
                  </div>

                  {m.reply?.chart && <RainTrendCard chart={m.reply.chart} />}

                  {m.role === "assistant" && !m.error && (
                    <div className="flex flex-wrap items-center gap-2">
                      {playback?.messageId === m.id && playback.state === "playing" ? (
                        <button type="button" aria-label="Pause spoken answer" aria-pressed="false" onClick={() => {
                          window.speechSynthesis.pause();
                          setPlayback({ messageId: m.id, state: "paused" });
                        }} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </button>
                      ) : (
                        <button type="button" aria-label={playback?.messageId === m.id ? "Resume spoken answer" : "Play spoken answer"} onClick={() => {
                          if (playback?.messageId === m.id && playback.state === "paused") {
                            window.speechSynthesis.resume();
                            setPlayback({ messageId: m.id, state: "playing" });
                          } else {
                            void playAnswer(m.text, m.id, m.language ?? language);
                          }
                        }} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
                          <Play className="h-3.5 w-3.5" /> {playback?.messageId === m.id ? "Resume" : "Play response"}
                        </button>
                      )}
                      {playback?.messageId === m.id && (
                        <button type="button" aria-label="Stop spoken answer" onClick={stopSpeech} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
                          <Square className="h-3.5 w-3.5" /> Stop
                        </button>
                      )}
                    </div>
                  )}

                  {m.reply && m.reply.key_insights.length > 0 && (
                    <div className="as-rise rounded-2xl border border-emerald-400/30 bg-emerald-50/70 p-5 dark:bg-emerald-400/10">
                      <p className="font-semibold text-brand-900 dark:text-white">Key insights</p>
                      <ul className="mt-3 space-y-2">
                        {m.reply.key_insights.map((insight) => (
                          <li key={insight} className="flex gap-3 text-sm text-brand-800 dark:text-brand-100">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">✓</span>{insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.reply && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setOpenSources(openSources === m.id ? null : m.id)} className="rounded-xl border border-brand-300 px-3.5 py-2 text-xs font-medium text-brand-800 hover:bg-brand-50 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/5">
                        {openSources === m.id ? "Hide sources" : "View sources"}
                      </button>
                      <Link href={`/explore`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110">
                        <ExternalLink className="h-3.5 w-3.5" /> Open in Explorer
                      </Link>
                    </div>
                  )}
                  {m.reply && openSources === m.id && (
                    <div className="as-rise rounded-xl bg-brand-50 p-4 text-xs leading-relaxed text-brand-700 dark:bg-white/5 dark:text-brand-200/80">
                      <p><span className="font-semibold">Source:</span> {m.reply.source}</p>
                      {m.reply.uncertainty && <p className="mt-1"><span className="font-semibold">Uncertainty:</span> {m.reply.uncertainty}</p>}
                    </div>
                  )}
                  {m.error && <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300"><AlertTriangle className="h-3.5 w-3.5" /> Try again in a moment.</p>}

                  {m.reply && m.reply.suggested_questions.length > 0 && m.id === lastAssistantId && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.reply.suggested_questions.map((q) => (
                        <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="rounded-full border border-emerald-400/50 bg-white px-3.5 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-40 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20">{q}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <Thinking />}
            <div ref={endRef} />
          </div>

          <div className="border-t border-brand-200 p-4 sm:p-5 dark:border-white/10">
            <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-2 pl-3 shadow-inner transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/20 sm:pl-5 dark:border-white/10 dark:bg-white/[0.05]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Ask or edit a transcript…"
                aria-label="Ask a question"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-brand-900 outline-none placeholder:text-brand-500 dark:text-white dark:placeholder:text-brand-300/60"
              />
              {isRecording ? (
                <>
                  <span className="flex items-center gap-1.5 px-2 text-xs font-medium text-red-700 dark:text-red-300" role="status" aria-live="polite">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening
                  </span>
                  <button type="button" onClick={stopRecording} aria-label="Stop recording" className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300">
                    <Square className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={cancelRecording} aria-label="Cancel recording" className="rounded-lg px-2 py-2 text-xs font-medium text-brand-700 hover:bg-white dark:text-brand-200 dark:hover:bg-white/10">
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={startRecording} disabled={busy} aria-label="Start voice input" title={speechRecognitionAvailable ? "Start voice input" : "Speech input may not be supported in this browser"} className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-300 text-brand-800 transition hover:bg-white disabled:opacity-40 dark:border-white/15 dark:text-brand-100 dark:hover:bg-white/10">
                  <Mic className="h-4 w-4" />
                </button>
              )}
              <button type="submit" disabled={busy || input.trim() === ""} aria-label="Send question" className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105 disabled:scale-100 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
            {speechNotice && <p role="status" aria-live="polite" className="mt-2 text-xs text-brand-700 dark:text-brand-200">{speechNotice}</p>}
            {speechRecognitionAvailable ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-600 dark:text-brand-300/70"><Mic className="h-3 w-3" /> Speech requests {recognitionLocale(language)}; the browser service may not support it. Review transcripts before sending.</p>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-200"><VolumeX className="h-3 w-3" /> Speech recognition is unavailable in this browser; text chat remains available.</p>
            )}
            {speechEnabled && <p className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-600 dark:text-brand-300/70"><Volume2 className="h-3 w-3" /> Auto-speak is on; only a matching {ASSISTANT_LANGUAGES.find((item) => item.code === language)?.name} voice will be used.</p>}
            <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-300/60">Microphone audio is handled by your browser&apos;s speech service. AgriShift receives only the transcript when you send it.</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-brand-600 dark:text-brand-300/60"><Info className="h-3 w-3" /> Answers come from NASA data for this place. They are not crop or chemical advice; consult your local agronomist.</p>
          </div>
        </section>

        {/* Field context */}
        <aside className="space-y-5 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-brand-900 dark:text-white">Field context</p>
            <Maximize2 className="h-4 w-4 text-brand-500" />
          </div>
          <div className="relative h-40 overflow-hidden rounded-2xl">
            <img src="/assets/landscape-banner.webp" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 to-transparent" />
            <p className="absolute bottom-3 left-3 text-sm font-semibold text-white">This place</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-brand-700 dark:text-brand-200/80">Coverage</dt><dd className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">Partial</dd></div>
            <div className="flex justify-between"><dt className="text-brand-700 dark:text-brand-200/80">Period</dt><dd className="text-brand-900 dark:text-white">Last 5 days</dd></div>
            <div className="flex justify-between"><dt className="text-brand-700 dark:text-brand-200/80">Sources</dt><dd className="text-brand-900 dark:text-white">1 connected</dd></div>
          </dl>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> Still needed</p>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">Soil moisture observations (NASA SMAP), being connected.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
