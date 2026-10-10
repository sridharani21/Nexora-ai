"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Clock3, Loader2, Plus, RefreshCw, Target, Trash2 } from "lucide-react";
import { addCompanyTarget, recalculateCompanyReadiness, removeCompanyTarget } from "@/actions/prep-company";
import { COMPANY_OPTIONS, COMPANY_PRIORITIES } from "@/data/prep-company";
import { formatPrepDate } from "@/lib/prep-date";

export default function CompanyPrepClient({ data }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(data.suggestedCompany);
  const [roleKey, setRoleKey] = useState(data.roles[0]?.key || "");
  const [priority, setPriority] = useState("HIGH");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function runAction(key, operation, successMessage) {
    setPending(key);
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(successMessage);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update company preparation.");
    } finally {
      setPending("");
    }
  }

  function addTarget(event) {
    event.preventDefault();
    runAction(
      "add",
      () => addCompanyTarget({ companyName, roleKey, priority }),
      "Company and role added. Readiness is based only on available student evidence.",
    );
  }

  const sortedTargets = [...data.targets].sort((first, second) => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return rank[first.priority] - rank[second.priority] || first.companyName.localeCompare(second.companyName);
  });

  return <>
    <section className="hero">
      <div className="eyebrow">Company preparation</div>
      <h1>Prepare for a company and role with evidence.</h1>
      <p className="lead">Compare your assessment and practice results with a role-specific benchmark, understand what to improve, and track readiness for multiple targets.</p>
      <div className="company-benchmark-notice">
        <strong>Requirements transparency:</strong> Role benchmarks are general preparation guidance, not official requirements or hiring patterns published by the selected employer. Company readiness is a preparation match, not a hiring prediction. Areas without evidence are excluded from the score and shown as gaps to assess.
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      <article className="card company-target-form-card">
        <div className="section-heading"><div><h2>Add a target</h2><p>Track a company and role combination. You can save up to 10 targets.</p></div><Building2 className="icon" size={22} /></div>
        <form className="company-target-form" onSubmit={addTarget}>
          <label className="plan-time-label" htmlFor="company-target-name">Company
            <input id="company-target-name" list="company-target-suggestions" maxLength={100} minLength={2} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} />
            <datalist id="company-target-suggestions">{COMPANY_OPTIONS.filter((item) => item !== "Other company").map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="plan-time-label" htmlFor="company-target-role">Target role
            <select id="company-target-role" onChange={(event) => setRoleKey(event.target.value)} value={roleKey}>
              {data.roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
            </select>
          </label>
          <label className="plan-time-label" htmlFor="company-target-priority">Priority
            <select id="company-target-priority" onChange={(event) => setPriority(event.target.value)} value={priority}>
              {COMPANY_PRIORITIES.map((item) => <option key={item} value={item}>{item.charAt(0) + item.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <button className="button button-primary" disabled={pending === "add"} type="submit">
            {pending === "add" ? <Loader2 size={16} /> : <Plus size={16} />} Add target
          </button>
        </form>
      </article>
    </section>

    {sortedTargets.length > 0 && <section className="section">
      <div className="section-heading"><div><h2>Company readiness comparison</h2><p>Scores compare your measured skills with a general role benchmark; they do not predict hiring outcomes.</p></div><Target className="icon" size={22} /></div>
      <div className="grid grid-3">
        {sortedTargets.map((target) => <article className="card company-target-card" key={target.id}>
          <div className="section-heading">
            <div><span className={`priority priority-${target.priority.toLowerCase()}`}>{target.priority} PRIORITY</span><h3>{target.companyName}</h3><p>{target.roleLabel}</p></div>
            <Building2 className="icon" size={20} />
          </div>
          <div className="readiness-score company-readiness-score">
            <strong>{target.current.score === null ? "—" : target.current.score}</strong>
            <span>{target.current.score === null ? "Not enough evidence" : "Role match / 100"}</span>
          </div>
          <p className="helper">Evidence coverage: {target.current.evidenceCoverage}% of this role profile has assessment or practice evidence.</p>
          <div className="progress"><span style={{ width: `${target.current.evidenceCoverage}%` }} /></div>
          <p className="company-benchmark-label">General role benchmark · not verified company requirements</p>
          <div className="company-target-actions">
            <button className="button button-secondary" disabled={pending === `recalc:${target.id}`} onClick={() => runAction(`recalc:${target.id}`, () => recalculateCompanyReadiness(target.id), "Readiness history updated from your latest saved results.")} type="button">
              {pending === `recalc:${target.id}` ? <Loader2 size={15} /> : <RefreshCw size={15} />} Recalculate
            </button>
            <button aria-label={`Remove ${target.companyName} ${target.roleLabel} target`} className="button button-secondary" disabled={pending === `remove:${target.id}`} onClick={() => runAction(`remove:${target.id}`, () => removeCompanyTarget(target.id), "Target removed; its saved readiness history is retained.")} type="button">
              {pending === `remove:${target.id}` ? <Loader2 size={15} /> : <Trash2 size={15} />} Remove
            </button>
          </div>
        </article>)}
      </div>
    </section>}

    {sortedTargets.map((target) => <TargetAnalysis key={target.id} target={target} />)}

    {sortedTargets.length === 0 && <section className="section">
      <article className="card"><h2>Start with your target role</h2><p>Add a company and role above to see a readiness comparison, evidence coverage, and a prioritized preparation path. You can add targets even before an assessment; missing evidence will remain clearly marked.</p></article>
    </section>}

    {data.archivedTargets?.length > 0 && <section className="section">
      <div className="section-heading"><div><h2>Archived targets</h2><p>Removed targets stay here with their saved readiness snapshots.</p></div><Clock3 className="icon" size={22} /></div>
      <div className="grid grid-3">
        {data.archivedTargets.map((target) => <article className="card company-archived-card" key={target.id}>
          <div className="section-heading"><div><h3>{target.companyName}</h3><p>{target.roleLabel}</p></div><span className="badge">Archived</span></div>
          {target.snapshots.length > 0 ? target.snapshots.map((snapshot) => <div className="history-row" key={snapshot.id}>
            <span>{formatPrepDate(snapshot.calculatedAt)} · {snapshot.evidenceCoverage}% evidence coverage</span>
            <strong>{snapshot.score === null ? "Not enough evidence" : `${snapshot.score}/100`}</strong>
          </div>) : <p className="helper">No readiness snapshots were saved for this target.</p>}
        </article>)}
      </div>
    </section>}

    <section className="section">
      <div className="section-heading"><div><h2>Connected preparation</h2><p>Company-specific gaps link back to Nexora’s existing learning and practice features.</p></div></div>
      <div className="grid grid-3">
        <article className="card"><h3>Personalized preparation</h3><p>Continue your saved weekly study plan and task history.</p><Link className="module-link" href="/placement-prep/preparation">Open preparation <ArrowRight size={14} /></Link></article>
        <article className="card"><h3>DSA &amp; coding</h3><p>Use your analyzed DSA results for LeetCode problem recommendations.</p><Link className="module-link" href="/placement-prep/dsa">Open DSA &amp; Coding <ArrowRight size={14} /></Link></article>
        <article className="card"><h3>Practice center</h3><p>Build further aptitude, technical, programming, and DSA evidence.</p><Link className="module-link" href="/placement-prep/practice">Open Practice Center <ArrowRight size={14} /></Link></article>
      </div>
      <p className="helper">Interview-specific and resume-specific preparation will use those features when they are available; they are not included as scored evidence here.</p>
    </section>
  </>;
}

function TargetAnalysis({ target }) {
  const gaps = target.current.gaps;
  return <section className="section">
    <div className="section-heading"><div><h2>{target.companyName} · {target.roleLabel}</h2><p>Skill-by-skill comparison against a general role benchmark.</p></div><span className="badge">{target.current.evidenceSummary.assessedAreas}/{target.current.evidenceSummary.totalAreas} areas measured</span></div>
    <div className="grid grid-2">
      <article className="card">
        <h3>Role requirements and your evidence</h3>
        {target.current.components.map((component) => <div className="company-component-row" key={component.skill}>
          <div className="company-component-head">
            <div><strong>{component.label}</strong><p className="helper">Benchmark: {component.required}% · Weight: {component.weight}%</p></div>
            <span className={`priority priority-${component.priority.toLowerCase()}`}>{component.currentScore === null ? "NEEDS EVIDENCE" : `${component.currentScore}%`}</span>
          </div>
          {component.currentScore !== null && <div className="progress"><span style={{ width: `${Math.min(100, component.currentScore)}%` }} /></div>}
          <p className="helper">{component.currentScore === null
            ? "Not scored: complete a relevant assessment or practice session first."
            : `Evidence: ${component.evidenceSources.join(" + ")}${component.gap > 0 ? ` · ${component.gap} points below benchmark` : " · benchmark met"}.`}</p>
        </div>)}
      </article>
      <article className="card">
        <h3>Why you are not ready yet</h3>
        {gaps.length ? gaps.slice(0, 5).map((gap) => <div className="gap-row" key={gap.skill}>
          <div><strong>{gap.label}</strong><p>{gap.currentScore === null
            ? "There is no assessment or practice evidence for this area yet."
            : `Your measured score is ${gap.currentScore}%; the general role benchmark is ${gap.required}%.`}</p></div>
          <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.currentScore === null ? "ASSESS" : `${gap.gap} GAP`}</span>
        </div>) : <p className="helper">Your available evidence meets the benchmark in every measured area. Continue gathering evidence for areas not yet assessed.</p>}
        <h3 className="company-next-steps-title">Recommended next steps</h3>
        {(gaps.length ? gaps.slice(0, 4) : target.current.components.slice(0, 3)).map((item) => <PreparationLink key={item.skill} skill={item.skill} label={item.label} evidenceMissing={item.currentScore === null} />)}
      </article>
    </div>
    <article className="card company-history-card">
      <div className="section-heading"><div><h3>Readiness history</h3><p>Snapshots are saved when you add a target or select Recalculate.</p></div><Clock3 className="icon" size={20} /></div>
      {target.snapshots.length > 0 ? target.snapshots.map((snapshot) => <div className="history-row" key={snapshot.id}>
        <span>{formatPrepDate(snapshot.calculatedAt)} · {snapshot.evidenceCoverage}% evidence coverage</span>
        <strong>{snapshot.score === null ? "Not enough evidence" : `${snapshot.score}/100`}</strong>
      </div>) : <p className="helper">No readiness snapshots have been saved yet.</p>}
    </article>
  </section>;
}

function PreparationLink({ skill, label, evidenceMissing }) {
  const isDsa = skill === "dsa";
  const href = isDsa ? "/placement-prep/dsa" : "/placement-prep/practice";
  const action = isDsa ? "Review DSA recommendations" : evidenceMissing ? "Build assessment evidence" : "Practice this skill";
  return <div className="company-next-step">
    <span><CheckCircle2 size={15} /> {label}</span>
    <Link href={evidenceMissing ? "/placement-prep/assessment" : href}>{action} <ArrowRight size={13} /></Link>
  </div>;
}
