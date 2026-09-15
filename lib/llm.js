import { GoogleGenerativeAI } from "@google/generative-ai";

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
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(
    "Return only valid JSON. No markdown, no commentary.\n\n" + prompt
  );
  return parseJson(result.response.text());
}
