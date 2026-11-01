export const RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"];
export const RIASEC_QUESTIONS_PER_DIMENSION = 4;
export const RIASEC_DIMENSION_INFO = {
  R: { name: "Realistic", description: "Practical, hands-on, technical and building activities.", activities: "Making, operating, building, repairing, or working with practical tools and systems." },
  I: { name: "Investigative", description: "Research, analysis, experimentation and problem-solving.", activities: "Exploring questions, analyzing evidence, experimenting, and understanding how things work." },
  A: { name: "Artistic", description: "Creativity, design, imagination and original expression.", activities: "Creating designs, writing, expressing ideas, and developing original approaches." },
  S: { name: "Social", description: "Helping, teaching, communicating and supporting people.", activities: "Teaching, explaining, mentoring, listening, and collaborating to support people." },
  E: { name: "Enterprising", description: "Initiative, leadership, persuasion and organizing action.", activities: "Leading projects, presenting ideas, persuading, organizing teams, and starting initiatives." },
  C: { name: "Conventional", description: "Organization, accuracy, structured processes and data.", activities: "Organizing information, checking details, maintaining records, and improving reliable processes." },
};

export function calculateRiasecScores(questions, responses) {
  if (!Array.isArray(questions) || !responses || typeof responses !== "object" || Array.isArray(responses)) {
    throw new Error("The assessment responses are invalid.");
  }
  if (!questions.every((question) => question && typeof question.id === "string" && RIASEC_DIMENSIONS.includes(question.dimension))) {
    throw new Error("The saved assessment question set is invalid.");
  }
  const expectedQuestionIds = new Set(questions.map((question) => question.id));
  if (expectedQuestionIds.size !== questions.length || questions.length === 0) {
    throw new Error("The saved assessment question set is invalid.");
  }
  for (const [questionId, score] of Object.entries(responses)) {
    if (!expectedQuestionIds.has(questionId)) throw new Error("A response references an unknown question.");
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Responses must use the 1-to-5 scale.");
  }

  const dimensions = Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, []]));
  for (const question of questions) {
    if (!dimensions[question.dimension]) throw new Error("A question has an invalid interest dimension.");
    const response = responses[question.id];
    if (response === undefined) throw new Error("Answer every question before submitting.");
    dimensions[question.dimension].push(response);
  }
  if (RIASEC_DIMENSIONS.some((dimension) => dimensions[dimension].length !== RIASEC_QUESTIONS_PER_DIMENSION)) {
    throw new Error("Every RIASEC dimension needs exactly four questions.");
  }

  const scores = Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => {
    const values = dimensions[dimension];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [dimension, {
      mean: Number(mean.toFixed(2)),
      percentage: Math.round(((mean - 1) / 4) * 100),
      responseCount: values.length,
    }];
  }));
  const ranking = [...RIASEC_DIMENSIONS].sort((left, right) => (
    scores[right].mean - scores[left].mean || RIASEC_DIMENSIONS.indexOf(left) - RIASEC_DIMENSIONS.indexOf(right)
  ));
  const topScore = scores[ranking[0]].mean;
  const tiedTop = ranking.filter((dimension) => scores[dimension].mean === topScore);
  return {
    scores,
    ranking,
    topThree: ranking.slice(0, 3),
    interestCode: ranking.slice(0, 3).join("-"),
    tiedTop,
  };
}

export function buildDeterministicInterpretation(result) {
  const first = RIASEC_DIMENSION_INFO[result.ranking[0]];
  const top = result.topThree.map((dimension) => RIASEC_DIMENSION_INFO[dimension].name);
  const ties = result.tiedTop.length > 1
    ? ` Your highest scores are tied across ${result.tiedTop.map((dimension) => RIASEC_DIMENSION_INFO[dimension].name).join(" and ")}, so both interests are shown as leading strengths.`
    : "";
  const spread = result.scores[result.ranking[0]].mean - result.scores[result.ranking[2]].mean;
  const closeness = spread <= 0.5
    ? " Your leading scores are close together, which may reflect varied interests rather than a single exclusive direction."
    : "";
  return `Your leading reported interest is ${first.name}: ${first.description} Your top-three interest code is ${result.interestCode} (${top.join(", ")}). This combination can help you explore activities that bring these preferences together, such as ${first.activities.toLowerCase()} Consider what kinds of tasks and environments you want to try next; these results describe reported interests, not ability, a diagnosis, or a prediction of career success.${ties}${closeness}`;
}
