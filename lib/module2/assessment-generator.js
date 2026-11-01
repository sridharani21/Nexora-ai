import "server-only";
import { generateJson } from "../llm.js";
import { isAIProviderUnavailableError } from "../ai/ai-errors.js";
import {
  hasSimilarQuestion,
  splitSectionForGeneration,
  validateAndNormalizeSection,
} from "./assessment-validation.js";

const QUESTION_REQUEST_TIMEOUT_MS = 30_000;
const SECTION_REQUEST_TIMEOUT_MS = QUESTION_REQUEST_TIMEOUT_MS * 3 + 1_000;
const MAX_CONCURRENT_QUESTION_REQUESTS = 1;

function promptForSection(blueprint, section, studentContext) {
  const type = section.questionType;
  const instructions = type === "MCQ"
    ? `Each question must have exactly four distinct choices and exactly one defensible correctOption key (A, B, C, or D). Avoid ambiguous, trick, subjective, or current-events questions.`
    : `Create exactly ${section.questionCount} concise coding exercises, each allocated ${section.durationSeconds / section.questionCount} seconds. Include 2 public and at least 3 private tests per item. Do not include complete solutions in starter code. Support Python 3 and C++ 17.`;
  const example = type === "MCQ"
    ? `{"type":"MCQ","sectionId":"${section.id}","topic":"one listed topic","skillTested":"one listed skill","learningObjective":"one listed objective","selectionReason":"...","careerRoleRelevance":"...","expectedEvidence":"...","estimatedTimeSeconds":${section.durationSeconds / section.questionCount},"evaluationCriteria":"...","difficulty":"MEDIUM","questionText":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correctOption":"A","explanation":"Explain why the answer is correct and the alternatives are not.","marks":${section.marks / section.questionCount},"negativeMarks":${section.marks / section.questionCount * 0.25}}`
    : `{"type":"CODING","sectionId":"${section.id}","topic":"one listed topic","skillTested":"one listed skill","learningObjective":"one listed objective","selectionReason":"...","careerRoleRelevance":"...","expectedEvidence":"...","estimatedTimeSeconds":${section.durationSeconds / section.questionCount},"evaluationCriteria":"...","difficulty":"MEDIUM","title":"...","questionText":"...","inputFormat":"...","outputFormat":"...","constraints":"...","starterCode":{},"sampleExplanation":"...","solution":"complete reference solution in Python 3","publicTestCases":[{"input":"...","expectedOutput":"..."}],"privateTestCases":[{"input":"...","expectedOutput":"..."}],"supportedLanguages":["Python 3","C++ 17"],"timeLimitSeconds":3,"memoryLimitMb":128,"explanation":"...","marks":${section.marks / section.questionCount},"negativeMarks":0}`;

  return `Generate original, branch-appropriate technical assessment questions. Return only JSON: {"questions":[...]}.
Assessment branch: ${blueprint.branch}. Assessment blueprint version: ${blueprint.version}.
Section: ${section.name} (${section.id}). Type: ${type}. Exact question count: ${section.questionCount}. Section marks: ${section.marks}. Each question must have exactly ${section.marks / section.questionCount} marks.
Allowed topics: ${section.topics.join("; ")}.
Allowed skills: ${section.skills.join("; ")}.
Allowed learning objectives: ${section.learningObjectives.join("; ")}.
Career role to tailor toward: ${studentContext.careerRole}.
Relevant student skills, if present: ${studentContext.skills.join("; ") || "not provided"}.
Prior assessment evidence, if present: ${JSON.stringify(studentContext.previousResults)}.
Required difficulty counts: ${JSON.stringify(section.difficultyDistribution)}.
Generate exactly the specified count and difficulty distribution. Use only the listed topics and this sectionId. Answers and explanations must be internally consistent. If a question uses money, use Indian rupees (₹/INR) only; never use dollars, USD, or another currency. Do not claim external or independent fact-checking; do not invent citations. ${instructions}
Every object must include all the metadata shown in the expected shape. Use exact strings from the allowed skills and objectives. Each question must state a concise selection reason, role relevance, expected evidence, and measurable evaluation criteria. estimatedTimeSeconds must equal ${section.durationSeconds / section.questionCount}. Every object must include marks and negativeMarks. MCQ negativeMarks must be exactly ${blueprint.scoringPolicy.negativeMarking ? (section.marks / section.questionCount) * 0.25 : 0}; coding negativeMarks must be 0. Expected shape:
${example}
Do not include markdown or other text.`;
}

