let assessmentStream = null;

export function setAssessmentStream(stream) {
  assessmentStream = stream;
}

export function getAssessmentStream() {
  if (!assessmentStream?.getTracks().some((track) => track.readyState === "live")) return null;
  return assessmentStream;
}

export function stopAssessmentStream() {
  assessmentStream?.getTracks().forEach((track) => track.stop());
  assessmentStream = null;
}
