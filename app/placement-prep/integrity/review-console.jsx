"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { savePlacementIntegrityReview } from "@/actions/placement-modules";
import { formatPrepDate } from "@/lib/prep-date";

export default function ReviewConsole({ assessments, interviews }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submitReview(event, recordType, recordId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(recordId);
    setError("");
    setMessage("");
    try {
      await savePlacementIntegrityReview({
        recordType,
        recordId,
        status: form.get("status"),
        decisionNote: form.get("decisionNote"),
      });
      setMessage("Review decision saved to the audit history.");
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to save the review decision.");
    } finally {
      setPending("");
    }
  }

  const total = assessments.length + interviews.length;
  return <main className="container">
    <section className="hero">
      <div className="eyebrow"><ShieldAlert size={16} /> Restricted staff workspace · Integrity review</div>
      <h1>Review flagged placement sessions.</h1>
      <p className="lead">Review recorded evidence only. A flag or review decision is not proof of misconduct and never changes a student’s assessment score.</p>
      <div className="integrity-limitations"><strong>Privacy:</strong> This allowlisted staff view covers flagged records across students. It shows session metadata and recorded browser events, not interview transcripts, camera footage, or microphone audio. Assessment camera/microphone records contain connection-state changes only.</div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Flagged sessions</h2><p>{total} flagged record{total === 1 ? "" : "s"} in the latest 100 assessment and interview records of each type.</p></div></div>
      {total === 0 ? <article className="card"><p>No flagged sessions currently require review.</p></article> : <div className="grid grid-2">
        {assessments.map((item) => <ReviewCard key={`assessment-${item.id}`} item={item} kind="ASSESSMENT" pending={pending} onSubmit={submitReview} />)}
        {interviews.map((item) => <ReviewCard key={`interview-${item.id}`} item={item} kind="INTERVIEW" pending={pending} onSubmit={submitReview} />)}
      </div>}
    </section>
  </main>;
}

function ReviewCard({ item, kind, pending, onSubmit }) {
  const title = kind === "ASSESSMENT" ? "Placement assessment" : item.companyName || item.role;
  const at = kind === "ASSESSMENT" ? item.completedAt : item.startedAt;
  return <article className="card integrity-review-card">
    <div className="section-heading"><div><span className="badge">{kind === "ASSESSMENT" ? "Assessment" : "AI interview"}</span><h3>{title}</h3><p>Student: {item.profile.fullName || "Nexora student"}</p></div><ShieldAlert className="icon" size={20} /></div>
    <p className="helper">Session date: {formatPrepDate(at)}</p>
    {kind === "ASSESSMENT" ? <>
      <p>Assessment result: {item.overallScore}% · Integrity score: {item.integrityScore}/100</p>
      {item.integrityEvents.length > 0 && <div className="integrity-review-evidence"><strong>Recorded assessment events</strong>{item.integrityEvents.map((event, index) => <p key={`${event.type || "event"}-${index}`}>{typeof event.type === "string" ? event.type.replaceAll("_", " ") : "Recorded event"}{Number.isInteger(event.count) ? ` · ${event.count} occurrence${event.count === 1 ? "" : "s"}` : ""}</p>)}</div>}
    </> : <>
      <p>{item.eventCount} saved browser event{item.eventCount === 1 ? "" : "s"} · {item.status.toLowerCase()}</p>
      {item.events.length > 0 && <div className="integrity-review-evidence"><strong>Recent recorded events</strong>{item.events.slice(0, 10).map((event, index) => <p key={`${event.eventType}-${index}`}>{event.eventType.replaceAll("_", " ")}{event.details ? ` · ${event.details.slice(0, 180)}` : ""} · {formatPrepDate(event.createdAt)}</p>)}</div>}
    </>}
    {item.review && <div className="integrity-review-outcome"><strong>Latest decision: {item.review.status === "CLEARED" ? "Flag cleared" : "Follow-up required"}</strong><p>{item.review.decisionNote}</p><span className="helper">By {item.review.reviewerEmail} · {formatPrepDate(item.review.createdAt)}</span></div>}
    <form className="integrity-review-form" onSubmit={(event) => onSubmit(event, kind, item.id)}>
      <label className="plan-time-label" htmlFor={`decision-${kind}-${item.id}`}>Decision
        <select defaultValue={item.review?.status || ""} id={`decision-${kind}-${item.id}`} name="status" required>
          <option disabled value="">Select a decision</option>
          <option value="CLEARED">Clear flag — no follow-up required</option>
          <option value="FOLLOW_UP_REQUIRED">Follow-up required</option>
        </select>
      </label>
      <label className="plan-time-label" htmlFor={`note-${kind}-${item.id}`}>Student-visible review summary
        <textarea defaultValue="" id={`note-${kind}-${item.id}`} maxLength={2000} minLength={3} name="decisionNote" required rows={3} />
      </label>
      <p className="helper">Each saved decision is retained in the review history. The summary is visible to the student in their integrity report.</p>
      <button className="button button-primary" disabled={pending === item.id} type="submit">{pending === item.id ? <Loader2 className="spin" size={15} /> : item.review ? <Save size={15} /> : <CheckCircle2 size={15} />} Save review decision</button>
    </form>
  </article>;
}
