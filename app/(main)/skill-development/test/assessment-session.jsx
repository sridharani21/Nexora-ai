"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AssessmentSession({ taskId, planId, weekNumber }) {
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const weekly = !taskId;
  const backUrl = planId ? `/skill-development/plan?planId=${encodeURIComponent(planId)}` : "/skill-development/setup";

  useEffect(() => {
    if (!planId || (!taskId && !weekNumber)) {
      setError("Assessment link is missing its plan or topic.");
      setLoading(false);
      return undefined;
    }
    const query = new URLSearchParams({ planId });
    if (taskId) query.set("taskId", taskId);
    if (weekNumber) query.set("weekNumber", weekNumber);
    let active = true;
    fetch(`/api/skill-development/assessments?${query}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this assessment.");
        if (active) setAssessment(data.assessment);
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [planId, taskId, weekNumber]);

  async function submit(event) {
    event.preventDefault();
    if (!assessment) return;
    setSubmitting(true);
    setError("");
    const request = {
      planId,
      submissionKey: crypto.randomUUID(),
      answers,
      ...(taskId ? { taskId } : { weekNumber: Number(weekNumber) }),
    };
    try {
      const response = await fetch("/api/skill-development/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your answers.");
      setResult(data.feedback || data.result.feedback);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-3xl">Loading assessment…</div></main>;
  if (error && !assessment) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl space-y-4"><p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{error}</p><Link href={backUrl} className="font-semibold text-indigo-700 underline">Back to the plan</Link></div></main>;

  const questions = assessment?.questions || [];
  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:py-10"><div className="mx-auto max-w-6xl space-y-6">
      <Link href={backUrl} className="text-sm font-semibold text-indigo-700 underline">Back to preparation plan</Link>
      <header className="rounded-2xl bg-gradient-to-r from-indigo-950 to-violet-800 p-5 text-white sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-200">{weekly ? `Week ${weekNumber} review` : "Daily topic practice"}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{assessment?.career}</h1>
        <p className="mt-2 text-sm text-indigo-100">{questions.length} questions · pass threshold {assessment?.passThreshold}%</p>
        {!result && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-indigo-100">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span>{answeredCount} answered</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Assessment progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount}>
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </header>
      {result ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="rounded-xl bg-indigo-50 p-4"><h2 className="text-xl font-bold text-indigo-950">Your result: {result.score}%</h2><p className="mt-1 text-sm text-indigo-900">{result.correctCount} of {result.total} correct · {result.passed ? "Threshold reached." : "Review the concepts below and try again when ready."}</p></div>
          {result.results.map((item, index) => {
            const question = assessment.questions.find((candidate) => candidate.id === item.questionId);
            return <article key={item.questionId} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{index + 1}. {question?.prompt}</p><p className={`mt-2 text-sm font-semibold ${item.isCorrect ? "text-emerald-700" : "text-amber-800"}`}>{item.isCorrect ? "Correct" : `Review recommended · correct answer: ${question?.options[item.correctAnswer]}`}</p><p className="mt-1 text-sm text-slate-600">{item.explanation}</p></article>;
          })}
          {result.weakConcepts?.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Suggested revision: {result.weakConcepts.join(", ")}</p>}
          <Link href={backUrl} className="inline-flex rounded-lg bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Return to plan</Link>
        </section>
      ) : (
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            {question && (
              <>
                <fieldset>
                  <legend className="text-lg font-bold leading-7 text-slate-950 sm:text-xl">{question.prompt}</legend>
                  <div className="mt-6 space-y-3">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === optionIndex;
                      return (
                        <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100" : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"}`}>
                          <input required type="radio" name={question.id} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} className="mt-1 accent-indigo-700" />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  {currentIndex < questions.length - 1 ? (
                    <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-800">Next question</button>
                  ) : (
                    <button type="submit" disabled={submitting || !assessment || answeredCount !== questions.length} className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Checking your answers…" : "Submit assessment"}</button>
                  )}
                </div>
                {currentIndex === questions.length - 1 && answeredCount !== questions.length && (
                  <p className="mt-3 text-right text-xs text-amber-800">Answer all {questions.length} questions before submitting.</p>
                )}
              </>
            )}
            {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          </section>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Question navigator</h2>
              <span className="text-xs text-slate-500">{answeredCount}/{questions.length}</span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-5">
              {questions.map((item, index) => {
                const answered = Object.hasOwn(answers, item.id);
                const current = index === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Question ${index + 1}${answered ? ", answered" : ", unanswered"}${current ? ", current" : ""}`}
                    aria-current={current ? "step" : undefined}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-10 rounded-lg text-sm font-bold transition-colors ${current ? "bg-indigo-700 text-white ring-2 ring-indigo-200" : answered ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Use the numbers to move directly to a question. Green numbers are answered.</p>
            {currentIndex === questions.length - 1 && (
              <button type="submit" disabled={submitting || !assessment || answeredCount !== questions.length} className="mt-4 hidden w-full rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 lg:block">
                {submitting ? "Submitting…" : "Submit assessment"}
              </button>
            )}
          </aside>
        </form>
      )}
    </div></main>
  );
}
