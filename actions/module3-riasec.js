"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { generateJson } from "@/lib/llm";
import { AIProviderError } from "@/lib/ai/ai-errors.js";
import { buildDeterministicInterpretation, calculateRiasecScores } from "@/lib/module3/riasec-scoring.js";
import { generateRiasecQuestions, RIASEC_QUESTION_SET_VERSION, validateRiasecResponses } from "@/lib/module3/riasec-questions.js";

async function requireStudentId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to access the career-interest assessment.");
  const student = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
  if (!student) throw new Error("Your student account could not be found.");
  return { clerkUserId: userId, studentId: student.id };
}

function publicAttempt(attempt) {
  return {
    id: attempt.id,
    status: attempt.status,
    questions: attempt.questions,
    responses: attempt.responses,
    scores: attempt.scores,
    interestCode: attempt.interestCode,
    interpretation: attempt.interpretation,
    completedAt: attempt.completedAt?.toISOString() || null,
    createdAt: attempt.createdAt?.toISOString() || null,
    questionSetVersion: attempt.questionSetVersion,
    scoringAlgorithmVersion: attempt.scoringAlgorithmVersion,
  };
}

function describeAttemptStartError(error) {
  const causes = [];
  let current = error;
  while (current && !causes.includes(current)) {
    causes.push(current);
    current = current.cause;
  }
  const aiError = causes.find((cause) => cause instanceof AIProviderError);
  if (aiError?.code === "AI_NOT_CONFIGURED") {
    return "Gemini is not configured. Set GEMINI_API_KEY in .env.local and restart the app.";
  }
  if (aiError?.code === "AI_PROVIDER_AUTH_FAILED") {
    return "Gemini rejected its API key. Check GEMINI_API_KEY in .env.local.";
  }
  if (aiError?.code === "AI_PROVIDER_QUOTA_EXHAUSTED") {
    return "The Gemini project quota or billing limit was reached. Check the project's usage and billing settings.";
  }
  if (aiError?.code === "AI_PROVIDER_RATE_LIMITED") {
    return "Gemini is rate-limited. Please wait briefly and try again.";
  }
  if (aiError?.code === "AI_PROVIDERS_UNAVAILABLE" || aiError?.code === "AI_PROVIDER_UNAVAILABLE") {
    return "Gemini is temporarily unavailable. Please try again shortly.";
  }
  const providerError = causes.find((cause) => Number.isInteger(cause.status));
  if (providerError?.status === 429) {
    return "Gemini's rate limit was reached. Please wait briefly and try again.";
  }
  if (providerError?.status === 401 || providerError?.status === 403) {
    return "Gemini rejected its API key. Check GEMINI_API_KEY in .env.local.";
  }
  if (providerError?.status === 404) {
    return "Gemini could not find the configured model. Please check GEMINI_MODEL in the server environment.";
  }
  if (providerError?.status) {
    return `Gemini could not generate questions (HTTP ${providerError.status}). Please try again later.`;
  }
  const prismaError = causes.find((cause) => typeof cause.code === "string" && cause.code.startsWith("P"));
  if (prismaError) {
    return `The assessment database could not start this attempt (${prismaError.code}). Check the Prisma migration status.`;
  }
  if (causes.some((cause) => /balanced RIASEC question set|Generated interest questions/.test(cause.message || ""))) {
    return "Gemini did not return a valid balanced question set after two attempts. Please try again.";
  }
  if (causes.some((cause) => /GEMINI_API_KEY is not configured/.test(cause.message || ""))) {
    return "Gemini is not configured. Set GEMINI_API_KEY in .env.local and restart the app.";
  }
  return "Questions could not be prepared. Check Gemini and database configuration, then try again.";
}

