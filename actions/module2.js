"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { studentProfileSchema } from "@/lib/student-profile";
import { getAuthenticatedStudent } from "@/lib/student-profile-server";
import { defaultCareerRoleForBranch, getBlueprintForBranch } from "@/lib/module2/blueprints";
import { validateBlueprint } from "@/lib/module2/blueprints";
import { isAIProviderUnavailableError } from "@/lib/ai/ai-errors.js";
import { AIProviderError } from "@/lib/ai/ai-errors.js";
import { generateAttemptQuestions } from "@/lib/module2/assessment-generator";
import { findReusableQuestionSet, hasSimilarQuestion } from "@/lib/module2/assessment-validation";
import { classifyIntegrityEvent, isMobileAssessmentClient } from "@/lib/module2/assessment-policy";
import {
  activateGeneratedAttempt,
  claimCodingSubmission,
  completeCodingSubmission,
  createGeneratingAttempt,
  expireStaleGeneratingAttempt,
  failCodingSubmission,
  failGeneratingAttempt,
  finalizeAttempt,
  getDatabaseServerTime,
  getOwnedAttempt,
  getIntegrityCooldown,
  recordOwnedIntegrityEvent,
  saveOwnedCodeDraft,
  saveOwnedAnswer,
  saveOwnedQuestionTime,
  toggleQuestionReview,
} from "@/lib/module2/assessment-engine";
import { evaluateCode } from "@/lib/module2/judge0";

const generationInputSchema = z.object({
  policyAccepted: z.literal(true),
  proctoringReady: z.literal(true),
  leaderboardOptIn: z.boolean(),
}).strict();

