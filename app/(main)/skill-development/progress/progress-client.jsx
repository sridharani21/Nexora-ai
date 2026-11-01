"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getPreparationProgress,
  summarizeWeeklyAssessments,
} from "@/lib/module5/preparation-plan.js";

export default function SkillDevelopmentProgressPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return undefined;
    let active = true;
    fetch(`/api/skill-development/plan?planId=${encodeURIComponent(planId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load progress.");
        if (!data.plan) throw new Error("Preparation plan not found.");
        if (active) setPlan(data.plan);
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [planId]);

  if (!planId) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Choose a preparation plan to view progress.</p><Link href="/skill-development/setup" className="mt-4 inline-block font-semibold text-indigo-700 underline">Start preparation</Link></div></main>;
  if (error) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/skill-development/setup" className="mt-4 inline-block font-semibold text-indigo-700 underline">Start preparation</Link></div></main>;
  if (!plan) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-5xl">Loading your progress…</div></main>;
  const progress = getPreparationProgress(plan.tasks, plan.attempts);
  const weeklySummaries = summarizeWeeklyAssessments(plan.attempts);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-12"><div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/skill-development/plan?planId=${encodeURIComponent(plan.id)}`} className="text-sm font-semibold text-indigo-700 underline">Back to preparation plan</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Career preparation · Progress</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{plan.career} learning progress</h1><p className="mt-2 text-sm text-slate-600">Plan version {plan.version} · started {plan.startDate} · {plan.dailyHours} hours/day, {plan.studyDays} study days/week</p></header>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Topics with a submitted check" value={`${progress.completedTasks}/${progress.taskCount}`} />
        <Metric label="Plan completion" value={`${progress.progressPercent}%`} />
        <Metric label="Assessment average" value={progress.assessmentAverage === null ? "No results yet" : `${progress.assessmentAverage}%`} />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div><h2 className="font-bold text-indigo-950">Ready to practise an interview?</h2><p className="mt-1 text-sm text-indigo-900">Use this career and preparation plan in your separate Module 6 interview session.</p></div>
        <Link href={`/mock-interview/setup?planId=${encodeURIComponent(plan.id)}`} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Start AI Mock Interview</Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold text-slate-950">Assessment history</h2>
        {!plan.attempts.length ? <p className="mt-3 text-sm text-slate-600">Your submitted daily and weekly assessments will appear here.</p> : (
          <ul className="mt-4 space-y-3">
            {plan.attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div><p className="font-semibold text-slate-900">{attempt.kind === "weekly" ? `Week ${attempt.weekNumber} review` : `Week ${attempt.weekNumber} topic check`} · Attempt {attempt.attemptNumber}</p><p className="mt-1 text-xs text-slate-500">Submitted {new Date(attempt.submittedAt).toLocaleString("en-IN")}</p></div>
                <div className="text-right"><p className="text-lg font-bold text-slate-950">{attempt.score}%</p><p className={`text-xs font-semibold ${attempt.passed ? "text-emerald-700" : "text-amber-700"}`}>{attempt.passed ? "Threshold reached" : "Review recommended"}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {weeklySummaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-bold text-slate-950">Weekly assessment results</h2>
          {weeklySummaries.map((summary) => <p key={summary.weekNumber} className="mt-3 text-sm text-slate-700">Week {summary.weekNumber}: latest {summary.latestScore}%, average {summary.averageScore}% across {summary.attempts} attempt{summary.attempts === 1 ? "" : "s"} ({summary.latestPassed ? "threshold reached" : "review suggested"}).</p>)}
        </section>
      )}
      {progress.weakConcepts.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">Suggested review areas</h2>
          <p className="mt-1 text-sm text-amber-900">Based on incorrect answers in your saved assessment attempts; these are practice suggestions, not skill diagnoses.</p>
          <ul className="mt-3 flex flex-wrap gap-2">{[...new Set(progress.weakConcepts)].map((concept) => <li key={concept} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950">{concept}</li>)}</ul>
        </section>
      )}
      {progress.recentScores.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-950">Recent score trend</h2>
          <ol className="mt-3 flex flex-wrap gap-2">{[...progress.recentScores].reverse().map((attempt, index) => <li key={`${attempt.kind}-${attempt.weekNumber}-${attempt.submittedAt}-${index}`} className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{attempt.kind === "weekly" ? "Weekly" : "Daily"} · W{attempt.weekNumber}: <strong>{attempt.score}%</strong></li>)}</ol>
        </section>
      )}
      {progress.nextTask && <Link href={`/skill-development/learn/${encodeURIComponent(progress.nextTask.id)}`} className="inline-flex rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Next activity: {progress.nextTask.title} · {progress.nextTask.scheduledDate}</Link>}
    </div></main>
  );
}

function Metric({ label, value }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></article>;
}
