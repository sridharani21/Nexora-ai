export const JUDGE0_LANGUAGE_IDS = Object.freeze({
  "Python 3": 71,
  "Java 17": 62,
  "C++ 17": 54,
  "C 11": 50,
});

export function decodeJudge0Output(value) {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function normalizeJudge0Output(value) {
  return String(value).replace(/\r\n/g, "\n").trimEnd();
}

export function parseJudge0Result(result, expectedOutput) {
  const output = decodeJudge0Output(result.stdout);
  const diagnostic = decodeJudge0Output(result.compile_output || result.stderr || result.message);
  const passed = result.status?.id === 3
    && normalizeJudge0Output(output) === normalizeJudge0Output(expectedOutput);
  return {
    passed,
    status: result.status?.description || "Unknown",
    output: result.compile_output
      ? decodeJudge0Output(result.compile_output)
      : result.stderr
        ? decodeJudge0Output(result.stderr)
        : output,
    diagnostic,
    time: result.time || null,
    memory: result.memory || null,
  };
}
