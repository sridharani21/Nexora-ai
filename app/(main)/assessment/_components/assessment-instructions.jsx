"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, CircleAlert, LoaderCircle, Mic } from "lucide-react";
import { startModule2Attempt } from "@/actions/module2";
import { setAssessmentStream } from "@/lib/module2/proctoring-stream";
import { formatAssessmentDateTime } from "@/lib/assessment-date-format";
import { formatAssessmentDuration } from "@/lib/module2/assessment-policy";
import { getPossiblePhoneDetectorStatus } from "@/lib/module2/phone-detector";

const phoneDetectorStatus = getPossiblePhoneDetectorStatus();

export default function AssessmentInstructions({ studentName, branch, blueprint, careerRole, priorAttempts, cooldownSeconds = 0 }) {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const endedListenersRef = useRef([]);
  const keepStreamOnNavigationRef = useRef(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [monitoringConsent, setMonitoringConsent] = useState(false);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsMobile(/android|iphone|ipod|ipad|mobile|tablet|windows phone|blackberry|opera mini/i.test(navigator.userAgent));
    return () => {
      endedListenersRef.current.forEach(([track, listener]) => track.removeEventListener("ended", listener));
      endedListenersRef.current = [];
      if (!streamRef.current || keepStreamOnNavigationRef.current) return;
      streamRef.current.getTracks().forEach((track) => track.stop());
      setAssessmentStream(null);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStream && videoRef.current.srcObject !== cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  async function enableMonitoring() {
    setError("");
    if (!monitoringConsent) {
      setError("Review and accept the camera and microphone notice first.");
      return;
    }
    if (isMobile) {
      setError("The assessment must be taken on a desktop or laptop browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Both camera and microphone access are required.");
      }
      streamRef.current = stream;
      setAssessmentStream(stream);
      setCameraStream(stream);
      stream.getTracks().forEach((track) => {
        const listener = () => {
          stream.getTracks().forEach((item) => item.stop());
          streamRef.current = null;
          setAssessmentStream(null);
          setCameraStream(null);
          setError("Camera or microphone access ended. Re-enable both devices before starting.");
        };
        endedListenersRef.current.push([track, listener]);
        track.addEventListener("ended", listener, { once: true });
      });
    } catch (mediaError) {
      setError(mediaError?.message || "Camera and microphone access are required to start.");
    }
  }

  function withdrawMonitoringConsent() {
    setMonitoringConsent(false);
    endedListenersRef.current.forEach(([track, listener]) => track.removeEventListener("ended", listener));
    endedListenersRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setAssessmentStream(null);
    setCameraStream(null);
  }

  async function start() {
    if (isMobile) {
      setError("The assessment must be taken on a desktop or laptop browser.");
      return;
    }
    if (!cameraStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
      || !cameraStream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)) {
      setError("Enable both camera and microphone before starting the assessment.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!document.fullscreenElement) throw new Error("Enter fullscreen to start the assessment.");
      const result = await startModule2Attempt({
        policyAccepted,
        proctoringReady: true,
        leaderboardOptIn,
      });
      if (!result.success) {
        setError(result.error || "The assessment could not be started.");
        setStarting(false);
        return;
      }
      keepStreamOnNavigationRef.current = true;
      router.push(`/assessment/${result.attemptId}`);
    } catch (startError) {
      setError(startError?.message || "The assessment could not be started. Please try again.");
      setStarting(false);
    }
  }

  const questionCount = blueprint.sections.reduce((sum, section) => sum + section.questionCount, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Technical assessment</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Before you begin</h1>
        <p className="mt-2 text-slate-600">
          {studentName ? `${studentName} · ` : ""}{branch} · {careerRole} · {questionCount} questions · {formatAssessmentDuration(blueprint.durationSeconds)} · {blueprint.maxMarks} marks
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Assessment blueprint</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-3 pr-4">Section</th><th className="py-3 pr-4">Questions</th><th className="py-3 pr-4">Time allocation</th><th className="py-3">Marks</th></tr>
            </thead>
            <tbody>
              {blueprint.sections.map((section) => (
                <tr key={section.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-900">{section.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{section.questionCount}</td>
                  <td className="py-3 pr-4 text-slate-600">{formatAssessmentDuration(section.durationSeconds)}</td>
                  <td className="py-3 text-slate-600">{section.marks}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="pt-3 pr-4">Total</td><td className="pt-3 pr-4">{questionCount}</td><td className="pt-3 pr-4">{formatAssessmentDuration(blueprint.durationSeconds)}</td><td className="pt-3">{blueprint.maxMarks}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Section times are allocations within one server-enforced timer. Correct MCQs receive their listed marks, incorrect MCQs lose 25% of their value, and unanswered questions receive zero. Coding marks are based on passed tests. The timer starts only after the complete question set is generated and the server activates your attempt.
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Validated question sets may be reused for students in the same branch to reduce waiting. Each set is checked for format, branch topics, difficulty, and scoring consistency; these checks cannot guarantee factual accuracy. Review explanations critically.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Correct answers and explanations are shown only in the results for your own submitted or expired attempt. If you changed the email on an existing account, its assessment history remains with that same account.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Exam rules</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Use a desktop or laptop. Work independently; do not share questions, use prohibited assistance, or copy/paste.</li>
            <li>Fullscreen is required. The first tab switch, focus loss, fullscreen exit, or clipboard attempt warns you; a second incident shows a stronger warning and a third flags the attempt for review. Focus loss alone is not proof of cheating.</li>
            <li>Your answers save to this attempt. Reopening the page restores the same questions and the server deadline.</li>
            <li>If the network disconnects, reconnect and reopen the same attempt. The timer continues. Contact support for a verified technical issue.</li>
            <li>Camera or microphone loss ends the monitored attempt. The same 10-minute retake cooldown applies.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Privacy and monitoring</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Camera and microphone access are mandatory for the existing local monitoring policy. Browser media remains local: Nexora does not record or upload audio/video, perform face recognition, or infer gaze or emotion. Monitoring events (tab visibility, focus, fullscreen, clipboard and connection changes) are recorded with server timestamps.
            If an answer or code draft cannot be synchronized, that unsent value is stored in this browser for retry and removed after syncing or 24 hours. Avoid shared browsers.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Gemini receives your assessment branch, topic blueprint, and question wording from up to three prior attempts in the same branch to reduce repeats; profile data and answers are not included. If you run or submit code, the code and the relevant test inputs are sent to the configured Judge0 execution service. Private expected outputs are not sent to Judge0 or shown in your browser.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Optional camera-based possible-phone detection is not configured in this version; {phoneDetectorStatus.message} A single browser camera cannot provide true 360-degree room coverage or reliably detect a separate phone. Screenshots, external devices, developer tools, and all clipboard workarounds cannot be completely prevented by browser controls.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
        <div className="flex items-center gap-2">
          <Camera className="size-5 text-indigo-700" />
          <Mic className="size-5 text-indigo-700" />
          <h2 className="font-semibold text-slate-950">Required camera and microphone</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Both devices must remain enabled for the assessment. A local live preview is shown; audio/video are not recorded or transmitted. Use a private, quiet space. This browser-only setup does not provide 360-degree monitoring or reliably detect a second device. {phoneDetectorStatus.message}
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={monitoringConsent} onChange={(event) => {
            if (event.target.checked) setMonitoringConsent(true);
            else withdrawMonitoringConsent();
          }} className="mt-1 size-4 accent-indigo-700" />
          I consent to required local camera and microphone access for this assessment and understand the monitoring limits above.
        </label>
        <button type="button" onClick={enableMonitoring} disabled={!monitoringConsent || Boolean(cameraStream) || isMobile} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-800 disabled:opacity-50">
          <Camera className="size-4" />Enable camera and microphone
        </button>
        {cameraStream && (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full max-w-sm rounded-xl bg-slate-950 object-cover" />
            <p className="text-sm font-medium text-emerald-800">Camera and microphone are active locally.</p>
          </div>
        )}
        {isMobile && <p role="alert" className="mt-3 text-sm text-rose-800">Mobile and tablet browsers are not supported for this monitored assessment.</p>}
      </section>

      {priorAttempts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Previous attempts</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {priorAttempts.slice(0, 3).map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap justify-between gap-2">
                <span>{formatAssessmentDateTime(attempt.submittedAt)} · {attempt.status}</span>
                <a className="font-semibold text-indigo-700 hover:underline" href={`/assessment/${attempt.id}/results`}>View result</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="mb-4 flex items-start gap-2 text-sm leading-6 text-slate-700">
          <input type="checkbox" checked={leaderboardOptIn} onChange={(event) => setLeaderboardOptIn(event.target.checked)} className="mt-1 size-4 accent-indigo-700" />
          Opt in to the anonymous branch leaderboard. Only my best opted-in score and completion time for this blueprint will be ranked; my name and account will not be shown.
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={policyAccepted}
            onChange={(event) => setPolicyAccepted(event.target.checked)}
            className="mt-1 size-4 accent-indigo-700"
          />
          I have read and agree to the assessment rules and privacy notice. I understand that the timer begins only after the server finishes preparing my questions.
        </label>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />{error}
          </p>
        )}
        {cooldownSeconds > 0 && <p role="status" className="mt-4 text-sm font-semibold text-amber-900">Retake available in {Math.ceil(cooldownSeconds / 60)} minute(s).</p>}
        <button
          type="button"
          onClick={start}
          disabled={!policyAccepted || !monitoringConsent || !cameraStream || starting || isMobile || cooldownSeconds > 0}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {starting ? <><LoaderCircle className="size-4 animate-spin" />Preparing assessment…</> : <>Start Assessment <ArrowRight className="size-4" /></>}
        </button>
        {starting && <p className="mt-3 text-sm text-slate-500">Questions are generated and checked now. Your timer has not started yet.</p>}
      </section>
    </main>
  );
}
