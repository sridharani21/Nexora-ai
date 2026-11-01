"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SkillDevelopmentResourcesPage() {
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
        if (!response.ok) throw new Error(data.error || "Unable to load plan resources.");
        if (!data.plan) throw new Error("Preparation plan not found.");
        if (active) setPlan(data.plan);
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [planId]);

  if (!planId) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Choose a preparation plan to view its resources.</p><Link href="/skill-development/setup" className="mt-4 inline-block font-semibold text-indigo-700 underline">Open preparation setup</Link></div></main>;
  if (error) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/skill-development/setup" className="mt-4 inline-block font-semibold text-indigo-700 underline">Open preparation setup</Link></div></main>;
  if (!plan) return <main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-5xl">Loading learning resources…</div></main>;

  const resources = new Map();
  for (const task of plan.tasks) {
    for (const resource of task.resources || []) {
      if (typeof resource.url === "string" && resource.url.startsWith("https://")) {
        resources.set(resource.url, { ...resource, relatedSkill: resource.relatedSkill || task.skill });
      }
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:py-12"><div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/skill-development/plan?planId=${encodeURIComponent(plan.id)}`} className="text-sm font-semibold text-indigo-700 underline">Back to preparation plan</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Career preparation · Resources</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{plan.career} learning resources</h1><p className="mt-2 text-sm text-slate-600">Vetted career-catalogue links are used when available. If a skill has no matching catalogue link, a skill-specific search on a learning platform is provided instead; review search results for quality and fit.</p></header>
      {resources.size ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {[...resources.values()].map((resource) => (
            <li key={resource.url} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{resource.relatedSkill || "Career learning"}</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950"><a href={resource.url} target="_blank" rel="noopener noreferrer" className="underline decoration-indigo-300 underline-offset-4 hover:text-indigo-700">{resource.title}</a></h2>
              {resource.description && <p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p>}
              <p className="mt-3 text-xs text-slate-500">{[resource.provider, resource.contentType || resource.type, resource.cost].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">No catalogue links are matched yet</h2><p className="mt-2 text-sm leading-6 text-amber-900">The plan can still be followed using its learning objectives and practical activities. Use trusted official documentation for the selected skill; resources are not invented when no vetted link is available.</p></section>
      )}
    </div></main>
  );
}
