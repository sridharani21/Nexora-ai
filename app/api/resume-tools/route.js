import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { generateResumeJson } from "@/lib/resume-llm";
import { isAIProviderUnavailableError } from "@/lib/ai/ai-errors.js";

const resumeToolSchemas = {
  optimizer: z.object({
    score: z.number().min(0).max(100),
    keywords: z.array(z.string()),
    missingSkills: z.array(z.string()),
    weakSections: z.array(z.string()),
    relevantExperience: z.array(z.string()),
    recommendations: z.array(z.string()),
    optimizedSummary: z.string(),
    improvedBullets: z.array(z.string()),
  }).strict(),
  matcher: z.object({
    matches: z.array(z.object({
      title: z.string().min(1),
      company: z.string().min(1),
      matchPercent: z.number().min(0).max(100),
      matchedSkills: z.array(z.string()),
      missingSkills: z.array(z.string()),
      reason: z.string(),
      nextStep: z.string(),
    }).strict()).max(5),
  }).strict(),
  company: z.object({
    name: z.string(),
    overview: z.string(),
    industry: z.string(),
    products: z.array(z.string()),
    commonRoles: z.array(z.string()),
    requiredSkills: z.array(z.string()),
    interviewTips: z.array(z.string()),
    preparationPlan: z.array(z.string()),
  }).strict(),
};

async function getUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return db.user.findUnique({
    where: { clerkUserId: userId },
    include: { resumes: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tool, jobDescription = "", companyName = "", resumeText = "" } =
      await request.json();
    const savedResume = user.resumes[0];
    const profile = resumeText || JSON.stringify({
      name: savedResume?.fullName || user.name,
      summary: savedResume?.summary || user.bio,
      skills: savedResume?.skills?.map((skill) => skill.name),
      experience: savedResume?.experiences?.map((experience) => ({
        position: experience.position,
        company: experience.company,
        description: experience.description,
      })),
    });

    const prompts = {
      optimizer: `Analyze this resume against the target job and return JSON with keys:
score (number 0-100), keywords (string[]), missingSkills (string[]),
weakSections (string[]), relevantExperience (string[]), recommendations (string[]),
optimizedSummary (string), improvedBullets (string[]).
RESUME: ${profile}
JOB DESCRIPTION: ${jobDescription}`,
      matcher: `Match this candidate to the target role/job context and return JSON with keys:
matches (array of objects with title, company, matchPercent, matchedSkills, missingSkills, reason, nextStep).
Return at most 5 realistic matches and never invent a specific live posting URL.
CANDIDATE: ${profile}
TARGET ROLE OR JOB DESCRIPTION: ${jobDescription}`,
      company: `Research the company named below using your general knowledge and return JSON with keys:
name, overview, industry, products (string[]), commonRoles (string[]),
requiredSkills (string[]), interviewTips (string[]), preparationPlan (string[]).
If uncertain, say so in the relevant value instead of inventing facts.
COMPANY: ${companyName}`,
    };

    if (!prompts[tool]) {
      return NextResponse.json({ error: "Invalid resume tool" }, { status: 400 });
    }

    const result = await generateResumeJson(prompts[tool], {
      operation: `resume-tool-${tool}`,
      validateOutput: (output) => {
        const parsed = resumeToolSchemas[tool].safeParse(output);
        return parsed.success ? parsed.data : false;
      },
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Resume tool error.", { code: error?.code || null, name: error?.name || "Error" });
    const unavailable = isAIProviderUnavailableError(error);
    const invalidOutput = error?.code === "AI_OUTPUT_INVALID";
    const status = unavailable ? 503 : invalidOutput ? 502 : 500;
    return NextResponse.json(
      {
        error: unavailable
          ? "Gemini is temporarily unavailable or rate-limited. Please try again later."
          : invalidOutput
            ? "The AI providers returned an invalid response. Please try again."
            : "Unable to complete this request.",
      },
      { status },
    );
  }
}
