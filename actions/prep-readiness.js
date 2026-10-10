"use server";

import { db } from "@/lib/prisma";
import { classifyScore, readinessStatus, ROLE_REQUIREMENTS, roleKey } from "@/data/prep-readiness";
import { getCurrentPrepStudentProfile, requirePrepStudentProfile } from "@/lib/prep-student-profile";

const skillLabels = {
  aptitude: "Aptitude",
  programming: "Programming",
  dsa: "DSA",
  technical: "Core Technical",
  communication: "Communication",
};

function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function score(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export async function getReadiness() {
  const profile = await getCurrentPrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 10 },
    readiness: true,
  });
  if (!profile?.readiness) return null;
  return {
    ...profile.readiness,
    targetCompany: profile.targetCompany,
    preferredRole: profile.preferredRole,
    skillProfile: parse(profile.readiness.skillProfile, {}),
    skillGaps: parse(profile.readiness.skillGaps, []),
    careerSuitability: parse(profile.readiness.careerSuitability, []),
    preparationPriorities: parse(profile.readiness.preparationPriorities, []),
    history: profile.assessments.map((attempt) => ({ score: attempt.overallScore, completedAt: attempt.completedAt })),
  };
}

export async function generateReadiness() {
  const profile = await requirePrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 10 },
    readiness: true,
  });
  if (!profile) throw new Error("Complete your profile before generating readiness analysis.");
  const latest = profile.assessments[0];
  if (!latest) throw new Error("Complete the assessment before generating readiness analysis.");
  const sectionScores = parse(latest.sectionScores, {});
  const previous = profile.assessments[1];
  const previousScores = previous ? parse(previous.sectionScores, {}) : {};
  const keys = Object.keys(skillLabels);
  const skillProfile = {};
  for (const key of keys) {
    const current = score(sectionScores[key]);
    const delta = previous && Number.isFinite(previousScores[key]) ? current - score(previousScores[key]) : 0;
    skillProfile[key] = { score: current, level: classifyScore(current), trend: delta > 2 ? "Improving" : delta < -2 ? "Declining" : "Stable", delta };
  }
  const technicalReadiness = score((skillProfile.programming.score + skillProfile.technical.score) / 2);
  const codingReadiness = score((skillProfile.programming.score * 0.55) + (skillProfile.dsa.score * 0.45));
  const aptitudeReadiness = skillProfile.aptitude.score;
  const communicationScore = skillProfile.communication.score;
  const interviewReadiness = score((communicationScore * 0.55) + (technicalReadiness * 0.45));
  const resumeReadiness = score(profile.skills && profile.preferredRole ? 70 : 40);
  const overallReadiness = score((technicalReadiness * 0.25) + (codingReadiness * 0.25) + (aptitudeReadiness * 0.15) + (communicationScore * 0.15) + (interviewReadiness * 0.1) + (resumeReadiness * 0.1));
  const selectedRole = ROLE_REQUIREMENTS[roleKey(profile.preferredRole)] || ROLE_REQUIREMENTS.default;
  const skillGaps = keys.map((key) => {
    const current = skillProfile[key].score;
    const target = selectedRole.requirements[key];
    const gap = Math.max(0, target - current);
    return { skill: key, label: skillLabels[key], currentScore: current, targetScore: target, gap, priority: gap >= 20 ? "HIGH" : gap >= 8 ? "MEDIUM" : "LOW", reason: gap ? `${skillLabels[key]} is ${gap} points below the ${selectedRole.label} target.` : `${skillLabels[key]} meets the current ${selectedRole.label} target.` };
  }).sort((a, b) => b.gap - a.gap);
  const preparationPriorities = skillGaps.filter((item) => item.gap > 0).slice(0, 5).map((item) => item.label);
  const careerSuitability = Object.entries(ROLE_REQUIREMENTS).map(([key, role]) => {
    const values = Object.entries(role.requirements).map(([skill, target]) => Math.min(100, (skillProfile[skill].score / target) * 100));
    const interestBonus = key === "default" ? 0 : 0;
    return { role: role.label, score: score(values.reduce((sum, value) => sum + value, 0) / values.length + interestBonus), matchingSkills: keys.filter((skill) => skillProfile[skill].score >= role.requirements[skill]).map((skill) => skillLabels[skill]), missingSkills: keys.filter((skill) => skillProfile[skill].score < role.requirements[skill]).map((skill) => skillLabels[skill]) };
  }).sort((a, b) => b.score - a.score);
  const data = { overallReadiness, technicalReadiness, codingReadiness, aptitudeReadiness, communicationScore, interviewReadiness, resumeReadiness, status: readinessStatus(overallReadiness), skillProfile, skillGaps, careerSuitability, preparationPriorities, sourceAttemptId: latest.id };
  await db.prepPlacementReadiness.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, ...data, skillProfile: JSON.stringify(skillProfile), skillGaps: JSON.stringify(skillGaps), careerSuitability: JSON.stringify(careerSuitability), preparationPriorities: JSON.stringify(preparationPriorities) }, update: { ...data, skillProfile: JSON.stringify(skillProfile), skillGaps: JSON.stringify(skillGaps), careerSuitability: JSON.stringify(careerSuitability), preparationPriorities: JSON.stringify(preparationPriorities) } });
  return data;
}
