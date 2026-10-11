import { GoogleGenerativeAI } from "@google/generative-ai";

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
    if (error?.status !== 503 || PRIMARY_MODEL === FALLBACK_MODEL) throw error;

    console.warn(`${PRIMARY_MODEL} is temporarily unavailable; retrying with ${FALLBACK_MODEL}.`);
    result = await genAI.getGenerativeModel({ model: FALLBACK_MODEL }).generateContent(request);
  }

  return parseJson(result.response.text());
}
