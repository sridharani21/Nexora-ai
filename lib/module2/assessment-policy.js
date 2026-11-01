export function isDeadlineExpired(deadlineAt, now = Date.now()) {
  return new Date(deadlineAt).getTime() <= now;
}

export function canAnswerBeforeDeadline(deadlineAt, now = Date.now()) {
  return now < new Date(deadlineAt).getTime();
}

export function getRemainingAssessmentSeconds(deadlineAt, currentTime) {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - currentTime) / 1000));
}

export function formatAssessmentDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "Time allocation unavailable";
  totalSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!seconds) return `${minutes} min`;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

export function integrityViolationLevel(count) {
  if (count >= 3) return "REVIEW";
  if (count === 2) return "STRONG";
  if (count === 1) return "WARNING";
  return null;
}

const technicalEventTypes = new Set([
  "CAMERA_ENABLED",
  "CAMERA_DISCONNECTED",
  "FULLSCREEN_ENTER",
  "MICROPHONE_ENABLED",
  "MICROPHONE_DISCONNECTED",
  "NETWORK_OFFLINE",
  "NETWORK_ONLINE",
  "INTERRUPTION_RECOVERED",
]);

export function classifyIntegrityEvent(eventType) {
  return technicalEventTypes.has(eventType) ? "TECHNICAL" : "WARNING";
}

export function isMobileAssessmentClient(userAgent = "") {
  return /android|iphone|ipod|ipad|mobile|tablet|windows phone|blackberry|opera mini/i.test(userAgent);
}

export function integrityEventGroup(eventType) {
  if (eventType === "TAB_HIDDEN" || eventType === "WINDOW_BLUR") return "FOCUS";
  if ([
    "CLIPBOARD_COPY",
    "CLIPBOARD_CUT",
    "CLIPBOARD_PASTE",
    "CONTEXT_MENU_ATTEMPT",
  ].includes(eventType)) return "CLIPBOARD";
  if (eventType === "FULLSCREEN_EXIT") return "FULLSCREEN";
  if (eventType === "CAMERA_DISCONNECTED" || eventType === "MICROPHONE_DISCONNECTED") return "MEDIA";
  return null;
}

export function isImmediateIntegrityTermination(eventType) {
  return eventType === "CAMERA_DISCONNECTED"
    || eventType === "MICROPHONE_DISCONNECTED"
    || eventType === "UNSUPPORTED_CLIENT"
    || eventType === "MOBILE_DEVICE_DETECTED";
}

export function calculateCooldownSeconds(cooldownUntil, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - now) / 1000));
}
