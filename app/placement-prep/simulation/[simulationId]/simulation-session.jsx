"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { startAiInterview } from "@/actions/prep-interview";
import { submitPlacementSimulationStage } from "@/actions/placement-simulation";
import { formatPrepDate } from "@/lib/prep-date";

function formatRemaining(seconds) {
  const safeSeconds = Math.max(0, seconds);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export default function SimulationSession({ simulation }) {
  const router = useRouter();
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [pending, setPending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const submittedStage = useRef("");
  const activeStage = simulation.stages.find((stage) => stage.status === "IN_PROGRESS");
  const completedStages = simulation.stages.filter((stage) => stage.status === "COMPLETED");
  const weakestStage = [...completedStages].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0];
  const activeDeadline = activeStage?.startedAt
    ? new Date(activeStage.startedAt).getTime() + activeStage.timeLimitSeconds * 1000
    : 0;

  useEffect(() => {
    if (!activeDeadline) return undefined;
    const update = () => setRemaining(Math.max(0, Math.ceil((activeDeadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeDeadline]);

  useEffect(() => {
    setAnswers({});
    setError("");
    setConsent(false);
  }, [activeStage?.id]);

  async function submitRound() {
    if (!activeStage || pending || submittedStage.current === activeStage.id) return;
    submittedStage.current = activeStage.id;
    setPending(true);
    setError("");
    try {
      await submitPlacementSimulationStage({ simulationId: simulation.id, stageId: activeStage.id, answers });
      router.refresh();
    } catch (submitError) {
      submittedStage.current = "";
      setError(submitError instanceof Error ? submitError.message : "Unable to save this simulation round.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (activeDeadline && Date.now() >= activeDeadline && activeStage && activeStage.stageKey !== "AI_INTERVIEW" && remaining === 0 && submittedStage.current !== activeStage.id) {
      submitRound();
    }
  // submitRound uses the current answer state; triggering only at expiry avoids resubmitting on every answer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStage?.id, activeStage?.stageKey, remaining]);

  async function startInterviewRound() {
    if (!consent || !activeStage) return;
    setPending(true);
    setError("");
    try {
      const result = await startAiInterview({
        role: simulation.role,
        companyName: simulation.companyName || "",
        simulationId: simulation.id,
        interviewType: "ROLE_SPECIFIC",
        difficulty: "INTERMEDIATE",
        mode: "STRICT",
        voiceEnabled,
        transcriptConsent: true,
        monitoringConsent: true,
      });
      router.push(`/placement-prep/interview/${result.sessionId}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start the interview round.");
      setPending(false);
    }
  }

  const reportHref = weakestStage?.stageKey === "APTITUDE"
    ? "/placement-prep/practice"
    : weakestStage?.stageKey === "TECHNICAL_CODING"
      ? "/placement-prep/dsa"
      : "/placement-prep/interview";

  return <>
    <section className="hero simulation-session-hero">
      <div className="eyebrow">Placement Simulation · {simulation.simulationType === "COMPANY" ? simulation.companyName : "General placement"}</div>
      <h1>{simulation.status === "COMPLETED" ? "Your simulation report." : "Work through each placement stage."}</h1>
      <p className="lead">{simulation.role} · Started {formatPrepDate(simulation.startedAt)}</p>
      <div className="actions"><Link className="button button-secondary" href="/placement-prep/simulation"><ArrowLeft size={16} /> All simulations</Link></div>
    </section>

    {simulation.status === "COMPLETED" ? <section className="section simulation-report">
      <article className="card simulation-overall-score"><span className="eyebrow">Illustrative simulation score</span><strong>{simulation.overallScore}/100</strong><p>Weighted from this attempt&apos;s saved stages: aptitude 25%, technical/coding concepts 35%, and the separate interview evaluation 40%. It is not a hiring prediction.</p></article>
      <div className="grid grid-3 simulation-result-grid">{simulation.stages.map((stage) => <article className="card" key={stage.id}>
        <span className="badge">{stage.title} · {simulation.weights[stage.stageKey]}%</span>
        <div className="stat-value">{stage.score}/100</div>
        {stage.stageKey !== "AI_INTERVIEW" && <><p>{stage.evidence.correctCount} of {stage.evidence.questionCount} questions correct · {stage.evidence.answeredCount} answered.</p><ul className="simulation-topic-list">{stage.evidence.topicResults?.map((topic) => <li key={topic.topic}>{topic.topic}: {topic.correct}/{topic.total}</li>)}</ul></>}
        {stage.stageKey === "AI_INTERVIEW" && <p>Score from Module 13&apos;s transcript evaluation. Integrity events are separate and did not affect this score.</p>}
        {stage.durationSeconds !== null && <p className="helper">Recorded time: {Math.floor(stage.durationSeconds / 60)} min {stage.durationSeconds % 60} sec.</p>}
      </article>)}</div>
      <article className="card simulation-next-step"><h2>Suggested next step</h2><p>{weakestStage ? `Your lowest-scoring stage was ${weakestStage.title}. Review the underlying topics before your next attempt.` : "Review the stage evidence and choose a focused practice step."}</p><div className="actions"><Link className="button button-primary" href={reportHref}>Continue focused preparation <ArrowRight size={16} /></Link><Link className="button button-secondary" href="/placement-prep/simulation">Start another simulation</Link></div></article>
    </section> : <>
      <section className="section simulation-progress-grid">
        {simulation.stages.map((stage) => <article className={`card simulation-stage-card ${stage.status === "IN_PROGRESS" ? "simulation-stage-active" : ""}`} key={stage.id}>
          <div className="section-heading"><div><span className="badge">Round {stage.order} · {stage.status.replace("_", " ")}</span><h2>{stage.title}</h2></div>{stage.status === "IN_PROGRESS" && stage.stageKey !== "AI_INTERVIEW" && <div className="simulation-clock"><Clock3 size={17} />{formatRemaining(remaining)}</div>}</div>
          {stage.status === "COMPLETED" && <p>Stage score: <strong>{stage.score}/100</strong></p>}
          {stage.status === "LOCKED" && <p className="helper">Complete the previous round to unlock this stage.</p>}
          {stage.status === "IN_PROGRESS" && stage.stageKey !== "AI_INTERVIEW" && <div className="simulation-questions">
            {stage.questions.map((question, index) => <fieldset className="simulation-question" key={question.id}>
              <legend>{index + 1}. {question.prompt}</legend>
              <p className="helper">{question.topic}</p>
              <div className="simulation-options">{question.options.map((option) => <label className={answers[question.id] === option.value ? "simulation-option simulation-option-selected" : "simulation-option"} key={option.value}>
                <input checked={answers[question.id] === option.value} name={question.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))} type="radio" value={option.value} />
                <span>{option.label}</span>
              </label>)}</div>
            </fieldset>)}
            <p className="helper">Unanswered questions count as incorrect. The timer and submission deadline are enforced by the server.</p>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="button button-primary" disabled={pending} onClick={submitRound} type="button">{pending ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} Submit round</button>
          </div>}
          {stage.status === "IN_PROGRESS" && stage.stageKey === "AI_INTERVIEW" && <>
            {stage.interviewSessionId ? <div className="simulation-interview-resume">
              <p>{stage.interviewStatus === "COMPLETED" ? stage.evaluationId ? "The interview evaluation is ready to attach to this simulation." : "The interview is complete. Generate its Module 13 evaluation to finish this simulation." : "Continue your saved interview round. When finished, generate the Module 13 evaluation to add it to the report."}</p>
              <Link className="button button-primary" href={stage.interviewStatus === "COMPLETED" && !stage.evaluationId ? `/placement-prep/interview/${stage.interviewSessionId}/evaluation` : `/placement-prep/interview/${stage.interviewSessionId}`}>{stage.interviewStatus === "COMPLETED" && !stage.evaluationId ? "Evaluate interview" : "Continue interview"} <ArrowRight size={16} /></Link>
            </div> : <div className="simulation-interview-start">
              <p>The interview uses your target role and saved student evidence to generate questions. Its separate transcript-based evaluation is required for the final simulation report.</p>
              <label className="interview-check-option"><input checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} type="checkbox" /> Enable optional browser voice. Nexora does not save microphone audio; browser speech recognition may process it under the browser provider&apos;s policies.</label>
              <label className="interview-check-option interview-consent"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" /> I agree to send my role/company context, saved skills and assessment evidence, matching Company Preparation evidence when available, and interview answers to Nexora&apos;s configured Gemini service for question generation and, if I generate it, evaluation; store the transcript and response timing; and log the disclosed browser focus, fullscreen, and clipboard events. The Module 13 evaluation is required to produce this simulation&apos;s final report.</label>
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="button button-primary" disabled={!consent || pending} onClick={startInterviewRound} type="button">{pending ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />} Start AI interview round</button>
            </div>}
          </>}
        </article>)}
      </section>
    </>}
  </>;
}
