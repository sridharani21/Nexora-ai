import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { findOwnedPlan } from "@/lib/module5/owned-records.js";
import {
  analyzeCareerSkills,
  buildPreparationTasks,
  buildWeeklyGoals,
  ensureTaskResources,
  preparationSetupSchema,
} from "@/lib/module5/preparation-plan.js";

const planRequestSchema = preparationSetupSchema;

function publicPlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    careerId: plan.careerId,
    goalId: plan.goalId,
    career: plan.career?.title || plan.careerTitle || "",
    version: plan.version,
    weeks: plan.weeks,
    dailyHours: plan.dailyHours,
    studyDays: plan.studyDays,
    startDate: plan.startDate.toISOString().slice(0, 10),
    skillLevel: plan.skillLevel,
    learningPreference: plan.learningPreference,
    skillAnalysis: plan.skillAnalysis,
    weeklyGoals: plan.weeklyGoals,
    sourceSnapshot: plan.sourceSnapshot,
    status: plan.status,
    createdAt: plan.createdAt,
    tasks: (plan.tasks || []).map((task) => ({
      id: task.id,
      weekNumber: task.weekNumber,
      dayNumber: task.dayNumber,
      scheduledDate: task.scheduledDate.toISOString().slice(0, 10),
      skill: task.skill,
      title: task.title,
      description: task.description,
      objectives: task.objectives,
      durationMinutes: task.durationMinutes,
      activity: task.activity,
      completionCriteria: task.completionCriteria,
      resources: ensureTaskResources(task.resources, task.skill, plan.learningPreference),
      status: task.status,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    })),
    attempts: (plan.attempts || []).map((attempt) => ({
      id: attempt.id,
      taskId: attempt.taskId,
      kind: attempt.kind,
      weekNumber: attempt.weekNumber,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      feedback: attempt.feedback,
    })),
  };
}

export async function GET(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to access career preparation." }, { status: 401 });
    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ goal: null, plan: null });

    const goal = await db.module4CareerGoal.findFirst({
      where: { userId: user.id, isCurrent: true },
      orderBy: { selectedAt: "desc" },
      include: { career: { select: { id: true, title: true, slug: true } } },
    });
    const planId = new URL(request.url).searchParams.get("planId");
    const setupDefaults = goal
      ? { skillLevel: "beginner", learningPreference: "mixed" }
      : null;
    const plan = planId
      ? await findOwnedPlan(db, user.id, planId, {
        include: {
          career: { select: { title: true } },
          tasks: { orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }] },
          attempts: { orderBy: { submittedAt: "desc" } },
        },
      })
      : goal ? await db.careerPreparationPlan.findFirst({
        where: { userId: user.id, goalId: goal.id, status: "active" },
        orderBy: { version: "desc" },
        include: {
          career: { select: { title: true } },
          tasks: { orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }] },
          attempts: { orderBy: { submittedAt: "desc" } },
        },
      }) : null;
    const versions = await db.careerPreparationPlan.findMany({
      where: { userId: user.id },
      orderBy: { version: "desc" },
      take: 20,
      select: {
        id: true,
        careerId: true,
        goalId: true,
        version: true,
        weeks: true,
        status: true,
        createdAt: true,
        career: { select: { title: true } },
      },
    });

    return NextResponse.json({
      goal: goal ? {
        id: goal.id,
        careerId: goal.careerId,
        title: goal.career.title,
        slug: goal.career.slug,
        isCurrent: goal.isCurrent,
      } : null,
      setupDefaults,
      versions: versions.map((version) => ({
        ...version,
        career: version.career.title,
      })),
      plan: publicPlan(plan),
    });
  } catch (error) {
    console.error("Career preparation load failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to load career preparation." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to create a preparation plan." }, { status: 401 });
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
    }
    const parsed = planRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Review the preparation settings and try again." }, { status: 400 });

    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Student account not found." }, { status: 404 });
    const goal = await db.module4CareerGoal.findFirst({
      where: {
        id: parsed.data.goalId,
        careerId: parsed.data.careerId,
        userId: user.id,
        isCurrent: true,
      },
      include: {
        career: { include: { skillRequirements: true } },
      },
    });
    if (!goal) return NextResponse.json({ error: "Select a current career in the career explorer before creating this plan." }, { status: 403 });

    const skillAnalysis = analyzeCareerSkills(
      goal.career.skillRequirements.map((skill) => ({
        name: skill.skillName,
        category: skill.category,
        importance: skill.importance,
      })),
      goal.skillEvidence,
    );
    const learningResources = Array.isArray(goal.career.learningResources)
      ? goal.career.learningResources.filter((resource) => (
        typeof resource?.title === "string" &&
        typeof resource?.url === "string" &&
        resource.url.startsWith("https://")
      ))
      : [];
    const tasks = buildPreparationTasks({
      ...parsed.data,
      career: goal.career.title,
      skillAnalysis,
      learningResources,
    });
    const weeklyGoals = buildWeeklyGoals(tasks, {
      skillLevel: parsed.data.skillLevel,
      competencyProgression: goal.career.competencyProgression,
    });
    const plan = await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      const latest = await tx.careerPreparationPlan.aggregate({
        where: { userId: user.id },
        _max: { version: true },
      });
      const version = (latest._max.version || 0) + 1;
      await tx.careerPreparationPlan.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "archived" },
      });
      const createdPlan = await tx.careerPreparationPlan.create({
        data: {
          userId: user.id,
          careerId: goal.careerId,
          goalId: goal.id,
          version,
          weeks: parsed.data.weeks,
          dailyHours: parsed.data.dailyHours,
          studyDays: parsed.data.studyDays,
          startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`),
          skillLevel: parsed.data.skillLevel,
          learningPreference: parsed.data.learningPreference,
          skillAnalysis,
          weeklyGoals,
          sourceSnapshot: {
            careerGoalSelectedAt: goal.selectedAt.toISOString(),
            evidenceSnapshot: goal.skillEvidence,
            careerSkillRequirements: goal.career.skillRequirements,
            competencyProgression: goal.career.competencyProgression,
            learningResources,
          },
        },
      });
      const insertedTasks = await tx.careerPreparationTask.createMany({
        data: tasks.map((task) => ({
          ...task,
          planId: createdPlan.id,
          userId: user.id,
        })),
      });
      if (insertedTasks.count !== tasks.length) {
        throw new Error("Preparation plan tasks were not all persisted.");
      }
      return tx.careerPreparationPlan.findUniqueOrThrow({
        where: { id: createdPlan.id },
        include: {
          career: { select: { title: true } },
          tasks: { orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }] },
        },
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    return NextResponse.json({ plan: publicPlan(plan) }, { status: 201 });
  } catch (error) {
    console.error("Career preparation plan creation failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to create the preparation plan." }, { status: 500 });
  }
}
