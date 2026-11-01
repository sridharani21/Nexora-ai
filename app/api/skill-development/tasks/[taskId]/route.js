import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { findOwnedTask } from "@/lib/module5/owned-records.js";

const taskStatusSchema = z.object({
  status: z.enum(["started", "studied"]),
}).strict();

function publicTask(task) {
  return {
    ...task,
    scheduledDate: task.scheduledDate.toISOString().slice(0, 10),
    plan: {
      id: task.plan.id,
      careerId: task.plan.careerId,
      goalId: task.plan.goalId,
      career: task.plan.career.title,
      version: task.plan.version,
      weeks: task.plan.weeks,
      skillLevel: task.plan.skillLevel,
      learningPreference: task.plan.learningPreference,
    },
  };
}

export async function GET(_request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to access this learning task." }, { status: 401 });
    const { taskId } = await params;
    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Learning task not found." }, { status: 404 });
    const task = await findOwnedTask(db, user.id, taskId, {
      include: {
        plan: { include: { career: { select: { title: true } } } },
      },
      });
    if (!task) return NextResponse.json({ error: "Learning task not found." }, { status: 404 });
    return NextResponse.json({ task: publicTask(task) });
  } catch (error) {
    console.error("Career preparation task load failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to load this learning task." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to update learning progress." }, { status: 401 });
    const { taskId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
    }
    const parsed = taskStatusSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Learning status is invalid." }, { status: 400 });
    const user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Learning task not found." }, { status: 404 });

    const task = await db.$transaction(async (tx) => {
      const current = await findOwnedTask(tx, user.id, taskId, {
        select: { id: true, status: true, planId: true, plan: { select: { status: true } } },
      });
      if (!current) return null;
      if (current.plan.status === "archived") return { conflict: "This plan version is archived and can no longer be changed." };
      if (current.status === "completed") return { conflict: "This learning task has already been completed with its topic check." };
      const nextStatus = current.status === "studied" && parsed.data.status === "started"
        ? "studied"
        : parsed.data.status;
      const updated = await tx.careerPreparationTask.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          ...(current.status === "pending" ? { startedAt: new Date() } : {}),
        },
        include: { plan: { include: { career: { select: { title: true } } } } },
      });
      return updated;
    });
    if (!task) return NextResponse.json({ error: "Learning task not found." }, { status: 404 });
    if (task.conflict) return NextResponse.json({ error: task.conflict }, { status: 409 });
    return NextResponse.json({ task: publicTask(task) });
  } catch (error) {
    console.error("Career preparation task update failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to update learning progress." }, { status: 500 });
  }
}
