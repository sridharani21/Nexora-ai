import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { calculateAssessmentResult } from "./assessment-scoring.js";
import {
  canAnswerBeforeDeadline,
  integrityViolationLevel,
  integrityEventGroup,
  isDeadlineExpired,
  isImmediateIntegrityTermination,
} from "./assessment-policy.js";

export const ACTIVE_ATTEMPT_STATUSES = ["GENERATING", "ACTIVE"];
export { toStudentQuestion } from "./assessment-presentation.js";

export async function getDatabaseServerTime() {
  const rows = await db.$queryRaw`SELECT CURRENT_TIMESTAMP AS "serverNow"`;
  return rows[0].serverNow;
}

function jsonValue(value) {
  return JSON.stringify(value);
}

async function finalizeLockedAttempt(tx, attempt, completionReason, now) {
  const questions = attempt.questions;
  const answers = attempt.answers || {};
  const events = await tx.$queryRaw`
    SELECT "severity", "eventType" FROM "Module2IntegrityEvent"
    WHERE "attemptId" = ${attempt.id}
  `;
  const result = calculateAssessmentResult({
    blueprint: attempt.blueprint,
    questions,
    answers,
    completionReason,
    integrityEvents: events,
    questionTime: attempt.questionTime || {},
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    submittedAt: now,
  });
  const status = completionReason === "TIME_EXPIRED" ? "EXPIRED" : "SUBMITTED";
  await tx.$executeRaw`
    UPDATE "Module2Attempt"
    SET "status" = ${status}::"Module2AttemptStatus",
        "result" = ${jsonValue(result)}::jsonb,
        "completionReason" = ${completionReason},
        "submittedAt" = ${now},
        "cooldownUntil" = CASE
          WHEN ${completionReason} IN ('INTEGRITY_TERMINATION', 'MONITORING_INTERRUPTED')
          THEN ${new Date(now.getTime() + 10 * 60_000)}
          ELSE NULL
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${attempt.id}
  `;
  return { ...attempt, status, result, completionReason, submittedAt: now };
}

export async function getOwnedAttempt(attemptId, clerkUserId, { finalizeExpired = true } = {}) {
  const rows = await db.$queryRaw`
    SELECT a.*
    FROM "Module2Attempt" a
    JOIN "User" u ON u."id" = a."userId"
    WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
    LIMIT 1
  `;
  const attempt = rows[0];
  if (!attempt) return null;
  if (
    finalizeExpired
    && attempt.status === "ACTIVE"
    && attempt.deadlineAt
    && isDeadlineExpired(attempt.deadlineAt)
  ) {
    return finalizeAttempt(attempt.id, clerkUserId, "TIME_EXPIRED");
  }
  return attempt;
}

export async function finalizeAttempt(attemptId, clerkUserId, reason = "MANUAL_SUBMISSION") {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt) return null;
    if (attempt.status !== "ACTIVE") return attempt;
    const now = new Date();
    if (now.getTime() >= new Date(attempt.deadlineAt).getTime()) {
      return finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", now);
    }
    return finalizeLockedAttempt(tx, attempt, reason, now);
  });
}

