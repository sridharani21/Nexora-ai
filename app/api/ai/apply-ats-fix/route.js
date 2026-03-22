// ==================================================================
// Apply ATS Fix Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recommendation, resumeData, jobDescription } = body;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `You are an ATS optimization expert. Fix this issue.

ISSUE: ${recommendation.issue}
CATEGORY: ${recommendation.category}
SUGGESTION: ${recommendation.suggestion}

CURRENT RESUME DATA:
${JSON.stringify({
  summary: resumeData.summary,
  experiences: resumeData.experiences?.map(e => ({
    position: e.position,
    company: e.company,
    description: e.description
  })),
  skills: resumeData.skills,
  education: resumeData.education,
}, null, 2)}

${jobDescription ? `TARGET JOB:\n${jobDescription}\n` : ""}

Return a JSON object with the fields that need updating. For example:
- If fixing "Summary" → return { "summary": "new summary text" }
- If fixing "Experience" → return { "experiences": [updated array] }
- If fixing "Skills" → return { "skills": [updated array] }

Return ONLY valid JSON, no markdown:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const updatedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ updatedData });

  } catch (error) {
    console.error("ATS fix error:", error);
    return NextResponse.json(
      { error: "Failed to apply fix", details: error.message },
      { status: 500 }
    );
  }
}