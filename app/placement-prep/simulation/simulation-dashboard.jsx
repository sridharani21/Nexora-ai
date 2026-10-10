"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Loader2 } from "lucide-react";
import { startPlacementSimulation } from "@/actions/placement-simulation";
import { formatPrepDate } from "@/lib/prep-date";

const stageLabels = [
  ["APTITUDE", "Aptitude & reasoning"],
  ["TECHNICAL_CODING", "Technical & coding concepts"],
  ["AI_INTERVIEW", "AI interview + evaluation"],
];

export default function SimulationDashboard({ data }) {
  const router = useRouter();
  const [simulationType, setSimulationType] = useState("GENERAL");
  const [role, setRole] = useState(data.defaultRole);
  const [companyName, setCompanyName] = useState(data.defaultCompany);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function createSimulation(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await startPlacementSimulation({ simulationType, role, companyName });
      router.push(`/placement-prep/simulation/${result.simulationId}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start this simulation.");
      setPending(false);
    }
  }

  return <>
    <section className="hero">
      <div className="eyebrow">Placement Simulation · Module 14</div>
      <h1>Take a complete placement-drive simulation.</h1>
      <p className="lead">Complete timed aptitude and technical/coding-concept rounds, then take a contextual AI interview and generate its separate Module 13 evaluation.</p>
      <div className="simulation-transparency">
        <strong>What this measures:</strong> Each attempt is scored from its own saved round results, not from your older readiness or practice scores. The coding section tests code tracing and algorithm concepts; Nexora does not execute submitted code or synchronize LeetCode submissions. Company names are student-selected context, not verified employer question patterns. Simulation results are practice evidence, not a hiring prediction.
      </div>
    </section>

    <section className="section simulation-start-grid">
      <article className="card">
        <div className="section-heading"><div><h2>Configure a simulation</h2><p>Two timed rounds · 30 minutes total, plus the AI interview.</p></div><ClipboardCheck className="icon" size={22} /></div>
        <div className="simulation-stage-list">
          {stageLabels.map(([key, label], index) => <div className="simulation-stage-preview" key={key}><span>{index + 1}</span><strong>{label}</strong></div>)}
        </div>
        <form className="simulation-form" onSubmit={createSimulation}>
          <label className="plan-time-label" htmlFor="simulation-type">Simulation type
            <select id="simulation-type" value={simulationType} onChange={(event) => setSimulationType(event.target.value)}>
              <option value="GENERAL">General placement</option>
              <option value="COMPANY">Company-focused practice</option>
            </select>
          </label>
          <label className="plan-time-label" htmlFor="simulation-role">Target role
            <select id="simulation-role" value={role} onChange={(event) => setRole(event.target.value)}>
              {data.roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {simulationType === "COMPANY" && <label className="plan-time-label" htmlFor="simulation-company">Company context
            <input id="simulation-company" autoComplete="organization" maxLength={100} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} />
            <span className="helper">Questions are not represented as official company questions or hiring rules.</span>
          </label>}
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
            {pending ? "Preparing simulation..." : "Start new simulation"}
          </button>
        </form>
      </article>
      <aside className="card simulation-scoring-card">
        <h2>How scoring works</h2>
        <p><strong>Aptitude &amp; reasoning · 25%</strong><br />Correct answers across six fixed questions.</p>
        <p><strong>Technical &amp; coding concepts · 35%</strong><br />Correct answers across six technical, algorithm, and code-tracing questions.</p>
        <p><strong>AI interview · 40%</strong><br />The separate evidence-based Module 13 score; integrity events are not deducted.</p>
        <p className="helper">Both quiz rounds have server-enforced time limits; the interview uses Module 12&apos;s session flow and its duration can vary. Unanswered quiz questions count as incorrect. Your report shows stage scores and topic-level evidence.</p>
      </aside>
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>Previous attempts</h2><p>Continue an active attempt or compare results from completed simulations.</p></div></div>
      {!data.simulations.length ? <p className="helper">No simulations yet. Your first attempt will appear here.</p> : <div className="grid grid-2">
        {data.simulations.map((simulation) => <article className="card simulation-history-card" key={simulation.id}>
          <div className="section-heading"><div><span className="badge">{simulation.status === "COMPLETED" ? "Completed" : "In progress"}</span><h3>{simulation.simulationType === "COMPANY" ? simulation.companyName : "General placement"} · {simulation.role}</h3></div>{simulation.overallScore !== null && <strong className="simulation-history-score">{simulation.overallScore}/100</strong>}</div>
          <p className="helper">Started {formatPrepDate(simulation.startedAt)}</p>
          <div className="simulation-history-stages">{simulation.stages.map((stage) => <span className="badge" key={stage.stageKey}>{stage.title}: {stage.status === "COMPLETED" ? `${stage.score}/100` : stage.status === "IN_PROGRESS" ? "In progress" : "Not started"}</span>)}</div>
          <Link className="button button-secondary" href={`/placement-prep/simulation/${simulation.id}`}>{simulation.status === "COMPLETED" ? "View report" : "Continue simulation"} <ArrowRight size={15} /></Link>
        </article>)}
      </div>}
    </section>
  </>;
}