export async function createGeneratingAttempt({ student, branch, blueprint, cameraConsent, leaderboardOptIn }) {
  const attemptId = randomUUID();
  const rows = await db.$queryRaw`
    INSERT INTO "Module2Attempt" (
      "id", "userId", "branch", "blueprintVersion", "blueprint", "status",
      "cameraConsent", "leaderboardOptIn", "createdAt", "updatedAt"
    )
    VALUES (
      ${attemptId}, ${student.id}, ${branch}, ${blueprint.version},
      ${jsonValue(blueprint)}::jsonb, 'GENERATING', ${cameraConsent}, ${leaderboardOptIn},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;
  return rows[0];
}

export async function activateGeneratedAttempt(attemptId, questions, durationSeconds) {
  const rows = await db.$queryRaw`
    UPDATE "Module2Attempt"
    SET "questions" = ${jsonValue(questions)}::jsonb,
        "status" = 'ACTIVE',
        "startedAt" = CURRENT_TIMESTAMP,
        "deadlineAt" = CURRENT_TIMESTAMP + (${durationSeconds} * INTERVAL '1 second'),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${attemptId} AND "status" = 'GENERATING'
    RETURNING *
  `;
  return rows[0] || null;
}

export async function failGeneratingAttempt(attemptId) {
  await db.$executeRaw`
    UPDATE "Module2Attempt"
    SET "status" = 'GENERATION_FAILED', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${attemptId} AND "status" = 'GENERATING'
  `;
}

export async function expireStaleGeneratingAttempt(userId) {
  await db.$executeRaw`
    UPDATE "Module2Attempt"
    SET "status" = 'GENERATION_FAILED', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId}
      AND "status" = 'GENERATING'
      AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
  `;
}

export async function getIntegrityCooldown(userId) {
  const rows = await db.$queryRaw`
    SELECT "cooldownUntil"
    FROM "Module2Attempt"
    WHERE "userId" = ${userId}
      AND "cooldownUntil" > CURRENT_TIMESTAMP
    ORDER BY "cooldownUntil" DESC
    LIMIT 1
  `;
  return rows[0]?.cooldownUntil || null;
}

export async function saveOwnedQuestionTime(attemptId, clerkUserId, questionId, seconds) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    if (!attempt.questions.some((question) => question.id === questionId)) {
      return { success: false, error: "Question not found in this attempt." };
    }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) {
      return { success: false, error: "The time update is invalid." };
    }
    const questionTime = { ...(attempt.questionTime || {}) };
    const currentTotal = Object.values(questionTime).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const maxSeconds = attempt.blueprint.durationSeconds || attempt.blueprint.durationMinutes * 60;
    if (currentTotal + seconds > maxSeconds) {
      return { success: false, error: "The time update exceeds the assessment duration." };
    }
    questionTime[questionId] = (Number(questionTime[questionId]) || 0) + seconds;
    await tx.$executeRaw`
      UPDATE "Module2Attempt"
      SET "questionTime" = ${jsonValue(questionTime)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attemptId} AND "status" = 'ACTIVE'
    `;
    return { success: true };
  });
}

export async function saveOwnedAnswer(attemptId, clerkUserId, questionId, answer) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt) return { success: false, error: "Assessment attempt not found." };
    if (attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    const now = Date.now();
    if (!canAnswerBeforeDeadline(attempt.deadlineAt, now)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    const question = attempt.questions.find((item) => item.id === questionId);
    if (!question) return { success: false, error: "Question not found in this attempt." };
    if (question.type !== "MCQ" || !question.options.some((option) => option.key === answer.choice)) {
      return { success: false, error: "Choose one of the available answers." };
    }

    const answers = { ...(attempt.answers || {}) };
    answers[questionId] = { ...(answers[questionId] || {}), choice: answer.choice };
    await tx.$executeRaw`
      UPDATE "Module2Attempt"
      SET "answers" = ${jsonValue(answers)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id} AND "status" = 'ACTIVE'
    `;
    return { success: true };
  });
}

export async function saveOwnedCodeDraft(attemptId, clerkUserId, questionId, sourceCode, language) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    const question = attempt.questions.find((item) => item.id === questionId && item.type === "CODING");
    if (!question || sourceCode.length > 20_000 || !question.supportedLanguages.includes(language)) {
      return { success: false, error: "The code draft is invalid." };
    }
    const answers = { ...(attempt.answers || {}) };
    answers[questionId] = {
      ...(answers[questionId] || {}),
      coding: {
        ...(answers[questionId]?.coding || {}),
        sourceCode,
        language,
      },
    };
    await tx.$executeRaw`
      UPDATE "Module2Attempt" SET "answers" = ${jsonValue(answers)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id} AND "status" = 'ACTIVE'
    `;
    return { success: true };
  });
}

export async function toggleQuestionReview(attemptId, clerkUserId, questionId) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    if (!attempt.questions.some((question) => question.id === questionId)) {
      return { success: false, error: "Question not found in this attempt." };
    }
    const answers = { ...(attempt.answers || {}) };
    answers[questionId] = { ...(answers[questionId] || {}), review: !answers[questionId]?.review };
    await tx.$executeRaw`
      UPDATE "Module2Attempt" SET "answers" = ${jsonValue(answers)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id} AND "status" = 'ACTIVE'
    `;
    return { success: true, review: answers[questionId].review };
  });
}

export async function saveCodingEvaluation(attemptId, clerkUserId, questionId, evaluation) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    const question = attempt.questions.find((item) => item.id === questionId && item.type === "CODING");
    if (!question) return { success: false, error: "Coding question not found in this attempt." };
    const answers = { ...(attempt.answers || {}) };
    answers[questionId] = {
      ...(answers[questionId] || {}),
      coding: {
        sourceCode: evaluation.sourceCode,
        language: evaluation.language,
        submitted: evaluation.submitted,
        passed: evaluation.passed,
        total: evaluation.total,
        status: evaluation.status,
        publicResults: evaluation.publicResults,
        evaluatedAt: new Date().toISOString(),
      },
    };
    await tx.$executeRaw`
      UPDATE "Module2Attempt" SET "answers" = ${jsonValue(answers)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attempt.id} AND "status" = 'ACTIVE'
    `;
    return { success: true };
  });
}

export async function claimCodingSubmission({ attemptId, clerkUserId, questionId, language, sourceCode, mode }) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    const question = attempt.questions.find((item) => item.id === questionId && item.type === "CODING");
    if (!question) return { success: false, error: "Coding question not found in this attempt." };
    if (!question.supportedLanguages.includes(language)) {
      return { success: false, error: "The selected language is not enabled for this challenge." };
    }

    const recent = await tx.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Module2CodingSubmission"
      WHERE "attemptId" = ${attemptId}
        AND "questionId" = ${questionId}
        AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '1 minute'
    `;
    if (recent[0].count >= 5) {
      return { success: false, error: "Too many code runs. Wait a minute before trying again." };
    }
    const total = await tx.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Module2CodingSubmission"
      WHERE "attemptId" = ${attemptId}
    `;
    if (total[0].count >= 30) {
      return { success: false, error: "This attempt has reached its code execution limit." };
    }

    const submissionId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "Module2CodingSubmission" (
        "id", "attemptId", "questionId", "language", "sourceCode",
        "mode", "status", "createdAt"
      ) VALUES (
        ${submissionId}, ${attemptId}, ${questionId}, ${language},
        ${sourceCode}, ${mode}, 'RUNNING', CURRENT_TIMESTAMP
      )
    `;
    return { success: true, submissionId, question };
  });
}

