import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { findOwnedPlan, findOwnedTask } from "@/lib/module5/owned-records.js";
import {
  buildTopicQuestions,
  gradeTopicAnswers,
  MODULE5_ASSESSMENT_VERSION,
  summarizeAssessment,
  validateTopicAnswers,
} from "@/lib/module5/preparation-plan.js";

const assessmentRequestSchema = z.object({
  planId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
}).strict().refine(({ taskId, weekNumber }) => Boolean(taskId) !== Number.isInteger(weekNumber), {
  message: "Provide either a task ID for a daily test or a week number for a weekly assessment.",
});
const submissionSchema = assessmentRequestSchema.extend({
  submissionKey: z.string().uuid(),
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
});

function publicQuestions(questions) {
  return questions.map(({ correctAnswer: _answer, explanation: _explanation, ...question }) => question);
}

async function getAssessmentContext(dbClient, userId, request) {
  if (request.taskId) {
    const task = await findOwnedTask(dbClient, userId, request.taskId, {
      planId: request.planId,
      include: {
        plan: {
          include: {
            career: { select: { title: true } },
          },
        },
      },
    });
    if (!task) return { error: "Learning task not found.", status: 404 };
    if (task.plan.status === "archived") return { error: "This plan version is archived and can no longer accept assessment attempts.", status: 409 };
    if (!["studied", "completed"].includes(task.status)) {
      return { error: "Mark this learning topic as studied before taking its topic check.", status: 409 };
    }
    return {
      kind: "daily",
      task,
      plan: task.plan,
      weekNumber: task.weekNumber,
      questions: buildTopicQuestions({ career: task.plan.career.title, skill: task.skill }),
    };
  }

  const plan = await findOwnedPlan(dbClient, userId, request.planId, {
    include: { career: { select: { title: true } } },
  });
  if (!plan) return { error: "Preparation plan not found.", status: 404 };
  if (plan.status === "archived") return { error: "This plan version is archived and can no longer accept assessment attempts.", status: 409 };
  const tasks = await dbClient.careerPreparationTask.findMany({
    where: { planId: plan.id, userId, weekNumber: request.weekNumber },
    orderBy: { dayNumber: "asc" },
  });
  if (!tasks.length) return { error: "No learning tasks are scheduled for this week.", status: 404 };
  if (tasks.some((task) => task.status !== "completed")) {
    return { error: "Complete the scheduled topic checks for this week before starting its weekly assessment.", status: 409 };
  }
  const skills = [...new Set(tasks.map((task) => task.skill))];
  const questions = Array.from({ length: Math.min(10, Math.max(5, skills.length * 2)) }, (_, index) => {
    const skill = skills[index % skills.length];
    const question = buildTopicQuestions({ career: plan.career.title, skill, limit: 5 })[index % 5];
    return { ...question, id: `week-${request.weekNumber}-q-${index + 1}` };
  });
  return { kind: "weekly", plan, tasks, weekNumber: request.weekNumber, questions };
}

function publicAttempt(attempt) {
  return {
    id: attempt.id,
    kind: attempt.kind,
    weekNumber: attempt.weekNumber,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
    feedback: attempt.feedback,
  };
}

