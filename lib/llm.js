import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiQuotaError, isGeminiUnavailableError } from "@/lib/gemini-errors";

const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-3.8-flash";

function parseJson(text) {
  const cleaned = String(text).replace(/```(?:json)?\n?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI returned invalid data. Please try again.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function generateJson(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Add it to your .env file.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const request = "Return only valid JSON. No markdown, no commentary.\n\n" + prompt;
  let result;

  try {
    result = await genAI.getGenerativeModel({ model: PRIMARY_MODEL }).generateContent(request);
  } catch (error) {
    if (
      (!isGeminiUnavailableError(error) && !isGeminiQuotaError(error)) ||
      PRIMARY_MODEL === FALLBACK_MODEL ||
      !process.env.GEMINI_API_RESUME_KEY
    ) {
      throw error;
    }

    console.warn(`${PRIMARY_MODEL} is unavailable or quota-limited; retrying with ${FALLBACK_MODEL}.`);
    const fallbackAI = new GoogleGenerativeAI(process.env.GEMINI_API_RESUME_KEY);
    result = await fallbackAI.getGenerativeModel({ model: FALLBACK_MODEL }).generateContent(request);
  }

  return parseJson(result.response.text());
}
