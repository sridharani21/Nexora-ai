"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { evaluateAiInterview } from "@/actions/prep-interview-evaluation";
import { formatPrepDate } from "@/lib/prep-date";

export default function InterviewEvaluationReport({ data }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { session, evaluation } = data;

  async function generateEvaluation() {
    setPending(true);
    setError("");
    try {
      await evaluateAiInterview(session.id);
      router.refresh();
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Unable to evaluate this interview.");
    } finally {
      setPending(false);
    }
  }

  return <section className="hero interview-evaluation-page">
    {session.simulationId && <Link className="module-link" href={`/placement-prep/simulation/${session.simulationId}`}><ArrowRight size={14} /> Back to placement simulation</Link>}
    <div className="eyebrow">Interview Evaluation · Module 13</div>
    <h1>Evidence-based interview evaluation.</h1>
    <p className="lead">{session.role}{session.companyName ? ` · ${session.companyName}` : ""} · {session.interviewType.replaceAll("_", " ")} · {formatPrepDate(session.startedAt)}</p>
    {!evaluation ? <article className="card interview-generate-evaluation">
      <Sparkles className="icon" size={24} />
      <h2>Analyze this completed interview</h2>
      <p>The evaluation reviews saved answers against the disclosed educational rubric, explains feedback with references to your transcript, and recommends relevant preparation. It is not a hiring prediction.</p>
      <p className="helper">Transcript evidence is sent to Nexora&apos;s configured Gemini service to generate the report. No audio is saved or evaluated. Integrity events are reported separately and do not lower your performance score.</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending || !session.turns.length} onClick={generateEvaluation} type="button">
        {pending ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {pending ? "Evaluating saved answers..." : "Generate evaluation"}
      </button>
      {!session.turns.length && <p className="helper">There are no saved answers to evaluate.</p>}
    </article> : <>
      <div className="interview-evaluation-score card">
        <div className="interview-score-ring" aria-label={`Overall interview score ${evaluation.overallScore ?? "not available"} out of 100`}>
          <strong>{evaluation.overallScore ?? "—"}</strong><span>/100</span>
        </div>
        <div>
          <div className="eyebrow">Overall interview score</div>
          <h2>{evaluation.evidenceCoverage}% rubric evidence coverage</h2>
          <p>Weighted score across dimensions with supporting evidence. Unmeasured dimensions are excluded and the available weights are normalized; this is an illustrative practice rubric, not a validated hiring predictor.</p>
          <p className="helper">Rubric {evaluation.rubricVersion} · Evaluated {formatPrepDate(evaluation.evaluatedAt)}</p>
        </div>
      </div>

      <section className="section interview-evaluation-section">
        <div className="section-heading"><div><h2>Dimension scores</h2><p>Scores are based on saved transcripts; unavailable evidence is left unscored.</p></div></div>
        <div className="grid grid-2">
          {evaluation.dimensions.map((dimension) => <article className="card interview-dimension-card" key={dimension.key}>
            <div className="interview-dimension-title"><strong>{dimension.label}</strong><span>{dimension.score === null ? "Not measured" : `${dimension.score}/100`}</span></div>
            <p className="helper">Rubric weight: {dimension.weight}% · {dimension.evidence}</p>
            {dimension.score !== null && <div className="progress"><span style={{ width: `${dimension.score}%` }} /></div>}
          </article>)}
        </div>
        <p className="interview-delivery-caveat">Acoustic delivery is not scored: Nexora does not retain the audio needed to measure pitch, loudness, pause duration, or intelligibility. Transcript-derived pace or filler counts are not treated as a substitute for acoustic analysis.</p>
      </section>

      <section className="section interview-evaluation-section">
        <div className="grid grid-2">
          <NarrativeCard title="Strengths identified" items={evaluation.strengths} empty="No strengths could be confidently grounded in the saved evidence." turns={session.turns} />
          <NarrativeCard title="Areas to improve" items={evaluation.improvements} empty="No specific improvement areas could be confidently grounded in the saved evidence." turns={session.turns} />
        </div>
      </section>

      <section className="section interview-evaluation-section">
        <div className="section-heading"><div><h2>Question-by-question review</h2><p>Open each answer to see its evidence and targeted feedback.</p></div></div>
        <div className="grid">
          {session.turns.map((turn) => {
            const answer = evaluation.answerEvaluations.find((item) => item.turnId === turn.id);
            if (!answer) return null;
            const missing = JSON.parse(answer.missingConcepts);
            return <details className="card interview-answer-review" key={turn.id}>
              <summary><span>Question {turn.sequenceIndex}: {turn.question}</span><span>{answer.relevanceScore}/100 relevance</span></summary>
              <div className="interview-transcript-answer"><strong>Your saved answer</strong><p>{turn.response}</p></div>
              <div className="interview-answer-scores">
                <Score label="Role knowledge" score={answer.technicalScore} />
                <Score label="Reasoning" score={answer.reasoningScore} />
                <Score label="Relevance" score={answer.relevanceScore} />
                <Score label="Structure" score={answer.structureScore} />
                {answer.followUpScore !== null && <Score label="Follow-up handling" score={answer.followUpScore} />}
              </div>
              <blockquote className="interview-evidence-quote">Evidence considered: “{answer.evidence}”</blockquote>
              <p>{answer.feedback}</p>
              {missing.length > 0 && <div className="interview-missing-concepts"><strong>Areas the answer could cover further</strong><ul>{missing.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
              <p className="helper">{turn.responseSeconds}s response time{turn.captureMode === "VOICE" ? " · transcript captured with browser speech recognition" : " · typed transcript"}</p>
            </details>;
          })}
        </div>
      </section>

      <section className="section interview-evaluation-section">
        <div className="section-heading"><div><h2>Recommended preparation</h2><p>Recommendations link to existing Nexora features; they do not change another module&apos;s scores automatically.</p></div></div>
        {evaluation.recommendations.length ? <div className="grid grid-2">
          {evaluation.recommendations.map((recommendation, index) => <article className="card interview-recommendation-card" key={`${recommendation.topic}-${index}`}>
            <span className={`priority priority-${recommendation.priority.toLowerCase()}`}>{recommendation.priority} PRIORITY</span>
            <h3>{recommendation.title}</h3><p>{recommendation.reason}</p><p className="helper">Topic: {recommendation.topic} · Module {recommendation.module}</p>
            <Link className="module-link" href={recommendation.href}>Open {recommendation.moduleLabel} <ArrowRight size={14} /></Link>
          </article>)}
        </div> : <article className="card"><p>No preparation recommendations were generated for this evidence.</p></article>}
      </section>

      <section className="section interview-evaluation-section">
        <div className="section-heading"><div><h2>Integrity events — separate from performance</h2><p>These are observable browser signals or student reports. They do not establish a policy violation or affect the interview score.</p></div><ShieldCheck className="icon" size={22} /></div>
        {session.events.length ? <article className="card">{session.events.map((event) => <div className="interview-event-row" key={event.id}>
          <span><strong>{event.eventType.replaceAll("_", " ")}</strong> · {event.source.replaceAll("_", " ")}{event.details ? ` · ${event.details}` : ""}</span><small>{formatPrepDate(event.createdAt)}</small>
        </div>)}<p className="helper">{session.reviewRequired ? "This session has a review flag. No human review decision is recorded by this module." : "No automatic review flag is set."}</p></article> : <article className="card"><p>No integrity events were recorded.</p></article>}
      </section>
    </>}
  </section>;
}

function NarrativeCard({ title, items, empty, turns }) {
  return <article className="card interview-narrative-card">
    <h2>{title}</h2>
    {items.length ? items.map((item, index) => <div className="interview-narrative-item" key={`${item.title}-${index}`}>
      <h3>{item.title}</h3><p>{item.detail}</p>
      <p className="helper">Evidence: {item.evidenceSequenceIndexes.map((sequenceIndex) => `Question ${sequenceIndex}: ${turns.find((turn) => turn.sequenceIndex === sequenceIndex)?.question || ""}`).join(" · ")}</p>
    </div>) : <p className="helper">{empty}</p>}
  </article>;
}

function Score({ label, score }) {
  return <div className="interview-mini-score"><span>{label}</span><strong>{score}</strong></div>;
}
