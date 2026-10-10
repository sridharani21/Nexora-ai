"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { ASSESSMENT_SECTIONS } from "@/data/prep-assessment";
import { getAssessmentAccess } from "@/actions/prep-integrity";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

const INTEGRITY_EVENT_TYPES = [
  "tab-hidden",
  "window-blur",
  "copy-blocked",
  "paste-blocked",
  "context-menu-blocked",
  "fullscreen-exited",
];
const assessmentSubmissionSchema = z.object({
  answers: z.record(z.string(), z.string()),
  integrityEvents: z.array(z.object({
    type: z.enum(INTEGRITY_EVENT_TYPES),
    at: z.string().max(40).optional(),
  })).max(100).default([]),
  mediaEvents: z.array(z.object({
    type: z.enum([
      "camera-track-muted",
      "camera-track-unmuted",
      "camera-track-ended",
      "microphone-track-muted",
      "microphone-track-unmuted",
      "microphone-track-ended",
    ]),
    at: z.string().max(40).optional(),
  })).max(100).default([]),
});
const QUESTION_BANK_VERSION = "diagnostic-v1";

const fields = {
  builder: { name: "Software Development", roles: ["Frontend Developer", "Full Stack Developer"] },
  analyst: { name: "Data and Analytics", roles: ["Data Analyst", "Data Engineer"] },
  systems: { name: "Cloud and Systems", roles: ["Backend Developer", "Cloud / DevOps Engineer"] },
  security: { name: "Cybersecurity", roles: ["Security Analyst", "Application Security Engineer"] },
};

export async function saveAssessment({ answers, integrityEvents = [], mediaEvents = [] }) {
  const access = await getAssessmentAccess();
  if (!access.allowed) throw new Error(`Assessment locked until ${new Date(access.lockedUntil).toLocaleTimeString()}.`);
  const profile = await requirePrepStudentProfile();
  const parsed = assessmentSubmissionSchema.safeParse({ answers, integrityEvents, mediaEvents });
  if (!parsed.success) throw new Error("Assessment answers or integrity-event data are invalid.");
  const submitted = parsed.data.answers;
  const allQuestions = ASSESSMENT_SECTIONS.flatMap((section) => section.questions);
  const questionIds = new Set(allQuestions.map((question) => question.id));
  const submittedIds = Object.keys(submitted);
  if (submittedIds.length !== questionIds.size || submittedIds.some((id) => !questionIds.has(id))) {
    throw new Error("Complete every assessment question before submitting your result.");
  }
  for (const question of allQuestions) {
    if (!question.options.some(([value]) => value === submitted[question.id])) {
      throw new Error("One or more submitted answers are not valid for this assessment.");
    }
  }
  const sectionScores = {};
  const details = {};
  for (const section of ASSESSMENT_SECTIONS) {
    const scored = section.questions.filter((question) => question.answer);
    const correct = scored.filter((question) => submitted[question.id] === question.answer).length;
    sectionScores[section.id] = scored.length ? Math.round((correct / scored.length) * 100) : null;
    section.questions.forEach((question) => {
      details[question.id] = { section: section.id, topic: question.topic || null, difficulty: question.difficulty || "easy", selected: submitted[question.id] || null, correct: question.answer || null, isCorrect: question.answer ? submitted[question.id] === question.answer : null };
    });
  }
  const interestCounts = ASSESSMENT_SECTIONS.find((section) => section.id === "interest").questions.reduce((counts, question) => {
    const value = submitted[question.id];
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
  const fieldKey = Object.entries(interestCounts).sort(([, first], [, second]) => second - first)[0]?.[0] || "builder";
  const career = fields[fieldKey];
  const scoredValues = Object.values(sectionScores).filter((score) => score !== null);
  const overallScore = Math.round(scoredValues.reduce((sum, score) => sum + score, 0) / scoredValues.length);
  const strengths = Object.entries(sectionScores).filter(([, score]) => score >= 70).map(([section]) => section);
  const weaknesses = Object.entries(sectionScores).filter(([, score]) => score < 60).map(([section]) => section);
  const skillProfile = { aptitude: sectionScores.aptitude, programming: sectionScores.programming, dsa: sectionScores.dsa, technical: sectionScores.technical, communication: sectionScores.communication };
  const careerProfile = { fieldKey, careerField: career.name, recommendedRoles: career.roles, suitability: Math.min(99, Math.max(40, overallScore + (interestCounts[fieldKey] || 0) * 4)), why: [`Interest alignment with ${career.name}`, `${strengths.length} strong assessment areas`, "This recommendation is based on the current attempt and should be updated as more evidence is collected."] };
  const difficultyMix = Object.values(details).reduce((counts, item) => {
    counts[item.difficulty] = (counts[item.difficulty] || 0) + 1;
    return counts;
  }, {});
  const savedIntegrityEvents = [
    ...parsed.data.integrityEvents,
    ...parsed.data.mediaEvents.map(({ type, at }) => ({ type, at: at || null })),
  ];
  const integrityScore = Math.max(0, 100 - parsed.data.integrityEvents.length * 15);
  const attempt = await db.prepAssessmentAttempt.create({ data: { profileId: profile.id, overallScore, sectionScores: JSON.stringify(sectionScores), skillProfile: JSON.stringify(skillProfile), strengths: JSON.stringify(strengths), weaknesses: JSON.stringify(weaknesses), careerProfile: JSON.stringify(careerProfile), answers: JSON.stringify(details), difficultyMix: JSON.stringify(difficultyMix), integrityEvents: JSON.stringify(savedIntegrityEvents), integrityScore, reviewRequired: savedIntegrityEvents.length > 0, questionBankVersion: QUESTION_BANK_VERSION } });
  return { attempt, sectionScores, skillProfile, strengths, weaknesses, careerProfile, overallScore };
}
