import Link from "next/link";
import { ArrowRight, History, Info } from "lucide-react";
import { getReadiness } from "@/actions/prep-readiness";
import { formatPrepDate } from "@/lib/prep-date";
import SiteNav from "../components/site-nav";

export default async function PlacementScorePage() {
  const readiness = await getReadiness();
  if (!readiness) return <EmptyState message="Complete the assessment and generate your analysis before viewing your Placement Score." />;
  const dimensions = [
    ["Technical", readiness.technicalReadiness, 25],
    ["Coding", readiness.codingReadiness, 25],
    ["Aptitude", readiness.aptitudeReadiness, 15],
    ["Communication", readiness.communicationScore, 15],
    ["Interview", readiness.interviewReadiness, 10],
    ["Profile / resume", readiness.resumeReadiness, 10],
  ];
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Nexora Placement Score</div><h1>A transparent score for placement readiness.</h1><p className="lead">This score is a weighted summary of your profile, assessment, and analysis evidence. It is not a skill level and does not guarantee placement.</p><div className="readiness-score"><strong>{readiness.overallReadiness}/100</strong><span>{readiness.status}</span></div><div className="actions"><Link className="button button-primary" href="/placement-prep/readiness">View analysis <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/careers">Explore career recommendations</Link></div></section><section className="section"><div className="grid grid-3">{dimensions.map(([label, value, weight]) => <article className="card" key={label}><h3>{label}</h3><div className="stat-value">{value}%</div><p>{weight}% contribution to total score</p><div className="progress"><span style={{ width: `${value}%` }} /></div></article>)}</div></section><section className="section"><div className="grid grid-2"><article className="card"><Info className="icon" size={20} /><h2>How this score is calculated</h2><p>Each dimension is normalized to 0–100, multiplied by its displayed weight, and combined into the final score. The underlying assessment and profile evidence remain visible in your assessment analysis.</p></article><article className="card"><History className="icon" size={20} /><h2>Score history</h2>{readiness.history.map((item, index) => <div className="history-row" key={`${item.completedAt}-${index}`}><span>{formatPrepDate(item.completedAt)}</span><strong>{item.score}/100</strong></div>)}</article></div></section></main></>;
}

function EmptyState({ message }) { return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Nexora Placement Score</div><h1>Your score will appear after analysis.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/readiness">Continue to analysis <ArrowRight size={16} /></Link></section></main></>; }
