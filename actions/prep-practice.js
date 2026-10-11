"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { PRACTICE_QUESTIONS, PRACTICE_SUBJECTS } from "@/data/prep-practice";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";
import { claimQuestionSet, createGeneratedQuestionSet, getOwnedQuestionSet } from "@/lib/prep-question-generation";

const practiceAttemptSchema = z.object({
  subject: z.string().max(40),
  topic: z.string().max(120),
  difficulty: z.enum(["all", "easy", "medium", "hard"]),
  mode: z.enum(["PRACTICE", "TIMED", "COMPANY_PATTERN", "MISTAKE_REVIEW"]),
  answers: z.record(z.string(), z.string()),
  durationSeconds: z.number().int().min(0).max(8 * 60 * 60),
  questionSetId: z.string().min(1).max(100),
});
const questionSetSchema = z.object({
  subject: z.string().max(40),
  topic: z.string().max(120),
  difficulty: z.enum(["all", "easy", "medium", "hard"]),
  questionCount: z.number().int().refine((count) => [10, 15, 20, 25, 30].includes(count)),
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

export async function createPracticeQuestionSet(input) {
  const profile = await currentProfile();
  const parsed = questionSetSchema.safeParse(input);
  if (!parsed.success) throw new Error("Practice question-set details are invalid.");
  const { subject, topic, difficulty, questionCount } = parsed.data;
  const allowedSubjects = new Set(["mixed", "mistakes", ...PRACTICE_SUBJECTS.map((item) => item.id)]);
  if (!allowedSubjects.has(subject)) throw new Error("Choose a valid practice subject.");
  if (subject === "mistakes" && !topic) throw new Error("Choose a mistake topic to generate remedial practice.");
  const selectedSubject = PRACTICE_SUBJECTS.find((item) => item.id === subject);
  if (selectedSubject && topic && !selectedSubject.topics.includes(topic)) {
    throw new Error("Choose a valid topic for this practice subject.");
  }

  let allowedTopics;
  let allowedPracticeSubjects;
  if (subject === "mistakes") {
    const attempts = await db.prepPracticeAttempt.findMany({
      where: { profileId: profile.id },
      orderBy: { completedAt: "desc" },
      select: { mistakes: true },
    });
    const priorMistakes = attempts.flatMap((attempt) => {
      try {
        const mistakes = JSON.parse(attempt.mistakes || "[]");
        return Array.isArray(mistakes) ? mistakes : [];
      } catch {
        throw new Error("Saved mistake history is invalid. Please contact support.");
      }
    });
    allowedTopics = [...new Set(priorMistakes.map((mistake) => mistake.topic).filter(Boolean))];
    if (!allowedTopics.includes(topic)) throw new Error("That topic is not in your saved Mistake Bank.");
    allowedPracticeSubjects = [...new Set(priorMistakes
      .filter((mistake) => mistake.topic === topic)
      .map((mistake) => mistake.subject || PRACTICE_QUESTIONS.find((question) => question.id === mistake.questionId)?.subject)
      .filter((id) => PRACTICE_SUBJECTS.some((item) => item.id === id)))];
  } else if (selectedSubject) {
    allowedPracticeSubjects = [selectedSubject.id];
    allowedTopics = topic ? [topic] : selectedSubject.topics;
  } else {
    allowedPracticeSubjects = PRACTICE_SUBJECTS.map((item) => item.id);
    allowedTopics = PRACTICE_SUBJECTS.flatMap((item) => item.topics);
  }
  if (!allowedPracticeSubjects.length) throw new Error("No saved mistakes are available for that topic.");

  return createGeneratedQuestionSet({
    profileId: profile.id,
    ownerId: profile.clerkUserId,
    purpose: "practice",
    questionCount,
    sections: [{
      id: "practice",
      count: questionCount,
      subject: allowedPracticeSubjects[0],
      allowedSubjects: allowedPracticeSubjects,
      allowedTopics,
      ...(difficulty !== "all" ? { allowedDifficulties: [difficulty] } : {}),
      ...(topic ? { topic } : {}),
    }],
    instructions: `Create ${questionCount} questions for ${subject === "mixed" ? "a mixed placement practice set" : subject === "mistakes" ? `remedial practice based on past mistakes about ${topic}` : `${selectedSubject.label}${topic ? `, specifically ${topic}` : ""}`}. Difficulty selection: ${difficulty}. ${difficulty === "all" ? "Mix easy, medium, and hard questions." : `Every question must be ${difficulty}.`} Use only the allowed subject and topic values from the section definition.`,
  });
}

export async function savePracticeAttempt({ subject, topic, difficulty, mode, answers, durationSeconds, questionSetId }) {
  const profile = await currentProfile();
  const parsed = practiceAttemptSchema.safeParse({ subject, topic, difficulty, mode, answers, durationSeconds, questionSetId });
  if (!parsed.success) throw new Error("Practice attempt details are invalid.");
  const input = parsed.data;
  const allowedSubjects = new Set(["mixed", "mistakes", ...PRACTICE_SUBJECTS.map((item) => item.id)]);
  if (!allowedSubjects.has(input.subject)) throw new Error("Choose a valid practice subject.");
  if ((input.subject === "mistakes") !== (input.mode === "MISTAKE_REVIEW")) {
    throw new Error("Mistake review mode must use the Mistake Bank, and the Mistake Bank requires mistake review mode.");
  }
  const questionSet = await getOwnedQuestionSet({ ownerId: profile.clerkUserId, questionSetId: input.questionSetId, purpose: "practice" });
  const questions = questionSet.questions;
  if (questions.length < 1 || questions.length > 30) throw new Error("The generated practice question count is invalid.");
  if (questions.some((question) =>
    (input.subject !== "mixed" && input.subject !== "mistakes" && question.subject !== input.subject) ||
    (input.difficulty !== "all" && question.difficulty !== input.difficulty) ||
    (input.topic && question.topic !== input.topic)
  )) {
    throw new Error("The generated questions do not match the requested subject, topic, or difficulty.");
  }
  const submitted = input.answers;
  if (Object.keys(submitted).length !== questions.length ||
      questions.some((question) => !Object.hasOwn(submitted, question.id) || !question.options.some(([value]) => value === submitted[question.id]))) {
    throw new Error("Answer every generated question using one of its available options before submitting.");
  }
  const mistakes = questions.filter((question) => submitted[question.id] !== question.answer).map((question) => ({ questionId: question.id, subject: question.subject, topic: question.topic, prompt: question.prompt, correct: question.answer, selected: submitted[question.id] || null, explanation: `This tests ${question.topic}. Review the underlying concept, then try a new question on the topic.` }));
  const score = Math.round(((questions.length - mistakes.length) / questions.length) * 100);
  return db.$transaction(async (transaction) => {
    await claimQuestionSet({ transaction, ownerId: profile.clerkUserId, questionSetId: input.questionSetId, purpose: "practice" });
    return transaction.prepPracticeAttempt.create({ data: { profileId: profile.id, subject: input.subject, topic: input.topic || "mixed", mode: input.mode, difficulty: input.difficulty, score, totalQuestions: questions.length, durationSeconds: input.durationSeconds, questionIds: JSON.stringify(questions.map((question) => question.id)), questionData: JSON.stringify(questions), answers: JSON.stringify(submitted), mistakes: JSON.stringify(mistakes) } });
  });
}
