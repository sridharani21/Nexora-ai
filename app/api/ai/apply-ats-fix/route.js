// ==================================================================
// Apply ATS Fix Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { generateResumeJson } from "@/lib/resume-llm";

const updatedResumeSchema = z.object({
  summary: z.string().optional(),
  experiences: z.array(z.object({
    position: z.string(),
    company: z.string(),
    description: z.array(z.string()),
  }).passthrough()).optional(),
  skills: z.array(z.record(z.string(), z.unknown())).optional(),
  education: z.array(z.record(z.string(), z.unknown())).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recommendation, resumeData, jobDescription } = body;

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

    const updatedData = await generateResumeJson(prompt, {
      operation: "resume-ats-fix",
      validateOutput: (output) => {
        const parsed = updatedResumeSchema.safeParse(output);
        return parsed.success ? parsed.data : false;
      },
    });

    return NextResponse.json({ updatedData });

  } catch (error) {
    console.error("ATS fix error.", { code: error?.code || null, name: error?.name || "Error" });
    return NextResponse.json(
      {
        error: error?.code === "AI_OUTPUT_INVALID"
          ? "The AI providers returned an invalid resume update. Please try again."
          : "Failed to apply fix.",
      },
      { status: error?.code === "AI_OUTPUT_INVALID" ? 502 : 500 },
    );
  }
}