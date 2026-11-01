"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPreparationProgress } from "@/lib/module5/preparation-plan.js";

export default function SkillDevelopmentPlanPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return undefined;
    let active = true;
    fetch(`/api/skill-development/plan?planId=${encodeURIComponent(planId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load the preparation plan.");
        if (!data.plan) throw new Error("Preparation plan not found.");
        if (active) setPlan(data.plan);
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [planId]);

  if (!planId) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl space-y-4"><p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">No preparation plan was selected.</p><Link href="/skill-development/setup" className="font-semibold text-indigo-700 underline">Open preparation setup</Link></div></main>;
  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-6xl">Loading your preparation plan…</div></main>;
  if (error) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl space-y-4"><p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/skill-development/setup" className="font-semibold text-indigo-700 underline">Open preparation setup</Link></div></main>;

  const progress = getPreparationProgress(plan.tasks, plan.attempts);
  const tasksByWeek = Array.from({ length: plan.weeks }, (_, index) => ({
    week: index + 1,
    tasks: plan.tasks.filter((task) => task.weekNumber === index + 1),
  }));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-950 p-6 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Career preparation · Plan version {plan.version}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div><h1 className="text-3xl font-bold sm:text-4xl">{plan.career}</h1><p className="mt-2 text-sm text-indigo-100">Your preparation plan begins {plan.startDate}. Keep the schedule editable and treat progress as learning evidence, not a job-readiness score.</p></div>
          <Link href={`/skill-development/progress?planId=${encodeURIComponent(plan.id)}`} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-800">View progress</Link>
          <Link href={`/skill-development/resources?planId=${encodeURIComponent(plan.id)}`} className="rounded-xl border border-white/50 px-4 py-3 text-sm font-bold text-white">Learning resources</Link>
          <Link href={`/mock-interview/setup?planId=${encodeURIComponent(plan.id)}`} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">Start AI Mock Interview</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Summary label="Duration" value={`${plan.weeks} weeks`} />
          <Summary label="Study schedule" value={`${plan.dailyHours} hrs × ${plan.studyDays} days`} />
          <Summary label="Planned hours" value={`${plan.dailyHours * plan.studyDays * plan.weeks} total`} />
          <Summary label="Tasks completed" value={`${progress.completedTasks}/${progress.taskCount} · ${progress.progressPercent}%`} />
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Preparation plan completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercent}><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress.progressPercent}%` }} /></div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-slate-950">Skill-gap analysis</h2>
          <p className="mt-1 text-sm text-slate-600">Statuses are based on evidence captured when this career was selected. Missing information is not treated as proof that you lack a skill.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plan.skillAnalysis.map((skill) => (
              <article key={skill.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold text-slate-900">{skill.name}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${skill.priority === "essential" ? "bg-rose-50 text-rose-800" : "bg-indigo-50 text-indigo-800"}`}>{skill.priority}</span></div>
                <p className="mt-2 text-xs font-semibold text-slate-700">{skill.status === "Developing" || skill.status === "Gap identified" ? "Needs improvement" : skill.status}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{skill.reason}</p>
                {skill.evidence.length > 0 && <p className="mt-2 text-xs text-slate-500">Evidence: {skill.evidence.join(" · ")}</p>}
                {skill.currentProficiency && <p className="mt-1 text-xs text-slate-500">{skill.currentProficiency}</p>}
              </article>
            ))}
          </div>
          {!plan.skillAnalysis.length && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No detailed career skill requirements are available. Use the tasks as exploratory activities and add more evidence to your profile.</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-slate-950">Your learning evidence</h2>
          <p className="mt-1 text-sm text-slate-600">Daily topic checks submitted: {progress.topicCheckCount}. Average across assessments: {progress.assessmentAverage === null ? "No results yet" : `${progress.assessmentAverage}%`}.</p>
          {progress.nextTask ? <Link href={`/skill-development/learn/${encodeURIComponent(progress.nextTask.id)}`} className="mt-4 inline-flex rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Continue: {progress.nextTask.title}</Link> : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">All scheduled learning tasks have a submitted topic check.</p>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Topic checks use a consistent 70% review threshold. A lower result recommends review; it does not force a career change or prevent continued learning.</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Weekly schedule</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Learn one topic at a time</h2></div><Link href={`/skill-development/progress?planId=${encodeURIComponent(plan.id)}`} className="text-sm font-semibold text-indigo-700 underline">Assessment history</Link></div>
        {tasksByWeek.map(({ week, tasks }) => {
          const weekReady = tasks.length > 0 && tasks.every((task) => task.status === "completed");
          const weeklyGoal = plan.weeklyGoals.find((goal) => goal.weekNumber === week);
          return (
            <section key={week} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-950">Week {week}</h3><p className="text-xs text-slate-500">{tasks.length} scheduled study day{tasks.length === 1 ? "" : "s"}</p></div>{weekReady && <Link href={`/skill-development/test/weekly/${encodeURIComponent(plan.id)}?week=${week}`} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700">Take weekly review</Link>}</div>
              <ul className="mt-2 list-inside list-disc text-xs text-slate-600">{(weeklyGoal?.goals || []).map((goal) => <li key={goal}>{goal}</li>)}</ul>
              <p className="mt-2 text-xs text-slate-500">Weekly review unlocks after each scheduled topic check is submitted.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                  <Link key={task.id} href={`/skill-development/learn/${encodeURIComponent(task.id)}`} className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
                    <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase text-indigo-700">Day {task.dayNumber} · {task.skill}</span><TaskStatus status={task.status} /></div>
                    <h4 className="mt-2 font-bold text-slate-950">{task.title}</h4>
                    <p className="mt-2 text-xs text-slate-600">{task.durationMinutes} min · {task.scheduledDate}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </section>
      </div>
    </main>
  );
}

function Summary({ label, value }) {
  return <div className="rounded-xl bg-white/10 p-3"><p className="text-[11px] font-semibold text-indigo-100">{label}</p><p className="mt-1 text-sm font-bold text-white">{value}</p></div>;
}

function TaskStatus({ status }) {
  const label = status === "completed" ? "Checked" : status === "studied" ? "Ready for check" : status === "started" ? "In progress" : "Upcoming";
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">{label}</span>;
}
