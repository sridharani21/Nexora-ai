import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generateJson } from "../llm.js";
import { RIASEC_DIMENSIONS, RIASEC_QUESTIONS_PER_DIMENSION } from "./riasec-scoring.js";

export const RIASEC_QUESTION_SET_VERSION = 1;
export const QUESTIONS_PER_DIMENSION = RIASEC_QUESTIONS_PER_DIMENSION;
export const RIASEC_QUESTION_COUNT = RIASEC_DIMENSIONS.length * QUESTIONS_PER_DIMENSION;
function generateRiasecJson(prompt) {
  return generateJson(prompt, {
    operation: "riasec-question-generation",
    validateOutput: (output) => {
      try {
        validateRiasecQuestions(output);
        return output;
      } catch {
        return false;
      }
    },
  });
}

const questionSchema = z.object({
  dimension: z.enum(RIASEC_DIMENSIONS),
  statement: z.string().trim().min(25).max(240),
}).strict();

const responseSchema = z.object({
  questions: z.array(questionSchema).length(RIASEC_QUESTION_COUNT),
}).strict();

export function validateRiasecQuestions(input, { createId = randomUUID } = {}) {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) throw new Error("Generated interest questions did not match the required structure.");
  const counts = Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, 0]));
  const statements = new Set();
  const questions = parsed.data.questions.map((question) => {
    counts[question.dimension] += 1;
    const normalized = question.statement.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (statements.has(normalized)) throw new Error("Generated interest questions included duplicates.");
    statements.add(normalized);
    if (/\b(?:marks|cgpa|grade|gender|salary|dollars?|usd|euros?|pounds?|rupees?|inr|currency)\b|[$€£₹]/i.test(question.statement)) {
      throw new Error("Generated interest questions must focus on activities and preferences, not demographics or money.");
    }
    return { id: createId(), dimension: question.dimension, statement: question.statement };
  });
  if (RIASEC_DIMENSIONS.some((dimension) => counts[dimension] !== QUESTIONS_PER_DIMENSION)) {
    throw new Error("Generated questions must cover all six interest dimensions equally.");
  }
  return questions;
}

export async function generateRiasecQuestions({ generate = generateRiasecJson, maxAttempts = 2 } = {}) {
  const prompt = `Create a balanced career-interest self-reflection assessment using Holland's six RIASEC interest dimensions: R=Realistic, I=Investigative, A=Artistic, S=Social, E=Enterprising, C=Conventional.
Return only JSON in this exact shape: {"questions":[{"dimension":"R","statement":"I enjoy practical activities where I can build or repair things."}]}.
Generate exactly ${RIASEC_QUESTION_COUNT} concise first-person activity/preference statements: exactly ${QUESTIONS_PER_DIMENSION} per dimension. Use only the six dimension codes. Statements should be clear, accessible, culturally neutral, not double-barrelled, not leading, and should describe an activity or work preference. Do not reference degrees, academic performance, gender, salary, ability, clinical traits, or career guarantees. Do not use money/currency examples. Do not repeat statements.`;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const output = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Question generation timed out.")), 45_000);
        Promise.resolve()
          .then(() => generate(prompt))
          .then(resolve, reject)
          .finally(() => clearTimeout(timer));
      });
      return validateRiasecQuestions(output);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("We could not create a balanced RIASEC question set. Please try again.", { cause: lastError });
}

export function validateRiasecResponses(questions, responses) {
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
    throw new Error("Your response could not be saved.");
  }
  const questionIds = new Set(questions.map((question) => question.id));
  for (const [id, score] of Object.entries(responses)) {
    if (!questionIds.has(id) || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error("Use one of the five response options for each question.");
    }
  }
  return responses;
}