export async function startModule2Attempt(input) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to start the assessment." };
  const requestHeaders = await headers();
  if (isMobileAssessmentClient(requestHeaders.get("user-agent") || "")) {
    return { success: false, error: "This assessment can only be started on a desktop or laptop browser." };
  }
  const parsed = generationInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Accept the assessment rules before continuing." };

  try {
    const student = await getAuthenticatedStudent();
    if (!student) return { success: false, error: "Sign in to start the assessment." };
    const profileResult = studentProfileSchema.safeParse(student.profile?.profileData);
    if (!profileResult.success || !profileResult.data.academic.branch) {
      return { success: false, error: "Add your confirmed branch to your student profile before starting." };
    }
    const branchBlueprint = getBlueprintForBranch(profileResult.data.academic.branch);
    if (!branchBlueprint) {
      return { success: false, error: "Your profile branch does not yet have a supported assessment blueprint." };
    }
    const configuredRows = await db.$queryRaw`
      SELECT "branch", "version", "durationMinutes", "maxMarks", "sections", "scoringPolicy"
      FROM "Module2Blueprint"
      WHERE "branch" = ${branchBlueprint.branch} AND "isActive" = true
      ORDER BY "version" DESC LIMIT 1
    `;
    const configured = configuredRows[0];
    if (!configured) {
      return { success: false, error: "The assessment blueprint is not configured yet. Please contact support." };
    }
    const blueprintResult = validateBlueprint(configured);
    if (!blueprintResult.success) {
      console.error("Stored Module 2 blueprint failed validation.", blueprintResult.errors);
      return { success: false, error: "The assessment configuration is invalid. Please contact support." };
    }
    const blueprint = blueprintResult.blueprint;
    const careerRole = profileResult.data.preferences.roles[0] || defaultCareerRoleForBranch(blueprint.branch);
    const relevantSkills = profileResult.data.skills
      .map((skill) => skill.name.trim())
      .filter(Boolean)
      .slice(0, 20);

    await expireStaleGeneratingAttempt(student.id);
    const cooldownUntil = await getIntegrityCooldown(student.id);
    if (cooldownUntil) {
      const remainingSeconds = Math.max(1, Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000));
      return {
        success: false,
        error: `A retake is available in ${Math.ceil(remainingSeconds / 60)} minute(s) after the monitoring interruption.`,
      };
    }
    const activeRows = await db.$queryRaw`
      SELECT "id", "status" FROM "Module2Attempt"
      WHERE "userId" = ${student.id} AND "status" IN ('GENERATING', 'ACTIVE')
      ORDER BY "createdAt" DESC LIMIT 1
    `;
    if (activeRows.length) {
      return activeRows[0].status === "ACTIVE"
        ? { success: true, attemptId: activeRows[0].id }
        : { success: false, error: "Your assessment is still being prepared. Please wait and refresh." };
    }

    const recentRows = await db.$queryRaw`
      SELECT COUNT(*)::int AS "count" FROM "Module2Attempt"
      WHERE "userId" = ${student.id}
        AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '1 minute'
    `;
    if (recentRows[0].count >= 2) {
      return { success: false, error: "Please wait a minute before requesting another assessment." };
    }

    const attempt = await createGeneratingAttempt({
      student,
      branch: blueprint.branch,
      blueprint,
      cameraConsent: true,
      leaderboardOptIn: parsed.data.leaderboardOptIn,
    }).catch(async (error) => {
      const existing = await db.$queryRaw`
        SELECT "id", "status" FROM "Module2Attempt"
        WHERE "userId" = ${student.id} AND "status" IN ('GENERATING', 'ACTIVE')
        ORDER BY "createdAt" DESC LIMIT 1
      `;
      if (existing[0]?.status === "ACTIVE") return existing[0];
      if (existing.length) throw new Error("Another assessment attempt is already being prepared.");
      throw error;
    });

    if (attempt.status === "ACTIVE") return { success: true, attemptId: attempt.id };

    try {
      const previousAttempts = await db.$queryRaw`
        SELECT "questions", "result" FROM "Module2Attempt"
        WHERE "userId" = ${student.id} AND "branch" = ${blueprint.branch}
          AND "status" IN ('SUBMITTED', 'EXPIRED')
          AND "questions" IS NOT NULL
        ORDER BY "createdAt" DESC LIMIT 3
      `;
      const excludeQuestionTexts = previousAttempts.flatMap((item) => (
        (item.questions || [])
          .map((question) => question?.questionText)
          .filter((questionText) => typeof questionText === "string" && questionText.length > 0)
      ));
      const previousResults = previousAttempts
        .map((item) => item.result?.topics)
        .filter(Array.isArray)
        .map((topics) => topics
          .filter((topic) => Number.isFinite(topic.percentage))
          .sort((left, right) => left.percentage - right.percentage)
          .slice(0, 5)
          .map(({ topic, percentage, total }) => ({ topic, percentage, total })));
      const studentContext = { careerRole, skills: relevantSkills, previousResults };
      const canUseGenericCache = !relevantSkills.length
        && !profileResult.data.preferences.roles.length
        && !previousResults.length;
      let cachedSets = [];
      if (canUseGenericCache) {
        try {
          cachedSets = await db.$queryRaw`
            SELECT "questions"
            FROM "Module2QuestionSetCache"
            WHERE "branch" = ${blueprint.branch}
              AND "blueprintVersion" = ${blueprint.version}
            ORDER BY random()
            LIMIT 24
          `;
        } catch (error) {
          console.error("Module 2 question cache lookup failed; generating a fresh set.", error?.message || "Unknown error");
        }
      }
      const cachedSet = findReusableQuestionSet(blueprint, cachedSets, excludeQuestionTexts);
      let questions;
      if (cachedSet) {
        questions = cachedSet.questions.map((question) => ({ ...question, id: randomUUID() }));
      } else {
        let generatedFresh = false;
        try {
          questions = await generateAttemptQuestions(blueprint, { excludeQuestionTexts, studentContext });
          generatedFresh = true;
        } catch (generationError) {
          if (!isAIProviderUnavailableError(generationError)) throw generationError;

          let outageCache = [];
          try {
            outageCache = await db.$queryRaw`
              SELECT "questions"
              FROM "Module2QuestionSetCache"
              WHERE "branch" = ${blueprint.branch}
                AND "blueprintVersion" = ${blueprint.version}
              ORDER BY random()
              LIMIT 24
            `;
          } catch (cacheError) {
            console.error(
              "Module 2 outage cache lookup failed.",
              cacheError?.message || "Unknown error",
            );
          }
          const outageSet = findReusableQuestionSet(blueprint, outageCache, excludeQuestionTexts);
          if (!outageSet) throw generationError;

          console.warn(
            "Module 2 is using a validated generic question set because AI providers are unavailable.",
            { branch: blueprint.branch, blueprintVersion: blueprint.version },
          );
          questions = outageSet.questions.map((question) => ({ ...question, id: randomUUID() }));
        }
        if (generatedFresh && canUseGenericCache) {
          try {
            await db.$executeRaw`
              INSERT INTO "Module2QuestionSetCache" ("id", "branch", "blueprintVersion", "questions")
              VALUES (${randomUUID()}, ${blueprint.branch}, ${blueprint.version}, ${JSON.stringify(questions)}::jsonb)
            `;
          } catch (error) {
            console.error("Module 2 generated questions could not be added to the reuse cache.", error?.message || "Unknown error");
          }
        }
      }
      const active = await activateGeneratedAttempt(attempt.id, questions, blueprint.durationSeconds);
      if (!active) throw new Error("The attempt could not be activated.");
      return { success: true, attemptId: active.id };
    } catch (error) {
      await failGeneratingAttempt(attempt.id);
      const generationError = error?.cause || error;
      console.error("Module 2 question generation failed.", {
        name: generationError?.name || "Error",
        code: generationError?.code || null,
        status: generationError?.status || null,
        ...(generationError?.code === "AI_OUTPUT_INVALID"
          ? { validation: generationError.message }
          : {}),
      });
      return {
        success: false,
        error: error?.cause instanceof AIProviderError && error.cause.code === "AI_NOT_CONFIGURED"
            ? "Assessment questions are not configured. Set GEMINI_API_KEY on the server and restart the app."
            : error?.cause instanceof AIProviderError && error.cause.code === "AI_PROVIDER_AUTH_FAILED"
              ? "Gemini rejected its API key. Please check GEMINI_API_KEY in the server environment."
              : error?.cause instanceof AIProviderError && error.cause.code === "AI_PROVIDER_QUOTA_EXHAUSTED"
                ? "The Gemini project quota or billing limit was reached. Check the project's usage and billing settings."
              : error?.cause instanceof AIProviderError && error.cause.code === "AI_PROVIDER_RATE_LIMITED"
                ? "Gemini is rate-limited. Your timer has not started; wait briefly and try again."
              : isAIProviderUnavailableError(error)
                ? "Gemini is temporarily unavailable. Your timer has not started; please try again shortly."
                : error?.message?.startsWith("Unable to prepare")
                  ? error.message
                  : "We could not prepare a valid assessment. Your timer has not started. Please try again.",
      };
    }
  } catch (error) {
    console.error("Module 2 attempt could not be started.", error?.message || "Unknown error");
    if (error?.message?.includes("Another assessment attempt")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "We could not start the assessment. Please try again." };
  }
}

