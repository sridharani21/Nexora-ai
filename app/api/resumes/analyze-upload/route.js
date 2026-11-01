// ==================================================================
// Resume Upload & Analysis Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { analyzeResumeATS } from "@/lib/ats-analyzer";
import { generateResumeJson, generateResumeText } from "@/lib/resume-llm";
import { isAIProviderUnavailableError } from "@/lib/ai/ai-errors.js";

const resumeDataSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  linkedin: z.string(),
  portfolio: z.string(),
  github: z.string(),
  summary: z.string(),
  experiences: z.array(z.object({
    position: z.string(),
    company: z.string(),
    location: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    current: z.boolean(),
    description: z.array(z.string()),
  }).strict()),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    gpa: z.string(),
  }).strict()),
  skills: z.array(z.object({
    category: z.string(),
    name: z.string(),
    level: z.string(),
  }).strict()),
}).strict();

async function extractPdfText(file) {
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const result = await extractText(pdf, { mergePages: true });
  if (typeof result === "string") return result;
  if (Array.isArray(result?.text)) return result.text.join("\n");
  return result?.text || "";
}

function buildLocalAtsReport(text, jobDescription = "") {
  const normalizedText = text.toLowerCase();
  const keywords = jobDescription.match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const uniqueKeywords = [...new Set(keywords)].slice(0, 30);
  const found = uniqueKeywords.filter((keyword) => normalizedText.includes(keyword));
  const missing = uniqueKeywords.filter((keyword) => !normalizedText.includes(keyword));
  const sections = [
    ["contact information", /@|phone|linkedin/],
    ["experience", /experience|employment|work history/],
    ["education", /education|university|degree|college/],
    ["skills", /skills|technical skills|technologies/],
  ];
  const strengths = sections
    .filter(([, pattern]) => pattern.test(normalizedText))
    .map(([name]) => `${name} section detected`);
  const recommendations = [
    ...sections
      .filter(([, pattern]) => !pattern.test(normalizedText))
      .map(([name]) => `Add a clear ${name} section`),
    ...(missing.length ? [`Add relevant keywords: ${missing.slice(0, 8).join(", ")}`] : []),
  ];
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (strengths.length / sections.length) * 75 +
          (found.length / Math.max(uniqueKeywords.length, 1)) * 25
      )
    )
  );

  return {
    overallScore: score,
    scores: {
      formatting: score,
      keywords: uniqueKeywords.length
        ? Math.round((found.length / uniqueKeywords.length) * 100)
        : 50,
    },
    strengths,
    weaknesses: recommendations,
    recommendations: recommendations.map((suggestion) => ({
      category: "General",
      issue: suggestion,
      suggestion,
      priority: "medium",
    })),
    keywordAnalysis: { found, missing, suggestions: missing },
    sectionAnalysis: {},
    source: "local",
  };
}

export async function POST(req) {
  let uploadedFile;
  let jobDescription = "";
  let extractedText = "";
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume");
    uploadedFile = file;
    const rawJobDescription = formData.get("jobDescription");
    jobDescription = typeof rawJobDescription === "string" ? rawJobDescription : "";

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mimeType = file.type;

    if (mimeType === "application/pdf") {
      extractedText = await extractPdfText(file);
    } else if (mimeType.startsWith("image/")) {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      extractedText = await generateResumeText([
        { inlineData: { mimeType, data: base64 } },
        "Extract all text from this resume image. Return ONLY the plain text content.",
      ]);
    } else {
      return NextResponse.json({ error: "Upload a PDF resume or a supported image." }, { status: 415 });
    }

    extractedText = extractedText.replace(/\u0000/g, "").trim().slice(0, 30_000);
    if (extractedText.length < 30) {
      return NextResponse.json({ error: "No readable text was found. Scanned PDFs aren't supported; use a text-based PDF or image." }, { status: 422 });
    }

    const structurePrompt = `Extract structured data from this resume text.

RESUME TEXT:
${extractedText}

Return ONLY a JSON object with this structure:
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin": "string",
  "portfolio": "string",
  "github": "string",
  "summary": "string",
  "experiences": [
    {
      "position": "string",
      "company": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "current": boolean,
      "description": ["bullet 1", "bullet 2"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string"
    }
  ],
  "skills": [
    {
      "category": "Technical Skills",
      "name": "skill1, skill2",
      "level": ""
    }
  ]
}

Return ONLY valid JSON.`;

    const extractedData = await generateResumeJson(structurePrompt, {
      operation: "resume-upload-structure-extraction",
      validateOutput: (output) => {
        const parsed = resumeDataSchema.safeParse(output);
        return parsed.success ? parsed.data : false;
      },
    });
    const analysis = await analyzeResumeATS(extractedData, jobDescription);

    return NextResponse.json({
      extractedData,
      analysis,
      rawText: extractedText.substring(0, 1000),
    });

  } catch (error) {
    console.error("Upload analysis error.", {
      code: error?.code || null,
      status: error?.status || null,
      name: error?.name || "Error",
    });

    if (uploadedFile?.type === "application/pdf" && extractedText.length >= 30 && isAIProviderUnavailableError(error)) {
      const text = extractedText;
      return NextResponse.json({
        extractedData: { rawText: text.slice(0, 10000) },
        analysis: buildLocalAtsReport(text, jobDescription),
        notice: error?.code === "AI_NOT_CONFIGURED"
          ? "Gemini is not configured. This report was generated locally from your PDF."
          : "Gemini is temporarily unavailable. This report was generated locally from your PDF.",
      });
    }
    if (isAIProviderUnavailableError(error)) {
      return NextResponse.json(
        { error: "Gemini is temporarily unavailable or rate-limited. Please try again shortly." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error?.code === "AI_OUTPUT_INVALID"
        ? "The resume couldn't be reliably structured. Please try again or enter details manually."
        : "Failed to process upload." },
      { status: error?.code === "AI_OUTPUT_INVALID" ? 502 : 500 },
    );
  }
}