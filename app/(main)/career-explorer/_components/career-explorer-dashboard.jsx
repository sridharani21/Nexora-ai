"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Check, ChevronRight, CircleAlert, GitCompareArrows, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { chooseModule4Career, generateModule4Recommendations, saveModule4CareerPreferences, toggleModule4SavedCareer } from "@/actions/module4-careers";

const readinessLabel = (value) => value ? "Complete" : "Not completed";

export default function CareerExplorerDashboard({ initialData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [family, setFamily] = useState("all");
  const [interest, setInterest] = useState("all");
  const [skill, setSkill] = useState("all");
  const [selected, setSelected] = useState([]);
  const [savedSlugs, setSavedSlugs] = useState(initialData.savedSlugs);
  const [pending, startTransition] = useTransition();
  const eligible = initialData.readiness.eligible;
  const resultsCurrent = eligible && !initialData.latestRun?.stale;
  const [preferenceForm, setPreferenceForm] = useState({
    roles: initialData.preferences.roles.join(", "),
    domains: initialData.preferences.domains.join(", "),
    interests: initialData.preferences.interests.join(", "),
    goals: initialData.preferences.goals,
  });
  const domains = [...new Set(initialData.catalog.map((career) => career.domain))].sort();
  const families = [...new Set(initialData.catalog.map((career) => career.family))].sort();
  const matchesFilters = (career) => (
    (domain === "all" || career.domain === domain) &&
    (family === "all" || career.family === family) &&
    (interest === "all" || career.interestDimensions.includes(interest)) &&
    (skill === "all" || career.skills.some((item) => (
      item.name.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(item.name.toLowerCase())
    ))) &&
    (!query || `${career.title} ${career.family} ${career.domain} ${career.summary} ${career.skills.map((item) => item.name).join(" ")}`.toLowerCase().includes(query.toLowerCase()))
  );
  const filtered = initialData.catalog.filter(matchesFilters);
  const recommended = (resultsCurrent ? initialData.latestRun?.recommendations || [] : []).filter(matchesFilters);
  const visibleRecommendedSlugs = new Set(recommended.map((career) => career.slug));
  const saved = initialData.catalog.filter((career) => savedSlugs.includes(career.slug));

  function refreshRecommendations() {
    startTransition(async () => {
      const result = await generateModule4Recommendations();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Your career exploration results are ready.");
      router.refresh();
    });
  }

  function chooseCareer(career) {
    startTransition(async () => {
      const result = await chooseModule4Career({
        slug: career.slug,
        ...(career.recommendationId ? { recommendationId: career.recommendationId } : {}),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${career.title} saved as your current career goal.`);
      router.push(result.module5Url);
    });
  }

  function toggleSave(career) {
    const isSaved = savedSlugs.includes(career.slug);
    startTransition(async () => {
      const result = await toggleModule4SavedCareer({ slug: career.slug, saved: !isSaved });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSavedSlugs((items) => isSaved ? items.filter((slug) => slug !== career.slug) : [...items, career.slug]);
    });
  }

  function toggleCompare(slug) {
    setSelected((items) => {
      if (items.includes(slug)) return items.filter((item) => item !== slug);
      if (items.length === 3) {
        toast.error("Compare up to three careers at a time.");
        return items;
      }
      return [...items, slug];
    });
  }

  function savePreferences(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveModule4CareerPreferences(Object.fromEntries(
        Object.entries(preferenceForm).map(([key, value]) => [
          key,
          key === "goals" ? value : value.split(",").map((item) => item.trim()).filter(Boolean),
        ]),
      ));
      if (!result.success) toast.error(result.error);
      else {
        toast.success("Career preferences saved.");
        router.refresh();
      }
    });
  }

  const CareerCard = ({ career, rank }) => (
    <article key={career.slug} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          {rank && <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Exploration {String(rank).padStart(2, "0")}</p>}
          <p className="mt-1 text-xs font-semibold text-slate-500">{career.family} · {career.domain}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-950">{career.title}</h3>
        </div>
        <button onClick={() => toggleSave(career)} aria-label={savedSlugs.includes(career.slug) ? `Unsave ${career.title}` : `Save ${career.title}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700">
          <Bookmark className={`size-5 ${savedSlugs.includes(career.slug) ? "fill-indigo-600 text-indigo-600" : ""}`} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{career.summary}</p>
      {career.evidence && (
        <div className="mt-4 rounded-xl bg-indigo-50/70 p-3 text-sm text-slate-700">
          <p className="font-semibold text-indigo-950">Evidence to explore</p>
          <p className="mt-1">{career.evidence.signals.length ? career.evidence.signals.join(" · ") : "No direct match signals yet; this is a catalog option, not a personalized conclusion."}</p>
          {career.evidence.developmentSkills.length > 0 && <p className="mt-2 text-xs">Not yet evidenced: {career.evidence.developmentSkills.slice(0, 3).join(", ")}</p>}
          {Number.isFinite(career.evidence.matchScore) && (
            <div className="mt-3 border-t border-indigo-100 pt-3">
              <p className="font-bold text-indigo-950">Career match score: {career.evidence.matchScore} / 100</p>
              <p className="mt-1 text-xs text-slate-600">An exploration aid, not a probability of employment or a measure of ability.</p>
              <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                {Object.entries(career.evidence.dimensionScores || {}).map(([label, value]) => (
                  <li key={label}>{label.replace("Alignment", "")}: {value === null ? "Not available" : `${value} / 100`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <Link href={`/career-explorer/${career.slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 hover:text-indigo-900">
          Explore details <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        <button onClick={() => toggleCompare(career.slug)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selected.includes(career.slug) ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          {selected.includes(career.slug) ? "Selected" : "Compare"}
        </button>
        <button onClick={() => chooseCareer(career)} disabled={pending} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50">Choose career</button>
      </div>
      {career.explanation && <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{career.explanation}</p>}
    </article>
  );

  return (
    <main className="module4-theme mx-auto w-full max-w-7xl space-y-9 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-[2rem] bg-slate-950 p-7 text-white sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Career exploration</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Career paths for {initialData.student.displayName || "you"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Explore several possibilities grounded in the evidence you have shared. These are directions to investigate, not predictions of success.</p>
          </div>
          <button onClick={refreshRecommendations} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-60">
            <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
            {initialData.latestRun ? "Refresh exploration" : "Generate career options"}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Data readiness">
        {[
          ["Profile", initialData.student.profileReady ? "Available" : "Incomplete", initialData.student.profileReady],
          ["Technical assessment", readinessLabel(initialData.student.assessment.completed), initialData.student.assessment.completed],
          ["RIASEC interests", readinessLabel(initialData.student.riasec.completed), initialData.student.riasec.completed],
          ["Experience", `${initialData.student.projectCount} projects · ${initialData.student.skillCount} listed skills`, initialData.student.projectCount + initialData.student.skillCount > 0],
        ].map(([label, status, isAvailable]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">
              {isAvailable
                ? <Check className="size-4 text-indigo-600" aria-hidden="true" />
                : <CircleAlert className="size-4 text-amber-600" aria-hidden="true" />}
              {status}
            </p>
          </div>
        ))}
      </section>

      {!eligible && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-labelledby="module4-readiness-heading">
          <h2 id="module4-readiness-heading" className="text-lg font-bold text-amber-950">Complete these steps for personalized recommendations</h2>
          <p className="mt-1 text-sm text-amber-900">The career catalogue remains available, but we do not rank personalized options until all required evidence is complete and valid.</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {initialData.readiness.missing.map((item) => <li key={item.key} className="min-w-48 rounded-lg bg-white/70 p-3"><Link href={item.href} className="font-bold text-indigo-800 underline">{item.label}</Link><p className="mt-1 text-xs text-amber-950">{item.reason}</p></li>)}
          </ul>
        </section>
      )}

      {initialData.currentGoal && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Current career goal</p>
          <h2 className="mt-1 text-xl font-bold text-emerald-950">{initialData.currentGoal.title}</h2>
          <Link href={`/career-explorer/${initialData.currentGoal.slug}`} className="mt-2 inline-block text-sm font-bold text-emerald-900 underline">Review goal and evidence</Link>
        </section>
      )}

      {initialData.goalHistory.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="career-goal-history-heading">
          <h2 id="career-goal-history-heading" className="text-lg font-bold text-slate-950">Previous career goals</h2>
          <ul className="mt-3 space-y-3">
            {initialData.goalHistory.map((goal) => (
              <li key={goal.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <Link href={`/career-explorer/${goal.slug}`} className="font-semibold text-indigo-700">{goal.title}</Link>
                  <p className="mt-1 text-xs text-slate-600">Selected {goal.selectedAt.slice(0, 10)} · ended {goal.endedAt.slice(0, 10)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {initialData.latestRun && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Latest exploration</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">Options grounded in your evidence</h2>
              <p className="mt-1 text-sm text-slate-600">Personalized using your profile, assessment, and interests. Ranking: {initialData.latestRun.rankingMethod}.</p>
            </div>
            <Link href={`/career-explorer/runs/${initialData.latestRun.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700">View saved run <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
          {!eligible && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">This saved run is historical. Current prerequisites are incomplete, so its personalized results are hidden until the required evidence is restored.</p>
          )}
          {eligible && initialData.latestRun.stale && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Your profile or assessment evidence has changed since this run. Refresh recommendations to use the latest inputs; old results are hidden until then.</p>
          )}
          {initialData.latestRun.limitations.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Evidence notes</p>
              <ul className="mt-2 list-inside list-disc space-y-1">{initialData.latestRun.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </div>
          )}
          {resultsCurrent && (recommended.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{recommended.map((career) => <CareerCard key={career.slug} career={career} rank={career.rank} />)}</div> : <p className="rounded-xl bg-slate-100 p-5 text-sm text-slate-600">No recommendations match the current filters.</p>)}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Career catalog</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Explore all supported paths</h2></div>
          {selected.length >= 2 && <Link href={`/career-explorer/compare?careers=${selected.join(",")}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800"><GitCompareArrows className="size-4" aria-hidden="true" />Compare {selected.length}</Link>}
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <label className="relative"><span className="sr-only">Search careers</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, skills, or domains" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="relative"><span className="sr-only">Filter by domain</span><SlidersHorizontal className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><select value={domain} onChange={(event) => setDomain(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm"><option value="all">All domains</option>{domains.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Filter by career family</span><select value={family} onChange={(event) => setFamily(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">All career families</option>{families.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Filter by RIASEC interest</span><select value={interest} onChange={(event) => setInterest(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">All interest links</option>{[["R","Realistic"],["I","Investigative"],["A","Artistic"],["S","Social"],["E","Enterprising"],["C","Conventional"]].map(([code, label]) => <option key={code} value={code}>{label} interest</option>)}</select></label>
          <label><span className="sr-only">Filter by current skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">All skill links</option>{initialData.student.skills.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.filter((career) => !visibleRecommendedSlugs.has(career.slug)).map((career) => <CareerCard key={career.slug} career={career} />)}
          {filtered.length === 0 && <p className="rounded-xl bg-slate-100 p-5 text-sm text-slate-600">No careers match your search and filters.</p>}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">Saved careers</h2><Link href="/career-explorer/saved" className="text-sm font-bold text-indigo-700">See all</Link></div>
          {saved.length ? <div className="mt-4 flex flex-wrap gap-2">{saved.map((career) => <Link key={career.slug} href={`/career-explorer/${career.slug}`} className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">{career.title}</Link>)}</div> : <p className="mt-3 text-sm text-slate-600">Save a career to build your shortlist.</p>}
        </div>
        <form onSubmit={savePreferences} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-bold text-slate-950">Your career preferences</h2>
          <p className="mt-1 text-sm text-slate-600">Comma-separate role, domain, and interest terms.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["roles", "domains", "interests"].map((key) => <label key={key} className="text-xs font-semibold capitalize text-slate-600">{key}<input value={preferenceForm[key]} onChange={(event) => setPreferenceForm({ ...preferenceForm, [key]: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-900" /></label>)}
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Goals<textarea value={preferenceForm.goals} onChange={(event) => setPreferenceForm({ ...preferenceForm, goals: event.target.value })} maxLength={1500} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-900" /></label>
          </div>
          <button disabled={pending} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save preferences</button>
        </form>
      </section>
      {initialData.history.length > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-950">Recent recommendation runs</h2>
          <ul className="mt-3 space-y-2">{initialData.history.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm"><span>{run.createdAt.slice(0, 10)} · {run.candidateCount} career options · deterministic evidence ranking</span><Link href={`/career-explorer/runs/${run.id}`} className="font-bold text-indigo-700">Open run</Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}
