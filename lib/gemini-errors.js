export function isGeminiQuotaError(error) {
  return (
    error?.status === 429 ||
    error?.statusText === "Too Many Requests" ||
    error?.errorDetails?.some((detail) =>
      String(detail?.["@type"] || "").includes("QuotaFailure")
    )
  );
}

export function isGeminiUnavailableError(error) {
  return error?.status === 503 || error?.statusText === "Service Unavailable";
}

export function getGeminiRetryAfterSeconds(error) {
  const retryInfo = error?.errorDetails?.find((detail) =>
    String(detail?.["@type"] || "").includes("RetryInfo")
  );
  const retryDelay = String(retryInfo?.retryDelay || "");
  const seconds = Number.parseInt(retryDelay.match(/\d+/)?.[0] || "", 10);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
}
