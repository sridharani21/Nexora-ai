"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Loader2, Save } from "lucide-react";
import { createTrackedJob, updateJobEligibilityChecklist, updateTrackedApplication } from "@/actions/placement-modules";
import { formatPrepDate } from "@/lib/prep-date";

const statuses = ["SAVED", "PLANNING_TO_APPLY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const statusLabel = (status) => status.replaceAll("_", " ");

function isSafeJobUrl(value) {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function JobTracker({ data }) {
  const router = useRouter();
  const [form, setForm] = useState({ jobTitle: "", companyName: "", location: "", jobUrl: "", jobDescription: "", requiredSkills: "", eligibility: "", deadline: "" });
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeCount = data.applications.filter((item) => !["OFFER", "REJECTED", "WITHDRAWN"].includes(item.status)).length;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function addJob(event) {
    event.preventDefault();
    setPending("create");
    setError("");
    setMessage("");
    try {
      await createTrackedJob({
        ...form,
        requiredSkills: form.requiredSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
      });
      setForm({ jobTitle: "", companyName: "", location: "", jobUrl: "", jobDescription: "", requiredSkills: "", eligibility: "", deadline: "" });
      setMessage("Job saved and compared with the skills in your Nexora profile.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this job.");
    } finally {
      setPending("");
    }
  }

  async function saveStatus(applicationId, status, notes) {
    setPending(applicationId);
    setError("");
    setMessage("");
    try {
      await updateTrackedApplication({ applicationId, status, notes });
      setMessage("Application status and history saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update this application.");
    } finally {
      setPending("");
    }
  }

  async function saveEligibility(applicationId, checklist) {
    const operation = `eligibility-${applicationId}`;
    setPending(operation);
    setError("");
    setMessage("");
    try {
      await updateJobEligibilityChecklist({ applicationId, checklist });
      setMessage("Your self-assessed eligibility checklist is saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the eligibility checklist.");
    } finally {
      setPending("");
    }
  }

  return <>
    <section className="hero">
      <div className="eyebrow"><BriefcaseBusiness size={16} /> Resume &amp; Jobs · Module 17</div>
      <h1>Connect your resume evidence to your job search.</h1>
      <p className="lead">Save job details, compare explicitly listed skills with your Nexora profile and saved resume evidence, review stated eligibility, and track application stages manually.</p>
      <div className="job-transparency"><strong>Matching limits:</strong> The skill percentage compares only employer skills you enter with skills saved in your Nexora profile and structured resume records. It is a keyword comparison—not an ATS score, verified eligibility decision, or promise of selection. Application status is updated manually.</div>
      <div className="actions"><Link className="button button-secondary" href={data.resumeHref}>Open existing Resume Builder <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/profile">Review profile skills</Link></div>
      <p className="helper">The button opens Nexora’s existing Resume Builder at /resume-builder in a separate page; resume editing happens there, not inside the Jobs tracker. The tracker can compare job skills with skills and project technologies saved in your resumes.</p>
    </section>
    <section className="section"><div className="grid grid-3"><Metric label="Tracked jobs" value={data.applications.length} /><Metric label="Open applications" value={activeCount} /><Metric label="Profile and resume skills" value={data.matchingSkills.length} /></div></section>
    <section className="section job-form-grid">
      <article className="card">
        <div className="section-heading"><div><h2>Add a job</h2><p>Enter the job requirements as stated by the employer.</p></div><Save className="icon" size={21} /></div>
        <form className="job-form" onSubmit={addJob}>
          <label className="plan-time-label" htmlFor="job-title">Job title<input id="job-title" maxLength={160} name="jobTitle" onChange={updateField} required value={form.jobTitle} /></label>
          <label className="plan-time-label" htmlFor="job-company">Company<input id="job-company" maxLength={160} name="companyName" onChange={updateField} required value={form.companyName} /></label>
          <label className="plan-time-label" htmlFor="job-location">Location<input id="job-location" maxLength={160} name="location" onChange={updateField} value={form.location} /></label>
          <label className="plan-time-label" htmlFor="job-url">Job link<input id="job-url" name="jobUrl" onChange={updateField} placeholder="https://" type="url" value={form.jobUrl} /></label>
          <label className="plan-time-label" htmlFor="job-skills">Explicit required skills, comma-separated<input id="job-skills" name="requiredSkills" onChange={updateField} placeholder="SQL, Python, React" value={form.requiredSkills} /><span className="helper">Only skills you enter here are included in the comparison.</span></label>
          <label className="plan-time-label" htmlFor="job-deadline">Application deadline<input id="job-deadline" name="deadline" onChange={updateField} type="date" value={form.deadline} /></label>
          <label className="plan-time-label" htmlFor="job-eligibility">Stated eligibility criteria<textarea id="job-eligibility" maxLength={2000} name="eligibility" onChange={updateField} placeholder={"One criterion per line, for example:\nGraduation year: 2027\nMinimum CGPA: 7.0"} rows={3} value={form.eligibility} /><span className="helper">Enter up to 12 criteria, one per line. You can mark each criterion for your own review after saving.</span></label>
          <label className="plan-time-label job-full" htmlFor="job-description">Job description<textarea id="job-description" maxLength={15000} name="jobDescription" onChange={updateField} rows={5} value={form.jobDescription} /></label>
          {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
          <button className="button button-primary" disabled={Boolean(pending)} type="submit">{pending === "create" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save job and compare skills</button>
        </form>
      </article>
      <aside className="card"><h2>Evidence used in the comparison</h2>
        <h3>Student profile</h3>
        {data.profileSkills.length ? <div className="tag-list">{data.profileSkills.map((skill) => <span className="badge" key={skill}>{skill}</span>)}</div> : <><p>No profile skills are saved yet.</p><Link className="module-link" href="/placement-prep/profile">Add skills to your student profile <ArrowRight size={14} /></Link></>}
        <h3>Saved resumes</h3>
        {data.resumeSkills.length ? <div className="tag-list">{data.resumeSkills.map((skill) => <span className="badge" key={skill}>{skill}</span>)}</div> : <p className="helper">No structured skills or project technologies were found in your saved resumes. Use the existing Resume Builder to maintain resume evidence.</p>}
        <p className="helper">Resume evidence includes structured resume skills and project technologies—not inferred content from files that have not been parsed and saved.</p>
      </aside>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="section">
      <div className="section-heading"><div><h2>Application tracker</h2><p>Update each stage yourself. Every status change is stored in the application history.</p></div></div>
      {!data.applications.length ? <article className="card"><p>No jobs saved yet.</p></article> : <div className="grid grid-2">{data.applications.map((application) => <JobCard key={application.id} application={application} pending={pending} onSave={saveStatus} onSaveEligibility={saveEligibility} />)}</div>}
    </section>
  </>;
}

function JobCard({ application, pending, onSave, onSaveEligibility }) {
  const [status, setStatus] = useState(application.status);
  const [notes, setNotes] = useState(application.notes || "");
  const [eligibilityChecklist, setEligibilityChecklist] = useState(application.eligibilityChecklist);
  const canOpenUrl = isSafeJobUrl(application.jobUrl);
  return <article className="card tracked-job-card">
    <div className="section-heading"><div><span className="badge">{statusLabel(application.status)}</span><h3>{application.jobTitle}</h3><p>{application.companyName}{application.location ? ` · ${application.location}` : ""}</p></div>{application.matchScore !== null && <strong className="job-match-score">{application.matchScore}%</strong>}</div>
    {application.deadline && <p><strong>Deadline:</strong> {formatPrepDate(application.deadline)}</p>}
    <p className="helper">{application.matchExplanation}</p>
    {application.requiredSkills.length > 0 && <><div className="job-skill-list"><strong>Matched:</strong>{application.matchedSkills.length ? application.matchedSkills.map((skill) => <span className="badge" key={`match-${skill}`}>{skill}</span>) : <span className="helper">None confirmed</span>}</div><div className="job-skill-list"><strong>Needs evidence:</strong>{application.missingSkills.length ? application.missingSkills.map((skill) => <span className="badge job-gap-badge" key={`gap-${skill}`}>{skill}</span>) : <span className="helper">No missing entered skills</span>}</div></>}
    {eligibilityChecklist.length > 0 && <details open><summary>Eligibility checklist ({eligibilityChecklist.filter((item) => item.status === "MEETS").length}/{eligibilityChecklist.length} marked as appearing to meet)</summary><div className="eligibility-checklist">
      {eligibilityChecklist.map((item, index) => <label className="plan-time-label" htmlFor={`eligibility-${application.id}-${index}`} key={`${item.criterion}-${index}`}>
        {item.criterion}
        <select id={`eligibility-${application.id}-${index}`} onChange={(event) => setEligibilityChecklist((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, status: event.target.value } : entry))} value={item.status}>
          <option value="NEEDS_REVIEW">Not checked</option>
          <option value="MEETS">I appear to meet this</option>
          <option value="DOES_NOT_MEET">I do not meet this</option>
        </select>
      </label>)}
      <p className="helper">These are your own checklist responses—not verified eligibility decisions. Check the employer’s official posting.</p>
      <button className="button button-secondary" disabled={pending === `eligibility-${application.id}`} onClick={() => onSaveEligibility(application.id, eligibilityChecklist)} type="button">{pending === `eligibility-${application.id}` ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Save eligibility checklist</button>
    </div></details>}
    {application.eligibility && !eligibilityChecklist.length && <details><summary>Stated eligibility criteria</summary><p>{application.eligibility}</p><p className="helper">Nexora has not verified whether you meet these criteria.</p></details>}
    {application.jobDescription && <details><summary>Job description</summary><p className="job-description-text">{application.jobDescription}</p></details>}
    <label className="plan-time-label" htmlFor={`status-${application.id}`}>Application status<select id={`status-${application.id}`} onChange={(event) => setStatus(event.target.value)} value={status}>{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label>
    <label className="plan-time-label" htmlFor={`notes-${application.id}`}>Notes<textarea id={`notes-${application.id}`} maxLength={4000} onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} /></label>
    <div className="actions">{canOpenUrl && <a className="button button-secondary" href={application.jobUrl} rel="noreferrer" target="_blank">Open employer link <ArrowRight size={15} /></a>}<button className="button button-primary" disabled={pending === application.id} onClick={() => onSave(application.id, status, notes)} type="button">{pending === application.id ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Save status</button></div>
    {application.events.length > 0 && <details><summary>Application history ({application.events.length})</summary><div className="job-history">{application.events.map((event) => <p key={event.id}><strong>{event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ""}{statusLabel(event.toStatus)}</strong> · {formatPrepDate(event.createdAt)}{event.note ? ` · ${event.note}` : ""}</p>)}</div></details>}
  </article>;
}

function Metric({ label, value }) { return <article className="card"><p>{label}</p><div className="stat-value">{value}</div></article>; }
