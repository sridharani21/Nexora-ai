"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InterviewCheck({ sessionId }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    fetch(`/api/mock-interview/sessions/${encodeURIComponent(sessionId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to check this interview.");
      if (active) setSession(data.session);
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [sessionId]);

  const liveAvailable = Boolean(session?.tavusAvailable || session?.geminiLiveAvailable);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/mock-interview" className="text-sm font-semibold text-indigo-700 underline">Cancel and return to Module 6</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Module 6 · Before you begin</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Pre-interview check</h1></header>
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
      {!session && !error && <p className="text-sm text-slate-500">Checking your saved session…</p>}
      {session && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-950">{session.careerTitle} · {session.duration} minutes</h2>
            <p className="mt-2 text-sm capitalize text-slate-600">{session.interviewType} interview · {session.difficulty} difficulty · {session.questions.length} questions</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li className="rounded-lg bg-emerald-50 p-3">{session.tavusAvailable ? "Tavus provides the live video avatar, spoken interview, and natural follow-up. After the conversation, the verified spoken transcript and practice feedback are saved to your private account." : session.geminiLiveAvailable ? "Gemini Live provides the audio-only spoken interview. Your answer transcript and practice feedback are saved to your private account." : "Gemini provides interview questions and feedback in a text-only practice session."}</li>
              {liveAvailable && <li className="rounded-lg bg-slate-50 p-3">{session.tavusAvailable ? "Tavus will ask for microphone and camera access in its video room. Tavus processes the live audio/video; Nexora does not save raw media, and recording is disabled." : "The next page requests microphone access after you choose Start. Google processes live audio; Nexora does not record or store raw media. Recording is disabled."}</li>}
              {session.tavusAvailable && <li className="rounded-lg bg-slate-50 p-3">If the embedded video room does not load, use the Open Tavus interview in a new tab link on the session page.</li>}
              {!session.tavusAvailable && session.geminiLiveAvailable && <li className="rounded-lg bg-slate-50 p-3">Camera is optional and, if enabled, is only a local preview; video is not sent to Gemini or recorded.</li>}
              {liveAvailable && <li className="rounded-lg bg-amber-50 p-3">You can switch to text practice if your browser or microphone cannot connect. Feedback is for practice, not a hiring decision, and coding is not executed.</li>}
            </ul>
          </section>
          <button onClick={() => router.push(liveAvailable
            ? `/mock-interview/session/${encodeURIComponent(session.id)}`
            : `/mock-interview/text-session/${encodeURIComponent(session.id)}`)} className="w-full rounded-xl bg-indigo-700 px-5 py-3.5 text-sm font-bold text-white">{liveAvailable ? "Continue to device check" : "Start text practice"}</button>
          {liveAvailable && <Link href={`/mock-interview/text-session/${encodeURIComponent(session.id)}`} className="block text-center text-sm font-semibold text-indigo-700 underline">Use the text-only fallback instead</Link>}
        </>
      )}
    </main>
  );
}
