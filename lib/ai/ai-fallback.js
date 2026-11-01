import {
  AI_MAX_RETRIES,
  AI_GEMINI_MODEL,
  AI_RETRY_DELAYS_MS,
} from "./ai-config.js";
import { AIProviderError, classifyAIProviderError, toAIProviderError } from "./ai-errors.js";

const inFlightRequests = new Map();

export function deduplicateInFlight(key, request) {
  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const pending = Promise.resolve().then(request);
  inFlightRequests.set(key, pending);
  pending.then(
    () => {
      if (inFlightRequests.get(key) === pending) inFlightRequests.delete(key);
    },
    () => {
      if (inFlightRequests.get(key) === pending) inFlightRequests.delete(key);
    },
  );
  return pending;
}

async function defaultSleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function recordUsage({ operation, durationMs, model }) {
  console.info("AI provider request completed.", {
    operation,
    provider: "gemini",
    model: model || AI_GEMINI_MODEL,
    durationMs,
  });
}

function recordFailure({ operation, durationMs, model, category, attempt, retryAfterMs }) {
  console.warn("AI provider request failed.", {
    operation,
    provider: "gemini",
    model: model || AI_GEMINI_MODEL,
    category,
    attempt,
    ...(Number.isFinite(retryAfterMs) ? { retryAfterMs } : {}),
    durationMs,
  });
}

export async function runWithAIProviderRetries({
  operation = "text-generation",
  invoke,
  transform = (value) => value,
  maxRetries = AI_MAX_RETRIES,
  retryDelaysMs = AI_RETRY_DELAYS_MS,
  sleep = defaultSleep,
  onUsage = recordUsage,
  onFailure = recordFailure,
}) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new AIProviderError(
      "Gemini is not configured. Set GEMINI_API_KEY on the server.",
      { code: "AI_NOT_CONFIGURED", category: "configuration" },
    );
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();
    try {
      const output = await invoke();
      const value = await transform(output);
      onUsage({
        operation,
        provider: "gemini",
        model: output?.model || AI_GEMINI_MODEL,
        durationMs: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      const category = classifyAIProviderError(error);
      const normalized = toAIProviderError(error, "Gemini");
      lastError = normalized;
      onFailure({
        operation,
        model: error?.model || AI_GEMINI_MODEL,
        category,
        attempt: attempt + 1,
        retryAfterMs: error?.retryAfterMs,
        durationMs: Date.now() - startedAt,
      });

      if (category === "invalid_request" || category === "authentication" || category === "configuration") {
        throw normalized;
      }

      if (attempt < maxRetries) {
        if (error?.retryableRateLimit === false) break;
        const retryAfterMs = error?.retryAfterMs;
        const delay = Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)] || 0;
        if (delay <= 5_000) {
          await sleep(delay);
          continue;
        }
      }
      break;
    }
  }

  if (lastError?.code === "AI_OUTPUT_INVALID") throw lastError;
  if (lastError?.cause?.quotaExhausted) {
    throw new AIProviderError(
      "Gemini's daily or project quota is exhausted. Wait for the limit to reset or check Google AI Studio's rate limits and billing.",
      {
        code: "AI_PROVIDER_QUOTA_EXHAUSTED",
        category: "quota_exhausted",
        provider: "Gemini",
        status: lastError.status,
        cause: lastError,
      },
    );
  }
  throw new AIProviderError(
    lastError?.category === "quota_or_rate_limit"
      ? "Gemini is rate-limited. Please wait and try again."
      : "Gemini is temporarily unavailable. Please try again shortly.",
    {
      code: lastError?.category === "quota_or_rate_limit"
        ? "AI_PROVIDER_RATE_LIMITED"
        : "AI_PROVIDERS_UNAVAILABLE",
      category: lastError?.category || "provider_error",
      provider: "Gemini",
      status: lastError?.status || null,
      cause: lastError,
    },
  );
}
