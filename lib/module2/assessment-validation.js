import { randomUUID } from "node:crypto";
import { z } from "zod";

const optionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().trim().min(1).max(800),
}).strict();

const testCaseSchema = z.object({
  input: z.string().max(5000),
  expectedOutput: z.string().max(5000),
}).strict();

const baseQuestionSchema = z.object({
  sectionId: z.string().min(1),
  topic: z.string().min(1),
  skillTested: z.string().min(2).max(160),
  learningObjective: z.string().min(8).max(500),
  selectionReason: z.string().min(20).max(1000),
  careerRoleRelevance: z.string().min(20).max(1000),
  expectedEvidence: z.string().min(10).max(1000),
  estimatedTimeSeconds: z.number().positive().max(900),
  evaluationCriteria: z.string().min(10).max(2000),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  questionText: z.string().trim().min(20).max(7000),
  explanation: z.string().trim().min(20).max(2000),
  marks: z.number().positive(),
  negativeMarks: z.number().min(0),
});

const mcqSchema = baseQuestionSchema.extend({
  type: z.literal("MCQ"),
  options: z.array(optionSchema).length(4),
  correctOption: z.enum(["A", "B", "C", "D"]),
}).strict();

const codingSchema = baseQuestionSchema.extend({
  type: z.literal("CODING"),
  title: z.string().trim().min(3).max(160),
  solution: z.string().trim().min(10).max(20_000),
  inputFormat: z.string().trim().min(5).max(2000),
  outputFormat: z.string().trim().min(5).max(2000),
  constraints: z.string().trim().min(1).max(2000),
  starterCode: z.record(z.string(), z.string().max(12000)).default({}),
  sampleExplanation: z.string().trim().min(10).max(1000),
  publicTestCases: z.array(testCaseSchema).min(1).max(6),
  privateTestCases: z.array(testCaseSchema).min(3).max(12),
  supportedLanguages: z.array(z.enum(["Python 3", "Java 17", "C++ 17", "C 11"])).min(1).max(4),
  timeLimitSeconds: z.number().int().min(1).max(10).default(3),
  memoryLimitMb: z.number().int().min(32).max(512).default(128),
}).strict();

