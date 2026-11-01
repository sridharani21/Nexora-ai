import "server-only";
import { createHash } from "node:crypto";
import {
  AI_GEMINI_MODEL,
  AI_REQUEST_TIMEOUT_MS,
} from "./ai-config.js";
import { AIProviderError } from "./ai-errors.js";
import { deduplicateInFlight, runWithAIProviderRetries } from "./ai-fallback.js";
import { generateWithGemini } from "./gemini-provider.js";

function parseJson(text) {
  const cleaned = String(text).replace(/```(?:json)?\s*/gi, "").trim();
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const start = objectStart === -1
    ? arrayStart
    : arrayStart === -1
      ? objectStart
      : Math.min(objectStart, arrayStart);
  const end = start === objectStart
    ? cleaned.lastIndexOf("}")
    : cleaned.lastIndexOf("]");

  if (start < 0 || end < start) {
    throw new AIProviderError("An AI provider returned malformed structured output.", {
      code: "AI_OUTPUT_INVALID",
      category: "invalid_output",
    });
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw new AIProviderError("An AI provider returned malformed structured output.", {
      code: "AI_OUTPUT_INVALID",
      category: "invalid_output",
      cause: error,
    });
  }
}

export async function generateText(prompt, {
  operation = "text-generation",
  systemPrompt,
  history,
  requestTimeoutMs = AI_REQUEST_TIMEOUT_MS,
} = {}) {
  const timeout = Math.min(requestTimeoutMs, AI_REQUEST_TIMEOUT_MS);
  return runWithAIProviderRetries({
    operation,
    invoke: () => generateWithGemini({
      prompt,
      systemPrompt,
      history,
      requestTimeoutMs: timeout,
    }),
    transform: (output) => output.text,
  });
}

export async function generateStructuredOutput(prompt, {
  operation = "structured-generation",
  requestTimeoutMs = AI_REQUEST_TIMEOUT_MS,
  jsonMode = true,
  maxOutputTokens,
  maxRetries,
  validateOutput,
  deduplicate = false,
} = {}) {
  const timeout = Math.min(requestTimeoutMs, AI_REQUEST_TIMEOUT_MS);
  const request = `Return only valid JSON. No markdown, no commentary.\n\n${prompt}`;
  const generate = () => runWithAIProviderRetries({
    operation,
    ...(Number.isInteger(maxRetries) && maxRetries >= 0 ? { maxRetries } : {}),
    invoke: () => generateWithGemini({
      prompt: request,
      requestTimeoutMs: timeout,
      maxOutputTokens,
      jsonMode,
    }),
    transform: async ({ text }) => {
      const output = parseJson(text);
      if (!validateOutput) return output;
      let validated;
      try {
        validated = await validateOutput(output);
      } catch (error) {
        throw new AIProviderError(
          `The AI response did not match the required format${error?.message ? `: ${String(error.message).slice(0, 300)}` : "."}`,
          {
            code: "AI_OUTPUT_INVALID",
            category: "invalid_output",
            cause: error,
          },
        );
      }
      if (validated === false) {
        throw new AIProviderError("The AI response did not match the required format.", {
          code: "AI_OUTPUT_INVALID",
          category: "invalid_output",
        });
      }
      return validated === true || validated === undefined ? output : validated;
    },
  });
  if (!deduplicate) return generate();

  const key = createHash("sha256")
    .update(JSON.stringify({ operation, request, jsonMode, maxOutputTokens, model: AI_GEMINI_MODEL }))
    .digest("hex");
  return deduplicateInFlight(key, generate);
}
