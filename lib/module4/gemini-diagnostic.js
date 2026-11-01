import { z } from "zod";
import { generateJson } from "../llm.js";

const diagnosticResponseSchema = z.object({ status: z.literal("ok") }).strict();

function classifyFailure(error) {
  const causes = [];
  const visited = new Set();
  let current = error;
  while (current && !visited.has(current)) {
    visited.add(current);
    causes.push(current);
    current = current.cause;
  }
  const status = causes
    .map((cause) => Number(cause?.status || cause?.response?.status))
    .find(Number.isFinite);
  const message = causes.map((cause) => String(cause?.message || "").toLowerCase()).join(" ");
  const code = causes.map((cause) => String(cause?.code || "").toUpperCase()).join(" ");

  if (status === 401 || status === 403 || /invalid api key|unauthorized|permission denied/.test(message)) {
    return "invalid_credentials";
  }
  if (
    status === 429
    && /insufficient_quota|quota|billing/.test(message)
  ) {
    return "quota_exhausted";
  }
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  if (
    /^(ECONN|ETIMEDOUT|ENET|EAI_)/.test(code) ||
    error?.name === "TypeError" ||
    /fetch failed|network|socket|timed out|timeout|connection/.test(message)
  ) {
    return "network_failure";
  }
  return "unexpected_response";
}

export async function runGeminiDiagnostic({
  apiKey = process.env.GEMINI_API_KEY,
  request = generateJson,
} = {}) {
  if (!apiKey) return { success: false, category: "missing_api_key" };

  try {
    const response = await request(
      'Return exactly this JSON object: {"status":"ok"}. Do not include any other text.',
      { operation: "gemini-diagnostic" },
    );
    if (!diagnosticResponseSchema.safeParse(response).success) {
      return { success: false, category: "unexpected_response" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, category: classifyFailure(error) };
  }
}
