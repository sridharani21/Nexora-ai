// ==================================================================
// File: app/api/resumes/[id]/analyze/route.js
// Description: API route for ATS analysis (CLERK AUTH)
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { analyzeResumeATS } from "@/lib/ats-analyzer";

// POST - Analyze resume for ATS score
export async function POST(req, { params }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params; // ✅ await params

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { jobDescription } = body;

    const resume = await db.resume.findFirst({
      where: { id, userId: user.id }, // ✅ uses awaited id
      include: {
        experiences: { orderBy: { order: "asc" } },
        education: { orderBy: { order: "asc" } },
        skills: { orderBy: { order: "asc" } },
        projects: { orderBy: { order: "asc" } },
        certifications: { orderBy: { order: "asc" } },
      },
    });

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const analysis = await analyzeResumeATS(resume, jobDescription);

    const updatedResume = await db.resume.update({
      where: { id }, // ✅ uses awaited id
      data: {
        atsScore: analysis.overallScore,
        atsAnalysis: analysis,
        lastAnalyzedAt: new Date(),
      },
    });

    await db.aTSAnalysisHistory.create({
      data: {
        resumeId: id, // ✅ uses awaited id
        score: analysis.overallScore,
        analysis: analysis,
        recommendations: {
          recommendations: analysis.recommendations,
          keywordAnalysis: analysis.keywordAnalysis,
        },
      },
    });

    return NextResponse.json({ analysis, resume: updatedResume });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return NextResponse.json(
      { error: "Failed to analyze resume" },
      { status: 500 }
    );
  }
}

// GET - Fetch analysis history
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params; // ✅ await params

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resume = await db.resume.findFirst({
      where: { id, userId: user.id }, // ✅ uses awaited id
    });

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const history = await db.aTSAnalysisHistory.findMany({
      where: { resumeId: id }, // ✅ uses awaited id
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching analysis history:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis history" },
      { status: 500 }
    );
  }
}