export const generatedQuestionSchema = z.discriminatedUnion("type", [mcqSchema, codingSchema]);
const nonIndianCurrencyPattern = /[$€£]|\b(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/i;

function containsNonIndianCurrency(value) {
  if (typeof value === "string") return nonIndianCurrencyPattern.test(value);
  if (Array.isArray(value)) return value.some(containsNonIndianCurrency);
  if (value && typeof value === "object") return Object.values(value).some(containsNonIndianCurrency);
  return false;
}

export function validateAndNormalizeSection(blueprint, section, input, { createId = randomUUID } = {}) {
  const parsed = z.object({ questions: z.array(generatedQuestionSchema) }).strict().safeParse(input);
  if (!parsed.success) {
    throw new Error(`Generated ${section.name} questions did not match the required structure.`);
  }
  const questions = parsed.data.questions;
  if (questions.length !== section.questionCount) {
    throw new Error(`Gemini returned an incomplete ${section.name} section.`);
  }

  const difficulties = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const normalized = [];
  const seen = new Set();
  const markValue = section.marks / section.questionCount;
  for (const rawQuestion of questions) {
    if (containsNonIndianCurrency(rawQuestion)) {
      throw new Error("Assessment questions must use Indian rupees and cannot mention foreign currencies.");
    }
    if (rawQuestion.sectionId !== section.id || rawQuestion.type !== section.questionType) {
      throw new Error(`Generated question did not match the ${section.name} blueprint.`);
    }
    if (!section.topics.includes(rawQuestion.topic)) {
      throw new Error(`Generated question used an unapproved topic for ${section.name}.`);
    }
    if (!section.skills.includes(rawQuestion.skillTested)) {
      throw new Error(`Generated question used an unapproved skill for ${section.name}.`);
    }
    if (!section.learningObjectives.includes(rawQuestion.learningObjective)) {
      throw new Error(`Generated question used an unapproved learning objective for ${section.name}.`);
    }
    if (rawQuestion.estimatedTimeSeconds !== section.durationSeconds / section.questionCount) {
      throw new Error(`Generated question time does not match the ${section.name} blueprint.`);
    }
    if (Math.abs(rawQuestion.marks - markValue) > 0.001) {
      throw new Error(`Generated question marks do not match the ${section.name} blueprint.`);
    }
    if (rawQuestion.negativeMarks > rawQuestion.marks) {
      throw new Error("Generated negative marks cannot exceed positive marks.");
    }
    if (rawQuestion.type === "MCQ") {
      const keys = rawQuestion.options.map((option) => option.key);
      const texts = rawQuestion.options.map((option) => option.text.normalize("NFKC").trim().toLocaleLowerCase());
      if (new Set(keys).size !== 4 || new Set(texts).size !== 4) {
        throw new Error("Generated MCQ options must be four distinct choices.");
      }
      const expectedNegative = blueprint.scoringPolicy.negativeMarking ? markValue * 0.25 : 0;
      if (Math.abs(rawQuestion.negativeMarks - expectedNegative) > 0.001) {
        throw new Error("Generated negative marks do not match the blueprint scoring policy.");
      }
    } else if (rawQuestion.negativeMarks !== 0) {
      throw new Error("Coding questions cannot have negative marks.");
    }

    difficulties[rawQuestion.difficulty] += 1;
    const stem = normalizeStem(rawQuestion.questionText);
    if (seen.has(stem)) throw new Error(`Gemini generated duplicate questions in ${section.name}.`);
    seen.add(stem);
    normalized.push({
      id: createId(),
      sectionId: section.id,
      sectionName: section.name,
      topic: rawQuestion.topic,
      skillTested: rawQuestion.skillTested,
      learningObjective: rawQuestion.learningObjective,
      selectionReason: rawQuestion.selectionReason,
      careerRoleRelevance: rawQuestion.careerRoleRelevance,
      expectedEvidence: rawQuestion.expectedEvidence,
      estimatedTimeSeconds: rawQuestion.estimatedTimeSeconds,
      evaluationCriteria: rawQuestion.evaluationCriteria,
      difficulty: rawQuestion.difficulty,
      type: rawQuestion.type,
      questionText: rawQuestion.questionText,
      explanation: rawQuestion.explanation,
      marks: rawQuestion.marks,
      negativeMarks: rawQuestion.negativeMarks,
      ...(rawQuestion.type === "MCQ"
        ? { options: rawQuestion.options, correctOption: rawQuestion.correctOption }
        : {
          title: rawQuestion.title,
          solution: rawQuestion.solution,
          inputFormat: rawQuestion.inputFormat,
          outputFormat: rawQuestion.outputFormat,
          constraints: rawQuestion.constraints,
          starterCode: rawQuestion.starterCode,
          sampleExplanation: rawQuestion.sampleExplanation,
          publicTestCases: rawQuestion.publicTestCases,
          privateTestCases: rawQuestion.privateTestCases,
          supportedLanguages: rawQuestion.supportedLanguages,
          timeLimitSeconds: rawQuestion.timeLimitSeconds,
          memoryLimitMb: rawQuestion.memoryLimitMb,
        }),
    });
  }

  for (const difficulty of ["EASY", "MEDIUM", "HARD"]) {
    if (difficulties[difficulty] !== section.difficultyDistribution[difficulty]) {
      throw new Error(`Generated ${section.name} difficulty mix did not match its blueprint.`);
    }
  }
  return normalized;
}

export function normalizeStem(text) {
  return String(text).normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function hasSimilarQuestion(existing, candidate) {
  const left = new Set(normalizeStem(existing).split(" ").filter((word) => word.length > 2));
  const right = new Set(normalizeStem(candidate).split(" ").filter((word) => word.length > 2));
  if (left.size < 6 || right.size < 6) return normalizeStem(existing) === normalizeStem(candidate);
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.min(left.size, right.size) >= 0.82;
}

export function splitSectionForGeneration(
  section,
  maxQuestionsPerBatch = section.questionType === "CODING" ? 1 : 4,
) {
  const difficulties = ["EASY", "MEDIUM", "HARD"].flatMap((difficulty) => (
    Array.from({ length: section.difficultyDistribution[difficulty] }, () => difficulty)
  ));
  const batches = [];
  for (let start = 0; start < difficulties.length; start += maxQuestionsPerBatch) {
    const batchDifficulties = difficulties.slice(start, start + maxQuestionsPerBatch);
    const difficultyDistribution = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const difficulty of batchDifficulties) difficultyDistribution[difficulty] += 1;
    batches.push({
      ...section,
      questionCount: batchDifficulties.length,
      durationSeconds: section.durationSeconds / section.questionCount * batchDifficulties.length,
      marks: section.marks / section.questionCount * batchDifficulties.length,
      difficultyDistribution,
    });
  }
  return batches;
}

export function isReusableQuestionSet(blueprint, questions, excludedQuestionTexts = []) {
  if (!Array.isArray(questions)) return false;
  const expectedCount = blueprint.sections.reduce((sum, section) => sum + section.questionCount, 0);
  if (
    questions.length !== expectedCount
    || questions.some((question) => (
      !question || typeof question !== "object" || containsNonIndianCurrency(question)
    ))
  ) return false;

  const ids = new Set();
  for (const section of blueprint.sections) {
    const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
    if (sectionQuestions.length !== section.questionCount) return false;
    const difficultyCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const question of sectionQuestions) {
      if (
        !question.id
        || ids.has(question.id)
        || question.type !== section.questionType
        || !section.topics.includes(question.topic)
        || !section.skills.includes(question.skillTested)
        || !section.learningObjectives.includes(question.learningObjective)
        || question.estimatedTimeSeconds !== section.durationSeconds / section.questionCount
        || Math.abs(question.marks - section.marks / section.questionCount) > 0.001
        || !question.questionText
      ) return false;
      ids.add(question.id);
      difficultyCounts[question.difficulty] += 1;
      if (excludedQuestionTexts.some((text) => hasSimilarQuestion(text, question.questionText))) return false;
    }
    if (["EASY", "MEDIUM", "HARD"].some((difficulty) => (
      difficultyCounts[difficulty] !== section.difficultyDistribution[difficulty]
    ))) return false;
  }

  for (let index = 0; index < questions.length; index += 1) {
    if (questions.slice(index + 1).some((question) => hasSimilarQuestion(questions[index].questionText, question.questionText))) {
      return false;
    }
  }
  return Math.abs(questions.reduce((sum, question) => sum + question.marks, 0) - blueprint.maxMarks) <= 0.01;
}

export function findReusableQuestionSet(blueprint, cachedSets, excludedQuestionTexts = []) {
  if (!Array.isArray(cachedSets)) return null;
  return cachedSets.find((row) => (
    isReusableQuestionSet(blueprint, row?.questions, excludedQuestionTexts)
  )) || null;
}
