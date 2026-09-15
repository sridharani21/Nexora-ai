import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { generateResumeJson } from "@/lib/resume-llm";
import {
  getGeminiRetryAfterSeconds,
  isGeminiQuotaError,
  isGeminiUnavailableError,
} from "@/lib/gemini-errors";

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

    const result = await generateResumeJson(prompts[tool]);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Resume tool error:", error);
    const isQuotaError = isGeminiQuotaError(error);
    const isUnavailableError = isGeminiUnavailableError(error);
    const status = isQuotaError ? 429 : isUnavailableError ? 503 : 500;
    const retryAfter = getGeminiRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error: isQuotaError
          ? "AI quota is temporarily exhausted. Please try again later."
          : isUnavailableError
            ? "The resume AI model is temporarily busy. Please try again in a moment."
            : "Unable to complete this request.",
        ...(status !== 500 ? { retryAfter } : {}),
      },
      {
        status,
        ...(status !== 500
          ? { headers: { "Retry-After": String(retryAfter) } }
          : {}),
      }
    );
  }
}
