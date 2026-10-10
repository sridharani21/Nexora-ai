export const MISTAKE_TYPES = {
  CONCEPT_GAP: "Concept gap",
  SYNTAX_ERROR: "Syntax or implementation error",
  CALCULATION_ERROR: "Calculation error",
  TIME_MANAGEMENT: "Time-management issue",
  REPEATED_MISTAKE: "Repeated mistake",
};

export function classifyMistake(mistake, attempt, repetitionCount) {
  const topic = String(mistake.topic || "").toLowerCase();
  if (repetitionCount > 1) return MISTAKE_TYPES.REPEATED_MISTAKE;
  if (topic.includes("debug") || topic.includes("coding") || topic.includes("algorithm")) return MISTAKE_TYPES.SYNTAX_ERROR;
  if (["percentages", "ratios", "probability"].some((item) => topic.includes(item))) return MISTAKE_TYPES.CALCULATION_ERROR;
  if (attempt.totalQuestions > 0 && attempt.durationSeconds / attempt.totalQuestions > 90) return MISTAKE_TYPES.TIME_MANAGEMENT;
  return MISTAKE_TYPES.CONCEPT_GAP;
}