export async function startRiasecAttempt() {
  const { studentId } = await requireStudentId();
  const activeAttempts = await db.$queryRaw`
    SELECT "id"
    FROM "RiasecAttempt"
    WHERE "userId" = ${studentId} AND "status" = 'IN_PROGRESS'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const active = activeAttempts[0];
  if (active) return { success: true, attemptId: active.id, resumed: true };

  const recentAttempts = await db.$queryRaw`
    SELECT COUNT(*)::int AS "count"
    FROM "RiasecAttempt"
    WHERE "userId" = ${studentId} AND "createdAt" >= ${new Date(Date.now() - 60 * 60_000)}
  `;
  const recentCount = recentAttempts[0].count;
  if (recentCount >= 5) return { success: false, error: "Please wait before starting another assessment." };

  try {
    const questions = await generateRiasecQuestions();
    const attemptId = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))::text AS "lock"`;
      const concurrentAttempts = await tx.$queryRaw`
        SELECT "id"
        FROM "RiasecAttempt"
        WHERE "userId" = ${studentId} AND "status" = 'IN_PROGRESS'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      const concurrentAttempt = concurrentAttempts[0];
      if (concurrentAttempt) return concurrentAttempt.id;
      const id = randomUUID();
      const created = await tx.$queryRaw`
        INSERT INTO "RiasecAttempt"
          ("id", "userId", "status", "questionSetVersion", "scoringAlgorithmVersion", "questions", "responses", "createdAt", "updatedAt")
        VALUES
          (${id}, ${studentId}, 'IN_PROGRESS', ${RIASEC_QUESTION_SET_VERSION}, 1, ${JSON.stringify(questions)}::jsonb, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING "id"
      `;
      return created[0].id;
    });
    return { success: true, attemptId, resumed: false };
  } catch (error) {
    console.error("RIASEC attempt could not be started.", {
      name: error?.name || "Error",
      code: error?.code || null,
      status: error?.status || error?.cause?.status || null,
    });
    return { success: false, error: describeAttemptStartError(error) };
  }
}

export async function saveRiasecResponse(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    score: z.number().int().min(1).max(5),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose one of the five response options." };
  const { clerkUserId } = await requireStudentId();
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "RiasecAttempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${parsed.data.attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt) return { success: false, error: "Assessment attempt not found." };
    if (attempt.status !== "IN_PROGRESS") return { success: false, error: "This assessment is already complete." };
    if (!attempt.questions.some((question) => question.id === parsed.data.questionId)) {
      return { success: false, error: "Question not found in this assessment." };
    }
    const responses = validateRiasecResponses(attempt.questions, {
      ...(attempt.responses || {}),
      [parsed.data.questionId]: parsed.data.score,
    });
    await tx.$executeRaw`
      UPDATE "RiasecAttempt"
      SET "responses" = ${JSON.stringify(responses)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id} AND "status" = 'IN_PROGRESS'
    `;
    return { success: true };
  });
}

export async function completeRiasecAttempt(input) {
  const schema = z.object({ attemptId: z.string().uuid() }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Assessment attempt not found." };
  const { clerkUserId } = await requireStudentId();

  const completed = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "RiasecAttempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${parsed.data.attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt) return { error: "Assessment attempt not found." };
    if (attempt.status === "COMPLETE") return { attempt, newlyCompleted: false };
    let result;
    try {
      result = calculateRiasecScores(attempt.questions, attempt.responses || {});
    } catch (error) {
      return { error: error.message };
    }
    const interpretation = buildDeterministicInterpretation(result);
    const updated = await tx.$queryRaw`
      UPDATE "RiasecAttempt"
      SET "status" = 'COMPLETE',
          "scores" = ${JSON.stringify(result.scores)}::jsonb,
          "interestCode" = ${result.interestCode},
          "interpretation" = ${interpretation},
          "completedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id}
      RETURNING *
    `;
    return { attempt: updated[0], newlyCompleted: true };
  });
  if (completed.error) return { success: false, error: completed.error };

  let attempt = completed.attempt;
  if (!attempt.interpretation) {
    const result = calculateRiasecScores(attempt.questions, attempt.responses || {});
    const fallback = buildDeterministicInterpretation(result);
    attempt = { ...attempt, interpretation: fallback };
  }
  if (completed.newlyCompleted) {
    try {
      const scores = attempt.scores;
      const interpretation = await generateJson(`Interpret these calculated RIASEC career-interest results as a non-clinical, non-diagnostic self-reflection. Do not alter, recalculate, or dispute the supplied scores, ranking, or code. Do not claim ability, guaranteed success, or a single correct career. Use only the provided scores and code.
Return JSON only: {"interpretation":"string"}.
Calculated interest code: ${attempt.interestCode}
Calculated dimension scores (1-5 mean and response-position percentage): ${JSON.stringify(scores)}
Explain the leading dimensions and their combination, possible activities/work environments, complementary interests, areas to explore, and practical reflection questions. State that interests are not ability or guaranteed outcomes.`, {
        operation: "riasec-results-interpretation",
        validateOutput: (output) => {
          const parsed = z.object({
            interpretation: z.string().trim().min(80).max(4000),
          }).safeParse(output);
          return parsed.success ? parsed.data : false;
        },
      });
      const parsedInterpretation = z.object({ interpretation: z.string().trim().min(80).max(4000) }).safeParse(interpretation);
      if (parsedInterpretation.success) {
        const personalized = `Personalized reflection: ${parsedInterpretation.data.interpretation}`;
        const updated = await db.$queryRaw`
          UPDATE "RiasecAttempt"
          SET "interpretation" = ${personalized}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${attempt.id} AND "userId" = ${attempt.userId} AND "status" = 'COMPLETE'
          RETURNING "id"
        `;
        if (updated.length === 1) attempt = { ...attempt, interpretation: personalized };
      }
    } catch (error) {
      console.warn("RIASEC personalized interpretation unavailable; keeping deterministic explanation.", error?.code || error?.name || "provider error");
    }
  }
  return { success: true, attemptId: attempt.id };
}

export async function getRiasecAttempt(attemptId) {
  const schema = z.string().uuid().safeParse(attemptId);
  if (!schema.success) return null;
  const { studentId } = await requireStudentId();
  const attempts = await db.$queryRaw`
    SELECT *
    FROM "RiasecAttempt"
    WHERE "id" = ${schema.data} AND "userId" = ${studentId}
    LIMIT 1
  `;
  const attempt = attempts[0];
  return attempt ? publicAttempt(attempt) : null;
}

export async function getRiasecHistory() {
  const { studentId } = await requireStudentId();
  const attempts = await db.$queryRaw`
    SELECT "id", "status", "interestCode", "createdAt", "completedAt", "scores"
    FROM "RiasecAttempt"
    WHERE "userId" = ${studentId}
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;
  return attempts.map((attempt) => ({
    ...attempt,
    createdAt: attempt.createdAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() || null,
  }));
}
