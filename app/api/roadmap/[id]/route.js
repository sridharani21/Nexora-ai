// app/api/roadmap/[id]/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getRoadmapProgress, updateRoadmapTask } from "@/lib/learning-roadmap.js";
import { z } from "zod";

const taskUpdateSchema = z.object({
  taskId: z.string().regex(/^\d{1,2}:\d{1,2}:\d{1,2}$/),
  completed: z.boolean(),
}).strict();

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const roadmap = await db.roadmap.findFirst({
      where: { id, userId: user.id },
    });
    if (!roadmap) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ roadmap });
  } catch (err) {
    console.error("Get roadmap error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.roadmap.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete roadmap error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Learning task update is invalid." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await db.$transaction(async (tx) => {
      const owned = await tx.$queryRaw`
        SELECT "id" FROM "Roadmap"
        WHERE "id" = ${id} AND "userId" = ${user.id}
        FOR UPDATE
      `;
      if (!owned[0]) return null;
      const roadmap = await tx.roadmap.findFirst({
        where: { id, userId: user.id },
        select: { data: true },
      });
      if (!roadmap) return null;
      const result = updateRoadmapTask(roadmap.data, parsed.data.taskId, parsed.data.completed);
      if (!result.success) return { error: result.error };
      const saved = await tx.roadmap.update({
        where: { id },
        data: { data: result.roadmap },
        select: { data: true },
      });
      return { data: saved.data };
    });
    if (!updated) return NextResponse.json({ error: "Roadmap not found." }, { status: 404 });
    if (updated.error) return NextResponse.json({ error: updated.error }, { status: 409 });
    return NextResponse.json({
      roadmap: updated.data,
      progress: getRoadmapProgress(updated.data),
    });
  } catch (error) {
    console.error("Update roadmap task error:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to update learning progress." }, { status: 500 });
  }
}