"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

const TARGET_SCORE = 75;

const ROLE_TARGETS = {
  "Frontend Developer": ["JavaScript", "React", "HTML/CSS", "DSA", "Communication"],
  "Full Stack Developer": ["JavaScript", "React", "Node.js", "SQL", "DSA"],
  "Backend Developer": ["Node.js", "SQL", "DBMS", "DSA", "Computer Networks"],
  "Data Analyst": ["SQL", "Python", "Aptitude", "Communication", "Analytical thinking"],
  "Data Engineer": ["Python", "SQL", "DBMS", "Computer Networks", "DSA"],
  "Cloud / DevOps Engineer": ["Linux", "Computer Networks", "OS", "SQL", "Problem solving"],
  "Security Analyst": ["Computer Networks", "OS", "SQL", "Problem solving", "Communication"],
  "Application Security Engineer": ["Computer Networks", "OS", "Coding", "Problem solving", "Communication"],
};

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildReadinessReport(profile, latestAssessment, careerTwin) {
  const sectionScores = asObject(latestAssessment?.sectionScores);
  const profileSkills = unique([
    ...(profile.skills ?? []),
    ...(profile.programmingLanguages ?? []),
  ]);
  const skillSet = new Set(profileSkills.map((skill) => skill.toLowerCase()));
  const role =
    profile.preferredRole ||
    careerTwin?.recommendedRoles?.[0] ||
    latestAssessment?.suitabilityProfile?.recommendedRoles?.[0] ||
    "Software Developer";
  const targetSkills = ROLE_TARGETS[role] ?? ["Coding", "DSA", "SQL", "Communication", "Problem solving"];
  const profileBonus = Math.min(15, profileSkills.length * 3);

  const twinScores = asObject(careerTwin?.skillScores);
  const skillScores = {
    Aptitude: clamp((sectionScores.aptitude ?? 0) + profileBonus * 0.35),
    "Logical reasoning": clamp((sectionScores.aptitude ?? 0) + profileBonus * 0.25),
    Coding: clamp((sectionScores.coding ?? 0) + profileBonus),
    "Core technical": clamp((sectionScores.technical ?? 0) + profileBonus),
    Communication: clamp((sectionScores.communication ?? 0) + profileBonus * 0.5),
    "Profile depth": clamp((profileSkills.length / 8) * 100 + (profile.projects?.length ? 10 : 0)),
  };
  for (const [skill, score] of Object.entries(twinScores)) {
    if (skill in skillScores) skillScores[skill] = clamp(score);
  }

  const strengths = Object.entries(skillScores)
    .filter(([, score]) => score >= 70)
    .sort(([, first], [, second]) => second - first)
    .map(([skill]) => skill);
  const weaknesses = Object.entries(skillScores)
    .filter(([, score]) => score < 60)
    .sort(([, first], [, second]) => first - second)
    .map(([skill]) => skill);
  const skillGaps = targetSkills.map((skill) => {
    const normalized = skill.toLowerCase();
    const matchingKey = Object.keys(skillScores).find((key) => key.toLowerCase() === normalized);
    const score = matchingKey
      ? skillScores[matchingKey]
      : skillSet.has(normalized)
        ? 70
        : Math.max(20, clamp((sectionScores.technical ?? sectionScores.coding ?? 0) * 0.7));
    return {
      skill,
      currentScore: score,
      targetScore: TARGET_SCORE,
      gap: Math.max(0, TARGET_SCORE - score),
      priority: score < 50 ? "high" : score < TARGET_SCORE ? "medium" : "maintain",
    };
  });

  const overallScore = clamp(
    Object.values(skillScores).reduce((total, score) => total + score, 0) / Object.values(skillScores).length
  );
  const dynamicProfile = {
    label: overallScore >= 75 ? "Placement ready" : overallScore >= 55 ? "Building momentum" : "Foundation stage",
    role,
    field: careerTwin?.careerField ?? latestAssessment?.careerField ?? "Technology",
    evidence: unique([
      profile.institution ? `Profile from ${profile.institution}` : null,
      profileSkills.length ? `${profileSkills.length} skills recorded` : null,
      latestAssessment ? "Latest career assessment included" : "Complete the career assessment to improve confidence",
      careerTwin ? `Career Twin version ${careerTwin.version}` : null,
    ]),
  };

  return {
    overallScore,
    skillScores,
    strengths: strengths.length ? strengths : ["Keep building a consistent practice habit"],
    weaknesses: weaknesses.length ? weaknesses : ["Continue practising at target-role difficulty"],
    skillGaps,
    targetRole: profile.preferredRole || role,
    targetCompany: profile.targetCompany || null,
    profileSnapshot: {
      dynamicProfile,
      skills: profileSkills,
      interests: profile.careerInterests ?? [],
      education: profile.educationLevel ?? null,
      projectCount: Array.isArray(profile.projects) ? profile.projects.length : 0,
    },
    assessmentId: latestAssessment?.id ?? null,
    careerTwinVersion: careerTwin?.version ?? null,
  };
}

async function getPlacementContext() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      placementJourney: {
        include: {
          profile: true,
          careerTwin: true,
          assessmentAttempts: { orderBy: { completedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!user?.placementJourney?.profile) {
    throw new Error("Complete your placement profile before viewing readiness.");
  }
  return user.placementJourney;
}

export async function getPlacementReadiness() {
  const journey = await getPlacementContext();
  const latestAssessment = journey.assessmentAttempts[0] ?? null;
  const report = buildReadinessReport(journey.profile, latestAssessment, journey.careerTwin);
  const saved = await db.placementReadinessReport.upsert({
    where: { journeyId: journey.id },
    create: { journeyId: journey.id, ...report },
    update: { ...report },
  });

  await db.placementJourney.update({
    where: { id: journey.id },
    data: { status: "active", currentModule: Math.max(journey.currentModule, 3) },
  });
  return { report: saved, latestAssessment };
}
