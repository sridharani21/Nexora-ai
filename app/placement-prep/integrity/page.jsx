import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getIntegrityReport } from "@/actions/placement-modules";
import { formatPrepDate } from "@/lib/prep-date";
import SiteNav from "../components/site-nav";

export default async function IntegrityPage() {
  let report;
  try {
    report = await getIntegrityReport();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!["Sign in with Nexora before continuing.", "Complete your student profile before continuing.", "Add and verify an email address in your Nexora account before continuing."].includes(message)) throw error;
    return <><SiteNav /><main className="container"><section className="hero"><div className="eyebrow">Integrity &amp; Proctoring · Module 15</div><h1>Your integrity activity report.</h1><p className="lead">{message}</p><Link className="button button-primary" href="/placement-prep/profile">Complete student profile</Link></section></main></>;
  }
  return <><SiteNav /><main className="container">
    <section className="hero">
      <div className="eyebrow"><ShieldCheck size={16} /> Integrity &amp; Proctoring · Module 15</div>
      <h1>Review recorded session events.</h1>
      <p className="lead">This report gathers saved assessment and interview browser events, along with any placement-officer review outcomes. It presents observable event records, not a finding of cheating.</p>
      <div className="integrity-limitations"><strong>Coverage limitation:</strong> Current logs are available for the placement assessment and AI interviews, including simulation-linked interviews. During the placement assessment only, camera and microphone connection status is monitored in the browser; changes are logged, but audio and video are neither recorded nor uploaded. Practice/coding sessions do not have a shared monitor, and external devices cannot be detected. Review flags do not change test or interview scores.</div>
      <div className="actions"><Link className="button button-secondary" href="/placement-prep/simulation">Placement simulations</Link><Link className="button button-secondary" href="/placement-prep/interview">AI interviews</Link><Link className="button button-secondary" href="/placement-prep/integrity/review">Placement officer review console</Link></div>
    </section>
    <section className="section">
      <div className="grid grid-3">
        <Metric label="Events shown" value={report.counts.eventCount} detail="Most recent records from available assessment and interview logs" />
        <Metric label="Assessment review flags" value={report.counts.assessmentReviewFlags} detail="Saved assessment attempts marked for review" />
        <Metric label="Interview review flags" value={report.counts.interviewReviewFlags} detail="Observable events only; not a misconduct finding" />
      </div>
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Recent event timeline</h2><p>Only the most recent 150 available events are shown.</p></div></div>
      {report.events.length ? <article className="card integrity-timeline">{report.events.map((event) => <div className="integrity-timeline-item" key={event.id}>
        <span className="badge">{event.source.replaceAll("_", " ")}</span>
        <div><strong>{event.type.replaceAll("_", " ")}</strong>{event.details && <p>{event.details}</p>}{event.sessionId && <Link className="module-link" href={`/placement-prep/interview/${event.sessionId}`}>Open interview record</Link>}{event.simulationId && <Link className="module-link" href={`/placement-prep/simulation/${event.simulationId}`}>Open linked simulation</Link>}</div>
        <time dateTime={event.createdAt.toISOString()}>{formatPrepDate(event.createdAt)}</time>
      </div>)}</article> : <article className="card"><p>No assessment or interview integrity events are currently recorded.</p></article>}
    </section>
    <section className="section">
      <div className="section-heading"><div><h2>Session review flags</h2><p>A flag requests attention; it does not establish a violation. Authorized placement officers may review recorded evidence and publish a summary here.</p></div></div>
      <div className="grid grid-2">
        {report.assessments.filter((item) => item.reviewRequired).map((attempt) => <article className="card" key={attempt.id}><span className="badge">Assessment attempt</span><h3>{attempt.review ? (attempt.review.status === "CLEARED" ? "Flag reviewed · cleared" : "Flag reviewed · follow-up required") : "Awaiting officer review"}</h3><p>Integrity score: {attempt.integrityScore}/100 · {formatPrepDate(attempt.completedAt)}</p>{attempt.review && <div className="integrity-review-outcome"><p>{attempt.review.decisionNote}</p><span className="helper">Reviewed {formatPrepDate(attempt.review.createdAt)}</span></div>}</article>)}
        {report.interviews.filter((session) => session.reviewRequired).map((session) => <article className="card" key={session.id}><span className="badge">AI interview</span><h3>{session.companyName || session.role}</h3><p>{session.eventCount} observable events · {formatPrepDate(session.startedAt)}</p><p className="helper">{session.review ? (session.review.status === "CLEARED" ? "Flag reviewed · cleared" : "Flag reviewed · follow-up required") : "Awaiting officer review"}</p>{session.review && <div className="integrity-review-outcome"><p>{session.review.decisionNote}</p><span className="helper">Reviewed {formatPrepDate(session.review.createdAt)}</span></div>}<Link className="module-link" href={`/placement-prep/interview/${session.id}`}>Open your interview record</Link></article>)}
      </div>
    </section>
  </main></>;
}

function Metric({ label, value, detail }) { return <article className="card"><p>{label}</p><div className="stat-value">{value}</div><p className="helper">{detail}</p></article>; }
