export async function generateResumeText(promptOrContents) {
  const { generateText } = await import("./ai/ai-provider.js");
  return generateText(promptOrContents, { operation: "resume-text" });
}

export async function generateResumeJson(prompt, options = {}) {
  const { generateStructuredOutput } = await import("./ai/ai-provider.js");
  return generateStructuredOutput(prompt, {
    ...options,
    operation: options.operation || "resume-structured-output",
  });
}
