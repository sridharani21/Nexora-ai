export function calculateAssessmentResult({
  blueprint,
  questions,
  answers,
  completionReason,
  integrityEvents = [],
  questionTime = {},
  attemptId,
  startedAt,
  submittedAt,
}) {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let mcqCorrect = 0;
  let mcqAttempted = 0;
  let maxMarks = 0;
  const sections = new Map();
  const topics = new Map();
  const difficulties = new Map();
  const questionResults = [];

  for (const question of questions) {
    maxMarks += question.marks;
    const answer = answers?.[question.id] || null;
    const section = sections.get(question.sectionId) || {
      id: question.sectionId,
      name: question.sectionName,
      score: 0,
      maxMarks: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
    };
    section.maxMarks += question.marks;
    const topic = topics.get(question.topic) || {
      topic: question.topic,
      score: 0,
      maxMarks: 0,
      correct: 0,
      total: 0,
    };
    const difficulty = difficulties.get(question.difficulty) || {
      difficulty: question.difficulty,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      total: 0,
    };
    difficulty.total += 1;
    topic.maxMarks += question.marks;
    topic.total += 1;

    let questionScore = 0;
    let status = "UNANSWERED";
    const correctAnswer = question.type === "MCQ" ? question.correctOption : undefined;
    if (question.type === "MCQ") {
      if (!answer?.choice) {
        unanswered += 1;
        section.unanswered += 1;
        difficulty.unanswered += 1;
      } else if (answer.choice === question.correctOption) {
        correct += 1;
        mcqCorrect += 1;
        mcqAttempted += 1;
        section.correct += 1;
        topic.correct += 1;
        difficulty.correct += 1;
        questionScore = question.marks;
        status = "CORRECT";
      } else {
        incorrect += 1;
        mcqAttempted += 1;
        section.incorrect += 1;
        difficulty.incorrect += 1;
        questionScore = -question.negativeMarks;
        status = "INCORRECT";
      }
    } else if (!answer?.coding?.submitted) {
      unanswered += 1;
      section.unanswered += 1;
      difficulty.unanswered += 1;
    } else {
      const total = Math.max(0, answer.coding.total || 0);
      const passed = Math.max(0, Math.min(answer.coding.passed || 0, total));
      questionScore = total ? question.marks * passed / total : 0;
      status = passed === total && total > 0 ? "CORRECT" : "PARTIAL";
      if (status === "CORRECT") {
        correct += 1;
        section.correct += 1;
        topic.correct += 1;
        difficulty.correct += 1;
      } else {
        incorrect += 1;
        section.incorrect += 1;
        difficulty.incorrect += 1;
      }
    }
    score += questionScore;
    section.score += questionScore;
    topic.score += questionScore;
    sections.set(question.sectionId, section);
    topics.set(question.topic, topic);
    difficulties.set(question.difficulty, difficulty);
    questionResults.push({
      id: question.id,
      sectionId: question.sectionId,
      sectionName: question.sectionName,
      topic: question.topic,
      skillTested: question.skillTested,
      learningObjective: question.learningObjective,
      selectionReason: question.selectionReason,
      careerRoleRelevance: question.careerRoleRelevance,
      expectedEvidence: question.expectedEvidence,
      evaluationCriteria: question.evaluationCriteria,
      difficulty: question.difficulty,
      type: question.type,
      questionText: question.questionText,
      options: question.options,
      correctAnswer,
      explanation: question.explanation,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      answer: question.type === "MCQ" ? answer?.choice || null : undefined,
      status,
      score: questionScore,
      coding: question.type === "CODING" && answer?.coding?.submitted
        ? { passed: answer.coding.passed, total: answer.coding.total, status: answer.coding.status }
        : undefined,
      solution: question.type === "CODING" ? question.solution : undefined,
    });
  }

  const cappedScore = Math.max(0, Math.min(maxMarks, score));
  const topicResults = [...topics.values()].map((topic) => ({
    ...topic,
    percentage: topic.maxMarks ? Math.round(Math.max(0, topic.score) / topic.maxMarks * 100) : null,
  }));
  return {
    score: Number(cappedScore.toFixed(2)),
    maxMarks: Number(maxMarks.toFixed(2)),
    percentage: maxMarks ? Number((cappedScore / maxMarks * 100).toFixed(2)) : 0,
    accuracy: mcqAttempted ? Number((mcqCorrect / mcqAttempted * 100).toFixed(2)) : null,
    correct,
    incorrect,
    unanswered,
    completionReason,
    summaryVersion: 1,
    assessmentId: "nexora-technical-assessment",
    attemptId,
    branch: blueprint.branch,
    blueprintVersion: blueprint.version,
    startedAt: startedAt?.toISOString?.() || null,
    submittedAt: submittedAt?.toISOString?.() || null,
    timeUsedSeconds: startedAt && submittedAt
      ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000))
      : null,
    questionTimes: questions.map((question, index) => ({
      questionNumber: index + 1,
      sectionName: question.sectionName,
      seconds: Math.max(0, Number(questionTime[question.id]) || 0),
    })),
    sections: [...sections.values()],
    topics: topicResults,
    difficulties: [...difficulties.values()],
    strengths: topicResults.filter((topic) => topic.percentage !== null && topic.percentage >= 70).map((topic) => topic.topic),
    improvementAreas: topicResults.filter((topic) => topic.percentage !== null && topic.percentage < 60).map((topic) => topic.topic),
    codingOutcomes: questionResults.filter((question) => question.type === "CODING").map((question) => ({
      questionId: question.id,
      topic: question.topic,
      ...question.coding,
    })),
    integritySummary: {
      totalEvents: integrityEvents.length,
      warnings: integrityEvents.filter((event) => event.severity === "WARNING").length,
      flaggedForReview: integrityEvents.some((event) => event.severity === "REVIEW"),
      technicalEvents: integrityEvents.filter((event) => event.severity === "TECHNICAL").length,
      eventTypes: [...new Set(integrityEvents.map((event) => event.eventType).filter(Boolean))],
    },
    questions: questionResults,
    scoringPolicyVersion: blueprint.scoringPolicy.version,
  };
}
