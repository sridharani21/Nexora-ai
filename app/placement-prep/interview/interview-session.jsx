"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Loader2, Maximize2, Mic, MicOff, Pause, Play, RefreshCw, Volume2 } from "lucide-react";
import { advanceAiInterview, endAiInterviewEarly, logAiInterviewIntegrityEvent, saveAiInterviewAnswer } from "@/actions/prep-interview";
import { evaluateAiInterview } from "@/actions/prep-interview-evaluation";
import { formatPrepDate } from "@/lib/prep-date";

function SpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function AiInterviewSession({ initialSession }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [evaluationPending, setEvaluationPending] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problem, setProblem] = useState("Speech recognition is unavailable");
  const recognitionRef = useRef(null);
  const speechStartedAt = useRef(null);
  const lastFocusEventAt = useRef(0);
  const enteredFullscreen = useRef(false);
  const trackingEnabled = useRef(true);
  const timerInitialized = useRef(false);
  const currentTurn = session.turns.find((turn) => turn.sequenceIndex === session.currentQuestion);
  const currentQuestionText = currentTurn?.question || "";
  const currentAnswerSaved = Boolean(currentTurn?.response);
  const completed = session.status === "COMPLETED";

  async function openEvaluation() {
    if (session.evaluation) {
      router.push(`/placement-prep/interview/${session.id}/evaluation`);
      return;
    }
    setEvaluationPending(true);
    setError("");
    setNotice("");
    try {
      await evaluateAiInterview(session.id);
      router.push(`/placement-prep/interview/${session.id}/evaluation`);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Unable to evaluate this interview.");
      setEvaluationPending(false);
    }
  }

  useEffect(() => {
    setRecognitionSupported(Boolean(SpeechRecognitionConstructor()));
    if (session.status !== "ACTIVE") return undefined;
    trackingEnabled.current = true;

    const logEvent = async (eventType, source = "BROWSER_API", details = "") => {
      if (!trackingEnabled.current) return;
      const now = Date.now();
      if (["TAB_HIDDEN", "WINDOW_BLUR"].includes(eventType)) {
        if (now - lastFocusEventAt.current < 1600) return;
        lastFocusEventAt.current = now;
      }
      try {
        const result = await logAiInterviewIntegrityEvent({ sessionId: session.id, eventType, source, details });
        setSession((previous) => ({
          ...previous,
          reviewRequired: result.reviewRequired,
          events: [...previous.events, result.event],
        }));
        if (result.reviewRequired) {
          setNotice("This session has been flagged for review because several observable browser events were recorded. This flag is not a finding of misconduct.");
        } else {
          setNotice("A browser session event was recorded. It is a signal for review, not a conclusion about your conduct.");
        }
      } catch (eventError) {
        setError(eventError instanceof Error ? eventError.message : "Unable to save the browser event.");
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") logEvent("TAB_HIDDEN", "BROWSER_API", "Interview page became hidden.");
    };
    const onBlur = () => logEvent("WINDOW_BLUR", "BROWSER_API", "Interview window lost focus.");
    const onFullscreen = () => {
      if (document.fullscreenElement) enteredFullscreen.current = true;
      else if (enteredFullscreen.current) logEvent("FULLSCREEN_EXIT", "BROWSER_API", "Fullscreen mode exited.");
    };
    const onCopy = () => logEvent("COPY_ATTEMPT", "BROWSER_API", "Copy event observed in the interview page.");
    const onPaste = () => logEvent("PASTE_ATTEMPT", "BROWSER_API", "Paste event observed in the interview page.");
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("blur", onBlur);
    return () => {
      trackingEnabled.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("blur", onBlur);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, [session.id, session.status]);

  useEffect(() => {
    if (!timerInitialized.current) {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)));
      timerInitialized.current = true;
    }
    if (completed || paused) return undefined;
    const timer = window.setInterval(() => setElapsedSeconds((elapsed) => elapsed + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session.startedAt, completed, paused]);

  useEffect(() => {
    if (completed || paused || !session.voiceEnabled || !currentQuestionText || currentAnswerSaved) return undefined;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setNotice("Automatic speech is unavailable in this browser. Use Read question aloud or read the live caption.");
      return undefined;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestionText);
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setNotice("Browser speech could not play. Read the live caption or select Read question aloud.");
    };
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [currentQuestionText, currentAnswerSaved, session.voiceEnabled, completed, paused]);

  const beginListening = useCallback(() => {
    const Recognition = SpeechRecognitionConstructor();
    if (!Recognition || !session.voiceEnabled) {
      setNotice("Speech recognition is unavailable or disabled. You can type your answer instead.");
      return;
    }
    setError("");
    setNotice("Microphone active. Speak your answer, then select Stop listening to review the transcript.");
    speechStartedAt.current = performance.now();
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${text} `;
        else interimText += text;
      }
      if (finalText) {
        setAnswer((previous) => `${previous}${previous ? " " : ""}${finalText.trim()}`);
        setVoiceUsed(true);
      }
      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setInterim("");
      const denied = ["not-allowed", "service-not-allowed"].includes(event.error);
      setError(denied
        ? "Microphone permission was denied. Allow microphone access in your browser or type your answer."
        : `Speech recognition stopped (${event.error}). Your transcript draft is retained; you can continue by typing.`);
      if (!denied) logAiInterviewIntegrityEvent({
        sessionId: session.id,
        eventType: "MICROPHONE_ERROR",
        source: "SPEECH_RECOGNITION",
        details: `Speech recognition reported ${event.error}.`,
      }).catch((eventError) => setError(eventError instanceof Error ? eventError.message : "Unable to save the microphone event."));
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Could not start browser speech recognition. Type your answer instead.");
    }
  }, [session.id, session.voiceEnabled]);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
    setNotice("Voice capture stopped. Review or edit the transcript before saving your answer.");
  }

  function speakQuestion() {
    if (!window.speechSynthesis) {
      setNotice("Spoken questions are not supported by this browser; read the question below.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentTurn.question);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setNotice("Browser speech could not play. Read the live caption instead.");
    };
    window.speechSynthesis.speak(utterance);
  }

  function togglePause() {
    if (paused) {
      setPaused(false);
      setNotice("Interview resumed. Microphone listening does not resume automatically.");
      return;
    }
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(true);
    setNotice("Interview controls and timer paused. Browser session monitoring remains active.");
  }

  async function reportTechnicalProblem() {
    setError("");
    try {
      const result = await logAiInterviewIntegrityEvent({
        sessionId: session.id,
        eventType: "TECHNICAL_PROBLEM",
        source: "STUDENT_REPORTED",
        details: problem,
      });
      setSession((previous) => ({ ...previous, events: [...previous.events, result.event] }));
      setNotice("Technical problem report saved with the session.");
      setProblemOpen(false);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unable to report this technical problem.");
    }
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      enteredFullscreen.current = true;
      setNotice("Fullscreen focus mode is active. Browser limitations still apply.");
    } catch {
      setNotice("Fullscreen could not be enabled by this browser. The interview can continue.");
    }
  }

  async function saveAnswer() {
    if (!currentTurn || !answer.trim()) {
      setError("Add your answer before continuing.");
      return;
    }
    setPending("save");
    setError("");
    setNotice("");
    try {
      const elapsedSeconds = speechStartedAt.current
        ? Math.max(1, Math.round((performance.now() - speechStartedAt.current) / 1000))
        : Math.max(1, Math.round((Date.now() - new Date(currentTurn.askedAt).getTime()) / 1000));
      const metrics = await saveAiInterviewAnswer({
        sessionId: session.id,
        sequenceIndex: currentTurn.sequenceIndex,
        response: answer,
        responseSeconds: elapsedSeconds,
        captureMode: voiceUsed ? "VOICE" : "TEXT",
      });
      const savedTurn = {
        ...currentTurn,
        response: answer.trim(),
        responseSeconds: elapsedSeconds,
        captureMode: voiceUsed ? "VOICE" : "TEXT",
        speakingRateWpm: metrics.speakingRateWpm,
        fillerWordCount: metrics.fillerWordCount,
        answeredAt: new Date(),
      };
      setSession((previous) => ({
        ...previous,
        turns: previous.turns.map((turn) => turn.id === currentTurn.id ? savedTurn : turn),
      }));
      setPending("advance");
      const result = await advanceAiInterview(session.id);
      if (result.completed) {
        trackingEnabled.current = false;
        setPaused(false);
        setSession((previous) => ({ ...previous, status: "COMPLETED", completedAt: new Date() }));
        setNotice("Interview complete. Your transcript and session evidence are saved for Module 13 evaluation.");
        if (document.fullscreenElement) await document.exitFullscreen();
      } else {
        const nextTurn = {
          id: `pending-${result.sequenceIndex}`,
          sequenceIndex: result.sequenceIndex,
          question: result.question,
          category: session.interviewType,
          difficulty: session.difficulty,
          askedAt: new Date(),
          response: null,
        };
        setSession((previous) => ({
          ...previous,
          currentQuestion: result.sequenceIndex,
          turns: [...previous.turns.filter((turn) => turn.sequenceIndex !== result.sequenceIndex), nextTurn],
        }));
        setAnswer("");
        setVoiceUsed(false);
        speechStartedAt.current = null;
        setNotice("Answer saved. The interviewer has a follow-up for you.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save or continue this interview.");
      setNotice("If your answer was already saved, use Retry next question to continue without submitting it again.");
    } finally {
      setPending("");
    }
  }

  async function retryNextQuestion() {
    setPending("advance");
    setError("");
    try {
      const result = await advanceAiInterview(session.id);
      if (result.completed) {
        trackingEnabled.current = false;
        setPaused(false);
        setSession((previous) => ({ ...previous, status: "COMPLETED", completedAt: new Date() }));
        setNotice("Interview complete. Your transcript and session evidence are saved for Module 13 evaluation.");
      } else {
        const nextTurn = {
          id: `pending-${result.sequenceIndex}`,
          sequenceIndex: result.sequenceIndex,
          question: result.question,
          category: session.interviewType,
          difficulty: session.difficulty,
          askedAt: new Date(),
          response: null,
        };
        setSession((previous) => ({
          ...previous,
          currentQuestion: result.sequenceIndex,
          turns: [...previous.turns.filter((turn) => turn.sequenceIndex !== result.sequenceIndex), nextTurn],
        }));
        setAnswer("");
        setVoiceUsed(false);
        speechStartedAt.current = null;
        setNotice("The interviewer is ready with your next question.");
      }
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "Unable to continue the interview.");
    } finally {
      setPending("");
    }
  }

  async function finishEarly() {
    if (!window.confirm("End this interview now? Your saved transcript and events will be retained, but any unsaved answer will be lost.")) return;
    setPending("finish");
    setError("");
    try {
      await endAiInterviewEarly(session.id);
      trackingEnabled.current = false;
      setPaused(false);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setSession((previous) => ({ ...previous, status: "COMPLETED", completedAt: new Date() }));
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Unable to finish this interview.");
    } finally {
      setPending("");
    }
  }

  return <section className="hero interview-session-hero">
    <Link className="module-link" href={session.simulationId ? `/placement-prep/simulation/${session.simulationId}` : "/placement-prep/interview"}><ArrowLeft size={14} /> {session.simulationId ? "Back to placement simulation" : "Back to AI Interview"}</Link>
    <div className="eyebrow">AI Interview · {session.role}</div>
    <h1>{completed ? "Interview session record" : "Your interview is in progress."}</h1>
    <p className="lead">{session.companyName ? `${session.companyName} · ` : ""}{session.interviewType.replaceAll("_", " ")} · {session.difficulty.toLowerCase()} · {session.mode === "STRICT" ? "strict assessment" : "practice mode"} · Started {formatPrepDate(session.startedAt)}</p>
    {session.reviewRequired && <div className="interview-warning" role="status"><strong>Review flag:</strong> Several observable browser events occurred. This is not a finding of misconduct; the saved event timeline is available for human review.</div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    <div className="interview-status-bar" role="status">
      <span><Clock3 size={16} /> Session time {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</span>
      <span><span className={`interview-connection-dot ${paused ? "interview-connection-paused" : ""}`} /> {paused ? "Paused" : "Connected"}</span>
      <span>{speaking ? "Interviewer speaking" : listening ? "Listening to your answer" : "Ready"}</span>
    </div>

    {!completed && currentTurn?.response && <article className="card interview-retry-card">
      <p>Your answer to question {currentTurn.sequenceIndex} is saved. The interviewer did not return a next question yet.</p>
      <button className="button button-secondary" disabled={pending === "advance"} onClick={retryNextQuestion} type="button">
        {pending === "advance" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Retry next question
      </button>
    </article>}

    {!completed && currentTurn && !currentTurn.response && <div className="interview-live-grid">
      <article className="card interview-question-card">
        <div className="interview-live-status"><span className="interview-live-dot" /> AI INTERVIEWER · QUESTION {currentTurn.sequenceIndex} OF {session.maxQuestions} · {session.interviewType.replaceAll("_", " ")}</div>
        <div className={`interview-robot ${speaking ? "interview-robot-speaking" : ""}`} role="img" aria-label={speaking ? "AI interviewer speaking" : "AI interviewer ready"}>
          <span className="interview-robot-antenna" /><span className="interview-robot-head"><span className="interview-robot-eye" /><span className="interview-robot-eye" /><span className="interview-robot-mouth" /></span>
        </div>
        <div className="interview-speaking-indicator" aria-live="polite">{speaking ? "Nexora interviewer is speaking" : listening ? "Listening — speak naturally" : "Live question captions are shown below"}</div>
        <p className="interview-category">{currentTurn.category.replaceAll("_", " ")} · {currentTurn.difficulty.toLowerCase()}</p>
        <h2>{currentTurn.question}</h2>
        <div className="interview-live-actions">
          <button className="button button-secondary" onClick={speakQuestion} type="button" disabled={paused || speaking}><Volume2 size={16} /> Read question aloud</button>
          <button className="button button-secondary" onClick={togglePause} type="button">{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume" : "Pause"}</button>
          {session.monitoringConsent && <button className="button button-secondary" onClick={enterFullscreen} type="button"><Maximize2 size={15} /> Enter fullscreen</button>}
        </div>
        <button className="interview-report-link" onClick={() => setProblemOpen((open) => !open)} type="button">Report a technical problem</button>
        {problemOpen && <div className="interview-problem-report"><label className="plan-time-label" htmlFor="interview-problem">What happened?
          <select id="interview-problem" onChange={(event) => setProblem(event.target.value)} value={problem}>
            <option>Speech recognition is unavailable</option>
            <option>Microphone permission or device problem</option>
            <option>Question audio did not play</option>
            <option>Connection or page problem</option>
            <option>Transcript needs correction</option>
          </select>
        </label><button className="button button-secondary" onClick={reportTechnicalProblem} type="button">Save problem report</button></div>}
        {session.voiceEnabled && <div className="interview-voice-card">
          <p>{recognitionSupported ? "Browser voice input is optional. Audio is not stored by Nexora; transcription behavior depends on your browser." : "Speech recognition is unavailable in this browser; type your answer below."}</p>
          {recognitionSupported && <button className={`button ${listening ? "button-danger" : "button-primary"}`} disabled={!recognitionSupported || speaking || paused} onClick={listening ? stopListening : beginListening} type="button">
            {listening ? <MicOff size={16} /> : <Mic size={16} />} {listening ? "Stop listening" : "Speak answer"}
          </button>}
          {listening && <span className="interview-listening-label"><span className="interview-live-dot" /> Listening</span>}
        </div>}
        <label className="interview-answer-label" htmlFor="interview-answer">Your answer
          <textarea id="interview-answer" disabled={paused} maxLength={8000} onChange={(event) => {
            if (listening) {
              recognitionRef.current?.stop();
              setListening(false);
              setInterim("");
            }
            setAnswer(event.target.value);
          }} placeholder="Explain your reasoning and use a specific example where you can." rows={7} value={`${answer}${interim ? `${answer ? " " : ""}${interim}` : ""}`} />
        </label>
        <p className="helper">Your transcript is saved when you continue. Review speech recognition text for errors first.</p>
        <div className="interview-session-actions">
          <button className="button button-primary" disabled={pending !== "" || !answer.trim() || listening || speaking || paused} onClick={saveAnswer} type="button">
            {pending ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} {pending === "save" ? "Saving answer..." : pending === "advance" ? "Preparing next question..." : "Submit answer"}
          </button>
          <button className="button button-secondary" disabled={pending !== "" || speaking} onClick={finishEarly} type="button">End interview</button>
        </div>
      </article>
      <aside className="card interview-monitor-card">
        <div className="section-heading"><div><h2>Session status</h2><p>Observable browser signals only</p></div><Clock3 className="icon" size={20} /></div>
        <div className="interview-monitor-row"><span>Questions answered</span><strong>{session.turns.filter((turn) => Boolean(turn.response)).length}/{session.maxQuestions}</strong></div>
        <div className="interview-monitor-row"><span>Monitoring</span><strong>Active with consent</strong></div>
        <div className="interview-monitor-row"><span>Camera</span><strong>Not used</strong></div>
        <div className="interview-monitor-row"><span>Audio storage</span><strong>Not stored</strong></div>
        <p className="helper">Browser focus and clipboard events are recorded with server timestamps. Browser-based monitoring has limitations and does not see other apps or devices.</p>
        <h3>Session events</h3>
        {session.events.length ? session.events.slice(-6).reverse().map((event) => <div className="interview-event-row" key={event.id}>
          <span>{event.eventType.replaceAll("_", " ")}</span><small>{formatPrepDate(event.createdAt)}</small>
        </div>) : <p className="helper">No browser events have been recorded.</p>}
      </aside>
    </div>}

    {completed && <section className="section interview-transcript">
      <article className="card interview-complete-card"><CheckCircle2 className="icon" size={22} /><div><h2>Session saved</h2><p>{session.turns.filter((turn) => Boolean(turn.response)).length} answers and {session.events.length} browser events saved. Module 13 evaluates answer evidence separately from integrity events.</p><button className="button button-primary interview-evaluate-button" disabled={evaluationPending} onClick={openEvaluation} type="button">{evaluationPending ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{evaluationPending ? "Preparing evaluation..." : session.evaluation ? "View Module 13 evaluation" : "Generate Module 13 evaluation"}</button></div></article>
      {session.turns.map((turn) => <article className="card interview-transcript-turn" key={turn.id}>
        <span className="interview-category">QUESTION {turn.sequenceIndex} · {turn.category.replaceAll("_", " ")}</span>
        <h3>{turn.question}</h3>
        <div className="interview-transcript-answer"><strong>Your answer{turn.captureMode === "VOICE" ? " · browser transcript" : ""}</strong><p>{turn.response || "No answer was saved for this question."}</p></div>
        {turn.response && <p className="helper">{turn.responseSeconds}s response time{turn.speakingRateWpm !== null ? ` · about ${turn.speakingRateWpm} transcript words per response-time minute · ${turn.fillerWordCount} fillers detected in the transcript` : ""}</p>}
      </article>)}
      {session.events.length > 0 && <article className="card"><h2>Integrity event timeline</h2>{session.events.map((event) => <div className="interview-event-row" key={event.id}>
        <span>{event.eventType.replaceAll("_", " ")} · {event.details}</span><small>{formatPrepDate(event.createdAt)}</small>
      </div>)}</article>}
      <Link className="button button-primary" href="/placement-prep/interview">Return to interview dashboard <ArrowRight size={16} /></Link>
    </section>}
  </section>;
}
