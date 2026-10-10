"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BrainCircuit, Clock3, Loader2, Mic, ShieldCheck } from "lucide-react";
import { startAiInterview } from "@/actions/prep-interview";
import { formatPrepDate } from "@/lib/prep-date";

export default function AiInterviewDashboard({ data }) {
  const router = useRouter();
  const [role, setRole] = useState(data.defaultRole);
  const [companyName, setCompanyName] = useState(data.defaultCompany);
  const [interviewType, setInterviewType] = useState("ROLE_SPECIFIC");
  const [difficulty, setDifficulty] = useState("INTERMEDIATE");
  const [mode, setMode] = useState("PRACTICE");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function beginInterview(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await startAiInterview({
        role,
        companyName,
        interviewType,
        difficulty,
        mode,
        voiceEnabled,
        transcriptConsent: consent,
        monitoringConsent: consent,
      });
      router.push(`/placement-prep/interview/${result.sessionId}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start the interview.");
      setPending(false);
    }
  }

  return <>
    <section className="hero">
      <div className="eyebrow">AI Interview · Module 12</div>
      <h1>Practice a real interview conversation.</h1>
      <p className="lead">Your interviewer uses your selected role and saved assessment evidence to ask one question at a time, listen to your answer, and ask relevant follow-ups.</p>
      <div className="interview-transparency">
        <strong>Evidence and privacy:</strong> Questions are generated using Nexora&apos;s configured Gemini service. Your selected role/company, saved skills and assessment evidence, matching Company Preparation evidence, and previous answers are sent to that provider to personalize questions; your name and email are not included. Transcripts and response timing are saved for Module 13, and the transcript is sent to Gemini if you choose to generate its evaluation. Consented browser events are logged. Avoid including secrets or sensitive third-party information. Nexora does not save microphone audio or use camera monitoring. Optional browser speech recognition may process audio under your browser provider&apos;s own policies. Browser voice features vary; text answers always work.
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>

    <section className="section interview-dashboard-grid">
      <article className="card interview-setup-card">
        <div className="section-heading"><div><h2>Set up your interview</h2><p>Eight questions · adaptive follow-ups · no score is generated in this module.</p></div><BrainCircuit className="icon" size={22} /></div>
        {data.assessmentAreas.length > 0 && <div className="interview-evidence">
          <strong>Personalization evidence from your latest assessment</strong>
          <div>{data.assessmentAreas.map(({ area, score }) => <span className="badge" key={area}>{area}: {score}%</span>)}</div>
        </div>}
        {!data.assessmentAvailable && <p className="helper">No placement assessment is saved yet. The interview can still start, but will be personalized from the role and answers you provide.</p>}
        <form className="interview-setup-form" onSubmit={beginInterview}>
          <label className="plan-time-label" htmlFor="interview-role">Target role
            <select id="interview-role" value={role} onChange={(event) => setRole(event.target.value)} required>
              {data.roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="plan-time-label" htmlFor="interview-company">Company context (optional)
            <input id="interview-company" list="interview-company-options" maxLength={100} onChange={(event) => setCompanyName(event.target.value)} placeholder="Enter a target company" value={companyName} />
            <datalist id="interview-company-options">{data.companyTargets.map((target) => <option key={target.id} value={target.companyName}>{target.roleLabel}</option>)}</datalist>
            <span className="helper">Company name is context you provide; questions are not claimed to match official employer practices.</span>
          </label>
          <div className="interview-setup-row">
            <label className="plan-time-label" htmlFor="interview-type">Interview type
              <select id="interview-type" value={interviewType} onChange={(event) => setInterviewType(event.target.value)}>
                {data.types.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <label className="plan-time-label" htmlFor="interview-difficulty">Difficulty
              <select id="interview-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {data.difficulties.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <label className="plan-time-label" htmlFor="interview-mode">Interview mode
            <select id="interview-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              {data.modes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <span className="helper">{mode === "STRICT" ? "Keeps the requested question difficulty fixed and provides no hints. Browser monitoring cannot guarantee prevention of external assistance." : "Allows difficulty to adapt by at most one level. This module does not provide hints or answers."}</span>
          </label>
          <label className="interview-check-option"><input checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} type="checkbox" /> Enable optional browser voice input and spoken questions. Audio is not saved by Nexora, but browser speech recognition may process it under the browser provider&apos;s policies.</label>
          <label className="interview-check-option interview-consent"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} required type="checkbox" /> I agree to send my selected role/company, saved skills, assessment evidence, matching Company Preparation evidence, and previous interview answers to Nexora&apos;s configured Gemini service for question generation, and to send saved answers for evaluation if I choose to generate a Module 13 report; store my transcript and response timing; and log the browser focus, fullscreen, and clipboard events listed above for this session.</label>
          <button className="button button-primary" disabled={pending || !consent} type="submit">
            {pending ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} {pending ? "Preparing interviewer..." : "Start interview"}
          </button>
        </form>
      </article>
      <aside className="card interview-rules-card">
        <ShieldCheck className="icon" size={24} />
        <h2>Before you begin</h2>
        <ul>
          <li>Answer in your own words; the interviewer may ask you to clarify reasoning or examples.</li>
          <li>Browser monitoring records observable page focus, fullscreen, and clipboard events only.</li>
          <li>Three or more such events add a review flag; it is not a finding of misconduct, and a human review workflow is not part of this module.</li>
          <li>Browser monitoring cannot see other devices or apps and may miss events.</li>
          <li>Voice pace and filler counts are rough transcript-derived observations, not acoustic voice analysis or judgments of honesty, confidence, accent, or ability.</li>
          <li>Module 13 will separately evaluate saved interview evidence.</li>
        </ul>
        <div className="interview-feature-note"><Mic size={16} /> Voice input is optional; use text if speech recognition is unavailable or inaccurate.</div>
      </aside>
    </section>

    <section className="section interview-history-section">
      <div className="section-heading"><div><h2>Your interview sessions</h2><p>Saved sessions can be resumed or reviewed later.</p></div><Clock3 className="icon" size={22} /></div>
      {data.sessions.length ? <div className="grid grid-2">
        {data.sessions.map((session) => <article className="card interview-history-card" key={session.id}>
          <div className="section-heading"><div><h3>{session.role}</h3><p>{session.interviewType.replaceAll("_", " ")} · {session.difficulty.toLowerCase()} · {session.mode === "STRICT" ? "Strict assessment" : "Practice"}</p></div><span className={`badge ${session.status === "ACTIVE" ? "interview-active-badge" : ""}`}>{session.status === "ACTIVE" ? "In progress" : "Completed"}</span></div>
          <p className="helper">{session.companyName ? `${session.companyName} · ` : ""}{formatPrepDate(session.startedAt)} · {session.answeredQuestions} answers saved · {session.eventCount} browser events{session.reviewRequired ? " · Review flagged" : ""}</p>
          <Link className="module-link" href={session.status === "COMPLETED" && session.evaluation ? `/placement-prep/interview/${session.id}/evaluation` : `/placement-prep/interview/${session.id}`}>{session.status === "ACTIVE" ? "Resume interview" : session.evaluation ? "View evaluation report" : "Review transcript & evaluate"} <ArrowRight size={14} /></Link>
        </article>)}
      </div> : <article className="card"><p>No interview sessions yet. Start your first interview above.</p></article>}
    </section>
  </>;
}
