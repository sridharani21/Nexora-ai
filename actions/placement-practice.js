"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getPracticeQuestions, PLACEMENT_PRACTICE_TOPICS } from "@/data/placement-practice";

const practiceSchema = z.object({
  topic: z.string().min(1),
  category: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  mode: z.enum(["practice", "company-pattern"]).default("practice"),
  companyPattern: z.string().max(100).optional(),
  timed: z.boolean().default(false),
  difficulty: z.enum(["adaptive", "foundation", "intermediate", "advanced"]).default("adaptive"),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
});

const TOPIC_TO_TWIN_SKILL = {
  aptitude: "Aptitude",
  "logical-reasoning": "Aptitude",
  "verbal-ability": "Communication",
  coding: "Coding",
  dsa: "DSA",
  sql: "SQL",
  oop: "Technical",
  dbms: "Technical",
  os: "Technical",
  "computer-networks": "Technical",
  "core-technical": "Technical",
  "role-specific": "Coding",
};

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function levelForScore(score) {
  if (score >= 80) return "advanced";
  if (score >= 60) return "intermediate";
  return "foundation";
}

export async function getPracticeCenter() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      placementJourney: {
        select: {
          id: true,
          profile: { select: { preferredRole: true, targetCompany: true } },
          careerTwin: true,
          practiceAttempts: {
            orderBy: { completedAt: "desc" },
            take: 12,
          },
        },
      },
    },
  });
  if (!user?.placementJourney?.profile) {
    throw new Error("Complete your placement profile before practising.");
  }
  return {
    topics: PLACEMENT_PRACTICE_TOPICS,
    attempts: user.placementJourney.practiceAttempts,
    profile: user.placementJourney.profile,
  };
}

export async function savePracticeAttempt(input) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const values = practiceSchema.parse(input);
  const topic = PLACEMENT_PRACTICE_TOPICS.find((item) => item.id === values.topic);
  if (!topic || topic.category !== values.category) throw new Error("Choose a valid practice topic.");

  const questions = getPracticeQuestions(values.topic);
  const expectedIds = new Set(questions.map((question) => question.id));
  const submittedIds = Object.keys(values.answers);
  if (submittedIds.length !== questions.length || submittedIds.some((id) => !expectedIds.has(id))) {
    throw new Error("Answer every question before submitting.");
  }

  const mistakes = questions
    .filter((question) => values.answers[question.id] !== question.answer)
    .map((question) => ({
      questionId: question.id,
      topic: question.topic,
      selected: values.answers[question.id],
      correct: question.answer,
      prompt: question.prompt,
    }));
  const correctCount = questions.length - mistakes.length;
  const score = Math.round((correctCount / questions.length) * 100);
  const weakTopics = mistakes.length ? [topic.label] : [];

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      placementJourney: {
        select: { id: true, currentModule: true, careerTwin: true },
      },
    },
  });
  if (!user?.placementJourney) throw new Error("Placement journey not found.");

  const attempt = await db.practiceAttempt.create({
    data: {
      journeyId: user.placementJourney.id,
      category: values.category,
      topic: values.topic,
      mode: values.mode,
      companyPattern: values.companyPattern || null,
      timed: values.timed,
      difficulty: values.difficulty,
      questionCount: questions.length,
      correctCount,
      score,
      durationSeconds: values.durationSeconds ?? null,
      answers: values.answers,
      mistakes,
      weakTopics,
    },
  });

  const previousTwin = user.placementJourney.careerTwin;
  const previousScores = asObject(previousTwin?.skillScores);
  const twinSkill = TOPIC_TO_TWIN_SKILL[values.topic] ?? "Technical";
  const priorScore = Number(previousScores[twinSkill] ?? score);
  const updatedScore = Math.round(priorScore * 0.6 + score * 0.4);
  const skillScores = { ...previousScores, [twinSkill]: updatedScore };
  const recentAttempts = await db.practiceAttempt.findMany({
    where: { journeyId: user.placementJourney.id, topic: values.topic },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: { score: true, mistakes: true, completedAt: true },
  });
  const repeatedMistakes = recentAttempts
    .flatMap((item) => Array.isArray(item.mistakes) ? item.mistakes : [])
    .reduce((counts, mistake) => {
      const key = mistake.questionId || mistake.prompt;
      if (key) counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  const recurringMistakes = Object.entries(repeatedMistakes)
    .filter(([, count]) => count >= 2)
    .map(([questionId, count]) => ({ questionId, attempts: count }));
  const existingWeaknesses = Array.isArray(previousTwin?.weaknesses)
    ? previousTwin.weaknesses
    : [];
  const weaknesses = updatedScore < 60
    ? [...new Set([...existingWeaknesses, topic.label])]
    : existingWeaknesses.filter((item) => item !== topic.label);
  const strengths = updatedScore >= 70
    ? [...new Set([...(Array.isArray(previousTwin?.strengths) ? previousTwin.strengths : []), twinSkill])]
    : (previousTwin?.strengths ?? []);
  const weaknessReport = {
    topic: topic.label,
    score,
    trend: recentAttempts.length > 1 ? recentAttempts[0].score - recentAttempts[1].score : 0,
    recurringMistakes,
    remedialRequired: updatedScore < 60 || recurringMistakes.length > 0,
    analyzedAt: new Date().toISOString(),
  };
  const twinData = {
    currentSkills: previousTwin?.currentSkills ?? [],
    skillScores,
    interests: previousTwin?.interests ?? [],
    strengths,
    weaknesses,
    dsaLevel: levelForScore(skillScores.DSA ?? 0),
    codingLevel: levelForScore(skillScores.Coding ?? 0),
    careerField: previousTwin?.careerField ?? null,
    recommendedRoles: previousTwin?.recommendedRoles ?? [],
    alternativeRoles: previousTwin?.alternativeRoles ?? [],
    evidence: {
      ...asObject(previousTwin?.evidence),
      latestPractice: weaknessReport,
    },
    placementReadiness: Math.round(
      Object.values(skillScores).reduce((sum, value) => sum + Number(value || 0), 0) /
      Math.max(1, Object.values(skillScores).length)
    ),
    lastAssessmentId: previousTwin?.lastAssessmentId ?? null,
  };
  const careerTwin = previousTwin
    ? await db.careerTwin.update({
      where: { journeyId: user.placementJourney.id },
      data: { ...twinData, version: { increment: 1 } },
    })
    : null;
  await db.placementJourney.update({
    where: { id: user.placementJourney.id },
    data: { status: "active", currentModule: Math.max(user.placementJourney.currentModule, 5) },
  });
  return {
    attempt,
    mistakes,
    score,
    correctCount,
    questionCount: questions.length,
    weaknessReport,
    careerTwin,
  };
}
