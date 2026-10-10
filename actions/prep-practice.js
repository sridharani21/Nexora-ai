"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { PRACTICE_QUESTIONS, PRACTICE_SUBJECTS } from "@/data/prep-practice";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

const practiceAttemptSchema = z.object({
  subject: z.string().max(40),
  topic: z.string().max(120),
  difficulty: z.enum(["all", "easy", "medium", "hard"]),
  mode: z.enum(["PRACTICE", "TIMED", "COMPANY_PATTERN", "MISTAKE_REVIEW"]),
  answers: z.record(z.string(), z.string()),
  durationSeconds: z.number().int().min(0).max(8 * 60 * 60),
  questionIds: z.array(z.string().min(1).max(100)).min(1).max(30),
});

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
  const parsed = practiceAttemptSchema.safeParse({ subject, topic, difficulty, mode, answers, durationSeconds, questionIds });
  if (!parsed.success) throw new Error("Practice attempt details are invalid.");
  const input = parsed.data;
  const allowedSubjects = new Set(["mixed", "mistakes", ...PRACTICE_SUBJECTS.map((item) => item.id)]);
  if (!allowedSubjects.has(input.subject)) throw new Error("Choose a valid practice subject.");
  if ((input.subject === "mistakes") !== (input.mode === "MISTAKE_REVIEW")) {
    throw new Error("Mistake review mode must use the Mistake Bank, and the Mistake Bank requires mistake review mode.");
  }
  if (new Set(input.questionIds).size !== input.questionIds.length) {
    throw new Error("A practice attempt cannot contain duplicate questions.");
  }
  const questionsById = new Map(PRACTICE_QUESTIONS.map((question) => [question.id, question]));
  const questionSet = input.questionIds.map((id) => questionsById.get(id));
  if (questionSet.some((question) => !question)) {
    throw new Error("One or more selected questions are not in the approved question bank.");
  }
  const matchesSubject = (question) => input.subject === "mixed" || input.subject === "mistakes" || question.subject === input.subject;
  if (questionSet.some((question) =>
    !matchesSubject(question) ||
    (input.difficulty !== "all" && question.difficulty !== input.difficulty) ||
    (input.topic && question.topic !== input.topic)
  )) {
    throw new Error("The selected questions do not match the requested subject, topic, or difficulty.");
  }
  if (!questionSet.length) throw new Error("No practice questions are configured for this subject yet.");
  const submitted = input.answers;
  if (Object.keys(submitted).length !== questionSet.length ||
      questionSet.some((question) => !question.options.some(([value]) => value === submitted[question.id]))) {
    throw new Error("Answer every selected question using one of its available options before submitting.");
  }
  const mistakes = questionSet.filter((question) => submitted[question.id] !== question.answer).map((question) => ({ questionId: question.id, topic: question.topic, prompt: question.prompt, correct: question.answer, selected: submitted[question.id] || null, explanation: `This tests ${question.topic}. Review the underlying concept, then retry the question without memorizing the option.` }));
  const score = Math.round(((questionSet.length - mistakes.length) / questionSet.length) * 100);
  return db.prepPracticeAttempt.create({ data: { profileId: profile.id, subject: input.subject, topic: input.topic || "mixed", mode: input.mode, difficulty: input.difficulty, score, totalQuestions: questionSet.length, durationSeconds: input.durationSeconds, questionIds: JSON.stringify(questionSet.map((question) => question.id)), answers: JSON.stringify(submitted), mistakes: JSON.stringify(mistakes) } });
}
