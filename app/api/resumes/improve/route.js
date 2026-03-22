// ==================================================================
// File: app/api/resumes/improve/route.js
// Description: Content improvement API (CLERK AUTH)
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  generateImprovedContent,
  improveBulletPoint,
  suggestKeywords,
} from "@/lib/ats-analyzer";

// POST - Get content improvement suggestions
export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, content, recommendations, context } = body;

    let improvedContent;

    switch (type) {
      case "summary":
      case "experience":
      case "education":
        improvedContent = await generateImprovedContent(
          type,
          content,
          recommendations || [],
          context
        );
        break;

      case "bullet":
        improvedContent = await improveBulletPoint(content, context);
        break;

      case "keywords":
        improvedContent = await suggestKeywords(
          context.resumeData,
          context.jobDescription,
          context.targetRole
        );
        break;

      default:
        return NextResponse.json(
          { error: "Invalid improvement type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      original: content,
      improved: improvedContent,
      type,
    });
  } catch (error) {
    console.error("Error improving content:", error);
    return NextResponse.json(
      { error: "Failed to improve content" },
      { status: 500 }
    );
  }
}