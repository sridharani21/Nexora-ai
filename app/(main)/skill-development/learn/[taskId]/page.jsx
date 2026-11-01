"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LearningTopicPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/skill-development/tasks/${encodeURIComponent(taskId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this topic.");
        if (active) setTask(data.task);
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [taskId]);

  async function updateStatus(status) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/skill-development/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update this task.");
      setTask(data.task);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !task) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/skill-development/setup" className="mt-4 inline-block text-sm font-semibold text-indigo-700 underline">Open preparation setup</Link></div></main>;
  if (!task) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-3xl">Loading learning activity…</div></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-12"><div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/skill-development/plan?planId=${encodeURIComponent(task.plan.id)}`} className="text-sm font-semibold text-indigo-700 underline">Back to weekly plan</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Week {task.weekNumber} · Day {task.dayNumber} · {task.durationMinutes} minutes</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{task.title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p><p className="mt-2 text-xs text-slate-500">{task.plan.career} · Scheduled {task.scheduledDate}</p></header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">Learning objectives</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">{task.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
      </section>
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="text-lg font-bold text-indigo-950">Practical activity</h2>
        <p className="mt-2 text-sm leading-6 text-indigo-900">{task.activity}</p>
        <p className="mt-3 text-xs leading-5 text-indigo-800"><strong>Completion criteria:</strong> {task.completionCriteria}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">Learning resources</h2>
        {task.resources.length ? <ul className="mt-3 space-y-3">{task.resources.map((resource) => <li key={`${resource.provider}:${resource.title}`}><a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 underline">{resource.title}</a><p className="text-xs text-slate-500">{resource.provider} · {resource.contentType || resource.type} · {resource.cost}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No directly matched verified link is available for this specific skill. Review the career&apos;s official resource list or use a trusted reference you already know.</p>}
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div><p className="font-semibold text-slate-900">Activity status: {task.status}</p><p className="mt-1 text-xs text-slate-500">Your topic check must be submitted before this task counts as completed.</p></div>
        <div className="flex flex-wrap gap-2">
          {task.status === "pending" && <button type="button" disabled={saving} onClick={() => updateStatus("started")} className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50">Start learning</button>}
          {["pending", "started"].includes(task.status) && <button type="button" disabled={saving} onClick={() => updateStatus("studied")} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Mark topic studied"}</button>}
          {["studied", "completed"].includes(task.status) && <Link href={`/skill-development/test/${encodeURIComponent(task.id)}?planId=${encodeURIComponent(task.plan.id)}`} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Take daily topic check</Link>}
        </div>
      </section>
    </div></main>
  );
}
