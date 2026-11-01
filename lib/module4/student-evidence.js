import { auth, currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { studentProfileSchema } from "@/lib/student-profile";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeStringArray(value) {
  return asArray(value).filter((item) => typeof item === "string" && item.trim());
}

export async function loadModule4StudentEvidence() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to use career recommendations.");
  let accountRows = await db.$queryRaw`
    SELECT "id" FROM "User" WHERE "clerkUserId" = ${userId} LIMIT 1
  `;
  if (!accountRows[0]) {
    const clerkUser = await currentUser();
    const verifiedEmail = clerkUser?.emailAddresses?.find(
      (address) => address.verification?.status === "verified"
    )?.emailAddress;
    if (!verifiedEmail) throw new Error("Your account needs a verified email address.");
    await db.$executeRaw`
      INSERT INTO "User" ("id", "clerkUserId", "email", "name", "imageUrl", "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()}, ${userId}, ${verifiedEmail},
        ${[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null},
        ${clerkUser.imageUrl || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("clerkUserId") DO NOTHING
    `;
    accountRows = await db.$queryRaw`
      SELECT "id" FROM "User" WHERE "clerkUserId" = ${userId} LIMIT 1
    `;
  }
  if (!accountRows[0]) throw new Error("Your student account could not be found.");
  const studentRows = await db.$queryRaw`
    SELECT u."id", u."name", u."skills", u."updatedAt" AS "accountUpdatedAt",
      to_jsonb(p)->'skills' AS "profileSkills",
      to_jsonb(p)->'education' AS "profileEducation",
      to_jsonb(p)->'experience' AS "profileExperience",
      to_jsonb(p)->'profileData' AS "profileData",
      p."updatedAt" AS "profileUpdatedAt"
    FROM "User" u
    LEFT JOIN "UserProfile" p ON p."userId" = u."id"
    WHERE u."id" = ${accountRows[0].id}
    LIMIT 1
  `;
  const studentRow = studentRows[0];
  if (!studentRow) throw new Error("Your student account could not be found.");
  const student = {
    id: studentRow.id,
    name: studentRow.name,
    skills: safeStringArray(studentRow.skills),
    profile: studentRow.profileSkills === null ? null : {
      skills: studentRow.profileSkills,
      education: studentRow.profileEducation,
      experience: studentRow.profileExperience,
      profileData: studentRow.profileData,
    },
  };

  const profileResult = studentProfileSchema.safeParse(student.profile?.profileData);
  const profile = profileResult.success ? profileResult.data : null;
  const savedProfileSkills = profile?.skills || [];
  const legacyProfileSkills = safeStringArray(student.profile?.skills).map((name) => ({ name, source: "manual" }));
  const accountSkills = safeStringArray(student.skills).map((name) => ({ name, source: "manual" }));
  const skillsByName = new Map();
  for (const skill of [...savedProfileSkills, ...legacyProfileSkills, ...accountSkills]) {
    const name = String(skill.name || "").trim();
    if (name && !skillsByName.has(name.toLowerCase())) {
      skillsByName.set(name.toLowerCase(), { name, source: skill.source || "manual" });
    }
  }

  const [resumeSkills, resumeProjects, resumeExperience, resumeCertifications, resumeVersionRows, module2Rows, riasecRows, preferencesRows] = await Promise.all([
    db.$queryRaw`
      SELECT s."name", s."category"
      FROM "skills" s
      JOIN "resumes" r ON r."id" = s."resumeId"
      WHERE r."userId" = ${student.id}
      ORDER BY r."updatedAt" DESC, s."order" ASC
      LIMIT 120
    `,
    db.$queryRaw`
      SELECT p."name", p."description", p."technologies", p."highlights"
      FROM "projects" p
      JOIN "resumes" r ON r."id" = p."resumeId"
      WHERE r."userId" = ${student.id}
      ORDER BY r."updatedAt" DESC, p."order" ASC
      LIMIT 60
    `,
    db.$queryRaw`
      SELECT e."position", e."company", e."description"
      FROM "experiences" e
      JOIN "resumes" r ON r."id" = e."resumeId"
      WHERE r."userId" = ${student.id}
      ORDER BY r."updatedAt" DESC, e."order" ASC
      LIMIT 60
    `,
    db.$queryRaw`
      SELECT c."name"
      FROM "certifications" c
      JOIN "resumes" r ON r."id" = c."resumeId"
      WHERE r."userId" = ${student.id}
      ORDER BY r."updatedAt" DESC, c."order" ASC
      LIMIT 60
    `,
    db.$queryRaw`
      SELECT MAX("updatedAt") AS "updatedAt"
      FROM "resumes"
      WHERE "userId" = ${student.id}
    `,
    db.$queryRaw`
      SELECT "status", "result", "submittedAt"
      FROM "Module2Attempt"
      WHERE "userId" = ${student.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    db.$queryRaw`
      SELECT "status", "scores", "interestCode", "completedAt",
             "questionSetVersion", "scoringAlgorithmVersion"
      FROM "RiasecAttempt"
      WHERE "userId" = ${student.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    db.$queryRaw`
      SELECT "roles", "domains", "interests", "goals", "updatedAt"
      FROM "Module4CareerPreference"
      WHERE "userId" = ${student.id}
      LIMIT 1
    `,
  ]);

  for (const item of resumeSkills) {
    if (item.name && !skillsByName.has(item.name.toLowerCase())) {
      skillsByName.set(item.name.toLowerCase(), { name: item.name, source: "resume" });
    }
  }
  const projects = [
    ...(profile?.projects || []),
    ...resumeProjects.map((item) => ({
      title: item.name,
      description: item.description,
      technologies: safeStringArray(item.technologies).join(", "),
      outcomes: safeStringArray(item.highlights).join(" "),
      source: "resume",
    })),
  ];
  const experience = [
    ...(profile?.experience || []),
    ...resumeExperience.map((item) => ({
      title: item.position,
      organization: item.company,
      responsibilities: safeStringArray(item.description).join(" "),
      source: "resume",
    })),
  ];
  const certifications = [
    ...(profile?.certifications || []),
    ...resumeCertifications.map((item) => ({ name: item.name, source: "resume" })),
  ];

  const latestAssessment = module2Rows[0];
  const candidateAssessmentResult = latestAssessment?.status === "SUBMITTED" &&
    latestAssessment.result &&
    typeof latestAssessment.result === "object" &&
    !Array.isArray(latestAssessment.result)
    ? latestAssessment.result
    : null;
  const assessmentScoreValid = Number.isFinite(candidateAssessmentResult?.percentage) &&
    candidateAssessmentResult.percentage >= 0 &&
    candidateAssessmentResult.percentage <= 100;
  const assessmentResult = candidateAssessmentResult && assessmentScoreValid ? candidateAssessmentResult : null;
  const latestInterest = riasecRows[0];
  const riasecDimensions = ["R", "I", "A", "S", "E", "C"];
  const validRiasecScores = latestInterest?.scores &&
    typeof latestInterest.scores === "object" &&
    !Array.isArray(latestInterest.scores) &&
    riasecDimensions.every((dimension) => (
      Number.isFinite(latestInterest.scores[dimension]?.mean) &&
      latestInterest.scores[dimension].mean >= 1 &&
      latestInterest.scores[dimension].mean <= 5
    ));
  const riasecComplete = latestInterest?.status === "COMPLETE" &&
    typeof latestInterest.interestCode === "string" &&
    validRiasecScores;
  const preferences = preferencesRows[0] || {};
  const profileDataExists = Boolean(
    profile ||
    legacyProfileSkills.length ||
    student.profile?.education ||
    student.profile?.experience
  );

  return {
    studentId: student.id,
    displayName: student.name || "",
    inputVersions: {
      profileUpdatedAt: studentRow.profileUpdatedAt?.toISOString?.() || null,
      accountUpdatedAt: studentRow.accountUpdatedAt?.toISOString?.() || null,
      resumeUpdatedAt: resumeVersionRows[0]?.updatedAt?.toISOString?.() || null,
      preferencesUpdatedAt: preferencesRows[0]?.updatedAt?.toISOString?.() || null,
      assessment: {
        submittedAt: latestAssessment?.submittedAt?.toISOString?.() || null,
        blueprintVersion: Number.isInteger(assessmentResult?.blueprintVersion) ? assessmentResult.blueprintVersion : null,
      },
      riasec: {
        completedAt: latestInterest?.completedAt?.toISOString?.() || null,
        questionSetVersion: latestInterest?.questionSetVersion ?? null,
        scoringAlgorithmVersion: latestInterest?.scoringAlgorithmVersion ?? null,
      },
    },
    hasProfileData: profileDataExists,
    profileReady: Boolean(
      profile?.academic?.degree ||
      profile?.academic?.branch ||
      [...skillsByName.values()].length
    ),
    profile: {
      summary: profile?.summary || "",
      location: profile?.location || "",
    },
    education: {
      degree: profile?.academic?.degree || student.profile?.education || "",
      branch: profile?.academic?.branch || "",
      specialization: profile?.academic?.specialization || "",
      institution: profile?.academic?.institution || "",
      expectedGraduationYear: profile?.academic?.expectedGraduationYear || "",
      gpa: profile?.academic?.gpa || "",
    },
    skills: [...skillsByName.values()],
    projects,
    experience,
    certifications,
    preferences: {
      roles: safeStringArray(preferences.roles),
      domains: safeStringArray(preferences.domains),
      interests: safeStringArray(preferences.interests),
      goals: preferences.goals || "",
    },
    assessment: {
      completed: Boolean(assessmentResult),
      status: assessmentResult ? "complete" : candidateAssessmentResult ? "invalid" : latestAssessment?.status?.toLowerCase() || "not_started",
      percentage: Number.isFinite(assessmentResult?.percentage) ? assessmentResult.percentage : null,
      score: Number.isFinite(assessmentResult?.score) ? assessmentResult.score : null,
      maxMarks: Number.isFinite(assessmentResult?.maxMarks) ? assessmentResult.maxMarks : null,
      sections: asArray(assessmentResult?.sections),
      topics: asArray(assessmentResult?.topics),
      strengths: safeStringArray(assessmentResult?.strengths),
      improvementAreas: safeStringArray(assessmentResult?.improvementAreas),
      codingOutcomes: asArray(assessmentResult?.codingOutcomes),
      submittedAt: latestAssessment?.submittedAt?.toISOString?.() || null,
      blueprintVersion: Number.isInteger(assessmentResult?.blueprintVersion) ? assessmentResult.blueprintVersion : null,
    },
    riasec: {
      completed: Boolean(riasecComplete),
      status: riasecComplete ? "complete" : latestInterest?.status === "COMPLETE" ? "invalid" : latestInterest?.status?.toLowerCase() || "not_started",
      interestCode: riasecComplete ? latestInterest.interestCode : null,
      scores: riasecComplete ? latestInterest.scores : null,
      completedAt: latestInterest?.completedAt?.toISOString?.() || null,
      questionSetVersion: latestInterest?.questionSetVersion ?? null,
      scoringAlgorithmVersion: latestInterest?.scoringAlgorithmVersion ?? null,
    },
  };
}
