export async function generateJson(prompt, {
  operation,
  requestTimeoutMs,
  jsonMode,
  maxOutputTokens,
  maxRetries,
  validateOutput,
  deduplicate,
} = {}) {
  const { generateStructuredOutput } = await import("./ai/ai-provider.js");
  return generateStructuredOutput(prompt, {
    operation,
    requestTimeoutMs,
    jsonMode,
    maxOutputTokens,
    maxRetries,
    validateOutput,
    deduplicate,
  });
}
