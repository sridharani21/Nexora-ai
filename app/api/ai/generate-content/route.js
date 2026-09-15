// ==================================================================
// AI Content Generation Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateResumeText } from "@/lib/resume-llm";

export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { field, resumeData, jobDescription, position, company } = body;

    let prompt = "";

    if (field === "summary") {
      prompt = `You are a professional resume writer. Generate a compelling professional summary.

Resume Data:
Name: ${resumeData.fullName}
Email: ${resumeData.email}
Experience: ${resumeData.experiences?.map(e => `${e.position} at ${e.company}`).join(", ") || "Entry level"}
Skills: ${resumeData.skills?.map(s => s.name).join(", ") || "Various skills"}
${jobDescription ? `\nTarget Job:\n${jobDescription}` : ""}

Requirements:
- 3-4 sentences
- Highlight key achievements and skills
- Professional tone
- ATS-optimized keywords

Return ONLY the summary text, no explanations.`;

    } else if (field.startsWith("exp-")) {
      prompt = `Generate impactful bullet points for this work experience.

Position: ${position}
Company: ${company}
${jobDescription ? `Target Job:\n${jobDescription}` : ""}

Requirements:
- 4-5 bullet points
- Start with strong action verbs
- Include quantifiable achievements
- ATS-optimized keywords

Return ONLY bullet points (one per line with • prefix):`;

    } else {
      return NextResponse.json({ error: "Invalid field type" }, { status: 400 });
    }

    let content = await generateResumeText(prompt);
    
    content = content.replace(/```/g, "").replace(/\*\*/g, "");

    return NextResponse.json({ content });

  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate content", details: error.message },
      { status: 500 }
    );
  }
}