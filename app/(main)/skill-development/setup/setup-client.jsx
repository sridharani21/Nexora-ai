"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const initialForm = {
  weeks: "12",
  dailyHours: "2",
  studyDays: "5",
  startDate: "",
  skillLevel: "beginner",
  learningPreference: "mixed",
};

export default function SkillDevelopmentSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const careerId = searchParams.get("careerId") || "";
  const goalId = searchParams.get("goalId") || "";
  const plannedWeeklyHours = useMemo(
    () => Number(form.dailyHours) * Number(form.studyDays),
    [form.dailyHours, form.studyDays],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/skill-development/plan")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load the current career goal.");
        if (active) {
          setContext(data);
          const now = new Date();
          const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          setForm((current) => ({
            ...current,
            startDate: current.startDate || localToday,
            ...(data.setupDefaults || {}),
          }));
          if (data.goal && (
            (careerId && careerId !== data.goal.careerId) ||
            (goalId && goalId !== data.goal.id)
          )) {
            setError("This link does not match your current career goal. Review the active goal below.");
          }
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [careerId, goalId]);

  async function createPlan(event) {
    event.preventDefault();
    if (!context?.goal) {
      setError("Choose a current career in career explorer before creating a preparation plan.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/skill-development/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          careerId: context.goal.careerId,
          goalId: context.goal.id,
          weeks: Number(form.weeks),
          dailyHours: Number(form.dailyHours),
          studyDays: Number(form.studyDays),
          startDate: form.startDate,
          skillLevel: form.skillLevel,
          learningPreference: form.learningPreference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create the preparation plan.");
      toast.success("Your career preparation plan is ready.");
      router.push(`/skill-development/plan?planId=${encodeURIComponent(data.plan.id)}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-4xl">Loading your current career goal…</div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Career preparation</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Set up your learning plan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Choose a schedule you can maintain. Planned study time helps organize activities; it does not guarantee skill mastery.</p>
      </header>

      {!context?.goal ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-950">Choose your career first</h2>
          <p className="mt-2 text-sm text-amber-900">Choose a career before creating a preparation plan. No current career is selected for this account yet.</p>
          <Link href="/career-explorer" className="mt-4 inline-flex rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white">Go to career explorer</Link>
        </section>
      ) : (
        <form onSubmit={createPlan} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <section className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Current career</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{context.goal.title}</h2>
            <Link href={`/career-explorer/${context.goal.slug || ""}`} className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">Review or change your career in career explorer</Link>
          </section>

          {context.plan && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-950">You have an active {context.plan.weeks}-week plan for this career.</p>
              <Link href={`/skill-development/plan?planId=${encodeURIComponent(context.plan.id)}`} className="text-sm font-bold text-indigo-700 underline">Continue existing plan</Link>
            </section>
          )}
          {context.versions?.length > 0 && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h2 className="font-bold text-slate-900">Saved plan versions</h2>
              <ul className="mt-2 space-y-2">
                {context.versions.slice(0, 5).map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700">{version.career} · version {version.version} · {version.status}</span>
                    <Link href={`/skill-development/plan?planId=${encodeURIComponent(version.id)}`} className="font-semibold text-indigo-700 underline">Open history</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Preparation duration
              <select required value={form.weeks} onChange={(event) => setForm({ ...form, weeks: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                {[4, 6, 8, 12, 16, 20, 24, 32, 52].map((weeks) => <option key={weeks} value={weeks}>{weeks} weeks</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">Daily study time
              <select required value={form.dailyHours} onChange={(event) => setForm({ ...form, dailyHours: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                {[0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">Study days per week
              <select required value={form.studyDays} onChange={(event) => setForm({ ...form, studyDays: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                {[1, 2, 3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"} per week</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">Start date
              <input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3" />
            </label>
            <label className="text-sm font-semibold text-slate-800">Current skill level
              <select required value={form.skillLevel} onChange={(event) => setForm({ ...form, skillLevel: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">This is only a starting point. Choose the level that best matches your current experience.</span>
            </label>
            <label className="text-sm font-semibold text-slate-800">Learning preference
              <select required value={form.learningPreference} onChange={(event) => setForm({ ...form, learningPreference: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                <option value="mixed">A mix of formats</option><option value="videos">Videos</option><option value="reading">Reading and documentation</option><option value="practice">Hands-on practice</option>
              </select>
            </label>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="font-bold text-slate-900">Schedule summary</h2>
            <p className="mt-2 text-sm text-slate-700">
              {form.dailyHours} hours/day × {form.studyDays} days/week = <strong>{plannedWeeklyHours} planned hours/week</strong>
              {" · "}{plannedWeeklyHours * Number(form.weeks)} total planned hours over {form.weeks} weeks.
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">The plan schedules one learning activity per selected study day and reserves a small portion of each session for a topic check. Learning time is a planning estimate, not a promise of mastery.</p>
          </section>

          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/career-explorer" className="text-sm font-semibold text-indigo-700 underline">Change selected career</Link>
            <button type="submit" disabled={submitting} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">
              {submitting ? "Building your plan…" : "Generate my preparation plan"}
            </button>
          </div>
        </form>
      )}
      </div>
    </main>
  );
}
