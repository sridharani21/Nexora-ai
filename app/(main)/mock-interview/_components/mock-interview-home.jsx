"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MockInterviewHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/mock-interview").then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load Module 6.");
      if (active) setData(payload);
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  if (error) return <Message error={error} />;
  if (!data) return <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-slate-500">Loading Module 6…</main>;
  const latest = data.latestCompleted;

  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-950 p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Module 6 · Practice, reflect, improve</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-5xl">AI Mock Interview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">Speak with a live, role-aware AI interviewer, practise aloud, and keep your saved answer transcripts and reports for later review.</p>
        {data.career ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">Selected career: <strong>{data.career.title}</strong></span>
            <Link href="/mock-interview/setup" className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Start AI Mock Interview</Link>
          </div>
        ) : (
          <div className="mt-6 rounded-xl bg-white/10 p-4 text-sm">Choose a current career in Module 4 before starting an interview. <Link href="/career-explorer" className="ml-1 font-bold underline">Open Career Explorer</Link></div>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Completed practice sessions" value={data.completedCount} />
        <Metric label="Latest completed score" value={latest?.overallScore === null || !latest ? "Not available" : `${latest.overallScore}%`} />
        <Metric label="Question types" value="Technical · Project · Behavioral" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-bold text-slate-950">Your practice room</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
            <li className="rounded-xl bg-slate-50 p-4">Role-specific questions from your Module 4 career skills.</li>
            <li className="rounded-xl bg-slate-50 p-4">Choose interview type, difficulty, and a 15, 30, or 45-minute session.</li>
            <li className="rounded-xl bg-slate-50 p-4">Speak your answers in the live room; transcripts and practice feedback are saved.</li>
            <li className="rounded-xl bg-slate-50 p-4">Review reports and matching Module 5 practice topics.</li>
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">When configured, Tavus powers a live video interviewer and processes the conversation audio/video. Otherwise, Gemini powers text practice. Gemini Live audio uses the same server-side Gemini key. Nexora saves spoken transcripts and practice feedback, not raw media. A clearly labeled text fallback is available. Coding is not executed, and feedback is for practice rather than a hiring decision.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold text-slate-950">Recent sessions</h2><p className="mt-1 text-sm text-slate-600">Your saved Module 6 history.</p></div>
            <Link href="/mock-interview/history" className="text-sm font-semibold text-indigo-700 underline">View all</Link>
          </div>
          {!data.sessions.length ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No interviews yet. Your first session and report will appear here.</p> : (
            <ul className="mt-4 space-y-3">
              {data.sessions.slice(0, 4).map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div><p className="font-semibold text-slate-900">{session.careerTitle}</p><p className="text-xs capitalize text-slate-500">{session.interviewType} · {session.status} · {new Date(session.createdAt).toLocaleDateString("en-IN")}</p></div>
                  {session.status === "in_progress" ? <Link href={`/mock-interview/session/${session.id}`} className="text-sm font-semibold text-indigo-700 underline">Resume</Link> : <Link href={`/mock-interview/report/${session.id}`} className="text-sm font-semibold text-indigo-700 underline">Report</Link>}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-950">{value}</p></article>;
}

function Message({ error }) {
  return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p></main>;
}
