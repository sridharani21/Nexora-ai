import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getModule4CareerDetails } from "@/actions/module4-careers";
import CareerDetailActions from "../_components/career-detail-actions";
import CareerGuidanceChat from "../_components/career-guidance-chat";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${slug.replaceAll("-", " ")} | Career Explorer | Nexora AI` };
}

export default async function CareerDetailsPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { slug } = await params;
  const details = await getModule4CareerDetails(slug);
  if (!details) notFound();
  const { career, evidence } = details;

  return (
    <main className="module4-theme mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/career-explorer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft className="size-4" aria-hidden="true" />Back to career explorer</Link>
      <header className="rounded-[2rem] bg-slate-950 p-7 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{career.family} · {career.domain}</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{career.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{career.description}</p>
        <div className="mt-6"><CareerDetailActions slug={career.slug} title={career.title} saved={details.saved} initialNotes={details.notes} alternatives={details.alternatives} isCurrentGoal={details.isCurrentGoal} /></div>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <InfoList title="Typical responsibilities" items={career.responsibilities} />
        <InfoList title="Work environments" items={career.workEnvironments} />
        <InfoList title="Entry-level role examples" items={career.entryLevelRoles} />
        <InfoList title="Common tools" items={career.tools} />
        <InfoList title="Academic foundations" items={career.educationThemes} />
        <InfoList title="Qualifications" items={career.qualifications} empty="No qualification requirements are asserted for this profile." />
      </section>
      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-bold text-slate-950">Your available evidence</h2>
          <p className="mt-1 text-sm text-slate-600">Evidence indicates what is present in your information, not a complete measure of ability.</p>
          {Number.isFinite(evidence.matchScore) && (
            <div className="mt-4 rounded-xl bg-indigo-50 p-4">
              <p className="font-bold text-indigo-950">Career match score: {evidence.matchScore} / 100</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{evidence.scoring.interpretation} Missing dimensions are excluded and the remaining weights are renormalized.</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {Object.entries(evidence.dimensionScores).map(([dimension, score]) => (
                  <li key={dimension} className="rounded-lg bg-white p-2 text-xs text-slate-700">
                    <span className="font-semibold">{dimension.replace("Alignment", "")}:</span> {score === null ? "Not available" : `${score} / 100`}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-600">Scoring version: {evidence.scoring.method}. Weights: {Object.entries(evidence.scoring.weights).map(([dimension, weight]) => `${dimension.replace("Alignment", "")} ${Math.round(weight * 100)}%`).join(", ") || "No score available"}.</p>
            </div>
          )}
          <div className="mt-5 min-w-0 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900">Career skill evidence</h3>
            <table className="mt-2 w-full min-w-[560px] text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3">Skill</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Importance</th><th className="py-2 pr-3">Status</th><th className="py-2">Evidence</th></tr></thead>
              <tbody>{evidence.skillEvidence.map((item) => (
                <tr key={item.skill} className="border-b border-slate-100 align-top">
                  <th className="py-2 pr-3 font-semibold text-slate-800">{item.skill}</th>
                  <td className="py-2 pr-3 capitalize text-slate-600">{item.category}</td>
                  <td className="py-2 pr-3 capitalize text-slate-600">{item.importance}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.status}</td>
                  <td className="py-2 text-slate-600">{item.evidence.length ? item.evidence.join("; ") : "Not yet assessed"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <EvidenceGroup title="Listed skills" items={evidence.profileMatches.map((item) => item.skill)} />
          <EvidenceGroup title="Project, experience, or certification mentions" items={evidence.projectMatches.map((item) => item.skill)} />
          <EvidenceGroup title="Related technical assessment topics" items={evidence.assessmentMatches.map((item) => `${item.topic}: ${item.result} (${item.percentage}%)`)} />
          <EvidenceGroup title="Skills not yet evidenced" items={evidence.developmentSkills} />
          <EvidenceGroup title="Unknown skills (profile information unavailable)" items={evidence.unknownSkills} />
          <p className="mt-4 text-sm text-slate-700">Interest alignment: {evidence.interestAlignment.status}{evidence.interestAlignment.dimensions.length ? ` (${evidence.interestAlignment.dimensions.join(", ")})` : ""}. {evidence.technicalAssessment.status}.</p>
        </div>
        <InfoList title="Project ideas to explore" items={career.projectIdeas} />
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold text-slate-950">Beginner-to-advanced competency progression</h2>
        <p className="mt-1 text-sm text-slate-600">Illustrative practice milestones based on this profile&apos;s skills and projects; they are not hiring criteria or a professional qualification.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["beginner", "intermediate", "advanced"].map((level) => {
            const stage = career.competencyProgression?.[level];
            if (!stage) return null;
            return (
              <section key={level} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">{stage.title}</h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                  {stage.competencies.map((competency) => <li key={competency}>{competency}</li>)}
                </ul>
                <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Portfolio evidence:</span> {stage.project}</p>
              </section>
            );
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold text-slate-950">Learning resources</h2>
        <p className="mt-1 text-sm text-slate-600">Links are curated from official documentation and learning providers. Cost labels and verification dates are shown only for listed resources.</p>
        {career.learningResources.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {career.learningResources.map((resource) => (
              <li key={`${resource.provider}-${resource.title}`} className="rounded-xl border border-slate-200 p-4">
                <a href={resource.url} target="_blank" rel="noreferrer" className="font-bold text-indigo-800 underline">{resource.title}</a>
                <p className="mt-1 text-sm text-slate-700">{resource.provider} · {resource.contentType}</p>
                <p className="mt-1 text-xs text-slate-600">Related skill: {resource.relatedSkill} · {resource.cost} · Link checked {resource.verifiedAt?.slice(0, 10) || "date unavailable"}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-600">No verified learning resources have been added to this career profile yet.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold text-slate-950">Related career paths</h2>
        <div className="mt-4 flex flex-wrap gap-2">{details.alternatives.map((item) => <Link key={item.slug} href={`/career-explorer/${item.slug}`} className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">{item.title}</Link>)}</div>
      </section>
      <CareerGuidanceChat slug={career.slug} />
      <section className="rounded-2xl bg-indigo-50 p-5">
        <h2 className="text-xl font-bold text-slate-950">Continue your exploration</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {details.isCurrentGoal && <Link href={details.module5Url} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800">Continue career preparation <ExternalLink className="size-4" aria-hidden="true" /></Link>}
          <Link href={details.module6Url} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-100">Practice a Module 6 interview <ExternalLink className="size-4" aria-hidden="true" /></Link>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold text-slate-950">Profile provenance</h2>
        <p className="mt-2 text-sm text-slate-600">Reviewed {career.reviewedAt ? new Date(career.reviewedAt).toISOString().slice(0, 10) : "date unavailable"} · Nexora-authored career profile; occupation references below are related classifications, not official recommendations.</p>
        <ul className="mt-3 space-y-2">{career.sources.map((source, index) => <li key={`${source.name}-${index}`} className="text-sm text-slate-700"><a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">{source.name}</a> · {source.occupation} · {source.license}</li>)}</ul>
      </section>
    </main>
  );
}

function InfoList({ title, items, empty = "No details have been added to this career profile." }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {items.length ? <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-600" />{item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{empty}</p>}
    </section>
  );
}

function EvidenceGroup({ title, items }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{items.length ? items.join(", ") : "No entries."}</p>
    </div>
  );
}
