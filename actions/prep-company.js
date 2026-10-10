"use server";

import { db } from "@/lib/prisma";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";
import { COMPANY_ROLE_PROFILES, COMPANY_PRIORITIES, findCompanyRole, getGapPriority } from "@/data/prep-company";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function mean(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function getStudentEvidence(profile) {
  const latestAssessment = profile.assessments[0];
  const sectionScores = parseJson(latestAssessment?.sectionScores);
  const practice = new Map();
  for (const attempt of profile.practiceAttempts) {
    const values = practice.get(attempt.subject) || [];
    values.push(attempt.score);
    practice.set(attempt.subject, values);
  }

  const practiceAverage = (subjects) => mean(
    subjects.flatMap((subject) => practice.get(subject) || []),
  );
  const assessmentScore = (key) => (
    typeof sectionScores[key] === "number" && Number.isFinite(sectionScores[key])
      ? sectionScores[key]
      : null
  );
  const evidence = {};

  for (const role of COMPANY_ROLE_PROFILES) {
    for (const requirement of role.requirements) {
      if (evidence[requirement.skill]) continue;
      let assessment = null;
      let practiceScore = null;
      let practiceCount = 0;
      if (requirement.skill === "dsa") {
        assessment = assessmentScore("dsa");
        practiceScore = practiceAverage(["dsa"]);
        practiceCount = practice.get("dsa")?.length || 0;
      } else if (requirement.skill === "programming") {
        assessment = assessmentScore("programming");
        practiceScore = practiceAverage(["coding"]);
        practiceCount = practice.get("coding")?.length || 0;
      } else if (requirement.skill === "technical") {
        assessment = assessmentScore("technical");
        practiceScore = practiceAverage(["core", "sql", "oop", "dbms", "os", "networks"]);
        practiceCount = ["core", "sql", "oop", "dbms", "os", "networks"]
          .reduce((sum, subject) => sum + (practice.get(subject)?.length || 0), 0);
      } else if (requirement.skill === "aptitude") {
        assessment = assessmentScore("aptitude");
        practiceScore = practiceAverage(["aptitude", "reasoning"]);
        practiceCount = ["aptitude", "reasoning"]
          .reduce((sum, subject) => sum + (practice.get(subject)?.length || 0), 0);
      } else if (requirement.skill === "communication") {
        assessment = assessmentScore("communication");
      }

      const sources = [assessment, practiceScore].filter((score) => score !== null);
      evidence[requirement.skill] = {
        score: mean(sources),
        assessmentScore: assessment,
        practiceScore,
        sourceLabels: [
          assessment !== null ? "assessment" : null,
          practiceScore !== null ? "practice" : null,
        ].filter(Boolean),
        evidenceCount: (assessment !== null ? 1 : 0) + practiceCount,
      };
    }
  }
  return evidence;
}

function analyzeTarget(profile, role, companyName) {
  const evidence = getStudentEvidence(profile);
  const components = role.requirements.map((requirement) => {
    const student = evidence[requirement.skill];
    const currentScore = student?.score ?? null;
    const gap = currentScore === null ? null : Math.max(0, requirement.required - currentScore);
    const matchScore = currentScore === null
      ? null
      : Math.min(100, Math.round((currentScore / requirement.required) * 100));
    return {
      ...requirement,
      currentScore,
      gap,
      matchScore,
      priority: getGapPriority(gap, requirement.weight),
      evidenceSources: student?.sourceLabels || [],
      assessmentScore: student?.assessmentScore ?? null,
      practiceScore: student?.practiceScore ?? null,
    };
  });
  const available = components.filter((component) => component.currentScore !== null);
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const evidenceWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const score = evidenceWeight
    ? Math.round(available.reduce((sum, component) => sum + component.matchScore * component.weight, 0) / evidenceWeight)
    : null;
  const gaps = components
    .filter((component) => component.gap === null || component.gap > 0)
    .sort((first, second) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[first.priority] - priorityOrder[second.priority] ||
        (second.gap ?? 100) - (first.gap ?? 100);
    });

  return {
    score,
    evidenceCoverage: Math.round((evidenceWeight / totalWeight) * 100),
    components,
    gaps,
    evidenceSummary: {
      assessedAreas: available.length,
      totalAreas: components.length,
      assessmentAreas: available.filter((component) => component.evidenceSources.includes("assessment")).length,
      practiceAreas: available.filter((component) => component.evidenceSources.includes("practice")).length,
    },
    requirementsSource: role.requirementsSource,
    companyName,
    roleLabel: role.label,
  };
}

