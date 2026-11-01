import "server-only";
import { GoogleGenAI } from "@google/genai";
import {
  AI_GEMINI_MODEL,
  AI_REQUEST_TIMEOUT_MS,
  getGeminiKey,
} from "./ai-config.js";

function toGeminiContent(prompt) {
  if (typeof prompt === "string") return [{ type: "text", text: prompt }];
  if (!Array.isArray(prompt)) {
    throw new TypeError("Gemini requests must contain text or supported image content.");
  }

  return prompt.map((part) => {
    if (typeof part === "string") return { type: "text", text: part };
    if (part?.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
      return {
        type: "image",
        mime_type: part.inlineData.mimeType,
        data: part.inlineData.data,
      };
    }
    throw new TypeError("This request format is not supported by Gemini.");
  });
}

function toGeminiHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.flatMap((item) => {
    const isModel = item?.role === "model" || item?.role === "assistant";
    const content = Array.isArray(item?.parts)
      ? item.parts.map((part) => part?.text || "").join("\n")
      : item?.content;
    return typeof content === "string" && content.trim()
      ? [{
        type: isModel ? "model_output" : "user_input",
        content: [{ type: "text", text: content }],
      }]
      : [];
  });
}

function extractText(steps) {
  return (Array.isArray(steps) ? steps : [])
    .filter((step) => step?.type === "model_output")
    .flatMap((step) => Array.isArray(step.content) ? step.content : [])
    .filter((content) => content?.type === "text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n");
}

export async function generateWithGemini({
  prompt,
  systemPrompt,
  history,
  requestTimeoutMs = AI_REQUEST_TIMEOUT_MS,
  jsonMode = false,
  maxOutputTokens,
}) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const client = new GoogleGenAI({ apiKey });
  const input = [
    ...toGeminiHistory(history),
    { type: "user_input", content: toGeminiContent(prompt) },
  ];

  try {
    const interaction = await client.interactions.create({
      model: AI_GEMINI_MODEL,
      input,
      ...(systemPrompt ? { system_instruction: systemPrompt } : {}),
      ...(jsonMode ? { response_format: { type: "text", mime_type: "application/json" } } : {}),
      ...(maxOutputTokens ? { generation_config: { max_output_tokens: maxOutputTokens } } : {}),
    }, {
      timeout_ms: requestTimeoutMs,
      retries: { strategy: "none" },
    });
    const text = interaction.output_text || extractText(interaction.steps);
    if (!text.trim()) throw new Error("Gemini returned an empty response.");
    return { text, model: interaction.model || AI_GEMINI_MODEL };
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      Number(error?.status) === 429
      && (/quota|billing|free tier|daily.*limit|limit:\s*\d+\s+requests?\s+per day|requests?\s+per day/.test(message))
    ) {
      error.quotaExhausted = true;
      error.retryableRateLimit = false;
    }
    throw error;
  }
}
