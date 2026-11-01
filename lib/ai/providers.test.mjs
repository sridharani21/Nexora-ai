import assert from "node:assert/strict";
import test from "node:test";
import { generateStructuredOutput } from "./ai-provider.js";
import { AI_GEMINI_MODEL } from "./ai-config.js";
import { generateWithGemini } from "./gemini-provider.js";

async function withGeminiKey(run, value = "test-gemini-key") {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
}

async function withMockedFetch(run, responseBody = {
  id: "interaction-id",
  status: "completed",
  model: "gemini-test-model",
  steps: [{
    type: "model_output",
    content: [{ type: "text", text: "Gemini response" }],
  }],
}, responseStatus = 200, responseHeaders = {}) {
  const previousFetch = globalThis.fetch;
  let requestUrl = "";
  let request;
  globalThis.fetch = async (input, init) => {
    const fetchRequest = input instanceof Request ? input : new Request(input, init);
    requestUrl = fetchRequest.url;
    request = {
      headers: fetchRequest.headers,
      body: await fetchRequest.json(),
    };
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { "Content-Type": "application/json", ...responseHeaders },
    });
  };
  try {
    return await run({
      get requestUrl() { return requestUrl; },
      get request() { return request; },
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("sends a server-side Gemini Interactions API request using GEMINI_API_KEY", async () => {
  await withGeminiKey(() => withMockedFetch(async (captured) => {
    const result = await generateWithGemini({
      prompt: "Say hello",
      requestTimeoutMs: 5000,
    });
    assert.match(captured.requestUrl, /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
    assert.equal(captured.requestUrl.includes("test-gemini-key"), false);
    assert.equal(captured.request.headers.get("x-goog-api-key"), "test-gemini-key");
    assert.equal(captured.request.body.model, AI_GEMINI_MODEL);
    assert.deepEqual(captured.request.body.input, [
      {
        type: "user_input",
        content: [{ type: "text", text: "Say hello" }],
      },
    ]);
    assert.deepEqual(result, { text: "Gemini response", model: "gemini-test-model" });
  }));
});

test("passes JSON mode, conversation history, image content, and output limit", async () => {
  await withGeminiKey(() => withMockedFetch(async (captured) => {
    const result = await generateWithGemini({
      prompt: [
        { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } },
        "Extract text",
      ],
      systemPrompt: "Be concise.",
      history: [{ role: "assistant", content: "Previous answer" }],
      jsonMode: true,
      maxOutputTokens: 4096,
      requestTimeoutMs: 5000,
    });
    assert.equal(result.text, "Gemini response");
    assert.deepEqual(captured.request.body.input, [
      {
        type: "model_output",
        content: [{ type: "text", text: "Previous answer" }],
      },
      {
        type: "user_input",
        content: [
          { type: "image", mime_type: "image/png", data: "aGVsbG8=" },
          { type: "text", text: "Extract text" },
        ],
      },
    ]);
    assert.equal(captured.request.body.system_instruction, "Be concise.");
    assert.deepEqual(captured.request.body.response_format, {
      type: "text",
      mime_type: "application/json",
    });
    assert.deepEqual(captured.request.body.generation_config, { max_output_tokens: 4096 });
  }));
});

test("parses and validates structured Gemini output before returning it", async () => {
  await withGeminiKey(() => withMockedFetch(async () => {
    const result = await generateStructuredOutput('Return {"status":"ok"}', {
      validateOutput: (output) => output.status === "ok" ? output : false,
    });
    assert.deepEqual(result, { status: "ok" });
  }, {
    id: "interaction-id",
    status: "completed",
    steps: [{
      type: "model_output",
      content: [{ type: "text", text: '{"status":"ok"}' }],
    }],
  }));
});

test("does not repeat invalid structured output when retries are disabled", async () => {
  await withGeminiKey(() => withMockedFetch(async (captured) => {
    let validationCalls = 0;
    await assert.rejects(
      generateStructuredOutput('Return {"status":"ok"}', {
        maxRetries: 0,
        validateOutput: () => {
          validationCalls += 1;
          throw new Error("Resume fields failed validation: academic.gpa.");
        },
      }),
      (error) => error.code === "AI_OUTPUT_INVALID"
        && error.message.includes("academic.gpa"),
    );
    assert.equal(validationCalls, 1);
    assert.equal(captured.requestUrl.includes("/interactions"), true);
  }, {
    id: "interaction-id",
    status: "completed",
    steps: [{
      type: "model_output",
      content: [{ type: "text", text: '{"status":"ok"}' }],
    }],
  }));
});

test("retains Gemini quota errors without retrying", async () => {
  await withGeminiKey(() => withMockedFetch(async () => {
    await assert.rejects(
      generateWithGemini({ prompt: "Say hello", requestTimeoutMs: 5000 }),
      (error) => error.status === 429
        && error.retryableRateLimit === false
        && error.quotaExhausted === true,
    );
  }, {
    error: {
      code: 429,
      message: "Rate limit exceeded for model (limit: 20 requests per day on Free Tier). Please retry in 47m.",
      status: "RESOURCE_EXHAUSTED",
    },
  }, 429));
});

test("requires a Gemini server-side key and does not accept OpenAI key aliases", async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousOpenKey = process.env.OPEN_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPEN_API_KEY = "test-open-key";
  try {
    await assert.rejects(
      generateWithGemini({ prompt: "Say hello" }),
      /GEMINI_API_KEY is not configured/,
    );
  } finally {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAIKey;
    if (previousOpenKey === undefined) delete process.env.OPEN_API_KEY;
    else process.env.OPEN_API_KEY = previousOpenKey;
  }
});
