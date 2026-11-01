"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function MockInterviewLiveSession({ sessionId }) {
  const router = useRouter();
  const liveStartStorageKey = `nexora-module6-live-start:${sessionId}`;
  const videoRef = useRef(null);
  const liveRef = useRef(null);
  const micStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const inputSourceRef = useRef(null);
  const mutedGainRef = useRef(null);
  const pendingAnswerRef = useRef("");
  const assistantTurnRef = useRef("");
  const answerContextRef = useRef([]);
  const answerIndexRef = useRef(0);
  const nextAnswerIsFollowUpRef = useRef(false);
  const savingRef = useRef(false);
  const answerSavePromiseRef = useRef(Promise.resolve());
  const audioSourcesRef = useRef([]);
  const nextPlaybackTimeRef = useRef(0);
  const finishRef = useRef(false);
  const finishInterviewRef = useRef(null);
  const stopMediaRef = useRef(null);
  const mutedRef = useRef(false);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [outputCaption, setOutputCaption] = useState("");
  const [inputCaption, setInputCaption] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/mock-interview/sessions/${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this interview.");
        if (!active) return;
        const interview = data.session;
        setSession(interview);
        answerContextRef.current = interview.answers;
        const answered = new Set(interview.answers.map((answer) => answer.questionId));
        const firstUnanswered = interview.questions.findIndex((question) => !answered.has(question.id));
        answerIndexRef.current = firstUnanswered < 0 ? interview.questions.length : firstUnanswered;
        setSavedCount(interview.answers.length);
        const storedStart = Number(window.localStorage.getItem(`nexora-module6-live-start:${sessionId}`));
        const elapsedSeconds = Number.isFinite(storedStart) && storedStart > 0
          ? Math.max(0, Math.floor((Date.now() - storedStart) / 1000))
          : 0;
        setRemainingSeconds(Math.max(0, interview.duration * 60 - elapsedSeconds));
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (!session || status !== "connected") return undefined;
    const timer = setInterval(() => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [session, status]);

  useEffect(() => {
    if (!cameraEnabled || !cameraStreamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = cameraStreamRef.current;
    void videoRef.current.play().catch(() => {
      setError("Camera preview could not start. You can continue without camera.");
    });
  }, [cameraEnabled]);

  useEffect(() => {
    if (status === "connected" && remainingSeconds === 0 && session) finishInterviewRef.current?.(false);
  }, [remainingSeconds, session, status]);

  useEffect(() => () => {
    finishRef.current = true;
    void stopMediaRef.current?.(true);
  }, []);

  async function requestCameraPreview() {
    setError("");
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        setCameraEnabled(false);
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      setCameraEnabled(true);
    } catch (cameraError) {
      setError(cameraError?.name === "NotAllowedError"
        ? "Camera permission was declined. You can continue the voice interview without camera."
        : "Camera preview is unavailable. You can continue the voice interview without camera.");
    }
  }

  async function startLiveInterview() {
    if (!session || busy || liveRef.current) return;
    setBusy(true);
    setError("");
    setStatus("connecting");
    try {
      if (status === "disconnected" || status === "reconnecting") await stopMedia();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support microphone access. Use text practice instead.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      micStreamRef.current = stream;

      const tokenResponse = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}/live-token`, { method: "POST" });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Could not connect to the interview provider.");

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const config = {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {},
      };
      const live = await ai.live.connect({
        model: tokenData.model,
        config,
        callbacks: {
          onmessage: (message) => handleLiveMessage(message),
          onerror: () => {
            setStatus("reconnecting");
            setError("The live connection was interrupted. Retry the connection or switch to text practice.");
            liveRef.current = null;
            void stopMedia();
          },
          onclose: () => {
            if (!finishRef.current) {
              liveRef.current = null;
              setStatus("disconnected");
              void stopMedia();
            }
          },
        },
      });
      liveRef.current = live;
      let startedAt = Number(window.localStorage.getItem(liveStartStorageKey));
      if (!Number.isFinite(startedAt) || startedAt <= 0) {
        startedAt = Date.now();
        window.localStorage.setItem(liveStartStorageKey, String(startedAt));
      }
      setRemainingSeconds(Math.max(0, session.duration * 60 - Math.floor((Date.now() - startedAt) / 1000)));
      setStatus("connected");
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === "suspended") await context.resume();
      connectMicrophone(stream, live, context);
      live.sendClientContent({
        turns: [{
          role: "user",
          parts: [{ text: "Begin the live interview now. Greet me briefly and ask the next unanswered question specified in your instructions." }],
        }],
        turnComplete: true,
      });
    } catch (startError) {
      await stopMedia();
      setStatus("ready");
      setError(startError?.name === "NotAllowedError"
        ? "Microphone permission was declined. Allow microphone access or choose the text-only fallback."
        : startError.message || "Unable to start the live interview.");
    } finally {
      setBusy(false);
    }
  }

  function connectMicrophone(stream, live, context) {
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const mutedGain = context.createGain();
    mutedGain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      if (mutedRef.current || liveRef.current !== live) return;
      const pcm = toPcm16(event.inputBuffer.getChannelData(0), context.sampleRate, 16000);
      if (pcm.length) live.sendRealtimeInput({ audio: { data: bytesToBase64(pcm), mimeType: "audio/pcm;rate=16000" } });
    };
    source.connect(processor);
    processor.connect(mutedGain);
    mutedGain.connect(context.destination);
    inputSourceRef.current = source;
    processorRef.current = processor;
    mutedGainRef.current = mutedGain;
  }

  function handleLiveMessage(message) {
    const content = message.serverContent;
    if (!content) return;
    if (content.interrupted) stopPlayback();
    if (content.inputTranscription?.text) {
      appendTranscript(pendingAnswerRef, content.inputTranscription.text);
      setInputCaption(pendingAnswerRef.current.slice(-900));
    }
    if (content.outputTranscription?.text) {
      appendTranscript(assistantTurnRef, content.outputTranscription.text);
      setOutputCaption((current) => `${current} ${content.outputTranscription.text}`.trim().slice(-1200));
    }
    for (const part of content.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) playAudio(part.inlineData.data);
    }
    if (content.turnComplete) {
      if (pendingAnswerRef.current.trim()) void queueAnswerSave();
      else assistantTurnRef.current = "";
    }
  }

  function queueAnswerSave() {
    const savePromise = answerSavePromiseRef.current.then(() => saveCompletedAnswer());
    answerSavePromiseRef.current = savePromise;
    return savePromise;
  }

  async function saveCompletedAnswer() {
    const answerText = pendingAnswerRef.current.trim();
    const question = session?.questions[answerIndexRef.current];
    const previousQuestion = nextAnswerIsFollowUpRef.current
      ? session?.questions[Math.max(0, answerIndexRef.current - 1)]
      : question;
    if (!answerText || !question || !previousQuestion || savingRef.current || answerIndexRef.current >= 12) return;
    if (answerText.length < 5) {
      setError("The speech transcript was too short to save. Please answer again or use text practice.");
      return;
    }
    savingRef.current = true;
    setError("");
    pendingAnswerRef.current = "";
    setInputCaption("");
    try {
      const append = nextAnswerIsFollowUpRef.current;
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: previousQuestion.id,
          answerText,
          append,
          interviewerText: assistantTurnRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your answer transcript.");
      answerContextRef.current = [
        ...answerContextRef.current.filter((answer) => answer.questionId !== data.answer.questionId),
        data.answer,
      ];
      if (!append) setSavedCount((count) => count + 1);
      const requestedFollowUp = /\bto follow up\b|\bfollow-up\b/i.test(assistantTurnRef.current);
      assistantTurnRef.current = "";
      nextAnswerIsFollowUpRef.current = requestedFollowUp;
      if (!requestedFollowUp) answerIndexRef.current += 1;
    } catch (saveError) {
      pendingAnswerRef.current = answerText;
      setInputCaption(answerText.slice(-900));
      setError(`${saveError.message} Your transcript is still in memory; retry or use text practice.`);
    } finally {
      savingRef.current = false;
    }
  }

  function playAudio(encodedAudio) {
    const context = audioContextRef.current;
    if (!context) return;
    const bytes = base64ToBytes(encodedAudio);
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buffer = context.createBuffer(1, samples.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    audioSourcesRef.current.push(source);
  }

  function stopPlayback() {
    for (const source of audioSourcesRef.current) {
      try { source.stop(); } catch {}
    }
    audioSourcesRef.current = [];
    nextPlaybackTimeRef.current = audioContextRef.current?.currentTime || 0;
  }

  function setMicrophoneMuted(value) {
    for (const track of micStreamRef.current?.getAudioTracks() || []) track.enabled = !value;
    mutedRef.current = value;
    setMuted(value);
  }

  async function stopMedia(unmounting = false) {
    try { liveRef.current?.close(); } catch {}
    liveRef.current = null;
    processorRef.current?.disconnect();
    inputSourceRef.current?.disconnect();
    mutedGainRef.current?.disconnect();
    processorRef.current = null;
    inputSourceRef.current = null;
    mutedGainRef.current = null;
    for (const stream of [micStreamRef.current, cameraStreamRef.current]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    micStreamRef.current = null;
    cameraStreamRef.current = null;
    if (!unmounting) {
      setCameraEnabled(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    stopPlayback();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") await audioContextRef.current.close();
    audioContextRef.current = null;
  }

  async function finishInterview(confirm = true) {
    if (!session || finishRef.current || busy) return;
    if (confirm && !window.confirm("End this interview and save your report?")) return;
    finishRef.current = true;
    setBusy(true);
    setStatus("finishing");
    setError("");
    try {
      await stopMedia();
      await answerSavePromiseRef.current;
      if (pendingAnswerRef.current.trim()) await queueAnswerSave();
      if (pendingAnswerRef.current.trim()) {
        throw new Error("Your latest spoken response could not be saved. Retry the connection before ending the interview.");
      }
      const response = await fetch(`/api/mock-interview/sessions/${encodeURIComponent(session.id)}/finish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the interview report.");
      window.localStorage.removeItem(liveStartStorageKey);
      router.push(`/mock-interview/report/${encodeURIComponent(session.id)}`);
    } catch (finishError) {
      finishRef.current = false;
      setStatus("disconnected");
      setError(finishError.message);
    } finally {
      setBusy(false);
    }
  }

  finishInterviewRef.current = finishInterview;
  stopMediaRef.current = stopMedia;

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  const questionCount = session?.questions?.length || 0;
  if (error && !session) return <main className="mx-auto max-w-4xl px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p><Link href="/mock-interview" className="mt-4 inline-block font-semibold text-indigo-700 underline">Back to Module 6</Link></main>;
  if (!session) return <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading interview…</main>;
  if (session.status !== "in_progress") return <main className="mx-auto max-w-4xl p-8"><Link href={`/mock-interview/report/${session.id}`} className="font-semibold text-indigo-700 underline">View saved interview report</Link></main>;
  const allQuestionsAnswered = savedCount >= questionCount;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Module 6 · Audio-only interview</p><h1 className="mt-1 text-xl font-bold">{session.careerTitle}</h1><p className="text-sm capitalize text-slate-300">{session.interviewType} · {session.difficulty} · Gemini Live</p></div>
        <div className="rounded-xl bg-white/10 px-4 py-2 text-center"><p className="text-xs text-slate-300">Time remaining</p><p className="font-mono text-xl font-bold" aria-live="polite">{minutes}:{seconds}</p></div>
      </header>
      {!session.tavusAvailable && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">This is the audio-only Gemini fallback; no video avatar is active. To enable Tavus video interviews, configure both TAVUS_API_KEY and TAVUS_PAL_ID in .env.local and restart the server.</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="flex min-h-[440px] flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-900 to-slate-950 p-6 text-center text-white sm:p-10">
          <div className={`relative flex h-36 w-36 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-2xl ${status === "connected" ? "animate-pulse" : ""}`}>
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-indigo-400 text-4xl font-black text-indigo-950">N</div>
          </div>
          <h2 className="mt-6 text-xl font-bold">AI interviewer</h2>
          <p className="mt-2 text-sm text-indigo-100">{statusLabel(status, savedCount, session.questions.length)}</p>
          <div className="mt-5 w-full max-w-xl space-y-3">
            {outputCaption && <p className="rounded-xl bg-black/20 p-3 text-left text-sm leading-6 text-white" aria-live="polite">{outputCaption}</p>}
            {inputCaption && <p className="rounded-xl bg-white/10 p-3 text-left text-sm leading-6 text-indigo-50">Your transcript: {inputCaption}</p>}
          </div>
          {status !== "connected" && (
            <button onClick={allQuestionsAnswered ? () => finishInterview(true) : startLiveInterview} disabled={busy || status === "connecting" || status === "finishing"} className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-indigo-950 disabled:opacity-60">
              {status === "connecting" ? "Connecting…" : status === "disconnected" || status === "reconnecting" ? "Retry live connection" : allQuestionsAnswered ? "Finish and view report" : "Start live interview"}
            </button>
          )}
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold text-slate-900">Camera preview</h2><p className="mt-1 text-xs leading-5 text-slate-500">Optional, local preview only. Video is not sent or recorded.</p></div>
              <button type="button" onClick={requestCameraPreview} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{cameraEnabled ? "Turn off" : "Enable"}</button>
            </div>
            {cameraEnabled && <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full rounded-xl bg-slate-950 object-cover" aria-label="Local camera preview" />}
            {!cameraEnabled && <div className="mt-3 flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Camera is off</div>}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold text-slate-900">Interview controls</h2>
            <p className="mt-1 text-sm text-slate-600">{savedCount} of {session.questions.length} response transcripts saved</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" disabled={status !== "connected"} onClick={() => setMicrophoneMuted(!muted)} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">{muted ? "Unmute mic" : "Mute mic"}</button>
              <button type="button" disabled={status === "finishing"} onClick={() => finishInterview(true)} className="rounded-xl bg-rose-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50">End interview</button>
            </div>
          </section>
          {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
          <p className="text-xs leading-5 text-slate-500">Microphone audio is streamed to Gemini for the live conversation. Nexora does not record or retain raw media. Spoken response transcripts and report feedback are saved to your account. Browser interruption monitoring is not enabled.</p>
          <Link href={`/mock-interview/text-session/${encodeURIComponent(session.id)}`} className="block text-center text-sm font-semibold text-indigo-700 underline">Switch to text-only practice</Link>
        </aside>
      </div>
    </main>
  );
}

function statusLabel(status, answered, total) {
  if (status === "connected") return `${answered} of ${total} answers saved · Listening for your response`;
  if (answered >= total) return "All planned answers are saved. Finish to view your report.";
  if (status === "connecting") return "Requesting microphone and connecting securely…";
  if (status === "reconnecting") return "Connection interrupted · retry or switch to text";
  if (status === "disconnected") return "Not connected · retry or use the text fallback";
  if (status === "finishing") return "Saving your interview report…";
  return "Microphone is off until you start";
}

function appendTranscript(reference, text) {
  const incoming = text.trim();
  if (!incoming) return;
  const current = reference.current;
  if (!current || incoming.startsWith(current)) reference.current = incoming;
  else if (!current.startsWith(incoming) && !current.endsWith(incoming)) reference.current = `${current} ${incoming}`;
}

function toPcm16(samples, sourceRate, targetRate) {
  const ratio = sourceRate / targetRate;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[Math.floor(index * ratio)]));
    output[index] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}

function bytesToBase64(samples) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1024) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 1024));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
