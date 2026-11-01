"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flag,
  Maximize,
  Mic,
  Send,
  Wifi,
} from "lucide-react";
import {
  getModule2AttemptStatus,
  reportModule2IntegrityEvent,
  runModule2Code,
  saveModule2Answer,
  saveModule2CodeDraft,
  saveModule2QuestionTime,
  submitModule2Attempt,
  toggleModule2Review,
} from "@/actions/module2";
import { getAssessmentStream, setAssessmentStream, stopAssessmentStream } from "@/lib/module2/proctoring-stream";
import { formatAssessmentDuration, getRemainingAssessmentSeconds } from "@/lib/module2/assessment-policy";
import { getPossiblePhoneDetectorStatus } from "@/lib/module2/phone-detector";

const phoneDetectorStatus = getPossiblePhoneDetectorStatus();
const UNSENT_ANSWER_TTL_MS = 24 * 60 * 60 * 1000;

export default function AssessmentExam({ attempt, questions, initialAnswers }) {
  const router = useRouter();
  const answersRef = useRef(initialAnswers || {});
  const pendingAnswerSaves = useRef(new Set());
  const failedAnswerSaves = useRef(new Set());
  const failedDraftSaves = useRef(new Map());
  const questionSaveSequences = useRef(new Map());
  const answerSaveSequence = useRef(0);
  const timerExpired = useRef(false);
  const fullscreenRef = useRef(false);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [activeIndex, setActiveIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => (
    getRemainingAssessmentSeconds(attempt.deadlineAt, new Date(attempt.serverNow).getTime())
  ));
  const serverClock = useRef(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [submitting, setSubmitting] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeResult, setCodeResult] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [monitoringNotice, setMonitoringNotice] = useState("");
  const [connected, setConnected] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraConsent, setCameraConsent] = useState(false);
  const [proctorError, setProctorError] = useState("");
  const [proctorReady, setProctorReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [integrityViolationCount, setIntegrityViolationCount] = useState(0);

  answersRef.current = answers;
  const activeQuestion = questions[activeIndex];
  const currentAnswer = answers[activeQuestion?.id] || {};
  const sections = useMemo(() => attempt.blueprint.sections, [attempt.blueprint.sections]);
  const cameraIsLive = cameraStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);
  const microphoneIsLive = cameraStream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled);
  const answeredCount = questions.filter((question) => (
    question.type === "MCQ"
      ? Boolean(answers[question.id]?.choice)
      : Boolean(answers[question.id]?.coding?.submitted)
  )).length;

  const goToResults = useCallback(() => {
    router.replace(`/assessment/${attempt.id}/results`);
  }, [attempt.id, router]);
  const unsentStorageKey = `nexora-module2-unsent-${attempt.id}`;

  const persistUnsentAnswers = useCallback(() => {
    const unsent = {
      savedAt: Date.now(),
      answers: [...failedAnswerSaves.current]
        .map((questionId) => ({ questionId, choice: answersRef.current[questionId]?.choice }))
        .filter((answer) => answer.choice),
      drafts: [...failedDraftSaves.current]
        .map(([questionId, draft]) => ({ questionId, ...draft })),
    };
    try {
      if (!unsent.answers.length && !unsent.drafts.length) {
        window.localStorage.removeItem(unsentStorageKey);
      } else {
        window.localStorage.setItem(unsentStorageKey, JSON.stringify(unsent));
      }
    } catch {
      setMonitoringNotice("Unsent answers could not be stored in this browser. Keep this page open and reconnect to retry.");
    }
  }, [unsentStorageKey]);

  const submitAtDeadline = useCallback(async () => {
    setSubmitting(true);
    await Promise.all([...pendingAnswerSaves.current]);
    for (let retry = 0; retry < 3; retry += 1) {
      try {
        const result = await submitModule2Attempt({ attemptId: attempt.id });
        if (result.success) {
          goToResults();
          return;
        }
      } catch {
        setMonitoringNotice("Automatic submission is retrying. Your previously saved answers remain on the server.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 750 * (retry + 1)));
    }
    goToResults();
  }, [attempt.id, goToResults]);

  const reportEvent = useCallback(async (eventType, warningShown = true) => {
    try {
      const result = await reportModule2IntegrityEvent({
        attemptId: attempt.id,
        eventType,
        clientOccurredAt: new Date().toISOString(),
        warningShown,
      });
      if (result.success && Number.isInteger(result.violationCount)) {
        setIntegrityViolationCount(result.violationCount);
      }
      if (!result.success) setMonitoringNotice(result.error || "A monitoring event could not be saved.");
      if (result.ended) {
        setMonitoringNotice(result.error || "Monitoring rules ended this attempt. Your saved answers are on the results page.");
        goToResults();
      } else if (result.warning) {
        const blockedAction = {
          CLIPBOARD_COPY: "Copying assessment content is blocked and recorded.",
          CLIPBOARD_CUT: "Cutting assessment content is blocked and recorded.",
          CLIPBOARD_PASTE: "Pasting into assessment content is blocked and recorded; paste remains available inside the coding editor.",
          CONTEXT_MENU_ATTEMPT: "The context menu is disabled here and this attempt was recorded.",
        }[eventType];
        const message = result.warningLevel === "REVIEW"
          ? `${blockedAction ? `${blockedAction} ` : ""}Third recorded monitoring incident: this attempt is flagged for review. This does not establish cheating.`
          : result.warningLevel === "STRONG"
            ? `${blockedAction ? `${blockedAction} ` : ""}A second monitoring incident was recorded. Please remain in the assessment; another incident will flag this attempt for review.`
            : blockedAction || "A monitoring incident was recorded. Accidental focus changes can happen; please return to the assessment.";
        setMonitoringNotice(message);
      }
      return result;
    } catch {
      setMonitoringNotice("A monitoring event could not be saved. Your assessment remains available.");
      return { success: false };
    }
  }, [attempt.id, goToResults]);

  const retryUnsentAnswers = useCallback(async () => {
    if (!failedAnswerSaves.current.size && !failedDraftSaves.current.size) return;
    for (const questionId of failedAnswerSaves.current) {
      const choice = answersRef.current[questionId]?.choice;
      if (!choice) continue;
      try {
        const result = await saveModule2Answer({ attemptId: attempt.id, questionId, choice });
        if (result.success) failedAnswerSaves.current.delete(questionId);
      } catch {
        return;
      }
    }
    for (const [questionId, draft] of failedDraftSaves.current) {
      try {
        const result = await saveModule2CodeDraft({ attemptId: attempt.id, questionId, ...draft });
        if (result.success) failedDraftSaves.current.delete(questionId);
      } catch {
        return;
      }
    }
    persistUnsentAnswers();
    if (!failedAnswerSaves.current.size && !failedDraftSaves.current.size) {
      setMonitoringNotice("Your previously unsent answers have been saved.");
    }
  }, [attempt.id, persistUnsentAnswers]);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(unsentStorageKey);
      if (!serialized) return;
      const unsent = JSON.parse(serialized);
      if (!Number.isFinite(unsent.savedAt) || Date.now() - unsent.savedAt > UNSENT_ANSWER_TTL_MS) {
        window.localStorage.removeItem(unsentStorageKey);
        setMonitoringNotice("Expired unsent browser data was cleared. Your server-saved answers are unchanged.");
        return;
      }
      if (!Array.isArray(unsent.answers) || !Array.isArray(unsent.drafts)) {
        throw new Error("Stored answer data has an invalid shape.");
      }
      const questionById = new Map(questions.map((question) => [question.id, question]));
      const restored = {};
      for (const answer of unsent.answers) {
        const question = questionById.get(answer?.questionId);
        if (question?.type !== "MCQ" || !question.options.some((option) => option.key === answer.choice)) continue;
        restored[question.id] = { choice: answer.choice };
        failedAnswerSaves.current.add(question.id);
      }
      for (const draft of unsent.drafts) {
        const question = questionById.get(draft?.questionId);
        if (
          question?.type !== "CODING"
          || typeof draft.sourceCode !== "string"
          || draft.sourceCode.length > 20_000
          || !question.supportedLanguages.includes(draft.language)
        ) continue;
        restored[question.id] = {
          ...restored[question.id],
          coding: { ...restored[question.id]?.coding, sourceCode: draft.sourceCode, language: draft.language },
        };
        failedDraftSaves.current.set(question.id, { sourceCode: draft.sourceCode, language: draft.language });
      }
      const mergedAnswers = { ...answersRef.current };
      for (const [questionId, answer] of Object.entries(restored)) {
        mergedAnswers[questionId] = { ...mergedAnswers[questionId], ...answer };
      }
      answersRef.current = mergedAnswers;
      setAnswers((current) => {
        const next = { ...current };
        for (const [questionId, answer] of Object.entries(restored)) {
          next[questionId] = { ...next[questionId], ...answer };
        }
        return next;
      });
      if (navigator.onLine) void retryUnsentAnswers();
    } catch {
      setMonitoringNotice("Previously unsent answers could not be restored. Your server-saved answers are unchanged.");
    }
  }, [questions, retryUnsentAnswers, unsentStorageKey]);

  useEffect(() => {
    const stream = getAssessmentStream();
    const mobile = /android|iphone|ipod|ipad|mobile|tablet|windows phone|blackberry|opera mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
    if (mobile) void reportEvent("UNSUPPORTED_CLIENT");
    if (stream) {
      setCameraStream(stream);
      setCameraConsent(true);
      setProctorReady(Boolean(document.fullscreenElement)
        && stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
        && stream.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));
      void reportEvent("CAMERA_ENABLED", false);
      void reportEvent("MICROPHONE_ENABLED", false);
    } else {
      setFullscreen(Boolean(document.fullscreenElement));
      setProctorReady(false);
    }
  }, [reportEvent]);

  useEffect(() => {
    const stream = cameraStream;
    if (!stream) return undefined;
    let interruptionHandled = false;
    const tracks = [
      ...stream.getVideoTracks().map((track) => [track, "CAMERA_DISCONNECTED"]),
      ...stream.getAudioTracks().map((track) => [track, "MICROPHONE_DISCONNECTED"]),
    ];
    const listeners = tracks.map(([track, eventType]) => {
      const listener = () => {
        if (interruptionHandled) return;
        interruptionHandled = true;
        setProctorReady(false);
        setCameraError("Required camera or microphone access ended. This attempt is being closed.");
        stopAssessmentStream();
        setCameraStream(null);
        void reportEvent(eventType);
      };
      track.addEventListener("ended", listener, { once: true });
      return [track, listener];
    });
    return () => listeners.forEach(([track, listener]) => track.removeEventListener("ended", listener));
  }, [cameraStream, reportEvent]);

  useEffect(() => {
    serverClock.current = {
      serverTime: new Date(attempt.serverNow).getTime(),
      monotonicTime: performance.now(),
    };
    const updateTimer = () => {
      if (!serverClock.current) return;
      const elapsed = performance.now() - serverClock.current.monotonicTime;
      const currentServerTime = serverClock.current.serverTime + elapsed;
      const left = getRemainingAssessmentSeconds(attempt.deadlineAt, currentServerTime);
      setRemainingSeconds(left);
      if (left === 0 && !timerExpired.current) {
        timerExpired.current = true;
        void submitAtDeadline();
      }
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    const onVisibility = () => {
      if (!document.hidden) updateTimer();
    };
    window.addEventListener("focus", updateTimer);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [attempt.deadlineAt, attempt.serverNow, submitAtDeadline]);

  useEffect(() => {
    let cancelled = false;
    const syncAttemptStatus = async () => {
      const requestStartedAt = performance.now();
      try {
        const state = await getModule2AttemptStatus({ attemptId: attempt.id });
        const responseReceivedAt = performance.now();
        if (cancelled) return;
        if (!state.success) {
          setMonitoringNotice(state.error || "Assessment status could not be checked.");
          return;
        }
        setIntegrityViolationCount(Number(state.violationCount) || 0);
        const midpoint = (requestStartedAt + responseReceivedAt) / 2;
        serverClock.current = {
          serverTime: new Date(state.serverNow).getTime() + (responseReceivedAt - requestStartedAt) / 2,
          monotonicTime: midpoint,
        };
        if (state.status !== "ACTIVE") goToResults();
      } catch {
        if (!cancelled) setMonitoringNotice("Assessment status could not be checked. Your server timer continues.");
      }
    };
    void syncAttemptStatus();
    const poll = window.setInterval(syncAttemptStatus, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [attempt.id, goToResults]);

  useEffect(() => {
    fullscreenRef.current = Boolean(document.fullscreenElement);
    const onVisibility = () => {
      if (document.hidden) void reportEvent("TAB_HIDDEN");
    };
    const onBlur = () => void reportEvent("WINDOW_BLUR");
    const onFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      const wasActive = fullscreenRef.current;
      fullscreenRef.current = active;
      setFullscreen(active);
      const mediaReady = cameraIsLive && microphoneIsLive;
      setProctorReady(active && mediaReady);
      if (!active && wasActive) void reportEvent("FULLSCREEN_EXIT");
      if (active && !wasActive) void reportEvent("FULLSCREEN_ENTER", false);
    };
    const onClipboard = (event) => {
      if (event.target instanceof Element && event.target.closest("[data-assessment-code-editor]")) return;
      event.preventDefault();
      const eventType = event.type === "copy"
        ? "CLIPBOARD_COPY"
        : event.type === "cut" ? "CLIPBOARD_CUT" : "CLIPBOARD_PASTE";
      void reportEvent(eventType);
    };
    const onKeyDown = (event) => {
      if (event.target instanceof Element && event.target.closest("[data-assessment-code-editor]")) return;
      if ((event.ctrlKey || event.metaKey) && ["c", "v", "x"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const eventType = event.key.toLowerCase() === "v"
          ? "CLIPBOARD_PASTE"
          : event.key.toLowerCase() === "x" ? "CLIPBOARD_CUT" : "CLIPBOARD_COPY";
        void reportEvent(eventType);
      }
    };
    const onContextMenu = (event) => {
      if (event.target instanceof Element && event.target.closest("[data-assessment-code-editor]")) return;
      event.preventDefault();
      void reportEvent("CONTEXT_MENU_ATTEMPT");
    };
    const onOffline = () => {
      setConnected(false);
      void reportEvent("NETWORK_OFFLINE");
    };
    const onOnline = () => {
      setConnected(true);
      void retryUnsentAnswers();
      void reportEvent("NETWORK_ONLINE");
      void reportEvent("INTERRUPTION_RECOVERED", false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onClipboard);
    document.addEventListener("cut", onClipboard);
    document.addEventListener("paste", onClipboard);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", onBlur);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onClipboard);
      document.removeEventListener("cut", onClipboard);
      document.removeEventListener("paste", onClipboard);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [cameraIsLive, microphoneIsLive, reportEvent, retryUnsentAnswers]);

  useEffect(() => () => stopAssessmentStream(), []);

  useEffect(() => {
    if (!proctorReady || !activeQuestion?.id) return undefined;
    let pendingSeconds = 0;
    let lastTick = Date.now();
    let saving = false;

    async function flushTime() {
      if (saving || pendingSeconds < 1) return;
      const seconds = Math.min(30, pendingSeconds);
      pendingSeconds -= seconds;
      saving = true;
      try {
        const result = await saveModule2QuestionTime({
          attemptId: attempt.id,
          questionId: activeQuestion.id,
          seconds,
        });
        if (!result.success) setMonitoringNotice(result.error || "Question time could not be saved.");
      } catch {
        pendingSeconds += seconds;
        setMonitoringNotice("Question time could not be saved. Check your connection.");
      } finally {
        saving = false;
        if (pendingSeconds >= 15) void flushTime();
      }
    }

    function tick() {
      const now = Date.now();
      if (!document.hidden && document.hasFocus() && Boolean(document.fullscreenElement)) {
        pendingSeconds += Math.floor((now - lastTick) / 1000);
      }
      lastTick = now;
      if (pendingSeconds >= 15) void flushTime();
    }

    const interval = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.hidden) {
        tick();
        void flushTime();
      } else {
        lastTick = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      tick();
      void flushTime();
    };
  }, [activeQuestion?.id, attempt.id, proctorReady]);

  useEffect(() => {
    if (activeQuestion?.type !== "CODING" || currentAnswer.coding?.sourceCode === undefined) return undefined;
    const timeout = window.setTimeout(async () => {
      setSaveStatus("saving");
      const draft = {
        sourceCode: currentAnswer.coding.sourceCode,
        language: currentAnswer.coding.language || activeQuestion.supportedLanguages[0],
      };
      const savePromise = (async () => {
        try {
          const result = await saveModule2CodeDraft({
            attemptId: attempt.id,
            questionId: activeQuestion.id,
            ...draft,
          });
          if (result.success) failedDraftSaves.current.delete(activeQuestion.id);
          else failedDraftSaves.current.set(activeQuestion.id, draft);
          persistUnsentAnswers();
          setSaveStatus(result.success ? "saved" : "error");
          if (!result.success) setMonitoringNotice(result.error || "Your code draft could not be saved.");
        } catch {
          failedDraftSaves.current.set(activeQuestion.id, draft);
          persistUnsentAnswers();
          setSaveStatus("error");
          setMonitoringNotice("Your code draft could not be saved. Check your connection and retry.");
        }
      })();
      pendingAnswerSaves.current.add(savePromise);
      void savePromise.finally(() => pendingAnswerSaves.current.delete(savePromise));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeQuestion, attempt.id, currentAnswer.coding?.language, currentAnswer.coding?.sourceCode, persistUnsentAnswers]);

  async function selectAnswer(choice) {
    const questionId = activeQuestion.id;
    answersRef.current = {
      ...answersRef.current,
      [questionId]: { ...answersRef.current[questionId], choice },
    };
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], choice } }));
    setActiveIndex((index) => Math.min(index + 1, questions.length - 1));
    const saveSequence = ++answerSaveSequence.current;
    questionSaveSequences.current.set(questionId, saveSequence);
    setSaveStatus("saving");
    const savePromise = saveModule2Answer({ attemptId: attempt.id, questionId, choice })
      .then((result) => {
        if (questionSaveSequences.current.get(questionId) === saveSequence) {
          if (result.success) failedAnswerSaves.current.delete(questionId);
          else failedAnswerSaves.current.add(questionId);
          persistUnsentAnswers();
        }
        if (saveSequence === answerSaveSequence.current) setSaveStatus(result.success ? "saved" : "error");
        if (!result.success) setMonitoringNotice(result.error || "Your answer could not be saved.");
        return result.success;
      })
      .catch(() => {
        if (questionSaveSequences.current.get(questionId) === saveSequence) {
          failedAnswerSaves.current.add(questionId);
          persistUnsentAnswers();
        }
        if (saveSequence === answerSaveSequence.current) setSaveStatus("error");
        setMonitoringNotice("Your answer could not be saved. Check your connection and retry.");
        return false;
      });
    pendingAnswerSaves.current.add(savePromise);
    void savePromise.finally(() => pendingAnswerSaves.current.delete(savePromise));
  }

  async function toggleReview() {
    try {
      const result = await toggleModule2Review({ attemptId: attempt.id, questionId: activeQuestion.id });
      if (!result.success) {
        setMonitoringNotice(result.error || "Review status could not be updated.");
        return;
      }
      setAnswers((current) => ({
        ...current,
        [activeQuestion.id]: { ...current[activeQuestion.id], review: result.review },
      }));
    } catch {
      setMonitoringNotice("Review status could not be updated. Check your connection and retry.");
    }
  }

  async function submitCode(mode) {
    setCodeBusy(true);
    setCodeError("");
    setCodeResult(null);
    const code = currentAnswer.coding?.sourceCode || activeQuestion.starterCode?.["Python 3"] || "";
    try {
      const result = await runModule2Code({
        attemptId: attempt.id,
        questionId: activeQuestion.id,
        sourceCode: code,
        language: currentAnswer.coding?.language || activeQuestion.supportedLanguages[0],
        mode,
      });
      if (!result.success) {
        setCodeError(result.error || "Code could not be evaluated.");
      } else {
        setCodeResult(result.result);
        setAnswers((current) => ({
          ...current,
          [activeQuestion.id]: {
            ...current[activeQuestion.id],
            coding: {
              ...current[activeQuestion.id]?.coding,
              sourceCode: code,
              submitted: mode === "SUBMIT" || current[activeQuestion.id]?.coding?.submitted,
              passed: mode === "SUBMIT" ? result.result.passed : current[activeQuestion.id]?.coding?.passed,
              total: mode === "SUBMIT" ? result.result.total : current[activeQuestion.id]?.coding?.total,
              status: result.result.status,
            },
          },
        }));
      }
    } catch {
      setCodeError("Code execution failed. Your assessment is still open.");
    } finally {
      setCodeBusy(false);
    }
  }

  async function finishAttempt() {
    if (!window.confirm("Submit your assessment now? You will not be able to change answers after submission.")) return;
    setSubmitting(true);
    try {
      const answerSavesSucceeded = await Promise.all([...pendingAnswerSaves.current]);
      if (
        answerSavesSucceeded.some((success) => !success)
        || failedAnswerSaves.current.size > 0
        || failedDraftSaves.current.size > 0
      ) {
        setSubmitting(false);
        setMonitoringNotice("A recent answer or code draft could not be saved. Reconnect and retry before submitting.");
        return;
      }
      const result = await submitModule2Attempt({ attemptId: attempt.id });
      if (result.success) {
        failedAnswerSaves.current.clear();
        failedDraftSaves.current.clear();
        persistUnsentAnswers();
        goToResults();
        return;
      }
      setSubmitting(false);
      setMonitoringNotice(result.error || "Submission did not complete. Your answers remain saved.");
    } catch {
      setSubmitting(false);
      setMonitoringNotice("Submission did not complete. Check your connection; your saved answers remain available.");
    }
  }

  async function resumeMonitoring() {
    setProctorError("");
    if (isMobile) {
      setProctorError("This monitored assessment cannot continue on a mobile or tablet browser.");
      return;
    }
    if (!cameraConsent) {
      setProctorError("Consent to the required local camera and microphone access first.");
      return;
    }
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      let stream = getAssessmentStream();
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("Both camera and microphone access are required.");
        }
        setAssessmentStream(stream);
      }
      if (!stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
        || !stream.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)) {
        throw new Error("Enable both camera and microphone to resume.");
      }
      setCameraStream(stream);
      setFullscreen(true);
      setCameraConsent(true);
      setProctorReady(true);
      setCameraError("");
      void reportEvent("CAMERA_ENABLED", false);
      void reportEvent("MICROPHONE_ENABLED", false);
      if (!fullscreenRef.current) {
        fullscreenRef.current = true;
        void reportEvent("FULLSCREEN_ENTER", false);
      }
    } catch (error) {
      setProctorReady(false);
      setProctorError(error?.message || "Fullscreen and camera/microphone access are required to continue.");
    }
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerWarning = remainingSeconds <= 300;
  const timerWarningMessage = remainingSeconds <= 60
    ? "One minute remains."
    : remainingSeconds <= 300 ? "Five minutes or less remain." : "";

  if (!proctorReady || !fullscreen || !cameraIsLive || !microphoneIsLive || isMobile) {
    return (
      <main className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-700"><Camera className="size-5" /><Mic className="size-5" /></div>
        <h1 className="text-2xl font-bold text-slate-950">Monitoring must stay active</h1>
        <p className="text-sm leading-6 text-slate-700">
          Your assessment timer continues while monitoring is paused. Enter fullscreen and keep both camera and microphone active to return to the questions. This local browser monitoring does not record audio/video and cannot provide 360-degree room coverage or reliably detect a separate phone.
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={cameraConsent} onChange={(event) => {
            setCameraConsent(event.target.checked);
            if (!event.target.checked) {
              stopAssessmentStream();
              setCameraStream(null);
              setProctorReady(false);
            }
          }} className="mt-1 size-4 accent-indigo-700" />
          I consent to camera and microphone access remaining active locally during this assessment; no audio/video is recorded or uploaded.
        </label>
        {isMobile && <p role="alert" className="text-sm font-medium text-rose-800">This assessment attempt cannot continue in a mobile or tablet browser. This is a client compatibility restriction, not camera-based phone detection.</p>}
        {(proctorError || cameraError) && <p role="alert" className="text-sm text-rose-800">{proctorError || cameraError}</p>}
        {monitoringNotice && <p role="status" className="text-sm text-amber-900">{monitoringNotice}</p>}
        {!isMobile && (
          <button type="button" onClick={resumeMonitoring} disabled={!cameraConsent} className="h-11 rounded-xl bg-indigo-700 px-4 font-semibold text-white disabled:opacity-50">
            Resume fullscreen monitoring
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="status" aria-live="polite">
          <div className="flex max-w-sm items-center gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <span className="size-6 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-700" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-950">Submitting your assessment</p>
              <p className="mt-1 text-sm text-slate-600">Saving your latest answer and calculating your results…</p>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{attempt.branch} technical assessment</p>
          <p className="mt-1 text-sm text-slate-600">{answeredCount} of {questions.length} answered · {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save issue" : "Answers saved"}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-lg font-bold ${timerWarning ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-900"}`} aria-live="polite">
          <Clock3 className="size-5" />{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          {timerWarning && <span className="sr-only">{timerWarningMessage}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={finishAttempt} disabled={submitting || remainingSeconds === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="size-4" />{submitting ? "Submitting…" : "Submit assessment"}
          </button>
        </div>
      </header>

      {!connected && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Wifi className="size-4" />Connection lost. The server timer continues; reconnect to save more answers.
        </p>
      )}
      {monitoringNotice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{monitoringNotice}</p>}
      {timerWarning && <p role="status" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{timerWarningMessage}</p>}

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {sections.map((section) => {
            const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
            return (
              <section key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <h2 className="font-semibold text-slate-900">{section.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatAssessmentDuration(section.durationSeconds ?? section.durationMinutes * 60)} allocation · {section.marks} marks</p>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {sectionQuestions.map((question) => {
                    const index = questions.findIndex((item) => item.id === question.id);
                    const answer = answers[question.id] || {};
                    const answered = question.type === "MCQ" ? Boolean(answer.choice) : Boolean(answer.coding?.submitted);
                    return (
                      <button
                        key={question.id}
                        type="button"
                        disabled={submitting || remainingSeconds === 0}
                        onClick={() => setActiveIndex(index)}
                        aria-label={`Question ${index + 1}${answered ? ", answered" : ", unanswered"}${answer.review ? ", marked for review" : ""}`}
                        className={`relative flex size-9 items-center justify-center rounded-lg border text-xs font-semibold ${index === activeIndex ? "border-indigo-700 bg-indigo-700 text-white" : answered ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}
                      >
                        {index + 1}
                        {answer.review && <Flag className="absolute -right-1 -top-1 size-3 fill-amber-400 text-amber-600" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Required local monitoring</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Camera and microphone active · no audio/video recording or upload.</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">Optional possible-phone detector: {phoneDetectorStatus.message}</p>
            <p className="mt-1 text-xs text-slate-600">Recorded focus/fullscreen/clipboard incidents: {integrityViolationCount}</p>
            {cameraStream && <video autoPlay muted playsInline ref={(element) => { if (element && element.srcObject !== cameraStream) element.srcObject = cameraStream; }} className="mt-3 aspect-video w-full rounded-lg bg-slate-950 object-cover" />}
            {cameraError && <p role="alert" className="mt-2 text-xs text-rose-800">{cameraError}</p>}
          </section>
          <p className="px-1 text-xs leading-5 text-slate-500">First incident warns, second shows a stronger warning, third flags for review. Browser controls cannot fully prevent screenshots, external devices, developer tools, or clipboard workarounds.</p>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-700">{activeQuestion.sectionName} · Question {activeIndex + 1} of {questions.length}</p>
              <p className="mt-1 text-xs text-slate-500">{activeQuestion.topic} · {activeQuestion.skillTested} · {activeQuestion.difficulty.toLocaleLowerCase()} · {activeQuestion.marks} marks · {formatAssessmentDuration(activeQuestion.estimatedTimeSeconds)} target</p>
            </div>
            <button type="button" onClick={toggleReview} disabled={submitting || remainingSeconds === 0} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${currentAnswer.review ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-700"}`}>
              <Flag className="size-4" />{currentAnswer.review ? "Marked for review" : "Mark for review"}
            </button>
          </div>
          <h1 className="mt-6 whitespace-pre-wrap text-xl font-semibold leading-8 text-slate-950 sm:text-2xl">{activeQuestion.questionText}</h1>
          <details className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-indigo-900">Why this question is included</summary>
            <dl className="mt-3 space-y-2 leading-5">
              <div><dt className="inline font-semibold">Learning objective: </dt><dd className="inline">{activeQuestion.learningObjective}</dd></div>
              <div><dt className="inline font-semibold">Selection reason: </dt><dd className="inline">{activeQuestion.selectionReason}</dd></div>
              <div><dt className="inline font-semibold">Career relevance: </dt><dd className="inline">{activeQuestion.careerRoleRelevance}</dd></div>
              <div><dt className="inline font-semibold">Expected evidence: </dt><dd className="inline">{activeQuestion.expectedEvidence}</dd></div>
            </dl>
          </details>

          {activeQuestion.type === "MCQ" ? (
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">Choose one answer</legend>
              {activeQuestion.options.map((option) => (
                <label key={option.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${currentAnswer.choice === option.key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-400"}`}>
                  <input type="radio" name={`answer-${activeQuestion.id}`} value={option.key} checked={currentAnswer.choice === option.key} onChange={() => selectAnswer(option.key)} disabled={submitting || remainingSeconds === 0} className="mt-1 size-4 accent-indigo-700" />
                  <span className="font-semibold text-slate-700">{option.key}.</span>
                  <span className="text-slate-800">{option.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p><strong>Input:</strong> {activeQuestion.inputFormat}</p>
                <p className="mt-1"><strong>Output:</strong> {activeQuestion.outputFormat}</p>
                <p className="mt-1"><strong>Constraints:</strong> {activeQuestion.constraints}</p>
                <p className="mt-2 font-medium">Sample tests</p>
                {activeQuestion.publicTestCases.map((test, index) => (
                  <pre key={index} className="mt-1 overflow-auto rounded-lg bg-white p-2 text-xs">Input: {test.input}{"\n"}Expected output: {test.expectedOutput}</pre>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <label data-assessment-code-editor="true" className="text-sm font-medium text-slate-700">
                  Language
                  <select
                    value={currentAnswer.coding?.language || activeQuestion.supportedLanguages[0]}
                    disabled={submitting || remainingSeconds === 0}
                    onChange={(event) => setAnswers((current) => ({
                      ...current,
                      [activeQuestion.id]: {
                        ...current[activeQuestion.id],
                        coding: { ...current[activeQuestion.id]?.coding, language: event.target.value },
                      },
                    }))}
                    className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-2"
                  >
                    {activeQuestion.supportedLanguages.map((language) => <option key={language}>{language}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Your code
                  <textarea
                    value={currentAnswer.coding?.sourceCode ?? activeQuestion.starterCode?.[currentAnswer.coding?.language || activeQuestion.supportedLanguages[0]] ?? ""}
                    disabled={submitting || remainingSeconds === 0}
                    onChange={(event) => setAnswers((current) => ({
                      ...current,
                      [activeQuestion.id]: {
                        ...current[activeQuestion.id],
                        coding: { ...current[activeQuestion.id]?.coding, sourceCode: event.target.value },
                      },
                    }))}
                    maxLength={20_000}
                    spellCheck={false}
                    className="mt-1 block min-h-64 w-full rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-50"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">Private test inputs are sent to the configured Judge0 sandbox for evaluation; expected outputs are not sent to Judge0 or shown in your browser. Clipboard and context-menu controls are intentionally not applied inside this code editor.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => submitCode("RUN")} disabled={codeBusy || submitting || remainingSeconds === 0} className="h-10 rounded-lg border border-indigo-200 px-4 text-sm font-semibold text-indigo-800 disabled:opacity-50">{codeBusy ? "Running…" : "Run sample tests"}</button>
                <button type="button" onClick={() => submitCode("SUBMIT")} disabled={codeBusy || submitting || remainingSeconds === 0} className="h-10 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{codeBusy ? "Evaluating…" : "Submit code"}</button>
              </div>
              {codeError && <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><CircleAlert className="size-4" />{codeError}</p>}
              {codeResult && (
                <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {codeResult.status}: {codeResult.passed}/{codeResult.total} public tests passed
                  {codeResult.results?.map((result, index) => <pre key={index} className="mt-2 overflow-auto whitespace-pre-wrap">{`Test ${index + 1}: ${result.status}\n${result.output || ""}`}</pre>)}
                </div>
              )}
            </div>
          )}

          <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
            <button type="button" disabled={activeIndex === 0 || submitting || remainingSeconds === 0} onClick={() => setActiveIndex((index) => index - 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button>
            <button type="button" disabled={activeIndex === questions.length - 1 || submitting || remainingSeconds === 0} onClick={() => setActiveIndex((index) => index + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="size-4" /></button>
          </footer>
        </section>
      </div>
    </main>
  );
}
