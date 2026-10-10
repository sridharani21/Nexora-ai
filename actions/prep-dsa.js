"use server";

import { db } from "@/lib/prisma";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";
import { DSA_LANGUAGES, DSA_STATUS_LABELS, DSA_TOPICS, LEETCODE_PROBLEMS } from "@/data/prep-dsa";
import { getSkillLevels } from "@/actions/prep-levels";
import { levelName } from "@/data/prep-levels";
import { ASSESSMENT_SECTIONS } from "@/data/prep-assessment";
import { PRACTICE_QUESTIONS } from "@/data/prep-practice";

const problemBySlug = new Map(LEETCODE_PROBLEMS.map((problem) => [problem.slug, problem]));
const validActivities = new Set(["OPENED", "ATTEMPTED", "FAILED", "REATTEMPT_REQUIRED", "STUDENT_MARKED_SOLVED"]);
const assessmentDsaQuestions = new Map(
  (ASSESSMENT_SECTIONS.find((section) => section.id === "dsa")?.questions || [])
    .map((question) => [question.id, question]),
);
const practiceDsaQuestions = new Map(
  PRACTICE_QUESTIONS.filter((question) => question.subject === "dsa").map((question) => [question.id, question]),
);

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getAssessmentDsaScore(profile) {
  const latestSkills = parseJson(profile.assessments[0]?.skillProfile);
  return typeof latestSkills.dsa === "number" && Number.isFinite(latestSkills.dsa)
    ? latestSkills.dsa
    : null;
}

function difficultyRank(difficulty) {
  return { Easy: 1, Medium: 2, Hard: 3 }[difficulty] || 1;
}

function createTopicEvidence() {
  return new Map(DSA_TOPICS.map((topic) => [
    topic,
    { correct: 0, total: 0, assessmentQuestions: 0, practiceQuestions: 0, mistakes: 0 },
  ]));
}

function addTopicEvidence(evidence, topic, isCorrect, source) {
  if (!topic || typeof isCorrect !== "boolean") return;
  const result = evidence.get(topic);
  if (!result) return;
  result.total += 1;
  result.correct += Number(isCorrect);
  result.mistakes += Number(!isCorrect);
  if (source === "assessment") result.assessmentQuestions += 1;
  if (source === "practice") result.practiceQuestions += 1;
}

function getTopicEvidence(profile) {
  const evidence = createTopicEvidence();
  for (const attempt of profile.assessments) {
    const answers = parseJson(attempt.answers, {});
    for (const [questionId, question] of assessmentDsaQuestions) {
      const answer = answers[questionId];
      if (!answer) continue;
      const isCorrect = typeof answer.isCorrect === "boolean"
        ? answer.isCorrect
        : answer.selected !== null && answer.selected === answer.correct;
      addTopicEvidence(evidence, answer.topic || question.topic, isCorrect, "assessment");
    }
  }
  for (const attempt of profile.practiceAttempts) {
    const answers = parseJson(attempt.answers, {});
    for (const [questionId, question] of practiceDsaQuestions) {
      if (!Object.hasOwn(answers, questionId)) continue;
      addTopicEvidence(evidence, question.topic, answers[questionId] === question.answer, "practice");
    }
  }
  return evidence;
}

