// ==================================================================
// ATS Analyzer - Core Analysis Logic
// ==================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeResumeATS(resumeData, jobDescription = "") {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      overallScore: analysis.overallScore || 0,
      scores: analysis.scores || {},
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      recommendations: analysis.recommendations || [],
      keywordAnalysis: analysis.keywordAnalysis || { found: [], missing: [], suggestions: [] },
      sectionAnalysis: analysis.sectionAnalysis || {}
    };

  } catch (error) {
    console.error("ATS analysis error:", error);
    
    return {
      overallScore: 50,
      scores: {
        formatting: 50,
        keywords: 50,
        experience: 50,
        education: 50,
        skills: 50,
        clarity: 50
      },
      strengths: ["Resume structure is present"],
      weaknesses: ["Unable to complete full analysis"],
      recommendations: [
        {
          category: "General",
          issue: "Analysis temporarily unavailable",
          suggestion: "Please try again",
          priority: "low"
        }
      ],
      keywordAnalysis: {
        found: [],
        missing: [],
        suggestions: []
      },
      sectionAnalysis: {}
    };
  }
}

export async function generateImprovedContent(section, currentContent, recommendations = [], context = {}) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Improve this ${section} section.

CURRENT: ${currentContent}
RECOMMENDATIONS: ${recommendations.map(r => r.suggestion).join(", ")}
${context.jobDescription ? `JOB: ${context.jobDescription}` : ""}

Return ONLY the improved content.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Content improvement error:", error);
    return currentContent;
  }
}

export async function suggestKeywords(resumeData, jobDescription, targetRole = "") {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Suggest keywords for this resume.

CURRENT SKILLS: ${resumeData.skills?.map(s => s.name).join(", ")}
${jobDescription ? `JOB: ${jobDescription}` : ""}
${targetRole ? `ROLE: ${targetRole}` : ""}

Return JSON array: ["keyword1", "keyword2"]`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return [];
  } catch (error) {
    console.error("Keyword suggestion error:", error);
    return [];
  }
}

export async function improveBulletPoint(bulletPoint, context = {}) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Improve this bullet point:

CURRENT: ${bulletPoint}
${context.position ? `POSITION: ${context.position}` : ""}

Make it impactful and ATS-friendly. Return ONLY the improved bullet.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/^[•\-*]\s*/, "");
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