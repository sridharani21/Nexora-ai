export const AI_REQUEST_TIMEOUT_MS = 60_000;
export const AI_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
export const AI_MAX_RETRIES = 1;
export const AI_RETRY_DELAYS_MS = [1_000];

export function getGeminiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

export function hasAIProviderConfigured() {
  return Boolean(getGeminiKey());
}
