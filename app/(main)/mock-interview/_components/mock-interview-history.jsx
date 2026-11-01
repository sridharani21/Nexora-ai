"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MockInterviewHistory() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/mock-interview").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load interview history.");
      if (active) setSessions(data.sessions);
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  if (error) return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p></main>;
  if (!sessions) return <main className="mx-auto max-w-5xl px-4 py-12 text-sm text-slate-500">Loading interview history…</main>;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Module 6 · History</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Your interview sessions</h1></div><Link href="/mock-interview/setup" className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Start a new interview</Link></div>
      {!sessions.length ? <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No saved sessions yet. Start a Module 6 interview to build your private history.</section> : (
        <div className="space-y-3">{sessions.map((session) => (
          <article key={session.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div><h2 className="font-bold text-slate-950">{session.careerTitle}</h2><p className="mt-1 text-sm capitalize text-slate-600">{session.interviewType} · {session.difficulty} · {session.duration} min · {session.status}</p><p className="mt-1 text-xs text-slate-500">{new Date(session.createdAt).toLocaleString("en-IN")}</p></div>
            <div className="flex items-center gap-4">{session.overallScore !== null && <span className="text-lg font-bold text-slate-900">{session.overallScore}%</span>}{session.status === "in_progress" ? <Link href={`/mock-interview/session/${session.id}`} className="text-sm font-semibold text-indigo-700 underline">Resume</Link> : <Link href={`/mock-interview/report/${session.id}`} className="text-sm font-semibold text-indigo-700 underline">View report</Link>}</div>
          </article>
        ))}</div>
      )}
      <Link href="/mock-interview" className="inline-block text-sm font-semibold text-indigo-700 underline">Back to Module 6</Link>
    </main>
  );
}
