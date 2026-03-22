// ==================================================================
// Resume Upload & Analysis Route
// ==================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeResumeATS } from "@/lib/ats-analyzer";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume");
    const jobDescription = formData.get("jobDescription");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type;

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const extractResult = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64
        }
      },
      "Extract all text from this resume. Return ONLY the plain text content."
    ]);
    
    const extractedText = extractResult.response.text();

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

    const structureResult = await model.generateContent(structurePrompt);
    const structureText = structureResult.response.text();
    
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
    return NextResponse.json(
      { error: "Failed to process upload", details: error.message },
      { status: 500 }
    );
  }
}