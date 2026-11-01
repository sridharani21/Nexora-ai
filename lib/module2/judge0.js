import "server-only";
import { JUDGE0_LANGUAGE_IDS, parseJudge0Result } from "./judge0-helpers.js";

export { JUDGE0_LANGUAGE_IDS } from "./judge0-helpers.js";

function getJudge0Config() {
  const configuredUrl = process.env.JUDGE0_API_URL || "https://ce.judge0.com";
  const baseUrl = new URL(configuredUrl);
  if (!["https:", "http:"].includes(baseUrl.protocol)) {
    throw new Error("Judge0 must use an HTTP or HTTPS endpoint.");
  }
  return {
    baseUrl: baseUrl.toString().replace(/\/+$/, ""),
    apiKey: process.env.JUDGE0_API_KEY,
  };
}

async function requestJudge0(path, init) {
  const { baseUrl, apiKey } = getJudge0Config();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (apiKey) headers.set("X-Auth-Token", apiKey);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Judge0 returned HTTP ${response.status}.`);
  return response.json();
}

async function runOne({ code, language, testCase, limits }) {
  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) throw new Error("The selected language is not supported.");
  const query = "?base64_encoded=true&wait=true";
  let result = await requestJudge0(`/submissions${query}`, {
    method: "POST",
    body: JSON.stringify({
      source_code: Buffer.from(code, "utf8").toString("base64"),
      language_id: languageId,
      stdin: Buffer.from(testCase.input, "utf8").toString("base64"),
      cpu_time_limit: limits.timeLimitSeconds,
      memory_limit: limits.memoryLimitMb * 1024,
    }),
  });

  if (result.token && result.status?.id < 3) {
    const token = encodeURIComponent(result.token);
    for (let poll = 0; poll < 10 && result.status?.id < 3; poll += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      result = await requestJudge0(`/submissions/${token}?base64_encoded=true`, { method: "GET" });
    }
  }

  const evaluation = parseJudge0Result(result, testCase.expectedOutput);
  return {
    ...evaluation,
  };
}

export async function evaluateCode({ code, language, testCases, limits, revealOutputs }) {
  if (typeof code !== "string" || code.length < 1 || code.length > 20_000) {
    throw new Error("Code must be between 1 and 20,000 characters.");
  }
  if (!JUDGE0_LANGUAGE_IDS[language]) throw new Error("Choose a supported programming language.");
  if (!Array.isArray(testCases) || testCases.length < 1 || testCases.length > 12) {
    throw new Error("The test case set is invalid.");
  }

  const results = [];
  for (const testCase of testCases) {
    results.push(await runOne({ code, language, testCase, limits }));
  }
  return {
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    status: results.every((result) => result.passed) ? "ACCEPTED" : "PARTIAL",
    results: revealOutputs
      ? results.map(({ passed, status, output, time, memory }) => ({ passed, status, output, time, memory }))
      : undefined,
  };
}
