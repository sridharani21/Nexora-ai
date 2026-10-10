import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { getReadiness } from "@/actions/prep-readiness";
import { ROLE_REQUIREMENTS } from "@/data/prep-readiness";
import SiteNav from "../components/site-nav";

const labels = { aptitude: "Aptitude", programming: "Programming", dsa: "DSA", technical: "Technical", communication: "Communication" };

export default async function WhatIfPage() {
  const readiness = await getReadiness();
  if (!readiness) return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Career path comparison</div><h1>Compare career paths before committing.</h1><p className="lead">Complete your assessment analysis to compare your current evidence with alternative roles.</p><Link className="button button-primary" href="/placement-prep/readiness">Continue to analysis <ArrowRight size={16} /></Link></section></main></>;
  const current = Object.fromEntries(Object.entries(readiness.skillProfile).map(([key, item]) => [key, item.score]));
  const options = Object.entries(ROLE_REQUIREMENTS).map(([key, role]) => {
    const requirements = Object.entries(role.requirements);
    const measured = requirements.filter(([skill]) => Number.isFinite(current[skill]));
    const gaps = measured
      .map(([skill, target]) => ({ skill, gap: Math.max(0, target - current[skill]) }))
      .filter((item) => item.gap > 0)
      .sort((a, b) => b.gap - a.gap);
    const fit = measured.length
      ? Math.round(measured.reduce((sum, [skill, target]) => sum + Math.min(100, (current[skill] / target) * 100), 0) / measured.length)
      : null;
    return {
      key,
      label: role.label,
      fit,
      gaps,
      coverage: Math.round((measured.length / requirements.length) * 100),
      unknownSkills: requirements.filter(([skill]) => !Number.isFinite(current[skill])).map(([skill]) => labels[skill] || skill),
    };
  }).sort((a, b) => b.fit - a.fit);
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Career path comparison</div><h1>Compare career paths before committing.</h1><p className="lead">Fit uses only measured assessment and practice results against general role benchmarks. This is not an employer requirement or hiring prediction. A transition-effort estimate is withheld when any required skill lacks evidence.</p><div className="actions"><Link className="button button-primary" href="/placement-prep/careers">Back to recommendations <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/preparation">Open preparation</Link></div></section><section className="section"><div className="grid grid-3">{options.map((option) => <article className="card" key={option.key}><GitCompareArrows className="icon" size={20} /><h3>{option.label}</h3><div className="stat-value">{option.fit === null ? "Not measured" : `${option.fit}% fit`}</div><p>Evidence coverage: {option.coverage}%</p><p>Transition difficulty: {option.coverage === 100 ? option.fit >= 80 ? "Lower estimated effort" : option.fit >= 65 ? "Moderate estimated effort" : "Higher estimated effort" : "Insufficient evidence"}</p><p className="helper">Priority learning: {option.gaps.slice(0, 3).map((gap) => `${labels[gap.skill]} (+${gap.gap})`).join(", ") || "No measured gaps identified."}</p>{option.unknownSkills.length > 0 && <p className="helper">Not assessed: {option.unknownSkills.join(", ")}.</p>}</article>)}</div></section></main></>;
}
