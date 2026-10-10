"use server";

import { db } from "@/lib/prisma";
import { classifyScore, readinessStatus, ROLE_REQUIREMENTS, roleKey } from "@/data/prep-readiness";
import {
  calculatePlacementScore,
  PLACEMENT_SCORE_FORMULA_VERSION,
  weightedAverageMeasured,
} from "@/lib/prep-score";
import { aggregateReadinessSkills } from "@/lib/prep-evidence";
import { getCurrentPrepStudentProfile, requirePrepStudentProfile } from "@/lib/prep-student-profile";

const skillLabels = {
  aptitude: "Aptitude",
  programming: "Programming",
  dsa: "DSA",
  technical: "Core Technical",
  communication: "Communication",
};

function parse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function score(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

function averageMeasured(values) {
  const measured = values.filter((value) => value !== null);
  return measured.length
    ? Math.round(measured.reduce((total, value) => total + value, 0) / measured.length)
    : null;
}

const readinessInclude = {
  assessments: { orderBy: { completedAt: "desc" }, take: 10 },
  practiceAttempts: { orderBy: { completedAt: "desc" }, take: 100 },
  readiness: true,
  readinessSnapshots: {
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, overallReadiness: true, formulaVersion: true, createdAt: true },
  },
  interviewSessions: {
    where: { status: "COMPLETED", evaluation: { isNot: null } },
    orderBy: { completedAt: "desc" },
    take: 1,
    select: { evaluation: { select: { overallScore: true } } },
  },
};

export async function getReadiness() {
  const profile = await getCurrentPrepStudentProfile(readinessInclude);
  if (!profile?.readiness) return null;
  const readinessData = {
    ...profile.readiness,
    targetCompany: profile.targetCompany,
    preferredRole: profile.preferredRole,
    skillProfile: parse(profile.readiness.skillProfile, {}),
    skillGaps: parse(profile.readiness.skillGaps, []),
    careerSuitability: parse(profile.readiness.careerSuitability, []),
    preparationPriorities: parse(profile.readiness.preparationPriorities, []),
    scoreComponents: parse(profile.readiness.scoreComponents, {}),
    history: profile.readinessSnapshots.map((snapshot) => ({
      score: snapshot.overallReadiness,
      createdAt: snapshot.createdAt,
      formulaVersion: snapshot.formulaVersion,
    })),
  };
  return {
    ...readinessData,
    isStale: profile.readiness.formulaVersion !== PLACEMENT_SCORE_FORMULA_VERSION,
  };
}

