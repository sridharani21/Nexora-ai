import assert from "node:assert/strict";
import test from "node:test";
import { runGeminiDiagnostic } from "./gemini-diagnostic.js";

test("reports a missing key without making a provider request", async () => {
  let called = false;
  const result = await runGeminiDiagnostic({
    apiKey: "",
    request: async () => { called = true; },
  });
  assert.deepEqual(result, { success: false, category: "missing_api_key" });
  assert.equal(called, false);
});

test("accepts a validated provider response and rejects malformed output", async () => {
  assert.deepEqual(await runGeminiDiagnostic({
    apiKey: "test-only",
    request: async () => ({ status: "ok" }),
  }), { success: true });
  assert.deepEqual(await runGeminiDiagnostic({
    apiKey: "test-only",
    request: async () => ({ status: "unexpected" }),
  }), { success: false, category: "unexpected_response" });
});

test("classifies credential, quota, and network failures without returning error details", async () => {
  for (const [error, category] of [
    [{ status: 403, message: "private error content" }, "invalid_credentials"],
    [{ status: 429 }, "rate_limited"],
    [{ code: "ECONNRESET" }, "network_failure"],
    [{ status: 503 }, "provider_unavailable"],
  ]) {
    const result = await runGeminiDiagnostic({
      apiKey: "test-only",
      request: async () => { throw error; },
    });
    assert.deepEqual(result, { success: false, category });
    assert.equal(JSON.stringify(result).includes("private error content"), false);
  }
});

test("distinguishes exhausted Gemini quota from a temporary rate limit", async () => {
  const result = await runGeminiDiagnostic({
    apiKey: "test-only",
    request: async () => {
      throw Object.assign(new Error(
        "You exceeded your current quota. Check your plan and billing details.",
      ), { status: 429 });
    },
  });
  assert.deepEqual(result, { success: false, category: "quota_exhausted" });
});