export async function completeCodingSubmission({
  submissionId,
  attemptId,
  clerkUserId,
  questionId,
  mode,
  sourceCode,
  language,
  result,
}) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = rows[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false, error: "This assessment is closed." };
    if (!canAnswerBeforeDeadline(attempt.deadlineAt)) {
      await finalizeLockedAttempt(tx, attempt, "TIME_EXPIRED", new Date());
      return { success: false, error: "The assessment deadline has passed." };
    }
    const evaluation = {
      passed: result.passed,
      total: result.total,
      status: result.status,
      ...(mode === "RUN" ? { publicResults: result.results } : {}),
    };
    await tx.$executeRaw`
      UPDATE "Module2CodingSubmission"
      SET "status" = ${result.status},
          "passed" = ${result.passed},
          "total" = ${result.total},
          "evaluation" = ${jsonValue(evaluation)}::jsonb
      WHERE "id" = ${submissionId} AND "attemptId" = ${attemptId}
    `;
    const answers = { ...(attempt.answers || {}) };
    const previous = answers[questionId]?.coding;
    answers[questionId] = {
      ...(answers[questionId] || {}),
      coding: {
        sourceCode,
        language,
        submitted: mode === "SUBMIT" ? true : Boolean(previous?.submitted),
        passed: mode === "SUBMIT" ? result.passed : previous?.passed || 0,
        total: mode === "SUBMIT" ? result.total : previous?.total || result.total,
        status: result.status,
        publicResults: mode === "RUN" ? result.results : undefined,
        evaluatedAt: new Date().toISOString(),
      },
    };
    await tx.$executeRaw`
      UPDATE "Module2Attempt"
      SET "answers" = ${jsonValue(answers)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${attemptId} AND "status" = 'ACTIVE'
    `;
    return {
      success: true,
      result: {
        status: result.status,
        passed: result.passed,
        total: result.total,
        results: mode === "RUN" ? result.results : undefined,
      },
    };
  });
}

