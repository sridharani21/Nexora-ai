"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, Expand, Loader2, Mic, ShieldAlert } from "lucide-react";
import { lockAssessment, recordIntegrityEvent } from "@/actions/prep-integrity";
import { createAssessmentQuestionSet, saveAssessment } from "@/actions/prep-assessment";

export default function AssessmentClient({ access }) {
  const [sectionIndex, setSectionIndex] = useState(0), [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}), [result, setResult] = useState(null), [error, setError] = useState("");
  const [questionSet, setQuestionSet] = useState(null), [generating, setGenerating] = useState(true);
  const [saving, setSaving] = useState(false), [events, setEvents] = useState([]);
  const [mediaEvents, setMediaEvents] = useState([]);
  const [camera, setCamera] = useState(false), [mic, setMic] = useState(false), [full, setFull] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [locked, setLocked] = useState(!access.allowed), [until, setUntil] = useState(access.lockedUntil);
  const sections = questionSet?.sections || [];
  const section = sections[sectionIndex], question = section?.questions[questionIndex];
  const streamRef = useRef(null), videoRef = useRef(null);
  const eventCountRef = useRef(0), lockTriggeredRef = useRef(false);
  const questionIdRef = useRef(question?.id);
  questionIdRef.current = question?.id;
  async function loadQuestionSet() {
    setGenerating(true);
    setError("");
    try {
      setQuestionSet(await createAssessmentQuestionSet());
      setSectionIndex(0);
      setQuestionIndex(0);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate assessment questions.");
    } finally {
      setGenerating(false);
    }
  }
  useEffect(() => {
    let active = true;
    createAssessmentQuestionSet().then((generated) => {
      if (active) setQuestionSet(generated);
    }).catch((generationError) => {
      if (active) setError(generationError instanceof Error ? generationError.message : "Unable to generate assessment questions.");
    }).finally(() => {
      if (active) setGenerating(false);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (locked || !assessmentStarted) return undefined;
    let active = true;
    const register = (type) => {
      if (!active) return;
      const event = { type, at: new Date().toISOString() };
      eventCountRef.current += 1;
      setEvents((current) => [...current, event]);
      recordIntegrityEvent(type, { questionId: questionIdRef.current }).catch(() => setError("Integrity event could not be stored."));
      if (eventCountRef.current >= 5 && !lockTriggeredRef.current) {
        lockTriggeredRef.current = true;
        lockAssessment().then((lock) => { setUntil(lock.lockedUntil); setLocked(true); }).catch(() => {
          setError("Assessment lock could not be recorded. Your assessment has been paused; reload after checking your connection.");
        });
      }
    };
    const visibility = () => document.hidden && register("tab-hidden");
    const blur = () => register("window-blur");
    const block = (event, type) => { event.preventDefault(); register(type); };
    const fullscreen = () => { setFull(Boolean(document.fullscreenElement)); if (!document.fullscreenElement) register("fullscreen-exited"); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur);
    const onCopy = (event) => block(event, "copy-blocked");
    const onPaste = (event) => block(event, "paste-blocked");
    const onContextMenu = (event) => block(event, "context-menu-blocked");
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [locked, assessmentStarted]);
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || locked || result) return undefined;
    const listeners = [];
    const watchTrack = (track, label, setReady) => {
      const update = (event) => {
        setReady(track.readyState === "live" && !track.muted);
        const type = `${label}-track-${event.type === "ended" ? "ended" : event.type === "mute" ? "muted" : "unmuted"}`;
        const entry = { type, at: new Date().toISOString() };
        setMediaEvents((current) => [...current, entry]);
        recordIntegrityEvent(type, { questionId: question.id }).catch(() => setError("Media monitoring event could not be stored."));
      };
      for (const eventType of ["mute", "unmute", "ended"]) {
        track.addEventListener(eventType, update);
        listeners.push(() => track.removeEventListener(eventType, update));
      }
    };
    stream.getVideoTracks().forEach((track) => watchTrack(track, "camera", setCamera));
    stream.getAudioTracks().forEach((track) => watchTrack(track, "microphone", setMic));
    return () => listeners.forEach((remove) => remove());
  }, [camera, mic, locked, question?.id, result]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;
  }, [camera, mic, full, result]);
  useEffect(() => {
    if (!locked && !result) return;
    const stream = streamRef.current;
    if (!stream) return;
    streamRef.current = null;
    stream.getTracks().forEach((track) => track.stop());
    setCamera(false);
    setMic(false);
  }, [locked, result]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  async function start() {
    try {
      await document.documentElement.requestFullscreen();
      setFull(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCamera(stream.getVideoTracks().some((track) => track.readyState === "live" && !track.muted));
      setMic(stream.getAudioTracks().some((track) => track.readyState === "live" && !track.muted));
      setAssessmentStarted(true);
      setError("");
    } catch {
      setError("Fullscreen, camera, and microphone permission are required.");
    }
  }
  async function next() {
    if (!answers[question.id] || locked) return;
    if (questionIndex < section.questions.length - 1) return setQuestionIndex((value) => value + 1);
    if (sectionIndex < sections.length - 1) { setSectionIndex((value) => value + 1); return setQuestionIndex(0); }
    setSaving(true); try { setResult(await saveAssessment({ questionSetId: questionSet.id, answers, integrityEvents: events, mediaEvents })); } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  if (locked) return <LockScreen until={until} />;
  if (result) return <main className="assessment-screen"><section className="assessment-card"><div className="eyebrow"><CheckCircle2 size={17} /> Assessment saved</div><h1>Your skill profile is ready.</h1><div className="grid grid-3"><Metric label="Overall score" value={`${result.overallScore}%`} /><Metric label="Suitability" value={`${result.careerProfile.suitability}%`} /><Metric label="Integrity events" value={events.length + mediaEvents.length} /></div><Link className="button button-primary" href="/placement-prep/dashboard">Return to workspace</Link></section></main>;
  if (!questionSet) return <main className="assessment-screen"><section className="assessment-card"><div className="eyebrow">Fresh assessment</div><h1>{generating ? "Generating your assessment questions…" : "Assessment questions are unavailable."}</h1><p className="helper">Gemini creates a new set for each attempt. A test starts only after the complete question set has been generated and checked.</p>{error && <p className="error-message" role="alert">{error}</p>}{!generating && <button className="button button-primary" onClick={loadQuestionSet}><ArrowRight size={16} /> Generate fresh questions</button>}</section></main>;
  if (!full || !camera || !mic) return <main className="assessment-screen"><section className="assessment-card"><div className="eyebrow"><ShieldAlert size={17} /> Secure assessment setup</div><h1>Prepare your test environment.</h1><p className="helper">Fullscreen, camera, and microphone are required. During the assessment, Nexora checks that camera and microphone tracks stay active, but does not record or upload audio or video. Only connection-status events are saved.</p><div className="security-checks"><Check label="Fullscreen" ready={full} icon={Expand} /><Check label="Camera" ready={camera} icon={Camera} /><Check label="Microphone" ready={mic} icon={Mic} /></div>{error && <p className="error-message">{error}</p>}<button className="button button-primary" onClick={start}>{camera || mic ? "Reconnect camera and microphone" : "Enter secure assessment"}</button><Link className="button button-secondary" href="/placement-prep/dashboard">Cancel</Link><Link className="home-button" href="/placement-prep">Go to Home</Link></section></main>;
  return <main className="assessment-screen"><section className="assessment-card"><div className="assessment-top"><span className="eyebrow">Assessment · {question.difficulty}</span><span className="badge">{events.length + mediaEvents.length} integrity events</span></div><div className="assessment-media-monitor"><video aria-label="Local camera preview" autoPlay className="assessment-camera-preview" muted playsInline ref={videoRef} /><div><span className="badge">{camera ? "Camera active" : "Camera unavailable"}</span><span className="badge">{mic ? "Microphone active" : "Microphone unavailable"}</span><p className="helper">Local status only; no audio or video is recorded or uploaded.</p></div></div><h1>{section.title}</h1><p className="helper">{section.description}</p><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map(([value, label]) => <button className={`button ${answers[question.id] === value ? "button-primary" : "button-secondary"}`} key={value} onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))}>{label}</button>)}</div>{error && <p className="error-message">{error}</p>}<button className="button button-primary next-button" disabled={!answers[question.id] || saving} onClick={next}>{saving ? <><Loader2 size={16} /> Saving</> : <><span>Continue</span><ArrowRight size={16} /></>}</button></section></main>;
}
function LockScreen({ until }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!until) return undefined;
    const tick = () => setRemaining(`${Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 60000))} minutes`);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return <main className="assessment-screen"><section className="assessment-card"><div className="eyebrow"><ShieldAlert size={17} /> Assessment unavailable</div><h1>{until ? "Please wait before trying again." : "Complete your profile first."}</h1>{until && <div className="lock-timer">{remaining}</div>}<p className="helper">{until ? "This lock is database-backed. Each later lock adds five minutes." : "Save your student profile before starting the assessment."}</p><Link className="button button-secondary" href="/placement-prep/profile">Go to profile</Link><Link className="home-button" href="/placement-prep">Go to Home</Link></section></main>;
}
function Check({ label, ready, icon: Icon }) { return <div className="security-check"><Icon size={19} /><span>{label}</span><strong>{ready ? "Ready" : "Required"}</strong></div>; }
function Metric({ label, value }) { return <article className="card"><p>{label}</p><div className="stat-value">{value}</div></article>; }