async function generateWithTimeout(generate, prompt) {
  let timer;
  try {
    return await Promise.race([
      generate(prompt),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("AI generation timed out.")), SECTION_REQUEST_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateAttemptQuestions(blueprint, {
  generate,
  maxAttempts = 2,
  excludeQuestionTexts = [],
  studentContext = {},
} = {}) {
  const context = {
    careerRole: String(studentContext.careerRole || "entry-level engineering role").slice(0, 100),
    skills: Array.isArray(studentContext.skills)
      ? studentContext.skills.filter((skill) => typeof skill === "string").slice(0, 20).map((skill) => skill.slice(0, 100))
      : [],
    previousResults: Array.isArray(studentContext.previousResults)
      ? studentContext.previousResults.slice(0, 3)
      : [],
  };
  const generateSection = generate || ((prompt, _questionType, _attempt, requestSection) => generateJson(prompt, {
    operation: "module2-assessment-questions",
    requestTimeoutMs: QUESTION_REQUEST_TIMEOUT_MS,
    jsonMode: true,
    maxOutputTokens: 12_000,
    maxRetries: 0,
    validateOutput: (output) => {
      validateAndNormalizeSection(blueprint, requestSection, output);
      return output;
    },
  }));
  const availableCodingTopics = blueprint.sections
    .filter((section) => section.questionType === "CODING")
    .flatMap((section) => section.topics);

  async function generateSectionQuestions(section, requestSection, additionalExcluded = []) {
    const excluded = excludeQuestionTexts
      .filter((question) => question.sectionId === section.id)
      .map((question) => question.questionText)
      .filter((text) => typeof text === "string" && text.length > 0)
      .concat(additionalExcluded.filter((text) => typeof text === "string" && text.length > 0));
    const sectionPrompt = promptForSection(blueprint, requestSection, context) + (
      excluded.length
        ? `\nAvoid repeating or lightly paraphrasing these questions from prior attempts:\n${excluded.map((text) => `- ${text.slice(0, 240)}`).join("\n")}`
        : ""
    );
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const retryGuidance = attempt > 0
          ? `\nThe previous response failed with this validation error: ${lastError?.message || "invalid output"}. Return compact valid JSON only. Keep each explanatory field to one concise sentence, preserve all required fields and exact values, and do not truncate the JSON.`
          : "";
        const generated = await generateWithTimeout(
          (prompt) => generateSection(prompt, requestSection.questionType, attempt, requestSection),
          `${sectionPrompt}${retryGuidance}`,
        );
        const questions = validateAndNormalizeSection(blueprint, requestSection, generated);
        for (let index = 0; index < questions.length; index += 1) {
          const question = questions[index];
          if (question.type === "CODING" && availableCodingTopics.includes(question.topic)) {
            const expectedTestTotal = question.publicTestCases.length + question.privateTestCases.length;
            if (expectedTestTotal < 5) throw new Error("Coding question test coverage is insufficient.");
          }
          if (questions.slice(0, index).some((existing) => hasSimilarQuestion(existing.questionText, question.questionText))) {
            throw new Error("Generated attempt contains duplicate or near-duplicate questions.");
          }
          if (excluded.some((existing) => hasSimilarQuestion(existing, question.questionText))) {
            throw new Error("Generated question repeated content from a previous attempt.");
          }
        }
        return questions;
      } catch (error) {
        lastError = error;
        if (
          isAIProviderUnavailableError(error)
          || error?.message === "Gemini generation timed out."
          || error?.message === "AI generation timed out."
        ) {
          break;
        }
      }
    }
    throw new Error(`Unable to prepare a valid ${section.name} section. Please retry.`, { cause: lastError });
  }

  const units = blueprint.sections.flatMap((section) => (
    splitSectionForGeneration(section).map((requestSection) => ({ section, requestSection }))
  ));
  const generatedSections = [];
  for (let start = 0; start < units.length; start += MAX_CONCURRENT_QUESTION_REQUESTS) {
    const batch = units.slice(start, start + MAX_CONCURRENT_QUESTION_REQUESTS);
    const results = await Promise.allSettled(batch.map(({ section, requestSection }) => (
      generateSectionQuestions(section, requestSection)
    )));
    const failedResult = results.find((result) => result.status === "rejected");
    if (failedResult?.status === "rejected") throw failedResult.reason;
    for (let index = 0; index < results.length; index += 1) {
      let questions = results[index].value;
      const priorQuestions = generatedSections.flat();
      if (priorQuestions.some((existing) => questions.some((question) => (
        hasSimilarQuestion(existing.questionText, question.questionText)
      )))) {
        questions = await generateSectionQuestions(
          batch[index].section,
          batch[index].requestSection,
          priorQuestions.map((question) => question.questionText),
        );
      }
      generatedSections.push(questions);
    }
  }

  const allQuestions = generatedSections.flat();
  if (
    allQuestions.length !== blueprint.sections.reduce((sum, section) => sum + section.questionCount, 0)
    || Math.abs(allQuestions.reduce((sum, question) => sum + question.marks, 0) - blueprint.maxMarks) > 0.01
  ) {
    throw new Error("Generated assessment did not match the configured question count or total marks.");
  }
  return allQuestions;
}