function serializeReadiness(analysis) {
  return {
    score: analysis.score,
    evidenceCoverage: analysis.evidenceCoverage,
    componentScores: JSON.stringify(analysis.components),
    skillGaps: JSON.stringify(analysis.gaps),
    evidenceSummary: JSON.stringify(analysis.evidenceSummary),
  };
}

async function getCompanyProfile() {
  return requirePrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 1 },
    practiceAttempts: { orderBy: { completedAt: "desc" }, take: 100 },
  });
}

export async function getCompanyPreparationDashboard() {
  const profile = await getCompanyProfile();
  const targets = await db.prepCompanyTarget.findMany({
    where: { profileId: profile.id },
    orderBy: [{ createdAt: "asc" }],
    include: { snapshots: { orderBy: { calculatedAt: "desc" }, take: 12 } },
  });

  const serializedTargets = targets.map((target) => {
    const role = findCompanyRole(target.roleKey);
    return {
      ...target,
      current: target.status === "ACTIVE" && role
        ? analyzeTarget(profile, role, target.companyName)
        : null,
      snapshots: target.snapshots.map((snapshot) => ({
        ...snapshot,
        components: parseJson(snapshot.componentScores, []),
        gaps: parseJson(snapshot.skillGaps, []),
        evidence: parseJson(snapshot.evidenceSummary, {}),
      })),
    };
  });

  return {
    roles: COMPANY_ROLE_PROFILES.map(({ key, label, aliases }) => ({ key, label, aliases })),
    suggestedCompany: profile.targetCompany || "",
    targets: serializedTargets.filter((target) => target.status === "ACTIVE"),
    archivedTargets: serializedTargets.filter((target) => target.status === "ARCHIVED"),
  };
}

export async function addCompanyTarget({ companyName, roleKey, priority = "MEDIUM" }) {
  const normalizedCompany = typeof companyName === "string" ? companyName.trim().replace(/\s+/g, " ") : "";
  const role = findCompanyRole(roleKey);
  if (normalizedCompany.length < 2 || normalizedCompany.length > 100) {
    throw new Error("Enter a company name between 2 and 100 characters.");
  }
  if (!role) throw new Error("Choose a supported role profile.");
  if (!COMPANY_PRIORITIES.includes(priority)) throw new Error("Choose a valid target priority.");

  const profile = await getCompanyProfile();
  const duplicate = await db.prepCompanyTarget.findFirst({
    where: {
      profileId: profile.id,
      roleKey,
      companyName: { equals: normalizedCompany, mode: "insensitive" },
    },
  });
  if (duplicate?.status === "ACTIVE") throw new Error("This company and role are already in your target list.");
  const existingTargets = await db.prepCompanyTarget.count({
    where: { profileId: profile.id, status: "ACTIVE" },
  });
  if (existingTargets >= 10) throw new Error("You can track up to 10 company-role targets at a time.");

  const analysis = analyzeTarget(profile, role, normalizedCompany);
  await db.$transaction(async (transaction) => {
    const target = duplicate
      ? await transaction.prepCompanyTarget.update({
        where: { id: duplicate.id },
        data: { status: "ACTIVE", priority, roleLabel: role.label, requirementsSource: role.requirementsSource },
      })
      : await transaction.prepCompanyTarget.create({
        data: {
          profileId: profile.id,
          companyName: normalizedCompany,
          roleKey,
          roleLabel: role.label,
          priority,
          requirementsSource: role.requirementsSource,
        },
      });
    await transaction.prepCompanyReadinessSnapshot.create({
      data: {
        profileId: profile.id,
        targetId: target.id,
        ...serializeReadiness(analysis),
      },
    });
  });
  return { saved: true };
}

export async function recalculateCompanyReadiness(targetId) {
  const profile = await getCompanyProfile();
  const target = await db.prepCompanyTarget.findFirst({
    where: { id: targetId, profileId: profile.id, status: "ACTIVE" },
  });
  if (!target) throw new Error("Company target not found.");
  const role = findCompanyRole(target.roleKey);
  if (!role) throw new Error("The saved role profile is no longer available.");
  const analysis = analyzeTarget(profile, role, target.companyName);
  await db.prepCompanyReadinessSnapshot.create({
    data: {
      profileId: profile.id,
      targetId: target.id,
      ...serializeReadiness(analysis),
    },
  });
  return { saved: true, score: analysis.score };
}

export async function removeCompanyTarget(targetId) {
  const profile = await getCompanyProfile();
  const result = await db.prepCompanyTarget.updateMany({
    where: { id: targetId, profileId: profile.id, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
  if (!result.count) throw new Error("Company target not found.");
  return { removed: true };
}
