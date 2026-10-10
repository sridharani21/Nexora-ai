import Link from "next/link";
import { ArrowRight, History, Info } from "lucide-react";
import { getReadiness } from "@/actions/prep-readiness";
import { formatPrepDate } from "@/lib/prep-date";
import SiteNav from "../components/site-nav";

const componentLabels = {
  technical: "Technical",
  coding: "Coding",
  aptitude: "Aptitude",
  communication: "Communication",
  interview: "Interview",
  resume: "Profile / resume",
};

export default async function PlacementScorePage() {
  const readiness = await getReadiness();
  if (!readiness) return <EmptyState message="Complete the assessment and generate your analysis before viewing your Placement Score." />;
  const dimensions = Object.entries(readiness.scoreComponents)
    .filter(([, item]) => item.status === "MEASURED")
    .map(([key, item]) => ({
      label: componentLabels[key] || key,
      score: item.score,
      weight: item.effectiveWeight,
    }));
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Nexora Placement Score</div><h1>A transparent score for placement readiness.</h1><p className="lead">This score uses measured evidence only. Categories without completed evidence are excluded and their weights are redistributed across measured categories. It is not a hiring prediction.</p><div className="readiness-score"><strong>{readiness.overallReadiness}/100</strong><span>{readiness.status}</span></div>{readiness.isStale && <p className="helper">This saved score uses an older formula. Refresh the analysis to recalculate it using measured evidence only.</p>}<div className="actions"><Link className="button button-primary" href="/placement-prep/readiness">View / refresh analysis <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/careers">Explore career recommendations</Link></div></section><section className="section"><div className="grid grid-3">{dimensions.map(({ label, score, weight }) => <article className="card" key={label}><h3>{label}</h3><div className="stat-value">{score}%</div><p>{weight}% effective contribution to this score</p><div className="progress"><span style={{ width: `${score}%` }} /></div></article>)}</div>{!dimensions.length && <p className="helper">Refresh the analysis to see measured score components.</p>}<p className="helper">Evidence coverage: {readiness.evidenceCoverage}% of the configured score weight. Formula: {readiness.formulaVersion}.</p></section><section className="section"><div className="grid grid-2"><article className="card"><Info className="icon" size={20} /><h2>How this score is calculated</h2><p>Measured dimensions use their configured weights, normalized over available evidence. Interview readiness is included only after a saved interview evaluation; profile and resume readiness are not scored until a supported resume-evaluation source is available.</p></article><article className="card"><History className="icon" size={20} /><h2>Score history</h2>{readiness.history.map((item) => <div className="history-row" key={item.id}><span>{formatPrepDate(item.createdAt)} · {item.formulaVersion}</span><strong>{item.score}/100</strong></div>)}{!readiness.history.length && <p className="helper">No score snapshots are saved yet. Refresh your analysis to create the first snapshot.</p>}</article></div></section></main></>;
}

function EmptyState({ message }) { return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Nexora Placement Score</div><h1>Your score will appear after analysis.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/readiness">Continue to analysis <ArrowRight size={16} /></Link></section></main></>; }
