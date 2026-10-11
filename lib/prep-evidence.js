import { PRACTICE_QUESTIONS } from "../data/prep-practice.js";

const PRACTICE_SUBJECT_SKILLS = {
  aptitude: "aptitude",
  reasoning: "aptitude",
  verbal: "communication",
  dsa: "dsa",
  coding: "programming",
  sql: "technical",
  oop: "technical",
  dbms: "technical",
  os: "technical",
  networks: "technical",
  core: "technical",
  role: "technical",
};

function validScore(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

export function aggregateReadinessSkills({
  assessmentScores = {},
  assessmentAnswers = {},
  previousAssessmentScores = {},
  assessmentId = null,
  practiceAttempts = [],
}) {
  const skills = ["aptitude", "programming", "dsa", "technical", "communication"];
  const practiceBySkill = Object.fromEntries(skills.map((skill) => [skill, {
    attempts: [],
    topics: new Map(),
    difficulties: new Map(),
  }]));

  for (const answer of Object.values(assessmentAnswers)) {
    const skill = answer?.section;
    if (!skills.includes(skill) || typeof answer.isCorrect !== "boolean") continue;
    const topic = answer.topic || "General";
    const topicStats = practiceBySkill[skill].topics.get(topic) || { correct: 0, total: 0 };
    topicStats.correct += answer.isCorrect ? 1 : 0;
    topicStats.total += 1;
    practiceBySkill[skill].topics.set(topic, topicStats);
    const difficulty = String(answer.difficulty || "unknown").toLowerCase();
    const difficultyStats = practiceBySkill[skill].difficulties.get(difficulty) || { correct: 0, total: 0 };
    difficultyStats.correct += answer.isCorrect ? 1 : 0;
    difficultyStats.total += 1;
    practiceBySkill[skill].difficulties.set(difficulty, difficultyStats);
  }

  for (const attempt of practiceAttempts) {
    let answers = null;
    let questionIds = null;
    let savedQuestions = [];
    try {
      answers = JSON.parse(attempt.answers || "{}");
      questionIds = JSON.parse(attempt.questionIds || "[]");
      savedQuestions = JSON.parse(attempt.questionData || "[]");
    } catch {
      answers = null;
      questionIds = null;
      savedQuestions = [];
    }
    if (!Array.isArray(questionIds) || !answers || typeof answers !== "object" || Array.isArray(answers)) {
      questionIds = [];
      answers = null;
    }

    const attemptResults = new Map();
    const questionsForAttempt = new Map(
      [...(Array.isArray(savedQuestions) ? savedQuestions : []), ...PRACTICE_QUESTIONS]
        .map((question) => [question.id, question]),
    );
    for (const questionId of questionIds) {
      const question = questionsForAttempt.get(questionId);
      if (!question || !Object.hasOwn(answers, questionId)) continue;
      const skill = PRACTICE_SUBJECT_SKILLS[question.subject];
      if (!skill) continue;
      const group = attemptResults.get(skill) || { correct: 0, total: 0 };
      const isCorrect = answers[questionId] === question.answer;
      group.correct += isCorrect ? 1 : 0;
      group.total += 1;
      attemptResults.set(skill, group);

      const topicStats = practiceBySkill[skill].topics.get(question.topic) || { correct: 0, total: 0 };
      topicStats.correct += isCorrect ? 1 : 0;
      topicStats.total += 1;
      practiceBySkill[skill].topics.set(question.topic, topicStats);
      const difficultyStats = practiceBySkill[skill].difficulties.get(question.difficulty) || { correct: 0, total: 0 };
      difficultyStats.correct += isCorrect ? 1 : 0;
      difficultyStats.total += 1;
      practiceBySkill[skill].difficulties.set(question.difficulty, difficultyStats);
    }

    for (const [skill, result] of attemptResults) {
      practiceBySkill[skill].attempts.push({
        id: attempt.id,
        score: (result.correct / result.total) * 100,
        questionCount: result.total,
      });
    }

    if (!attemptResults.size) {
      const fallbackSkill = PRACTICE_SUBJECT_SKILLS[attempt.subject];
      if (fallbackSkill && Number.isFinite(attempt.score)) {
        practiceBySkill[fallbackSkill].attempts.push({
          id: attempt.id,
          score: validScore(attempt.score),
          questionCount: Number.isFinite(attempt.totalQuestions) ? attempt.totalQuestions : 0,
        });
      }
    }
  }

  return Object.fromEntries(skills.map((skill) => {
    const assessmentScore = validScore(assessmentScores[skill]);
    const practiceForSkill = practiceBySkill[skill].attempts;
    const practiceScore = practiceForSkill.length
      ? practiceForSkill.reduce((total, attempt) => total + attempt.score, 0) / practiceForSkill.length
      : null;
    const sources = [assessmentScore, practiceScore].filter((value) => value !== null);
    const currentScore = sources.length
      ? Math.round(sources.reduce((total, value) => total + value, 0) / sources.length)
      : null;
    const previousScore = validScore(previousAssessmentScores[skill]);
    const delta = assessmentScore !== null && previousScore !== null
      ? Math.round(assessmentScore - previousScore)
      : null;

    return [skill, {
      score: currentScore,
      assessmentScore,
      practiceScore: practiceScore === null ? null : Math.round(practiceScore),
      practiceQuestionCount: practiceForSkill.reduce((total, attempt) => total + attempt.questionCount, 0),
      topicEvidence: Object.fromEntries([...practiceBySkill[skill].topics].map(([topic, counts]) => [
        topic,
        { accuracy: Math.round((counts.correct / counts.total) * 100), questionCount: counts.total },
      ])),
      difficultyEvidence: Object.fromEntries([...practiceBySkill[skill].difficulties].map(([difficulty, counts]) => [
        difficulty,
        { accuracy: Math.round((counts.correct / counts.total) * 100), questionCount: counts.total },
      ])),
      trend: delta === null ? "Insufficient evidence" : delta > 2 ? "Improving" : delta < -2 ? "Declining" : "Stable",
      delta,
      evidenceCount: (assessmentScore === null ? 0 : 1) + practiceForSkill.length,
      evidenceRecordIds: [
        ...(assessmentScore === null || !assessmentId ? [] : [assessmentId]),
        ...practiceForSkill.map((attempt) => attempt.id),
      ],
    }];
  }));
}