export async function getDsaDashboard() {
  const profile = await requirePrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 3 },
    readiness: true,
    practiceAttempts: {
      where: { subject: "dsa" },
      orderBy: { completedAt: "desc" },
      take: 30,
    },
    preparationPlans: {
      orderBy: [{ createdAt: "desc" }, { weekNumber: "desc" }],
      take: 1,
      include: { tasks: true },
    },
    dsaProblemProgress: { orderBy: { lastActivityAt: "desc" } },
    dsaActivities: { orderBy: { createdAt: "desc" }, take: 30 },
  });
  const levelData = await getSkillLevels();
  const dsaLevel = levelData.skills.find((skill) => skill.id === "dsa");
  const progressBySlug = new Map(profile.dsaProblemProgress.map((item) => [item.problemSlug, item]));
  const activities = profile.dsaActivities;
  const topicEvidence = getTopicEvidence(profile);
  const topicCatalogProgress = DSA_TOPICS.map((topic) => {
    const problems = LEETCODE_PROBLEMS.filter((problem) => problem.topic === topic);
    const markedSolved = problems.filter((problem) => progressBySlug.get(problem.slug)?.status === "STUDENT_MARKED_SOLVED").length;
    const evidence = topicEvidence.get(topic);
    return {
      topic,
      total: problems.length,
      markedSolved,
      catalogPercent: problems.length ? Math.round((markedSolved / problems.length) * 100) : 0,
      score: evidence.total ? Math.round((evidence.correct / evidence.total) * 100) : null,
      evidenceCount: evidence.total,
      assessmentQuestions: evidence.assessmentQuestions,
      practiceQuestions: evidence.practiceQuestions,
      mistakes: evidence.mistakes,
    };
  });
  const latestDsaPractice = profile.practiceAttempts.slice(0, 5);
  const practiceAverage = latestDsaPractice.length
    ? Math.round(latestDsaPractice.reduce((sum, attempt) => sum + attempt.score, 0) / latestDsaPractice.length)
    : null;
  const assessmentScore = getAssessmentDsaScore(profile);
  const hasPracticeEvidence = Boolean(dsaLevel?.attempts);
  const assessmentLevel = assessmentScore === null
    ? 1
    : assessmentScore >= 85 ? 5
      : assessmentScore >= 70 ? 4
        : assessmentScore >= 55 ? 3
          : assessmentScore >= 40 ? 2
            : 1;
  const currentLevel = hasPracticeEvidence ? dsaLevel.currentLevel : assessmentLevel;
  const recommendedDifficulty = hasPracticeEvidence
    ? (dsaLevel.recommendedDifficulty || "EASY").toLowerCase()
    : assessmentScore === null ? "easy"
      : assessmentScore >= 85 ? "hard"
        : assessmentScore >= 60 ? "medium"
          : "easy";
  const levelDifficultyCap = currentLevel >= 5 ? 3 : currentLevel >= 3 ? 2 : 1;
  const recommendedDifficultyRank = Math.min(
    difficultyRank(recommendedDifficulty),
    levelDifficultyCap,
  );
  const recommendationDifficulty = ["Easy", "Medium", "Hard"][recommendedDifficultyRank - 1];
  const evidenceTopics = topicCatalogProgress.filter((topic) => topic.evidenceCount > 0);
  const weakTopics = evidenceTopics
    .filter((topic) => topic.score < 70)
    .sort((first, second) => first.score - second.score || second.mistakes - first.mistakes);
  const recommendationTopics = weakTopics.length
    ? weakTopics
    : evidenceTopics.length
      ? [...evidenceTopics].sort((first, second) => first.score - second.score)
      : [];
  const rankedProblems = [...LEETCODE_PROBLEMS]
    .filter((problem) => progressBySlug.get(problem.slug)?.status !== "STUDENT_MARKED_SOLVED")
    .filter((problem) => difficultyRank(problem.difficulty) <= recommendedDifficultyRank)
    .filter((problem) => recommendationTopics.some((topic) => topic.topic === problem.topic))
    .sort((first, second) => {
      const firstEvidence = topicEvidence.get(first.topic);
      const secondEvidence = topicEvidence.get(second.topic);
      const firstTopic = topicCatalogProgress.find((topic) => topic.topic === first.topic);
      const secondTopic = topicCatalogProgress.find((topic) => topic.topic === second.topic);
      return firstTopic.score - secondTopic.score ||
        secondEvidence.mistakes - firstEvidence.mistakes ||
        Math.abs(difficultyRank(first.difficulty) - recommendedDifficultyRank) -
          Math.abs(difficultyRank(second.difficulty) - recommendedDifficultyRank) ||
        difficultyRank(first.difficulty) - difficultyRank(second.difficulty);
    });
  const recommendations = [];
  const selectedTopics = new Map();
  for (const problem of rankedProblems) {
    const count = selectedTopics.get(problem.topic) || 0;
    if (count >= 2) continue;
    selectedTopics.set(problem.topic, count + 1);
    const topic = topicCatalogProgress.find((item) => item.topic === problem.topic);
    const sources = [
      topic.assessmentQuestions ? `${topic.assessmentQuestions} assessment question${topic.assessmentQuestions === 1 ? "" : "s"}` : null,
      topic.practiceQuestions ? `${topic.practiceQuestions} practice question${topic.practiceQuestions === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const reason = topic.score < 70
      ? `Your ${problem.topic} accuracy is ${topic.score}% across ${topic.evidenceCount} assessed/practice question${topic.evidenceCount === 1 ? "" : "s"}${topic.mistakes ? `, including ${topic.mistakes} incorrect answer${topic.mistakes === 1 ? "" : "s"}` : ""}. Evidence: ${sources.join(" and ")}.`
      : `Your ${problem.topic} accuracy is ${topic.score}% across ${topic.evidenceCount} assessed/practice questions. This ${problem.difficulty} problem advances a topic where your evidence is currently strong.`;
    recommendations.push({ ...problem, reason, evidenceScore: topic.score, evidenceCount: topic.evidenceCount });
    if (recommendations.length === 3) break;
  }
  const progressRows = LEETCODE_PROBLEMS.map((problem) => ({
    ...problem,
    status: progressBySlug.get(problem.slug)?.status || "NOT_STARTED",
    attemptCount: progressBySlug.get(problem.slug)?.attemptCount || 0,
  }));
  const activityCount = activities.filter((activity) => activity.activityType !== "OPENED").length;
  const markedSolvedCount = profile.dsaProblemProgress.filter((item) => item.status === "STUDENT_MARKED_SOLVED").length;
  const attemptedProblemCount = profile.dsaProblemProgress.filter((item) => item.attemptCount > 0).length;
  const difficultyProgress = ["Easy", "Medium", "Hard"].map((difficulty) => ({
    difficulty,
    total: LEETCODE_PROBLEMS.filter((problem) => problem.difficulty === difficulty).length,
    markedSolved: progressRows.filter((problem) => problem.difficulty === difficulty && problem.status === "STUDENT_MARKED_SOLVED").length,
  }));
  const readinessPriorities = parseJson(profile.readiness?.preparationPriorities, []);

  return {
    preferredLanguage: profile.preferredDsaLanguage,
    languages: DSA_LANGUAGES,
    problems: progressRows,
    recommendations,
    topics: topicCatalogProgress,
    hasDsaEvidence: evidenceTopics.length > 0,
    activities: activities.map((activity) => ({
      ...activity,
      statusLabel: DSA_STATUS_LABELS[activity.activityType] || activity.activityType,
    })),
    stats: {
      level: currentLevel,
      levelName: levelName(currentLevel),
      levelSource: hasPracticeEvidence ? "practice" : assessmentScore === null ? "initial" : "assessment",
      recommendedDifficulty,
      recommendationDifficulty,
      levelProgress: hasPracticeEvidence ? dsaLevel.progress : 0,
      levelReason: hasPracticeEvidence
        ? dsaLevel.nextLevelReason
        : assessmentScore === null
          ? "Complete the DSA assessment and topic practice to establish a personalized starting level."
          : `Your assessment score of ${assessmentScore}% sets your initial ${levelName(currentLevel)} level. DSA practice attempts will refine this recommendation.`,
      assessmentScore,
      practiceAverage,
      markedSolvedCount,
      attemptedProblemCount,
      activityCount,
      catalogCount: LEETCODE_PROBLEMS.length,
      catalogProgress: Math.round((markedSolvedCount / LEETCODE_PROBLEMS.length) * 100),
      readinessPriorities: Array.isArray(readinessPriorities) ? readinessPriorities : [],
      analyzedQuestionCount: evidenceTopics.reduce((sum, topic) => sum + topic.evidenceCount, 0),
      weakTopicCount: weakTopics.length,
      difficultyProgress,
    },
  };
}

export async function savePreferredDsaLanguage(language) {
  if (!DSA_LANGUAGES.includes(language)) throw new Error("Choose a supported programming language.");
  const profile = await requirePrepStudentProfile();
  await db.prepStudentProfile.update({
    where: { id: profile.id },
    data: { preferredDsaLanguage: language },
  });
  return { saved: true, language };
}

export async function recordDsaActivity(problemSlug, activityType, language) {
  const profile = await requirePrepStudentProfile();
  const problem = problemBySlug.get(problemSlug);
  if (!problem || !validActivities.has(activityType)) {
    throw new Error("Choose a valid LeetCode problem and activity.");
  }
  if (language && !DSA_LANGUAGES.includes(language)) {
    throw new Error("Choose a supported programming language.");
  }

  const now = new Date();
  const source = activityType === "OPENED" ? "NEXORA_LINK" : "STUDENT_CONFIRMED";
  const current = await db.prepDsaProblemProgress.findUnique({
    where: { profileId_problemSlug: { profileId: profile.id, problemSlug } },
  });
  const nextStatus = activityType === "OPENED"
    ? current?.status || "OPENED"
    : activityType;
  const attemptedActivity = ["ATTEMPTED", "FAILED", "REATTEMPT_REQUIRED", "STUDENT_MARKED_SOLVED"].includes(activityType);

  await db.$transaction([
    db.prepDsaProblemProgress.upsert({
      where: { profileId_problemSlug: { profileId: profile.id, problemSlug } },
      create: {
        profileId: profile.id,
        problemSlug,
        title: problem.title,
        url: problem.url,
        topic: problem.topic,
        difficulty: problem.difficulty,
        status: nextStatus,
        source,
        verified: false,
        language: language || profile.preferredDsaLanguage,
        firstOpenedAt: activityType === "OPENED" ? now : null,
        lastActivityAt: now,
        attemptedAt: attemptedActivity ? now : null,
        solvedAt: activityType === "STUDENT_MARKED_SOLVED" ? now : null,
        attemptCount: attemptedActivity ? 1 : 0,
      },
      update: {
        status: nextStatus,
        source: activityType === "OPENED" ? current?.source || source : source,
        verified: false,
        language: language || profile.preferredDsaLanguage,
        firstOpenedAt: activityType === "OPENED" && !current?.firstOpenedAt ? now : undefined,
        lastActivityAt: now,
        attemptedAt: attemptedActivity ? now : undefined,
        solvedAt: activityType === "STUDENT_MARKED_SOLVED" ? now : activityType === "OPENED" ? undefined : null,
        attemptCount: attemptedActivity ? { increment: 1 } : undefined,
      },
    }),
    db.prepDsaActivity.create({
      data: {
        profileId: profile.id,
        problemSlug,
        title: problem.title,
        topic: problem.topic,
        difficulty: problem.difficulty,
        activityType,
        source,
        verified: false,
        language: language || profile.preferredDsaLanguage,
      },
    }),
  ]);
  return { saved: true, verified: false, status: nextStatus };
}
