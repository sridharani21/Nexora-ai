import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { compareModule4Careers } from "@/actions/module4-careers";

export const metadata = { title: "Compare careers | Nexora AI" };

const listOrUnavailable = (values, fallback = "Not available in this career profile") => (
  values.length ? values.join("; ") : fallback
);

export default async function CompareCareersPage({ searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const params = await searchParams;
  const slugs = (params.careers || "").split(",").filter(Boolean).slice(0, 3);
  const careers = await compareModule4Careers(slugs);
  if (!careers) {
    return <main className="module4-theme mx-auto max-w-5xl px-4 py-12"><Link href="/career-explorer" className="font-semibold text-indigo-700">Back to Career Explorer</Link><h1 className="mt-6 text-3xl font-bold text-slate-950">Choose two or three different careers to compare</h1></main>;
  }
  const rows = [
    ["Family and domain", (career) => `${career.family} · ${career.domain}`],
    ["Summary", (career) => career.summary],
    ["Skills in the career profile", (career) => listOrUnavailable(career.skills.map((skill) => `${skill.name} (${skill.importance})`))],
    ["Responsibilities", (career) => listOrUnavailable(career.responsibilities)],
    ["Work environments", (career) => listOrUnavailable(career.workEnvironments)],
    ["Entry-level roles", (career) => listOrUnavailable(career.entryLevelRoles)],
    ["Common tools", (career) => listOrUnavailable(career.tools)],
    ["Education themes", (career) => listOrUnavailable(career.educationThemes)],
    ["Qualifications", (career) => listOrUnavailable(career.qualifications, "No qualification requirements are asserted for this profile")],
    ["Learning resources", (career) => career.learningResources.map((resource) => `${resource.title} (${resource.provider}, ${resource.cost})`).join("; ") || "No verified learning resources currently listed"],
    ["Competency progression", (career) => ["beginner", "intermediate", "advanced"]
      .map((level) => {
        const stage = career.competencyProgression?.[level];
        return stage ? `${stage.title}: ${stage.project}` : `${level}: not available`;
      })
      .join("; ") || "Competency progression is not available"],
    ["Career match score", (career) => career.evidence.matchScore === null
      ? "Not available from the current evidence"
      : `${career.evidence.matchScore} / 100 (exploration aid, not an employment probability)`],
    ["Score dimensions", (career) => Object.entries(career.evidence.dimensionScores || {})
      .map(([dimension, score]) => `${dimension.replace("Alignment", "")}: ${score === null ? "not available" : `${score} / 100`}`)
      .join("; ") || "No score dimensions can be calculated from the available evidence"],
    ["Skills listed in profile", (career) => career.evidence.profileMatches.map((item) => item.skill).join(", ") || "No matching listed skills found"],
    ["Project / experience evidence", (career) => career.evidence.projectMatches.map((item) => item.skill).join(", ") || "No matched mentions found"],
    ["Related assessment topics", (career) => career.evidence.assessmentMatches.map((item) => `${item.topic} (${item.percentage}%)`).join(", ") || career.evidence.technicalAssessment.status],
    ["Not yet evidenced", (career) => career.evidence.developmentSkills.join(", ") || "No specific missing evidence inferred"],
    ["Skill evidence status", (career) => career.evidence.skillEvidence.map((item) => `${item.skill}: ${item.status}`).join("; ")],
    ["Interest alignment", (career) => career.evidence.interestAlignment.status],
    ["Project ideas", (career) => listOrUnavailable(career.projectIdeas)],
  ];
  return (
    <main className="module4-theme mx-auto w-full max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/career-explorer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft className="size-4" aria-hidden="true" />Back to Career Explorer</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Side-by-side exploration</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Compare career paths</h1><p className="mt-2 text-sm text-slate-600">This comparison highlights differences; it does not declare a universally better choice.</p></header>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead><tr><th className="w-48 border-b border-slate-200 bg-slate-50 p-4 text-xs uppercase tracking-wider text-slate-500">Consideration</th>{careers.map((career) => <th key={career.slug} className="border-b border-slate-200 p-4 align-top"><Link href={`/career-explorer/${career.slug}`} className="text-lg font-bold text-indigo-800">{career.title}</Link><p className="mt-1 text-xs font-medium text-slate-500">{career.family}</p></th>)}</tr></thead>
          <tbody>{rows.map(([label, value]) => <tr key={label} className="border-b border-slate-100 last:border-0"><th className="bg-slate-50/70 p-4 align-top text-sm font-semibold text-slate-700">{label}</th>{careers.map((career) => <td key={career.slug} className="p-4 align-top text-sm leading-6 text-slate-600">{value(career)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
