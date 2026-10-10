"use server";

import { db } from "@/lib/prisma";
import { PRACTICE_QUESTIONS } from "@/data/prep-practice";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

async function currentProfile() {
  const profile = await requirePrepStudentProfile({
      assessments: { take: 1 },
      readiness: true,
      preparationPlans: {
        orderBy: [{ createdAt: "desc" }, { weekNumber: "desc" }],
        take: 12,
        include: { tasks: true },
      },
  });
  const latestPlan = profile.preparationPlans[0];
  const sequencePlans = latestPlan?.sequenceId
    ? profile.preparationPlans.filter((plan) => plan.sequenceId === latestPlan.sequenceId)
    : latestPlan ? [latestPlan] : [];
  const allWeeksCompleted = Boolean(
    latestPlan &&
    sequencePlans.length >= latestPlan.totalWeeks &&
    sequencePlans.every((plan) => plan.tasks.length > 0 && plan.tasks.every((task) => task.status === "COMPLETED"))
  );
  const modulesComplete = Boolean(
    profile.fullName &&
    profile.email &&
    profile.assessments.length &&
    profile.readiness &&
    allWeeksCompleted
  );
  if (!modulesComplete) {
    throw new Error("Complete your profile, assessment analysis, and preparation plan before accessing the Practice Center.");
  }
  return profile;
}

export async function getPracticeAccess() {
  try {
    await currentProfile();
    return { allowed: true, reason: "" };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Complete your profile, assessment analysis, and preparation plan first.",
    };
  }
}

export async function getPracticeData() {
  const profile = await currentProfile();
  const attempts = await db.prepPracticeAttempt.findMany({ where: { profileId: profile.id }, orderBy: { completedAt: "desc" }, take: 20 });
  const weakTopics = [...new Set(attempts.filter((attempt) => attempt.score < 60).map((attempt) => attempt.topic))].slice(0, 5);
  const usedQuestionIds = [...new Set(attempts.flatMap((attempt) => {
    try { return JSON.parse(attempt.questionIds || "[]"); } catch { return Object.keys(JSON.parse(attempt.answers || "{}")); }
  }))];
  const normalizedAttempts = attempts.map((attempt) => {
    let mistakes = [];
    try { mistakes = JSON.parse(attempt.mistakes || "[]"); } catch { /* Preserve the attempt even if old data is malformed. */ }
    return { ...attempt, mistakes };
  });
  const latestQuestionState = new Map();
  normalizedAttempts.forEach((attempt) => {
    let questionIds = [];
    try { questionIds = JSON.parse(attempt.questionIds || "[]"); } catch { questionIds = Object.keys(JSON.parse(attempt.answers || "{}")); }
    const mistakeIds = new Set(attempt.mistakes.map((mistake) => mistake.questionId));
    questionIds.forEach((questionId) => {
      if (!latestQuestionState.has(questionId)) latestQuestionState.set(questionId, mistakeIds.has(questionId));
    });
  });
  return { attempts: normalizedAttempts, weakTopics, usedQuestionIds, mistakeQuestionIds: [...latestQuestionState].filter(([, due]) => due).map(([questionId]) => questionId) };
}

export async function savePracticeAttempt({ subject, topic, difficulty, mode, answers, durationSeconds, questionIds }) {
  const profile = await currentProfile();
  const requestedIds = Array.isArray(questionIds) ? questionIds : [];
  const questionSet = PRACTICE_QUESTIONS.filter((question) => requestedIds.includes(question.id));
  if (!questionSet.length) throw new Error("No practice questions are configured for this subject yet.");
  const submitted = answers || {};
  const mistakes = questionSet.filter((question) => submitted[question.id] !== question.answer).map((question) => ({ questionId: question.id, topic: question.topic, prompt: question.prompt, correct: question.answer, selected: submitted[question.id] || null, explanation: `This tests ${question.topic}. Review the underlying concept, then retry the question without memorizing the option.` }));
  const score = Math.round(((questionSet.length - mistakes.length) / questionSet.length) * 100);
  return db.prepPracticeAttempt.create({ data: { profileId: profile.id, subject: subject || "mixed", topic: topic || "mixed", mode: mode || "PRACTICE", difficulty: difficulty || "mixed", score, totalQuestions: questionSet.length, durationSeconds: Number(durationSeconds) || 0, questionIds: JSON.stringify(questionSet.map((question) => question.id)), answers: JSON.stringify(submitted), mistakes: JSON.stringify(mistakes) } });
}
