import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteNav from "../components/site-nav";

const modules = [
  ["Authentication & student profile", "Profile, academic history, skills, projects, resume, interests, role, company, and location.", "/placement-prep/profile"],
  ["Assessment & evaluation", "Interest, aptitude, reasoning, verbal, programming, DSA, technical, communication, role, and company assessments.", "/placement-prep/assessment"],
  ["Assessment analysis", "Scores, strengths, weaknesses, trends, suitability, and personalized evidence.", "/placement-prep/readiness"],
  ["Placement score", "A transparent 0–100 readiness score with history and improvement tracking.", "/placement-prep/placement-score"],
  ["Career recommendations", "Recommended roles, suitability, explainable evidence, missing skills, and alternatives.", "/placement-prep/careers"],
  ["Career path comparison", "Compare current and target careers with transition difficulty and roadmap.", "/placement-prep/what-if"],
  ["Personalized preparation", "Daily tasks, weekly goals, milestones, and performance-based updates.", "/placement-prep/preparation"],
  ["Adaptive learning", "Automatic topic selection, personalized difficulty, and skill advancement.", "/placement-prep/levels"],
  ["Practice center", "Placement practice, history, mistake bank, and weak-topic tracking.", "/placement-prep/practice"],
  ["DSA & Coding", "LeetCode recommendations, adaptive difficulty, and transparent student-reported progress.", "/placement-prep/dsa"],
  ["Company preparation", "Compare your evidence with role benchmarks, track targets, and plan company-focused improvement.", "/placement-prep/company-prep"],
  ["AI Interview", "Run a personalized interview with adaptive follow-ups, optional browser voice, saved transcripts, and transparent integrity-event monitoring.", "/placement-prep/interview"],
  ["Interview evaluation", "Review evidence-linked answer feedback, weighted performance dimensions, and separate integrity-event history.", "/placement-prep/interview"],
  ["Placement Simulation", "Complete timed aptitude and technical rounds followed by an evaluated AI interview, with attempt-specific results.", "/placement-prep/simulation"],
  ["Integrity & Proctoring", "Review recorded assessment and interview browser events separately from performance scores.", "/placement-prep/integrity"],
  ["Career & Learning Recommendations", "Create an evidence-informed learning roadmap with sequenced prerequisites, milestones, and free resources.", "/placement-prep/learning"],
  ["Resume & Jobs", "Link the existing resume builder, compare explicitly listed job skills, and manually track applications.", "/placement-prep/jobs"],
  ["Placement Tracking & Engagement", "View a read-only summary of readiness, learning, practice, simulations, interviews, applications, and milestones.", "/placement-prep/journey"],
];

export default function ModulesPage() {
  return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Features</div><h1>Everything you need for placement preparation.</h1><p className="lead">Start from your workspace and continue through each feature as it becomes relevant to your preparation.</p><div className="actions"><Link className="button button-primary" href="/placement-prep/dashboard">Open workspace <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/placement-prep">Back home</Link></div></section><section className="section"><div className="grid grid-3">{modules.map(([title, description, path]) => <article className="card" key={title}><h3>{title}</h3><p>{description}</p>{path && <Link className="module-link" href={path}>Open feature <ArrowRight size={14} /></Link>}</article>)}</div></section></main></>;
}