export async function failCodingSubmission(submissionId) {
  await db.$executeRaw`
    UPDATE "Module2CodingSubmission"
    SET "status" = 'SERVICE_ERROR'
    WHERE "id" = ${submissionId} AND "status" = 'RUNNING'
  `;
}

export async function recordOwnedIntegrityEvent(attemptId, clerkUserId, input) {
  const eventId = randomUUID();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  return db.$transaction(async (tx) => {
    const attempts = await tx.$queryRaw`
      SELECT a.*
      FROM "Module2Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId} AND u."clerkUserId" = ${clerkUserId}
      FOR UPDATE OF a
    `;
    const attempt = attempts[0];
    if (!attempt || attempt.status !== "ACTIVE") return { success: false };

    const group = integrityEventGroup(input.eventType);
    let previous = [];
    if (group === "FOCUS") {
      previous = await tx.$queryRaw`
        SELECT MAX("createdAt") AS "latest"
        FROM "Module2IntegrityEvent"
        WHERE "attemptId" = ${attemptId}
          AND "eventType" IN ('TAB_HIDDEN', 'WINDOW_BLUR')
          AND COALESCE("metadata"->>'deduplicated', 'false') <> 'true'
      `;
    } else if (group === "CLIPBOARD") {
      previous = await tx.$queryRaw`
        SELECT MAX("createdAt") AS "latest"
        FROM "Module2IntegrityEvent"
        WHERE "attemptId" = ${attemptId}
          AND "eventType" IN ('CLIPBOARD_COPY', 'CLIPBOARD_CUT', 'CLIPBOARD_PASTE', 'CONTEXT_MENU_ATTEMPT')
          AND COALESCE("metadata"->>'deduplicated', 'false') <> 'true'
      `;
    } else if (group === "FULLSCREEN") {
      previous = await tx.$queryRaw`
        SELECT MAX("createdAt") AS "latest"
        FROM "Module2IntegrityEvent"
        WHERE "attemptId" = ${attemptId} AND "eventType" = 'FULLSCREEN_EXIT'
          AND COALESCE("metadata"->>'deduplicated', 'false') <> 'true'
      `;
    }

    const now = new Date();
    const latest = previous[0]?.latest;
    const deduplicated = Boolean(latest && now.getTime() - new Date(latest).getTime() < 5_000);
    const recordedIncidents = group ? await tx.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Module2IntegrityEvent"
      WHERE "attemptId" = ${attemptId}
        AND "eventType" IN (
          'TAB_HIDDEN', 'WINDOW_BLUR', 'FULLSCREEN_EXIT',
          'CLIPBOARD_COPY', 'CLIPBOARD_CUT', 'CLIPBOARD_PASTE', 'CONTEXT_MENU_ATTEMPT'
        )
        AND COALESCE("metadata"->>'deduplicated', 'false') <> 'true'
    ` : [];
    const violationCount = group
      ? (Number(recordedIncidents[0]?.count) || 0) + (deduplicated ? 0 : 1)
      : 0;
    const warningLevel = deduplicated ? null : integrityViolationLevel(violationCount);
    const warning = Boolean(warningLevel);
    const flaggedForReview = warningLevel === "REVIEW";
    const terminate = isImmediateIntegrityTermination(input.eventType);
    const metadata = JSON.stringify({
      ...(input.metadata || {}),
      deduplicated,
      violationCount,
      ...(warningLevel ? { warningLevel } : {}),
    });
    await tx.$executeRaw`
      INSERT INTO "Module2IntegrityEvent" (
        "id", "attemptId", "eventType", "severity", "clientOccurredAt",
        "warningShown", "metadata", "createdAt"
      ) VALUES (
        ${eventId}, ${attemptId}, ${input.eventType}, ${flaggedForReview ? "REVIEW" : input.severity},
        ${input.clientOccurredAt ? new Date(input.clientOccurredAt) : null},
        ${warning}, ${metadata}::jsonb, ${now}
      )
    `;
    if (input.eventType === "CAMERA_ENABLED" || input.eventType === "MICROPHONE_ENABLED") {
      await tx.$executeRaw`
        UPDATE "Module2Attempt"
        SET "cameraConsent" = true
        WHERE "id" = ${attemptId} AND "status" = 'ACTIVE'
      `;
    }
    if (terminate) {
      const completionReason = isImmediateIntegrityTermination(input.eventType)
        ? "MONITORING_INTERRUPTED"
        : "INTEGRITY_TERMINATION";
      await finalizeLockedAttempt(tx, attempt, completionReason, now);
    }
    return { success: true, warning, warningLevel, violationCount, flaggedForReview, ended: terminate };
  });
}

export async function getStudentAttemptList(clerkUserId) {
  return db.$queryRaw`
    SELECT a."id", a."branch", a."blueprintVersion", a."status", a."startedAt", a."submittedAt",
      a."deadlineAt", a."result"->>'score' AS "score", a."completionReason", a."cooldownUntil"
    FROM "Module2Attempt" a
    JOIN "User" u ON u."id" = a."userId"
    WHERE u."clerkUserId" = ${clerkUserId}
      AND a."status" IN ('ACTIVE', 'SUBMITTED', 'EXPIRED')
    ORDER BY a."createdAt" DESC
  `;
}

export async function getAttemptLeaderboard(attemptId, clerkUserId) {
  const rows = await db.$queryRaw`
    WITH target AS (
      SELECT a."userId", a."branch", a."blueprintVersion", a."leaderboardOptIn"
      FROM "Module2Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."id" = ${attemptId}
        AND u."clerkUserId" = ${clerkUserId}
        AND a."status" IN ('SUBMITTED', 'EXPIRED')
        AND a."leaderboardOptIn" = true
        AND a."result" IS NOT NULL
        AND COALESCE(a."completionReason", '') NOT IN ('INTEGRITY_TERMINATION', 'MONITORING_INTERRUPTED')
    ),
    eligible AS (
      SELECT a."id", a."userId", a."result", a."submittedAt"
      FROM "Module2Attempt" a
      CROSS JOIN target t
      WHERE a."branch" = t."branch"
        AND a."blueprintVersion" = t."blueprintVersion"
        AND a."status" IN ('SUBMITTED', 'EXPIRED')
        AND a."leaderboardOptIn" = true
        AND a."result" IS NOT NULL
        AND COALESCE(a."completionReason", '') NOT IN ('INTEGRITY_TERMINATION', 'MONITORING_INTERRUPTED')
    ),
    best_per_student AS (
      SELECT eligible.*,
        ROW_NUMBER() OVER (
          PARTITION BY "userId"
          ORDER BY
            ("result"->>'score')::numeric DESC,
            COALESCE(("result"->>'timeUsedSeconds')::integer, 2147483647) ASC,
            "submittedAt" ASC
        ) AS "studentAttempt"
      FROM eligible
    ),
    ranked AS (
      SELECT
        "id", "userId",
        ("result"->>'score')::numeric AS "score",
        COALESCE(("result"->>'timeUsedSeconds')::integer, 0) AS "timeUsedSeconds",
        ROW_NUMBER() OVER (
          ORDER BY
            ("result"->>'score')::numeric DESC,
            COALESCE(("result"->>'timeUsedSeconds')::integer, 2147483647) ASC,
            "submittedAt" ASC
        )::integer AS "rank",
        COUNT(*) OVER ()::integer AS "participantCount"
      FROM best_per_student
      WHERE "studentAttempt" = 1
    )
    SELECT ranked."rank", ranked."score", ranked."timeUsedSeconds",
      ranked."participantCount", (ranked."userId" = target."userId") AS "isYou"
    FROM ranked
    CROSS JOIN target
    WHERE ranked."rank" <= 10 OR ranked."userId" = target."userId"
    ORDER BY ranked."rank"
  `;
  return rows.map((row) => ({
    rank: Number(row.rank),
    score: Number(row.score),
    timeUsedSeconds: Number(row.timeUsedSeconds),
    participantCount: Number(row.participantCount),
    isYou: row.isYou,
  }));
}