export async function saveModule2Answer(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    choice: z.enum(["A", "B", "C", "D"]),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The answer was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to save your answer." };
  return saveOwnedAnswer(parsed.data.attemptId, userId, parsed.data.questionId, parsed.data);
}

export async function saveModule2CodeDraft(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    sourceCode: z.string().max(20_000),
    language: z.enum(["Python 3", "Java 17", "C++ 17", "C 11"]),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The code draft was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to save your code." };
  return saveOwnedCodeDraft(
    parsed.data.attemptId,
    userId,
    parsed.data.questionId,
    parsed.data.sourceCode,
    parsed.data.language,
  );
}

export async function saveModule2QuestionTime(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    seconds: z.number().int().min(1).max(30),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The question time update was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to save question timing." };
  return saveOwnedQuestionTime(parsed.data.attemptId, userId, parsed.data.questionId, parsed.data.seconds);
}

export async function toggleModule2Review(input) {
  const schema = z.object({ attemptId: z.string().uuid(), questionId: z.string().uuid() }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The question reference was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to update your assessment." };
  return toggleQuestionReview(parsed.data.attemptId, userId, parsed.data.questionId);
}

export async function submitModule2Attempt(input) {
  const schema = z.object({ attemptId: z.string().uuid() }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The assessment reference was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to submit your assessment." };
  const result = await finalizeAttempt(parsed.data.attemptId, userId);
  if (!result) return { success: false, error: "Assessment attempt not found." };
  return { success: true, status: result.status };
}

export async function getModule2AttemptStatus(input) {
  const schema = z.object({ attemptId: z.string().uuid() }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Assessment attempt not found." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to view the assessment." };
  const attempt = await getOwnedAttempt(parsed.data.attemptId, userId);
  if (!attempt) return { success: false, error: "Assessment attempt not found." };
  const serverNow = await getDatabaseServerTime();
  const violationRows = await db.$queryRaw`
    SELECT COUNT(*)::int AS "violationCount"
    FROM "Module2IntegrityEvent"
    WHERE "attemptId" = ${attempt.id}
      AND "eventType" IN (
        'TAB_HIDDEN', 'WINDOW_BLUR', 'FULLSCREEN_EXIT',
        'CLIPBOARD_COPY', 'CLIPBOARD_CUT', 'CLIPBOARD_PASTE', 'CONTEXT_MENU_ATTEMPT'
      )
      AND COALESCE("metadata"->>'deduplicated', 'false') <> 'true'
  `;
  return {
    success: true,
    status: attempt.status,
    deadlineAt: attempt.deadlineAt?.toISOString?.() || attempt.deadlineAt || null,
    serverNow: serverNow.toISOString(),
    violationCount: Number(violationRows[0]?.violationCount) || 0,
  };
}

export async function reportModule2IntegrityEvent(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    eventType: z.enum([
      "TAB_HIDDEN",
      "WINDOW_BLUR",
      "FULLSCREEN_EXIT",
      "FULLSCREEN_ENTER",
      "CLIPBOARD_COPY",
      "CLIPBOARD_CUT",
      "CLIPBOARD_PASTE",
      "CONTEXT_MENU_ATTEMPT",
      "CAMERA_ENABLED",
      "MICROPHONE_ENABLED",
      "CAMERA_DENIED",
      "CAMERA_DISCONNECTED",
      "MICROPHONE_DISCONNECTED",
      "UNSUPPORTED_CLIENT",
      "NETWORK_OFFLINE",
      "NETWORK_ONLINE",
      "INTERRUPTION_RECOVERED",
    ]),
    clientOccurredAt: z.string().datetime().optional(),
    warningShown: z.boolean(),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "The monitoring event was invalid." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to continue." };
  const requestHeaders = await headers();
  const eventType = isMobileAssessmentClient(requestHeaders.get("user-agent") || "")
    ? "UNSUPPORTED_CLIENT"
    : parsed.data.eventType;
  const result = await recordOwnedIntegrityEvent(parsed.data.attemptId, userId, {
    ...parsed.data,
    eventType,
    severity: classifyIntegrityEvent(eventType),
  });
  return result.success
    ? result
    : { success: false, error: "This assessment is no longer active." };
}

export async function runModule2Code(input) {
  const schema = z.object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    sourceCode: z.string().min(1).max(20_000),
    language: z.enum(["Python 3", "Java 17", "C++ 17", "C 11"]),
    mode: z.enum(["RUN", "SUBMIT"]),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Check the code and selected language, then try again." };
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to run code." };

  const claim = await claimCodingSubmission({
    ...parsed.data,
    clerkUserId: userId,
  });
  if (!claim.success) return claim;
  const cases = parsed.data.mode === "RUN" ? claim.question.publicTestCases : [
    ...claim.question.publicTestCases,
    ...claim.question.privateTestCases,
  ];

  try {
    const evaluation = await evaluateCode({
      code: parsed.data.sourceCode,
      language: parsed.data.language,
      testCases: cases,
      limits: {
        timeLimitSeconds: claim.question.timeLimitSeconds,
        memoryLimitMb: claim.question.memoryLimitMb,
      },
      revealOutputs: parsed.data.mode === "RUN",
    });
    const result = await completeCodingSubmission({
      submissionId: claim.submissionId,
      attemptId: parsed.data.attemptId,
      clerkUserId: userId,
      questionId: parsed.data.questionId,
      mode: parsed.data.mode,
      sourceCode: parsed.data.sourceCode,
      language: parsed.data.language,
      result: evaluation,
    });
    return result.success
      ? result
      : { success: false, error: result.error || "The attempt closed before code evaluation completed." };
  } catch (error) {
    await failCodingSubmission(claim.submissionId);
    console.error("Module 2 Judge0 request failed.", error?.message || "Unknown error");
    return {
      success: false,
      error: "The code execution service is unavailable or the run timed out. Your assessment remains open.",
    };
  }
}
