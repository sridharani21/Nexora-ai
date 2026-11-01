// app/api/roadmap/save/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentCareerGoalForHandoff, hasCompleteCareerGoalHandoff } from "@/lib/module4/career-store.js";
import { getModule4Readiness } from "@/lib/module4/recommendation-engine.js";
import { loadModule4StudentEvidence } from "@/lib/module4/student-evidence.js";

const roadmapSaveSchema = z.object({
  career: z.string().trim().min(1).max(120),
  careerId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  months: z.number().int().min(1).max(12),
  roadmap: z.object({
    months: z.array(z.object({
      month: z.number().int().min(1).max(12),
      title: z.string().trim().min(1).max(100),
      weeks: z.array(z.object({
        week: z.number().int().min(1).max(4),
        topics: z.array(z.string().trim().min(1).max(160)).min(2).max(3),
      }).strict()).length(4),
    }).strict()).min(1).max(12),
  }).strict(),
}).strict().refine(hasCompleteCareerGoalHandoff, {
  message: "A career and its current goal must be supplied together.",
});

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = roadmapSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Career or roadmap data is invalid." }, { status: 400 });
    }
    let { career, months, roadmap } = parsed.data;
    let savedData = {
      ...roadmap,
      version: 1,
      generatedAt: new Date().toISOString(),
      completedTasks: [],
    };
    if (roadmap.months.length !== months || roadmap.months.some((month, index) => (
      month.month !== index + 1 || month.weeks.some((week, weekIndex) => week.week !== weekIndex + 1)
    ))) {
      return NextResponse.json({ error: "Roadmap month and week numbers must match the selected duration." }, { status: 400 });
    }

    // Find the DB user by clerkUserId
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (parsed.data.careerId && parsed.data.goalId) {
      const goals = await getCurrentCareerGoalForHandoff(db, {
        userId: user.id,
        careerId: parsed.data.careerId,
        goalId: parsed.data.goalId,
      });
      if (!goals[0]) {
        return NextResponse.json({ error: "This career goal is no longer current or does not belong to your account." }, { status: 403 });
      }
      const readiness = getModule4Readiness(await loadModule4StudentEvidence());
      if (!readiness.eligible) {
        return NextResponse.json({
          error: `Complete ${readiness.missing.map((item) => item.label).join(", ")} before saving a personalized learning plan.`,
          prerequisites: readiness.missing,
        }, { status: 403 });
      }
      career = goals[0].title;
      const learningResources = Array.isArray(goals[0].learningResources)
        ? goals[0].learningResources.filter((resource) => (
          typeof resource?.title === "string" &&
          typeof resource?.url === "string" &&
          resource.url.startsWith("https://")
        ))
        : [];
      savedData = {
        ...savedData,
        careerId: parsed.data.careerId,
        goalId: parsed.data.goalId,
        skillEvidence: Array.isArray(goals[0].skillEvidence) ? goals[0].skillEvidence : [],
        careerSkills: Array.isArray(goals[0].careerSkills) ? goals[0].careerSkills : [],
        competencyProgression: goals[0].competencyProgression || {},
        learningResources,
        completedTasks: [],
      };
    }

    const saved = await db.roadmap.create({
      data: {
        userId: user.id,
        career,
        months,
        data: savedData,
        title: `${career} — ${months} Month${months > 1 ? "s" : ""} Plan`,
      },
    });

    return NextResponse.json({ roadmap: saved });
  } catch (err) {
    console.error("Save roadmap error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}