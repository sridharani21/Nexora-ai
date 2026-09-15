// ==================================================================
// Resume Upload & Analysis Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractText, getDocumentProxy } from "unpdf";
import { analyzeResumeATS } from "@/lib/ats-analyzer";
import { generateResumeText } from "@/lib/resume-llm";
import {
  getGeminiRetryAfterSeconds,
  isGeminiQuotaError,
  isGeminiUnavailableError,
} from "@/lib/gemini-errors";

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
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume");
    uploadedFile = file;
    const jobDescription = formData.get("jobDescription");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type;

    const extractedText = await generateResumeText([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64
        }
      },
      "Extract all text from this resume. Return ONLY the plain text content."
    ]);

    if (!extractedText) {
      return NextResponse.json({ error: "Failed to extract text" }, { status: 500 });
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

    const structureText = await generateResumeText(structurePrompt);
    
    const jsonMatch = structureText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to structure data" }, { status: 500 });
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    const analysis = await analyzeResumeATS(extractedData, jobDescription || "");

    return NextResponse.json({
      extractedData,
      analysis,
      rawText: extractedText.substring(0, 1000)
    });

  } catch (error) {
    console.error("Upload analysis error:", error);

    if (isGeminiQuotaError(error)) {
      if (uploadedFile?.type === "application/pdf") {
        const text = await extractPdfText(uploadedFile);
        return NextResponse.json({
          extractedData: { rawText: text.slice(0, 10000) },
          analysis: buildLocalAtsReport(
            text,
            typeof jobDescription === "string" ? jobDescription.toLowerCase() : ""
          ),
          notice:
            "AI quota is temporarily exhausted. This report was generated locally from your PDF.",
        });
      }
      const retryAfter = getGeminiRetryAfterSeconds(error);
      return NextResponse.json(
        {
          error: `Gemini is temporarily rate-limited. Please try again in about ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    if (isGeminiUnavailableError(error)) {
      const retryAfter = getGeminiRetryAfterSeconds(error);
      return NextResponse.json(
        {
          error:
            "The resume AI model is temporarily busy. Please try again in a moment.",
          retryAfter,
        },
        {
          status: 503,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    return NextResponse.json(
      { error: "Failed to process upload", details: error.message },
      { status: 500 }
    );
  }
}