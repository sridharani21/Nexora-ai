"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function MockInterviewSession({ sessionId }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/mock-interview/sessions/${encodeURIComponent(sessionId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load this interview.");
      if (!active) return;
      const loaded = data.session;
      setSession(loaded);
      const answered = new Set(loaded.answers.map((item) => item.questionId));
      const nextIndex = loaded.questions.findIndex((question) => !answered.has(question.id));
      setCurrentIndex(nextIndex === -1 ? loaded.questions.length : nextIndex);
      setRemainingSeconds(Math.max(0, loaded.duration * 60 - Math.floor((Date.now() - new Date(loaded.createdAt).getTime()) / 1000)));
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") return undefined;
    const timer = setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const answersByQuestion = useMemo(
    () => new Map((session?.answers || []).map((answer) => [answer.questionId, answer])),
    [session],
  );
  const question = session?.questions[currentIndex];
  const savedAnswer = question ? answersByQuestion.get(question.id) : null;

  async function submitAnswer(event) {
    event.preventDefault();
    if (!question || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answerText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your answer.");
      setSession((current) => ({
        ...current,
        answers: [...current.answers.filter((answer) => answer.questionId !== data.answer.questionId), data.answer],
      }));
      setAnswerText("");
    } catch (submitError) {
      setError(`${submitError.message} Your response remains in the editor so you can retry.`);
    } finally {
      setBusy(false);
    }
  }

  async function finishInterview() {
    if (busy) return;
    if (!window.confirm("Finish this interview now? Submitted answers will be included in your saved report.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}/finish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the report.");
      router.push(`/mock-interview/report/${encodeURIComponent(session.id)}`);
    } catch (finishError) {
      setError(finishError.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) return <Message error={error} />;
  if (!session) return <main className="mx-auto max-w-5xl px-4 py-12 text-sm text-slate-500">Loading your interview…</main>;
  if (session.status !== "in_progress") return <main className="mx-auto max-w-3xl space-y-4 px-4 py-12"><p>This interview is closed.</p><Link className="font-semibold text-indigo-700 underline" href={`/mock-interview/report/${session.id}`}>View saved report</Link></main>;
  const completed = session.answers.length;
  const isComplete = currentIndex >= session.questions.length;
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-5 text-white">
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Module 6 · Interview room</p><h1 className="mt-1 text-xl font-bold">{session.careerTitle}</h1><p className="text-sm capitalize text-slate-300">{session.interviewType} · {session.difficulty}</p></div>
        <div className="rounded-xl bg-white/10 px-4 py-2 text-center"><p className="text-xs text-slate-300">Time remaining</p><p className="font-mono text-xl font-bold" aria-live="polite">{minutes}:{seconds}</p></div>
      </header>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Interview progress" aria-valuemin={0} aria-valuemax={session.questions.length} aria-valuenow={completed}><div className="h-full bg-indigo-600 transition-all" style={{ width: `${(completed / session.questions.length) * 100}%` }} /></div>
      <p className="text-sm text-slate-600">{completed} of {session.questions.length} answers submitted. Refreshing will not erase saved answers.</p>

      {isComplete ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-bold text-emerald-950">All questions answered</h2>
          <p className="mt-2 text-sm text-emerald-900">Finish to save your interview report and Module 5 review suggestions.</p>
          <button onClick={finishInterview} disabled={busy} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving report…" : "Finish and view report"}</button>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Question {currentIndex + 1} · {question.category}{question.skill ? ` · ${question.skill}` : ""}</p>
          <h2 className="mt-4 text-xl font-bold leading-8 text-slate-950 sm:text-2xl">{question.question}</h2>
          {savedAnswer ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Your saved response</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{savedAnswer.answerText}</p></div>
              <Feedback evaluation={savedAnswer.evaluation} score={savedAnswer.score} />
              <button onClick={() => { setCurrentIndex((index) => index + 1); setAnswerText(""); }} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white">Next question</button>
            </div>
          ) : (
            <form onSubmit={submitAnswer} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-800">Type your answer
                <textarea value={answerText} onChange={(event) => setAnswerText(event.target.value)} required minLength={5} maxLength={12000} rows={8} className="mt-2 block w-full rounded-xl border border-slate-300 p-4 text-sm leading-6 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Explain your reasoning and use a relevant example where possible." />
              </label>
              {question.kind === "coding" && <p className="text-xs text-amber-800">Code may be entered as text, but it is not executed or auto-graded.</p>}
              {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
              <div className="flex flex-wrap gap-3"><button disabled={busy || answerText.trim().length < 5} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving and reviewing…" : "Submit answer"}</button><button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Skip question</button></div>
            </form>
          )}
        </section>
      )}
      {error && isComplete && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <button type="button" onClick={finishInterview} disabled={busy} className="text-sm font-semibold text-rose-700 underline disabled:opacity-50">End interview early and save report</button>
      <p className="text-xs text-slate-500">Text-only practice session. No camera, microphone, or recording is used. Evaluations assess answer content only.</p>
    </main>
  );
}

function Feedback({ evaluation, score }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-indigo-950">Practice feedback</h3><span className="rounded-lg bg-white px-3 py-1 font-bold text-indigo-900">{score}%</span></div>
      <p className="mt-1 text-xs text-indigo-800">{evaluation.evaluationMethod === "ai_provider_practice_feedback" ? "AI-generated practice feedback" : "Structured practice review"} · not a hiring assessment</p>
      {evaluation.strengths?.length > 0 && <div className="mt-3"><p className="text-xs font-bold uppercase text-emerald-800">Strengths</p><ul className="mt-1 list-inside list-disc text-sm text-slate-700">{evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {evaluation.improvements?.length > 0 && <div className="mt-3"><p className="text-xs font-bold uppercase text-amber-800">Consider improving</p><ul className="mt-1 list-inside list-disc text-sm text-slate-700">{evaluation.improvements.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </div>
  );
}

function Message({ error }) {
  return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link className="mt-4 inline-block font-semibold text-indigo-700 underline" href="/mock-interview">Back to Module 6</Link></main>;
}
