"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudRain, ExternalLink, Globe2, Maximize2, MapPin, MessageSquare, Plus, Send, Sparkles, AlertTriangle, Info } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Chart = { title: string; unit: string; labels: string[]; values: number[] };
type Reply = { answer: string; key_insights: string[]; uncertainty: string; suggested_questions: string[]; chart: Chart | null; source: string };
type Message = { id: number; role: "user" | "assistant"; text: string; time: string; reply?: Reply; error?: boolean };

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
  "Any drought risk?",
  "What about temperature trends?",
  "How are wind and sunshine here?",
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
    const step = Math.max(1, Math.ceil(text.length / 160));
    const id = setInterval(() => setCount((c) => Math.min(text.length, c + step)), 16);
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
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy || !hasLocation) return;
    const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", text: question, time: now() }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, lat: latNum, lon: lonNum, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "The assistant couldn't respond. Please try again.");
      const reply = data as Reply;
      setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text: reply.answer, time: now(), reply }]);
      if (reply.suggested_questions.length) setSuggestions(reply.suggested_questions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant couldn't respond. Please try again.";
      setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text: message, time: now(), error: true }]);
    } finally {
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
        {prompts.slice(0, 2).map((p) => (
          <button key={p} type="button" disabled={busy} onClick={() => send(p)} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50">
            <CloudRain className="h-4 w-4" /> {p} <ArrowRight className="h-4 w-4" />
          </button>
        ))}
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr_290px]">
        {/* Sidebar */}
        <aside className="space-y-5 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-brand-900/60 dark:shadow-none">
          <button type="button" onClick={() => { setMessages([]); setSuggestions(prompts); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110">
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
            <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-2 pl-5 shadow-inner transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/20 dark:border-white/10 dark:bg-white/[0.05]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Ask about this place…"
                aria-label="Ask a question"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-brand-900 outline-none placeholder:text-brand-500 dark:text-white dark:placeholder:text-brand-300/60"
              />
              <button type="submit" disabled={busy || input.trim() === ""} aria-label="Send question" className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105 disabled:scale-100 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
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
            <div className="flex justify-between"><dt className="text-brand-700 dark:text-brand-200/80">Period</dt><dd className="text-brand-900 dark:text-white">Last 90 days</dd></div>
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
