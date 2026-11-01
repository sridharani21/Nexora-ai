// ==================================================================
// ATS Analyzer - Core Analysis Logic
// ==================================================================

import { z } from "zod";
import { generateResumeJson, generateResumeText } from "@/lib/resume-llm";

const resumeAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  scores: z.object({
    formatting: z.number().min(0).max(100),
    keywords: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    education: z.number().min(0).max(100),
    skills: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
  }).strict(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.object({
    category: z.string(),
    issue: z.string(),
    suggestion: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  }).strict()),
  keywordAnalysis: z.object({
    found: z.array(z.string()),
    missing: z.array(z.string()),
    suggestions: z.array(z.string()),
  }).strict(),
  sectionAnalysis: z.object({
    summary: z.string(),
    experience: z.string(),
    skills: z.string(),
    education: z.string(),
  }).strict(),
}).strict();

export async function analyzeResumeATS(resumeData, jobDescription = "") {
  const prompt = `You are an ATS expert. Analyze this resume.

RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ""}

Return a JSON object:
{
  "overallScore": number (0-100),
  "scores": {
    "formatting": number (0-100),
    "keywords": number (0-100),
    "experience": number (0-100),
    "education": number (0-100),
    "skills": number (0-100),
    "clarity": number (0-100)
  },
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": [
    {
      "category": "Summary|Experience|Skills|Keywords",
      "issue": "description",
      "suggestion": "fix suggestion",
      "priority": "high|medium|low"
    }
  ],
  "keywordAnalysis": {
    "found": ["keyword1"],
    "missing": ["missing1"],
    "suggestions": ["suggest1"]
  },
  "sectionAnalysis": {
    "summary": "analysis",
    "experience": "analysis",
    "skills": "analysis",
    "education": "analysis"
  }
}

Return ONLY valid JSON.`;

  try {
    return await generateResumeJson(prompt, {
      operation: "resume-ats-analysis",
      validateOutput: (output) => {
        const parsed = resumeAnalysisSchema.safeParse(output);
        return parsed.success ? parsed.data : false;
      },
    });

  } catch (error) {
    console.error("ATS analysis error.", { code: error?.code || null, name: error?.name || "Error" });
    throw error;
  }
}

export async function generateImprovedContent(section, currentContent, recommendations = [], context = {}) {
  const prompt = `Improve this ${section} section.

CURRENT: ${currentContent}
RECOMMENDATIONS: ${recommendations.map(r => r.suggestion).join(", ")}
${context.jobDescription ? `JOB: ${context.jobDescription}` : ""}

Return ONLY the improved content.`;

  try {
    return await generateResumeText(prompt);
  } catch (error) {
    console.error("Content improvement error:", error);
    return currentContent;
  }
}

export async function suggestKeywords(resumeData, jobDescription, targetRole = "") {
  const prompt = `Suggest keywords for this resume.

CURRENT SKILLS: ${resumeData.skills?.map(s => s.name).join(", ")}
${jobDescription ? `JOB: ${jobDescription}` : ""}
${targetRole ? `ROLE: ${targetRole}` : ""}

Return JSON array: ["keyword1", "keyword2"]`;

  try {
    return await generateResumeJson(prompt, {
      operation: "resume-keyword-suggestions",
      jsonMode: false,
      validateOutput: (output) => {
        const parsed = z.array(z.string().trim().min(1)).safeParse(output);
        return parsed.success ? parsed.data : false;
      },
    });
  } catch (error) {
    console.error("Keyword suggestion error:", error);
    return [];
  }
}

export async function improveBulletPoint(bulletPoint, context = {}) {
  const prompt = `Improve this bullet point:

CURRENT: ${bulletPoint}
${context.position ? `POSITION: ${context.position}` : ""}

Make it impactful and ATS-friendly. Return ONLY the improved bullet.`;

  try {
    return (await generateResumeText(prompt)).replace(/^[•\-*]\s*/, "");
  } catch (error) {
    return bulletPoint;
  }
}

export function calculateATSScore(resumeData) {
  let score = 0;
  let total = 0;

  const requiredFields = ["fullName", "email", "phone"];
  requiredFields.forEach(field => {
    total += 10;
    if (resumeData[field]) score += 10;
  });

  const sections = ["summary", "experiences", "education", "skills"];
  sections.forEach(section => {
    total += 15;
    const data = resumeData[section];
    if (Array.isArray(data) ? data.length > 0 : data) {
      score += 15;
    }
  });

  if (Array.isArray(resumeData.experiences) && resumeData.experiences.length > 0) {
    total += 20;
    const exp = resumeData.experiences[0];
    if (exp.description && Array.isArray(exp.description) && exp.description.length >= 3) {
      score += 20;
    } else {
      score += 10;
    }
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
}