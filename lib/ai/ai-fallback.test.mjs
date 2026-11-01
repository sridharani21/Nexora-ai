import assert from "node:assert/strict";
import test from "node:test";
import {
  deduplicateInFlight,
  runWithAIProviderRetries,
} from "./ai-fallback.js";
import { AIProviderError, classifyAIProviderError } from "./ai-errors.js";

const quiet = () => {};

async function withGeminiKey(value, run) {
  const previous = process.env.GEMINI_API_KEY;
  if (value === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
}

test("records Gemini usage and its actual model", async () => {
  await withGeminiKey("test-key", async () => {
    const usage = [];
    const result = await runWithAIProviderRetries({
      invoke: async () => ({ text: "Gemini response", model: "gemini-test-model" }),
      transform: (output) => output.text,
      onUsage: (entry) => usage.push(entry),
      onFailure: quiet,
    });
    assert.equal(result, "Gemini response");
    assert.equal(usage[0].model, "gemini-test-model");
    assert.equal(usage[0].provider, "gemini");
  });
});

test("retries a transient rate limit once when its retry delay is short", async () => {
  await withGeminiKey("test-key", async () => {
    let calls = 0;
    const delays = [];
    const result = await runWithAIProviderRetries({
      invoke: async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error("rate limit"), {
            status: 429,
            retryAfterMs: 250,
            retryableRateLimit: true,
          });
        }
        return { text: "recovered", model: "gemini-test-model" };
      },
      sleep: async (delay) => delays.push(delay),
      onUsage: quiet,
      onFailure: quiet,
    });
    assert.equal(result.text, "recovered");
    assert.equal(calls, 2);
    assert.deepEqual(delays, [250]);
  });
});

test("does not retry after quota exhaustion", async () => {
  await withGeminiKey("test-key", async () => {
    let calls = 0;
    await assert.rejects(
      runWithAIProviderRetries({
        invoke: async () => {
          calls += 1;
          throw Object.assign(new Error(
            "Rate limit exceeded (limit: 20 requests per day on Free Tier).",
          ), {
            status: 429,
            quotaExhausted: true,
            retryableRateLimit: false,
          });
        },
        onUsage: quiet,
        onFailure: quiet,
      }),
      (error) => error.code === "AI_PROVIDER_QUOTA_EXHAUSTED",
    );
    assert.equal(calls, 1);
  });
});

test("retries malformed structured output once, then returns validated output", async () => {
  await withGeminiKey("test-key", async () => {
    let calls = 0;
    const result = await runWithAIProviderRetries({
      invoke: async () => ({ text: String(++calls), model: "gemini-test-model" }),
      transform: (output) => {
        if (output.text === "1") {
          throw new AIProviderError("invalid test output", {
            code: "AI_OUTPUT_INVALID",
            category: "invalid_output",
          });
        }
        return { valid: true };
      },
      sleep: async () => {},
      onUsage: quiet,
      onFailure: quiet,
    });
    assert.deepEqual(result, { valid: true });
    assert.equal(calls, 2);
  });
});

test("does not retry invalid requests", async () => {
  await withGeminiKey("test-key", async () => {
    let calls = 0;
    await assert.rejects(
      runWithAIProviderRetries({
        invoke: async () => {
          calls += 1;
          throw Object.assign(new Error("invalid request"), { status: 400 });
        },
        onUsage: quiet,
        onFailure: quiet,
      }),
      (error) => error.code === "AI_PROVIDER_REQUEST_FAILED",
    );
    assert.equal(calls, 1);
  });
});

test("reports missing Gemini configuration clearly", async () => {
  await withGeminiKey(undefined, async () => {
    await assert.rejects(
      runWithAIProviderRetries({ invoke: async () => "unreachable" }),
      (error) => error.code === "AI_NOT_CONFIGURED"
        && error.message.includes("GEMINI_API_KEY"),
    );
  });
});

test("classifies abort errors as network failures", () => {
  assert.equal(classifyAIProviderError(new Error("The operation was aborted")), "network");
});

test("deduplicates only overlapping requests and releases completed entries", async () => {
  let calls = 0;
  let resolveRequest;
  const request = () => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  };
  const first = deduplicateInFlight("industry:test", request);
  const second = deduplicateInFlight("industry:test", request);
  assert.equal(calls, 0);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveRequest({ insight: true });
  assert.deepEqual(await Promise.all([first, second]), [{ insight: true }, { insight: true }]);

  const next = await deduplicateInFlight("industry:test", async () => {
    calls += 1;
    return { insight: false };
  });
  assert.equal(calls, 2);
  assert.deepEqual(next, { insight: false });
});
