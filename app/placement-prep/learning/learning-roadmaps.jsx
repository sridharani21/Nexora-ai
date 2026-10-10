"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Map } from "lucide-react";
import { createCareerLearningRoadmap, updateCareerRoadmapStep } from "@/actions/placement-modules";
import { formatPrepDate } from "@/lib/prep-date";

export default function LearningRoadmaps({ data }) {
  const router = useRouter();
  const [role, setRole] = useState(data.defaultRole);
  const [company, setCompany] = useState(data.defaultCompany);
  const [duration, setDuration] = useState("6");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function createRoadmap(event) {
    event.preventDefault();
    setPending("create");
    setError("");
    setMessage("");
    try {
      await createCareerLearningRoadmap({ targetRole: role, targetCompany: company, durationMonths: Number(duration) });
      setMessage("Your roadmap was saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create your roadmap.");
    } finally {
      setPending("");
    }
  }

  async function updateStep(step, status) {
    setPending(step.id);
    setError("");
    setMessage("");
    try {
      await updateCareerRoadmapStep({ stepId: step.id, status });
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this milestone.");
    } finally {
      setPending("");
    }
  }

  return <>
    <section className="hero">
      <div className="eyebrow"><Map size={16} /> Career &amp; Learning Recommendations · Module 16</div>
      <h1>Turn skill gaps into an ordered learning plan.</h1>
      <p className="lead">Roadmaps use your saved assessment and readiness evidence when available, sequence prerequisites, and link to free learning resources. Complete a milestone to update its progress.</p>
      {data.evidenceAvailable ? <div className="learning-evidence"><strong>Evidence available:</strong> {data.evidenceGaps.length ? data.evidenceGaps.map((item) => item.skill).join(", ") : "Your assessment/readiness has no skill gaps below the current prioritization threshold."}</div> : <div className="learning-evidence"><strong>Personalization limitation:</strong> There is no saved assessment or readiness analysis yet. A roadmap will be a generic starter sequence for your chosen role, not a diagnosis of skill gaps.</div>}
      <div className="actions"><Link className="button button-secondary" href="/placement-prep/preparation">Open daily preparation plan</Link><Link className="button button-secondary" href="/placement-prep/readiness">Review skill-gap evidence</Link></div>
    </section>
    <section className="section learning-create-grid">
      <article className="card">
        <div className="section-heading"><div><h2>Create a learning roadmap</h2><p>Each new roadmap is saved as a separate version.</p></div></div>
        <form className="learning-create-form" onSubmit={createRoadmap}>
          <label className="plan-time-label" htmlFor="learning-role">Target role<select id="learning-role" onChange={(event) => setRole(event.target.value)} value={role}>{data.roles?.map((item) => <option key={item} value={item}>{item}</option>) || <option>{role}</option>}</select></label>
          <label className="plan-time-label" htmlFor="learning-company">Company context (optional)<input id="learning-company" maxLength={100} onChange={(event) => setCompany(event.target.value)} value={company} /></label>
          <label className="plan-time-label" htmlFor="learning-duration">Duration<select id="learning-duration" onChange={(event) => setDuration(event.target.value)} value={duration}>{[3, 6, 9, 12].map((month) => <option key={month} value={month}>{month} months</option>)}</select></label>
          {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
          <button className="button button-primary" disabled={Boolean(pending)} type="submit">{pending === "create" ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} Generate roadmap</button>
        </form>
      </article>
      <aside className="card"><h2>How recommendations work</h2><p>Assessment section weaknesses and positive gaps from placement-readiness analysis are prioritized first.</p><p>Each recommendation includes its evidence, a prerequisite order, and a free resource link.</p><p className="helper">If there is no saved evidence, the roadmap says so and provides a clearly labeled starter sequence. It does not claim verified company requirements or guaranteed outcomes.</p></aside>
    </section>
    {error && data.roadmaps.length > 0 && <p className="error-message" role="alert">{error}</p>}
    <section className="section">
      <div className="section-heading"><div><h2>Saved roadmaps</h2><p>Milestone progress is saved independently of your daily Module 07 tasks.</p></div></div>
      {!data.roadmaps.length ? <p className="helper">Create a roadmap to start tracking learning milestones.</p> : <div className="grid">
        {data.roadmaps.map((roadmap) => {
          const completed = roadmap.steps.filter((step) => step.status === "COMPLETED").length;
          const percentage = roadmap.steps.length ? Math.round((completed / roadmap.steps.length) * 100) : 0;
          return <article className="card learning-roadmap-card" key={roadmap.id}>
            <div className="section-heading"><div><span className="badge">{roadmap.durationMonths}-month roadmap · {roadmap.targetCompany || "General role plan"}</span><h2>{roadmap.title}</h2></div><strong>{percentage}%</strong></div>
            <p className="helper">{roadmap.evidenceSummary}</p><div className="progress"><span style={{ width: `${percentage}%` }} /></div>
            <div className="learning-step-list">{roadmap.steps.map((step) => <article className="learning-step" key={step.id}>
              <div className="learning-step-heading"><div><span className={`badge ${step.status === "COMPLETED" ? "learning-complete-badge" : ""}`}>{step.status.replaceAll("_", " ")}</span><h3>{step.title}</h3></div>{step.dueDate && <time>{formatPrepDate(step.dueDate)}</time>}</div>
              <p><strong>Skill:</strong> {step.skill}</p><p>{step.objective}</p><p className="helper">Why: {step.reason}</p>
              <div className="actions"><a className="module-link" href={step.resourceUrl} target="_blank" rel="noreferrer">Free resource: {step.resourceTitle} <ArrowRight size={14} /></a>
                {step.status !== "COMPLETED" && <button className="button button-secondary" disabled={!step.canStart || Boolean(pending)} onClick={() => updateStep(step, step.status === "IN_PROGRESS" ? "COMPLETED" : "IN_PROGRESS")} type="button">{pending === step.id ? <Loader2 className="spin" size={15} /> : step.status === "IN_PROGRESS" ? <CheckCircle2 size={15} /> : <ArrowRight size={15} />}{step.status === "IN_PROGRESS" ? "Complete milestone" : step.canStart ? "Start milestone" : "Complete prerequisite first"}</button>}
              </div>
            </article>)}</div>
          </article>;
        })}
      </div>}
    </section>
  </>;
}
