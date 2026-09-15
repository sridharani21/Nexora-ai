import { GoogleGenerativeAI } from "@google/generative-ai";

const RESUME_MODEL = "gemini-3.8-flash";
const RESUME_FALLBACK_MODEL = "gemini-3-flash-preview";

function getResumeModel(modelName = RESUME_MODEL) {
  if (!process.env.GEMINI_API_RESUME_KEY) {
    throw new Error(
      "GEMINI_API_RESUME_KEY is missing. Add it to your environment configuration."
    );
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_RESUME_KEY);
  return genAI.getGenerativeModel({ model: modelName });
}

function parseJson(text) {
  const cleaned = String(text).replace(/```(?:json)?\n?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("AI returned invalid JSON. Please try again.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function generateResumeText(promptOrContents) {
  try {
    const result = await getResumeModel().generateContent(promptOrContents);
    return result.response.text().trim();
  } catch (error) {
    if (error?.status !== 503 || RESUME_MODEL === RESUME_FALLBACK_MODEL) {
      throw error;
    }

    console.warn(
      `${RESUME_MODEL} is temporarily unavailable; retrying with ${RESUME_FALLBACK_MODEL}.`
    );
    const fallbackResult = await getResumeModel(
      RESUME_FALLBACK_MODEL
    ).generateContent(promptOrContents);
    return fallbackResult.response.text().trim();
  }
}

export async function generateResumeJson(prompt) {
  const text = await generateResumeText(
    "Return only valid JSON. No markdown, no commentary.\n\n" + prompt
  );
  return parseJson(text);
}