export async function GET(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to take an assessment." }, { status: 401 });
    const parsed = assessmentRequestSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Assessment request is invalid." }, { status: 400 });
    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    const context = await getAssessmentContext(db, user.id, {
      ...parsed.data,
      weekNumber: parsed.data.weekNumber === undefined ? undefined : Number(parsed.data.weekNumber),
    });
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
    const attempts = await db.careerPreparationAttempt.findMany({
      where: {
        planId: context.plan.id,
        userId: user.id,
        kind: context.kind,
        ...(context.task ? { taskId: context.task.id } : { weekNumber: context.weekNumber }),
      },
      orderBy: { submittedAt: "desc" },
      take: 5,
    });
    return NextResponse.json({
      assessment: {
        kind: context.kind,
        planId: context.plan.id,
        taskId: context.task?.id || null,
        weekNumber: context.weekNumber,
        career: context.plan.career.title,
        version: MODULE5_ASSESSMENT_VERSION,
        passThreshold: 70,
        questions: publicQuestions(context.questions),
      },
      recentAttempts: attempts.map(summarizeAssessment),
    });
  } catch (error) {
    console.error("Career preparation assessment load failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to load this assessment." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to submit an assessment." }, { status: 401 });
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
    }
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Assessment submission is invalid." }, { status: 400 });
    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

    const duplicate = await db.careerPreparationAttempt.findUnique({
      where: { submissionKey: parsed.data.submissionKey },
    });
    if (duplicate) {
      if (
        duplicate.userId !== user.id ||
        duplicate.planId !== parsed.data.planId ||
        duplicate.kind !== (parsed.data.taskId ? "daily" : "weekly") ||
        (parsed.data.taskId
          ? duplicate.taskId !== parsed.data.taskId
          : duplicate.taskId !== null || duplicate.weekNumber !== parsed.data.weekNumber)
      ) {
        return NextResponse.json({ error: "Submission key is already used." }, { status: 409 });
      }
      return NextResponse.json({ result: publicAttempt(duplicate) });
    }

    const context = await getAssessmentContext(db, user.id, {
      ...parsed.data,
      weekNumber: parsed.data.weekNumber === undefined ? undefined : Number(parsed.data.weekNumber),
    });
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
    if (!validateTopicAnswers(context.questions, parsed.data.answers)) {
      return NextResponse.json({ error: "Answer every assessment question once using one of its listed options." }, { status: 400 });
    }
    const grade = gradeTopicAnswers(context.questions, parsed.data.answers);

    let attempt;
    try {
      attempt = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "CareerPreparationPlan"
        WHERE "id" = ${context.plan.id} AND "userId" = ${user.id}
        FOR UPDATE
      `;
      const existing = await tx.careerPreparationAttempt.findUnique({
        where: { submissionKey: parsed.data.submissionKey },
      });
      if (existing) return existing;
      const count = await tx.careerPreparationAttempt.count({
        where: {
          planId: context.plan.id,
          userId: user.id,
          kind: context.kind,
          ...(context.task ? { taskId: context.task.id } : { weekNumber: context.weekNumber }),
        },
      });
      const created = await tx.careerPreparationAttempt.create({
        data: {
          submissionKey: parsed.data.submissionKey,
          planId: context.plan.id,
          userId: user.id,
          taskId: context.task?.id || null,
          kind: context.kind,
          weekNumber: context.weekNumber,
          attemptNumber: count + 1,
          questionSnapshot: context.questions,
          answers: parsed.data.answers,
          score: grade.score,
          passed: grade.passed,
          feedback: grade,
        },
      });
      if (context.task) {
        await tx.careerPreparationTask.update({
          where: { id: context.task.id },
          data: { status: "completed", completedAt: new Date() },
        });
        const remaining = await tx.careerPreparationTask.count({
          where: { planId: context.plan.id, userId: user.id, status: { not: "completed" } },
        });
        if (remaining === 0) {
          await tx.careerPreparationPlan.update({
            where: { id: context.plan.id },
            data: { status: "completed" },
          });
        }
      }
      return created;
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const existing = await db.careerPreparationAttempt.findUnique({
        where: { submissionKey: parsed.data.submissionKey },
      });
      if (!existing) throw error;
      attempt = existing;
    }
    const sameSubmission = attempt.userId === user.id &&
      attempt.planId === parsed.data.planId &&
      attempt.kind === context.kind &&
      attempt.taskId === (context.task?.id || null) &&
      attempt.weekNumber === context.weekNumber;
    if (!sameSubmission) return NextResponse.json({ error: "Submission key is already used." }, { status: 409 });
    return NextResponse.json({ result: publicAttempt(attempt), feedback: attempt.feedback }, { status: 201 });
  } catch (error) {
    console.error("Career preparation assessment submission failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to submit this assessment." }, { status: 500 });
  }
}
