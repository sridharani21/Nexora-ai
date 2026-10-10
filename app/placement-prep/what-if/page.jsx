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
    const gaps = Object.entries(role.requirements).map(([skill, target]) => ({ skill, gap: Math.max(0, target - (current[skill] || 0)) })).filter((item) => item.gap > 0).sort((a, b) => b.gap - a.gap);
    const fit = Math.round(Object.entries(role.requirements).reduce((sum, [skill, target]) => sum + Math.min(100, ((current[skill] || 0) / target) * 100), 0) / Object.keys(role.requirements).length);
    return { key, label: role.label, fit, gaps };
  }).sort((a, b) => b.fit - a.fit);
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Career path comparison</div><h1>See the cost of changing career direction.</h1><p className="lead">Compare role fit, transition difficulty, and the highest-priority skills for each path using the same assessment evidence.</p><div className="actions"><Link className="button button-primary" href="/placement-prep/careers">Back to recommendations <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/preparation">Open preparation</Link></div></section><section className="section"><div className="grid grid-3">{options.map((option) => <article className="card" key={option.key}><GitCompareArrows className="icon" size={20} /><h3>{option.label}</h3><div className="stat-value">{option.fit}% fit</div><p>Transition difficulty: {option.fit >= 80 ? "Low" : option.fit >= 65 ? "Moderate" : "High"}</p><p className="helper">Priority learning: {option.gaps.slice(0, 3).map((gap) => `${labels[gap.skill]} (+${gap.gap})`).join(", ") || "Maintain current evidence."}</p></article>)}</div></section></main></>;
}
