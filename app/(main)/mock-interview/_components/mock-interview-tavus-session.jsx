"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function MockInterviewTavusSession({ sessionId }) {
  const router = useRouter();
  const roomStartedAtKey = `nexora-module6-tavus-start:${sessionId}`;
  const [session, setSession] = useState(null);
  const [conversationUrl, setConversationUrl] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerStartedAt = useRef(0);
  const finishConversationRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/mock-interview/sessions/${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this interview.");
        if (!active) return;
        setSession(data.session);
        if (data.session.status !== "in_progress") {
          setStatus("closed");
          return;
        }
        if (!data.session.tavusAvailable) {
          throw new Error("Tavus is not configured. Add TAVUS_API_KEY and TAVUS_PAL_ID to .env.local, then restart the server.");
        }
        setStatus("ready");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message);
          setStatus("error");
        }
      });
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (status !== "room-ready" || !session) return undefined;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - timerStartedAt.current) / 1000);
      setRemainingSeconds(Math.max(0, session.duration * 60 - elapsed));
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session, status]);

  useEffect(() => {
    if (status === "room-ready" && remainingSeconds === 0 && session
      && timerStartedAt.current > 0
      && Date.now() - timerStartedAt.current >= session.duration * 60 * 1000) {
      void finishConversationRef.current?.(false);
    }
  }, [remainingSeconds, session, status]);

  async function startConversation() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    setStatus("connecting");
    try {
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}/tavus`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start the video interview.");
      setConversationUrl(data.conversationUrl);
      const storedStart = Number(window.localStorage.getItem(roomStartedAtKey));
      const startedAt = Number.isFinite(storedStart) && storedStart > 0 ? storedStart : Date.now();
      window.localStorage.setItem(roomStartedAtKey, String(startedAt));
      timerStartedAt.current = startedAt;
      setStatus("room-ready");
    } catch (startError) {
      setStatus("ready");
      setError(startError.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishConversation(confirm = true) {
    if (!session || busy) return;
    if (confirm && !window.confirm("End this video interview and save the transcript report?")) return;
    setBusy(true);
    setStatus("finishing");
    setError("");
    try {
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}/finish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the interview report.");
      window.localStorage.removeItem(roomStartedAtKey);
      router.push(`/mock-interview/report/${encodeURIComponent(session.id)}`);
    } catch (finishError) {
      setError(finishError.message);
      setStatus(conversationUrl ? "room-ready" : "ready");
    } finally {
      setBusy(false);
    }
  }
  finishConversationRef.current = finishConversation;

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  if (status === "loading") {
    return <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading interview…</main>;
  }
  if (status === "closed") {
    return <main className="mx-auto max-w-4xl p-8"><Link href={`/mock-interview/report/${encodeURIComponent(sessionId)}`} className="font-semibold text-indigo-700 underline">View saved interview report</Link></main>;
  }
  if (!session) {
    return <main className="mx-auto max-w-4xl space-y-4 px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/mock-interview" className="font-semibold text-indigo-700 underline">Back to Module 6</Link></main>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Module 6 · Tavus video interview</p>
          <h1 className="mt-1 text-xl font-bold">{session.careerTitle}</h1>
          <p className="text-sm capitalize text-slate-300">{session.interviewType} · {session.difficulty} · {session.questions.length} planned questions · spoken practice</p>
        </div>
        <div className="rounded-xl bg-white/10 px-4 py-2 text-center">
          <p className="text-xs text-slate-300">Time remaining</p>
          <p className="font-mono text-xl font-bold" aria-live="polite">{minutes}:{seconds}</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
        {conversationUrl ? (
          <iframe
            title="Tavus AI video interview"
            src={conversationUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="aspect-video min-h-[420px] w-full border-0 bg-slate-950"
          />
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center text-white">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 text-4xl" aria-hidden="true">N</div>
            <h2 className="mt-6 text-2xl font-bold">Your interviewer is ready</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Start to open the Tavus video room. Allow microphone and camera access in the room when prompted; the interview transcript is saved after you end the conversation.</p>
            <button type="button" onClick={startConversation} disabled={busy || status === "connecting"} className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-indigo-950 disabled:opacity-60">
              {busy ? "Opening video room…" : "Start video interview"}
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-bold text-slate-950">Interview controls</h2>
          <p className="mt-1 text-sm text-slate-600">
            {status === "room-ready"
              ? "Complete your spoken answers and follow-ups in the Tavus room. We verify the final transcript before saving the report."
              : status === "finishing"
                ? "Waiting for Tavus to finalize the transcript and save your report…"
                : "Your role-specific planned questions and natural follow-ups run in the video room."}
          </p>
        </div>
        {conversationUrl && <button type="button" onClick={() => finishConversation(true)} disabled={busy} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving report…" : "End and save report"}</button>}
      </section>

      {conversationUrl && <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <a href={conversationUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 underline">Open Tavus interview in a new tab</a>
        <button type="button" onClick={startConversation} disabled={busy} className="font-semibold text-indigo-700 underline disabled:opacity-50">Reconnect video room</button>
      </div>}

      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</p>}
      <p className="text-xs leading-5 text-slate-500">Tavus processes live audio and video to provide the conversation and avatar. Nexora disables Tavus recording and saves the returned spoken transcript and practice feedback only. The report can be reopened from interview history.</p>
      <Link href={`/mock-interview/session/${encodeURIComponent(session.id)}?mode=audio`} className="block text-center text-sm font-semibold text-indigo-700 underline">{session.geminiLiveAvailable ? "Use the audio-only Gemini fallback instead" : "Use text-only practice instead"}</Link>
    </main>
  );
}
