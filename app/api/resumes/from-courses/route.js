// ==================================================================
// File: app/api/resumes/from-courses/route.js
// Description: Generate resume from courses (CLERK AUTH)
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { triggerResumeFromCourses } from "@/lib/inngest-helpers";

// POST - Generate resume from course recommendation
export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user in database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { courseRecommendationId } = body;

    if (!courseRecommendationId) {
      return NextResponse.json(
        { error: "courseRecommendationId is required" },
        { status: 400 }
      );
    }

    // Verify the course recommendation belongs to the user
    const courseRec = await db.courseRecommendation.findFirst({
      where: {
        id: courseRecommendationId,
        userId: user.id,
      },
    });

    if (!courseRec) {
      return NextResponse.json(
        { error: "Course recommendation not found" },
        { status: 404 }
      );
    }

    // Trigger Inngest function to generate resume
    await triggerResumeFromCourses(user.id, courseRecommendationId);

    return NextResponse.json({
      message: "Resume generation started",
      status: "processing",
    });
  } catch (error) {
    console.error("Error generating resume from courses:", error);
    return NextResponse.json(
      { error: "Failed to generate resume" },
      { status: 500 }
    );
  }
}

// GET - Get resume generated from course recommendation
export async function GET(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user in database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const courseRecommendationId = searchParams.get("courseRecommendationId");

    if (!courseRecommendationId) {
      return NextResponse.json(
        { error: "courseRecommendationId is required" },
        { status: 400 }
      );
    }

    // Get the course recommendation to find the domain
    const courseRec = await db.courseRecommendation.findFirst({
      where: {
        id: courseRecommendationId,
        userId: user.id,
      },
    });

    if (!courseRec) {
      return NextResponse.json(
        { error: "Course recommendation not found" },
        { status: 404 }
      );
    }

    // Find resume created from this course recommendation
    const resume = await db.resume.findFirst({
      where: {
        userId: user.id,
        title: {
          contains: courseRec.domain,
        },
      },
      include: {
        experiences: true,
        education: true,
        skills: true,
        projects: true,
        certifications: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!resume) {
      return NextResponse.json(
        { 
          error: "Resume not generated yet",
          status: "processing" 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Error fetching generated resume:", error);
    return NextResponse.json(
      { error: "Failed to fetch resume" },
      { status: 500 }
    );
  }
}
