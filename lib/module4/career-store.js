import { randomUUID } from "node:crypto";

export async function persistSavedCareer(db, { userId, careerId, saved, notes, id = randomUUID() }) {
  if (!saved) {
    await db.$executeRaw`
      DELETE FROM "Module4SavedCareer"
      WHERE "userId" = ${userId} AND "careerId" = ${careerId}
    `;
    return { success: true, saved: false };
  }

  await db.$executeRaw`
    INSERT INTO "Module4SavedCareer" ("id", "userId", "careerId", "notes", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${careerId}, ${notes || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "careerId") DO UPDATE
    SET "notes" = EXCLUDED."notes", "updatedAt" = CURRENT_TIMESTAMP
  `;
  return { success: true, saved: true };
}

export function getSavedCareerRows(db, userId) {
  return db.$queryRaw`
    SELECT s."notes", s."createdAt" AS "savedAt", c.*
    FROM "Module4SavedCareer" s
    JOIN "Module4Career" c ON c."id" = s."careerId"
    WHERE s."userId" = ${userId}
    ORDER BY s."createdAt" DESC
  `;
}

export function getEndedCareerGoals(db, userId) {
  return db.$queryRaw`
    SELECT g."id", g."selectedAt", g."endedAt", c."slug", c."title"
    FROM "Module4CareerGoal" g
    JOIN "Module4Career" c ON c."id" = g."careerId"
    WHERE g."userId" = ${userId} AND g."isCurrent" = false AND g."endedAt" IS NOT NULL
    ORDER BY g."endedAt" DESC
    LIMIT 10
  `;
}

export async function selectCurrentCareerGoal(db, {
  userId,
  careerId,
  recommendationId,
  skillEvidence,
  skillGaps,
  id = randomUUID(),
}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))::text AS "lock"`;
    const current = await tx.$queryRaw`
      SELECT "id"
      FROM "Module4CareerGoal"
      WHERE "userId" = ${userId} AND "careerId" = ${careerId} AND "isCurrent" = true
      LIMIT 1
    `;
    if (current[0]) {
      await tx.$executeRaw`
        UPDATE "Module4CareerGoal"
        SET "skillEvidence" = ${JSON.stringify(skillEvidence)}::jsonb,
            "skillGaps" = ${JSON.stringify(skillGaps)}::jsonb,
            "recommendationId" = COALESCE(${recommendationId || null}, "recommendationId")
        WHERE "id" = ${current[0].id} AND "userId" = ${userId} AND "isCurrent" = true
      `;
      return current[0].id;
    }
    await tx.$executeRaw`
      UPDATE "Module4CareerGoal"
      SET "isCurrent" = false, "endedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "isCurrent" = true
    `;
    await tx.$executeRaw`
      INSERT INTO "Module4CareerGoal"
        ("id", "userId", "careerId", "recommendationId", "skillEvidence", "skillGaps",
         "isCurrent", "selectedAt")
      VALUES
        (${id}, ${userId}, ${careerId}, ${recommendationId || null},
         ${JSON.stringify(skillEvidence)}::jsonb, ${JSON.stringify(skillGaps)}::jsonb,
         true, CURRENT_TIMESTAMP)
    `;
    return id;
  });
}

export function getCurrentCareerGoalForHandoff(db, { userId, careerId, goalId }) {
  return db.$queryRaw`
    SELECT g."id", c."id" AS "careerId", c."title", g."skillGaps", g."skillEvidence",
      c."competencyProgression", c."learningResources",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', skill."skillName",
          'importance', skill."importance",
          'category', skill."category",
          'evidenceTopics', skill."evidenceTopics"
        ) ORDER BY skill."skillName")
        FROM "Module4CareerSkill" skill
        WHERE skill."careerId" = c."id"
      ), '[]'::jsonb) AS "careerSkills"
    FROM "Module4CareerGoal" g
    JOIN "Module4Career" c ON c."id" = g."careerId"
    WHERE g."userId" = ${userId}
      AND g."careerId" = ${careerId}
      AND g."id" = ${goalId}
      AND g."isCurrent" = true
    LIMIT 1
  `;
}

export function buildModule5Url({ careerId, goalId, title }) {
  return `/skill-development/setup?careerId=${encodeURIComponent(careerId)}&goalId=${encodeURIComponent(goalId)}&career=${encodeURIComponent(title)}`;
}

export function hasCompleteCareerGoalHandoff({ careerId, goalId }) {
  return Boolean(careerId) === Boolean(goalId);
}