export async function generateReadiness() {
  const profile = await requirePrepStudentProfile(readinessInclude);
  const latest = profile.assessments[0];
  if (!latest) throw new Error("Complete the assessment before generating readiness analysis.");

  const sectionScores = parse(latest.sectionScores, {});
  const answerEvidence = parse(latest.answers, {});
  const previous = profile.assessments[1];
  const previousScores = previous ? parse(previous.sectionScores, {}) : {};
  const evidenceProfile = aggregateReadinessSkills({
    assessmentScores: sectionScores,
    assessmentAnswers: answerEvidence,
    previousAssessmentScores: previousScores,
    assessmentId: latest.id,
    practiceAttempts: profile.practiceAttempts,
  });
  const skillProfile = Object.fromEntries(
    Object.entries(evidenceProfile).map(([key, evidence]) => [
      key,
      {
        ...evidence,
        level: evidence.score === null ? "Insufficient evidence" : classifyScore(evidence.score),
      },
    ]),
  );

  const technicalReadiness = averageMeasured([
    skillProfile.programming.score,
    skillProfile.technical.score,
  ]);
  const codingReadiness = weightedAverageMeasured([
    [skillProfile.programming.score, 0.55],
    [skillProfile.dsa.score, 0.45],
  ]);
  const aptitudeReadiness = skillProfile.aptitude.score;
  const communicationScore = skillProfile.communication.score;
  const interviewReadiness = profile.interviewSessions[0]?.evaluation?.overallScore ?? null;
  const resumeReadiness = null;
  const calculated = calculatePlacementScore({
    technical: technicalReadiness,
    coding: codingReadiness,
    aptitude: aptitudeReadiness,
    communication: communicationScore,
    interview: score(interviewReadiness),
    resume: resumeReadiness,
  });
  if (calculated.overallReadiness === null) {
    throw new Error("There is not enough scored evidence to calculate placement readiness.");
  }

  const selectedRole = ROLE_REQUIREMENTS[roleKey(profile.preferredRole)] || ROLE_REQUIREMENTS.default;
  const skillGaps = Object.entries(skillProfile)
    .filter(([, item]) => item.score !== null)
    .map(([key, item]) => {
      const target = selectedRole.requirements[key];
      const gap = Math.max(0, target - item.score);
      return {
        skill: key,
        label: skillLabels[key],
        currentScore: item.score,
        targetScore: target,
        gap,
        priority: gap >= 20 ? "HIGH" : gap >= 8 ? "MEDIUM" : "LOW",
        reason: gap
          ? `${skillLabels[key]} is ${gap} points below the general ${selectedRole.label} benchmark.`
          : `${skillLabels[key]} meets the current general ${selectedRole.label} benchmark.`,
      };
    })
    .sort((first, second) => second.gap - first.gap);
  const preparationPriorities = skillGaps.filter((item) => item.gap > 0).slice(0, 5).map((item) => item.label);
  const careerSuitability = Object.entries(ROLE_REQUIREMENTS).map(([key, role]) => {
    const evidence = Object.entries(role.requirements)
      .filter(([skill]) => skillProfile[skill]?.score !== null)
      .map(([skill, target]) => ({
        skill,
        target,
        match: Math.min(100, (skillProfile[skill].score / target) * 100),
      }));
    const unknownSkills = Object.keys(role.requirements).filter((skill) => skillProfile[skill]?.score === null);
    return {
      role: role.label,
      score: evidence.length
        ? score(evidence.reduce((sum, item) => sum + item.match, 0) / evidence.length)
        : null,
      evidenceCoverage: Math.round((evidence.length / Object.keys(role.requirements).length) * 100),
      matchingSkills: evidence.filter((item) => skillProfile[item.skill].score >= item.target).map((item) => skillLabels[item.skill]),
      missingSkills: evidence.filter((item) => skillProfile[item.skill].score < item.target).map((item) => skillLabels[item.skill]),
      unknownSkills: unknownSkills.map((skill) => skillLabels[skill]),
      benchmarkType: "GENERAL_ROLE_BENCHMARK",
    };
  }).sort((first, second) => (second.score ?? -1) - (first.score ?? -1));

  const data = {
    overallReadiness: calculated.overallReadiness,
    technicalReadiness,
    codingReadiness,
    aptitudeReadiness,
    communicationScore,
    interviewReadiness: score(interviewReadiness),
    resumeReadiness,
    evidenceCoverage: calculated.evidenceCoverage,
    status: readinessStatus(calculated.overallReadiness),
    skillProfile,
    skillGaps,
    careerSuitability,
    preparationPriorities,
    scoreComponents: calculated.scoreComponents,
    formulaVersion: PLACEMENT_SCORE_FORMULA_VERSION,
    sourceAttemptId: latest.id,
  };

  const serialized = {
    ...data,
    skillProfile: JSON.stringify(skillProfile),
    skillGaps: JSON.stringify(skillGaps),
    careerSuitability: JSON.stringify(careerSuitability),
    preparationPriorities: JSON.stringify(preparationPriorities),
    scoreComponents: JSON.stringify(calculated.scoreComponents),
  };

  await db.$transaction(async (transaction) => {
    await transaction.prepPlacementReadiness.upsert({
      where: { profileId: profile.id },
      create: { profileId: profile.id, ...serialized },
      update: serialized,
    });
    await transaction.prepPlacementReadinessSnapshot.create({
      data: {
        profileId: profile.id,
        overallReadiness: calculated.overallReadiness,
        formulaVersion: PLACEMENT_SCORE_FORMULA_VERSION,
        sourceAttemptId: latest.id,
        componentScores: JSON.stringify(calculated.scoreComponents),
        analysisData: JSON.stringify(data),
      },
    });
  });

  return data;
}
