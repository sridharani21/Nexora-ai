export class AIProviderError extends Error {
  constructor(message, {
    code = "AI_PROVIDER_ERROR",
    category = "provider_error",
    provider = null,
    status = null,
    cause,
  } = {}) {
    super(message, { cause });
    this.name = "AIProviderError";
    this.code = code;
    this.category = category;
    this.provider = provider;
    this.status = status;
  }
}

export function classifyAIProviderError(error) {
  if (error instanceof AIProviderError) return error.category;
  if (error?.quotaExhausted) return "quota_exhausted";

  const status = Number(error?.status || error?.response?.status);
  const code = String(error?.code || error?.cause?.code || "").toUpperCase();
  const messages = [];
  const visited = new Set();
  let current = error;
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current.message) messages.push(String(current.message).toLowerCase());
    current = current.cause;
  }
  const message = messages.join(" ");

  if (status === 429) return "quota_or_rate_limit";
  if (status === 401 || status === 403) return "authentication";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 404) return "configuration";
  if ([500, 502, 503, 504].includes(status)) return "temporary";
  if (
    error?.name === "AbortError" ||
    code === "ABORT_ERR" ||
    /^(ECONN|ETIMEDOUT|ENET|EAI_)/.test(code) ||
    /abort(?:ed|ing)?|fetch failed|network|socket|timed out|timeout|connection/.test(message)
  ) {
    return "network";
  }
  return "provider_error";
}

export function toAIProviderError(error, provider) {
  if (error instanceof AIProviderError) return error;

  const category = classifyAIProviderError(error);
  const status = Number(error?.status || error?.response?.status) || null;
  const details = {
    provider,
    status,
    category,
    cause: error,
  };

  if (category === "authentication") {
    return new AIProviderError(
      `${provider} rejected its API key. Check GEMINI_API_KEY in the server environment.`,
      { ...details, code: "AI_PROVIDER_AUTH_FAILED" },
    );
  }
  if (category === "invalid_request") {
    return new AIProviderError(
      `The ${provider} provider rejected the request.`,
      { ...details, code: "AI_PROVIDER_REQUEST_FAILED" },
    );
  }
  if (category === "configuration") {
    return new AIProviderError(
      `The ${provider} provider rejected its model configuration.`,
      { ...details, code: "AI_PROVIDER_CONFIGURATION_ERROR" },
    );
  }
  if (category === "quota_or_rate_limit" || category === "temporary" || category === "network") {
    return new AIProviderError(
      `${provider} is temporarily unavailable or rate-limited.`,
      { ...details, code: "AI_PROVIDER_UNAVAILABLE" },
    );
  }
  return new AIProviderError(
    `${provider} could not complete the AI request.`,
    { ...details, code: "AI_PROVIDER_ERROR" },
  );
}

export function isAIProviderUnavailableError(error) {
  let current = error;
  const visited = new Set();
  while (current && !visited.has(current)) {
    if (
      current.code === "AI_PROVIDERS_UNAVAILABLE"
      || current.code === "AI_PROVIDER_RATE_LIMITED"
      || current.code === "AI_PROVIDER_QUOTA_EXHAUSTED"
      || current.code === "AI_PROVIDER_UNAVAILABLE"
      || current.code === "AI_NOT_CONFIGURED"
      || current.code === "AI_PROVIDER_AUTH_FAILED"
      || current.code === "AI_PROVIDER_CONFIGURATION_ERROR"
      || current.category === "quota_or_rate_limit"
      || current.category === "quota_exhausted"
      || current.category === "temporary"
      || current.category === "network"
    ) return true;
    visited.add(current);
    current = current.cause;
  }
  return false;
}
