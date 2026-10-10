"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { PLACEMENT_ASSESSMENT_SECTIONS } from "@/data/placement-assessment";

const assessmentInputSchema = z.object({
  answers: z.record(z.string(), z.string().min(1)),
  adaptiveTrail: z.record(z.string(), z.object({
    difficulty: z.string(),
    isCorrect: z.boolean(),
  })).default({}),
});

const fieldProfiles = {
  builder: {
    field: "Software Product Development",
    roles: ["Frontend Developer", "Full Stack Developer"],
    strengths: ["Product thinking", "User-focused problem solving"],
  },
  analyst: {
    field: "Data & Analytics",
    roles: ["Data Analyst", "Data Engineer"],
    strengths: ["Analytical thinking", "Pattern recognition"],
  },
  systems: {
    field: "Cloud & Systems Engineering",
    roles: ["Backend Developer", "Cloud / DevOps Engineer"],
    strengths: ["Systems thinking", "Reliability mindset"],
  },
  security: {
    field: "Cybersecurity",
    roles: ["Security Analyst", "Application Security Engineer"],
    strengths: ["Risk awareness", "Investigative thinking"],
  },
};

function getJourney(userId) {
  return db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      placementJourney: {
        select: {
          id: true,
          profile: true,
          careerTwin: true,
        },
      },
    },
  });
}

function levelForScore(score) {
  if (score >= 80) return "advanced";
  if (score >= 60) return "intermediate";
  return "foundation";
}

function buildCareerTwin(profile, attempt, sectionScores, suitabilityProfile) {
  const skills = [
    ...(profile.skills ?? []),
    ...(profile.programmingLanguages ?? []),
  ].filter(Boolean);
  const dsaScore = sectionScores.dsa ?? 0;
  const codingScore = sectionScores.coding ?? 0;
  const scoredValues = Object.values(sectionScores);
  const readiness = Math.round(
    scoredValues.reduce((total, score) => total + score, 0) / scoredValues.length
  );
  const skillScores = {
    Aptitude: sectionScores.aptitude ?? 0,
    Technical: sectionScores.technical ?? 0,
    Coding: codingScore,
    DSA: dsaScore,
    Communication: sectionScores.communication ?? 0,
  };
  const strengths = Object.entries(skillScores)
    .filter(([, score]) => score >= 70)
    .map(([skill]) => skill);
  const weaknesses = Object.entries(skillScores)
    .filter(([, score]) => score < 60)
    .map(([skill]) => skill);
  const alternatives = Object.values(fieldProfiles)
    .filter((field) => field.field !== suitabilityProfile.careerField)
    .flatMap((field) => field.roles)
    .slice(0, 3);
  return {
    currentSkills: skills,
    skillScores,
    interests: profile.careerInterests ?? [],
    strengths,
    weaknesses,
    dsaLevel: levelForScore(dsaScore),
    codingLevel: levelForScore(codingScore),
    careerField: suitabilityProfile.careerField,
    recommendedRoles: suitabilityProfile.recommendedRoles,
    alternativeRoles: alternatives,
    evidence: {
      profile: {
        preferredRole: profile.preferredRole ?? null,
        targetCompany: profile.targetCompany ?? null,
        projectCount: Array.isArray(profile.projects) ? profile.projects.length : 0,
      },
      assessment: {
        attemptId: attempt.id,
        sectionScores,
        adaptiveTrail,
        completedAt: attempt.completedAt.toISOString(),
      },
    },
    placementReadiness: readiness,
    lastAssessmentId: attempt.id,
  };
}

export async function getPlacementAssessment() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await getJourney(userId);
  if (!user?.placementJourney?.profile) {
    throw new Error("Complete your placement profile before starting the assessment.");
  }

  const latest = await db.placementAssessmentAttempt.findFirst({
    where: { journeyId: user.placementJourney.id },
    orderBy: { completedAt: "desc" },
  });

  const careerTwin = await db.careerTwin.findUnique({
    where: { journeyId: user.placementJourney.id },
  });

  return { latest, careerTwin };
}

export async function savePlacementAssessment(input) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { answers, adaptiveTrail } = assessmentInputSchema.parse(input);
  const user = await getJourney(userId);
  if (!user?.placementJourney?.profile) {
    throw new Error("Complete your placement profile before starting the assessment.");
  }

  const allQuestions = PLACEMENT_ASSESSMENT_SECTIONS.flatMap((section) =>
    section.questions.map((question) => ({ ...question, sectionId: section.id }))
  );
  const expectedIds = new Set(allQuestions.map((question) => question.id));
  const submittedIds = Object.keys(answers);
  if (submittedIds.length !== expectedIds.size || submittedIds.some((id) => !expectedIds.has(id))) {
    throw new Error("Please answer every assessment question.");
  }

  const sectionScores = {};
  const answerDetails = {};
  for (const section of PLACEMENT_ASSESSMENT_SECTIONS) {
    const questions = section.questions;
    const correct = questions.filter((question) => answers[question.id] === question.answer).length;
    sectionScores[section.id] = Math.round((correct / questions.length) * 100);
    for (const question of questions) {
      answerDetails[question.id] = {
        section: section.id,
        selected: answers[question.id],
        correct: question.answer ?? null,
        isCorrect: question.answer ? answers[question.id] === question.answer : null,
        difficulty: question.difficulty ?? "foundation",
      };
    }
  }

  const scoredSections = PLACEMENT_ASSESSMENT_SECTIONS.filter((section) =>
    section.questions.some((question) => question.answer)
  );
  const overallScore = Math.round(
    scoredSections.reduce((sum, section) => sum + sectionScores[section.id], 0) / scoredSections.length
  );

  const interestValues = PLACEMENT_ASSESSMENT_SECTIONS.find((section) => section.id === "interest")
    .questions.map((question) => answers[question.id]);
  const interestCounts = interestValues.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
  const careerField = Object.entries(interestCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "builder";
  const profile = fieldProfiles[careerField];
  const suitabilityProfile = {
    fieldKey: careerField,
    careerField: profile.field,
    recommendedRoles: profile.roles,
    interestStrengths: profile.strengths,
    assessmentStrengths: scoredSections
      .filter((section) => sectionScores[section.id] >= 70)
      .map((section) => section.title),
    improvementAreas: scoredSections
      .filter((section) => sectionScores[section.id] < 70)
      .map((section) => section.title),
  };

  const attempt = await db.placementAssessmentAttempt.create({
    data: {
      journeyId: user.placementJourney.id,
      overallScore,
      sectionScores,
      interestAnswers: interestValues,
      careerField: profile.field,
      suitabilityProfile,
      assessmentType: "diagnostic",
      adaptiveDifficulty: levelForScore(overallScore),
      evidence: answerDetails,
    },
  });

  const careerTwinData = buildCareerTwin(
    user.placementJourney.profile,
    attempt,
    sectionScores,
    suitabilityProfile
  );
  const previousTwin = user.placementJourney.careerTwin;
  const careerTwin = await db.careerTwin.upsert({
    where: { journeyId: user.placementJourney.id },
    create: { journeyId: user.placementJourney.id, ...careerTwinData },
    update: {
      ...careerTwinData,
      version: { increment: 1 },
    },
  });

  await db.placementJourney.update({
    where: { id: user.placementJourney.id },
    data: { status: "active", currentModule: 5 },
  });

  return { attempt, answerDetails, sectionScores, overallScore, suitabilityProfile, careerTwin, previousTwin };
}
