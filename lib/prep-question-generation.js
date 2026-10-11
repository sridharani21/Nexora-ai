import { randomUUID } from "node:crypto";
import { ASSESSMENT_SECTIONS } from "@/data/prep-assessment";
import { PRACTICE_QUESTIONS } from "@/data/prep-practice";
import { PLACEMENT_ASSESSMENT_SECTIONS } from "@/data/placement-assessment";
import { PLACEMENT_PRACTICE_QUESTIONS } from "@/data/placement-practice";
import { generateJson } from "@/lib/llm";
import { db } from "@/lib/prisma";

const QUESTION_BANK = [
  ...ASSESSMENT_SECTIONS.flatMap((section) => section.questions),
  ...PRACTICE_QUESTIONS,
  ...PLACEMENT_ASSESSMENT_SECTIONS.flatMap((section) => section.questions),
  ...PLACEMENT_PRACTICE_QUESTIONS,
  { prompt: "A product priced at 800 is discounted by 15%. What is the sale price?" },
  { prompt: "What number comes next: 3, 7, 13, 21, 31, ?" },
  { prompt: "Five workers finish a task in 12 days. At the same rate, how long would 8 workers take?" },
  { prompt: "A bag contains 3 red and 2 blue tokens. Two are drawn without replacement. What is the probability both are blue?" },
  { prompt: "The ratio of developers to testers is 3:2 in a team of 25. How many are developers?" },
  { prompt: "All Nors are Pels. No Pels are Vims. Which statement must be true?" },
  { prompt: "A loop processes n items and performs a binary search in a sorted array for each item. What is its time complexity?" },
  { prompt: "Which data structure gives average O(1) lookup by key and is useful for solving Two Sum in one pass?" },
  { prompt: "Which SQL clause filters individual rows before grouping?" },
  { prompt: "Which HTTP status code most commonly indicates that a resource was created successfully?" },
  { prompt: "What does this return? `[1, 2, 3].map(x => x * 2).filter(x => x > 2).length`" },
  { prompt: "Which ACID property ensures a transaction's changes are all applied or none are?" },
];

function normalizePrompt(prompt) {
  return prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function promptTokens(prompt) {
  const ignored = new Set(["a", "an", "and", "are", "by", "for", "from", "how", "in", "is", "of", "on", "or", "the", "to", "what", "which", "with"]);
  return new Set(normalizePrompt(prompt).split(" ").filter((token) => token.length > 2 && !ignored.has(token)));
}

function areNearDuplicates(first, second) {
  const firstTokens = promptTokens(first);
  const secondTokens = promptTokens(second);
  if (firstTokens.size < 4 || secondTokens.size < 4) return false;
  const overlap = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  return overlap / new Set([...firstTokens, ...secondTokens]).size >= 0.8;
}

function parseQuestionSet(value) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error("Saved question history is invalid. Please contact support before starting another test.");
  }
}

function normalizeQuestion(question, sectionById) {
  const prompt = typeof question?.prompt === "string" ? question.prompt.trim() : "";
  const topic = typeof question?.topic === "string" ? question.topic.trim() : "";
  const difficulty = ["easy", "medium", "hard"].includes(question?.difficulty)
    ? question.difficulty
    : "";
  const sectionId = typeof question?.sectionId === "string" && sectionById.has(question.sectionId)
    ? question.sectionId
    : null;
  const section = sectionById.get(sectionId);
  const allowedSubjects = section?.allowedSubjects || [section?.subject || sectionId];
  const subject = typeof question?.subject === "string" && allowedSubjects.includes(question.subject)
    ? question.subject
    : null;
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => {
      const value = typeof option?.value === "string" ? option.value.trim() : "";
      const label = typeof option?.label === "string" ? option.label.trim() : "";
      return value && label ? [value, label] : null;
    })
    : null;

  if (
    !prompt ||
    prompt.length > 1800 ||
    !topic ||
    topic.length > 120 ||
    !subject ||
    !difficulty ||
    !sectionId ||
    !options ||
    options.length !== 4 ||
    options.some((option) => !option) ||
    new Set(options.map(([value]) => value)).size !== 4
  ) {
    throw new Error("Gemini returned a malformed question. Please generate the test again.");
  }

  const answer = question.answer === null ? null : question.answer;
  if (answer !== null && (!options.some(([value]) => value === answer) || typeof answer !== "string")) {
    throw new Error("Gemini returned a question with no valid correct answer. Please generate the test again.");
  }

  if (section.topic && topic !== section.topic) {
    throw new Error("Gemini returned a question outside the requested topic.");
  }
  if (Array.isArray(section.allowedTopics) && !section.allowedTopics.includes(topic)) {
    throw new Error("Gemini returned a question outside the supported topics.");
  }
  if (Array.isArray(section.allowedDifficulties) && !section.allowedDifficulties.includes(difficulty)) {
    throw new Error("Gemini returned a question outside the requested difficulty.");
  }
  return { id: randomUUID(), sectionId, subject, topic, difficulty, prompt, options, answer };
}

export async function createGeneratedQuestionSet({
  profileId,
  ownerId,
  purpose,
  questionCount,
  sections,
  instructions,
}) {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 40) {
    throw new Error("Choose a valid number of questions.");
  }
  if (!Array.isArray(sections) || !sections.length) {
    throw new Error("Question topics are not configured for this test.");
  }
  const expectedCount = sections.reduce((sum, section) => sum + section.count, 0);
  if (expectedCount !== questionCount || sections.some((section) => !section.id || section.count < 1)) {
    throw new Error("The requested question count does not match the test configuration.");
  }

  if (typeof ownerId !== "string" || !ownerId) {
    throw new Error("A signed-in account is required to generate questions.");
  }
  const previousSets = await db.prepGeneratedQuestionSet.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    select: { questions: true },
  });
  const historyProfile = profileId
    ? { id: profileId }
    : await db.prepStudentProfile.findUnique({
      where: { clerkUserId: ownerId },
      select: { id: true },
    });
  const previousInterviewQuestions = historyProfile
    ? await db.prepInterviewTurn.findMany({
      where: { session: { profileId: historyProfile.id } },
      select: { question: true },
    })
    : [];
  const previousPrompts = [
    ...QUESTION_BANK.map((question) => question.prompt),
    ...previousSets.flatMap((set) => parseQuestionSet(set.questions).map((question) => question.prompt)),
    ...previousInterviewQuestions.map((turn) => turn.question),
  ];
  const previousPromptKeys = new Set(previousPrompts.map(normalizePrompt));
  let validationMessage = "";
  let questions;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = `Generate exactly ${questionCount} original, accurate, single-answer multiple-choice questions as JSON: {"questions":[{"sectionId":"one of the supplied section ids","subject":"one of the allowed subjects for that section","topic":"one of the allowed topics when provided","difficulty":"easy|medium|hard","prompt":"question text","options":[{"value":"short unique value","label":"answer choice"},{"value":"...","label":"..."},{"value":"...","label":"..."},{"value":"...","label":"..."}],"answer":"the exact value of the correct choice"}]}.

Rules:
- Generate exactly the requested count and exactly the requested number for each section.
- Every question must be materially different from every prior question below, not a rewording or number swap. Never repeat a prior question.
- Use four plausible, distinct options and exactly one demonstrably correct answer. Check calculations and facts.
- Use only the supplied allowed subject and topic values. If a section specifies a topic, use it exactly.
- Keep questions appropriate for a student placement test. Avoid ambiguous wording and trick questions.
- For the "interest" section only, questions are preference questions, set answer to null, and use option values builder, analyst, systems, security exactly once each.
- Follow these test-specific instructions: ${instructions}

Sections: ${JSON.stringify(sections)}
${validationMessage ? `Fix these validation failures from the previous response: ${validationMessage}` : ""}
Previously used questions (do not repeat or paraphrase): ${JSON.stringify(previousPrompts)}

Return JSON only.`;
    const generated = await generateJson(prompt);
    if (!Array.isArray(generated?.questions) || generated.questions.length !== questionCount) {
      validationMessage = `Expected exactly ${questionCount} questions; received ${Array.isArray(generated?.questions) ? generated.questions.length : "no question array"}.`;
      continue;
    }

    try {
      const sectionById = new Map(sections.map((section) => [section.id, section]));
      const candidate = generated.questions.map((question) => normalizeQuestion(question, sectionById));
      for (const section of sections) {
        const sectionQuestions = candidate.filter((question) => question.sectionId === section.id);
        if (sectionQuestions.length !== section.count) {
          throw new Error(`Section ${section.id} must contain exactly ${section.count} questions.`);
        }
        if (section.id === "interest" && sectionQuestions.some((question) => (
          question.answer !== null ||
          question.options.map(([value]) => value).sort().join(",") !== "analyst,builder,security,systems"
        ))) {
          throw new Error("Career-interest questions must use the supported preference options and no answer key.");
        }
        if (section.id !== "interest" && sectionQuestions.some((question) => question.answer === null)) {
          throw new Error("Scored questions must include a correct answer.");
        }
      }
      const promptKeys = candidate.map((question) => normalizePrompt(question.prompt));
      if (new Set(promptKeys).size !== candidate.length) {
        throw new Error("The generated set contains repeated questions.");
      }
      if (
        promptKeys.some((key) => previousPromptKeys.has(key)) ||
        candidate.some((question) => previousPrompts.some((previous) => areNearDuplicates(question.prompt, previous))) ||
        candidate.some((question, index) => candidate.slice(0, index).some((previous) => areNearDuplicates(question.prompt, previous.prompt)))
      ) {
        throw new Error("The generated set repeats a question used previously.");
      }
      questions = candidate;
      break;
    } catch (error) {
      validationMessage = error instanceof Error ? error.message : "The questions were invalid.";
    }
  }

  if (!questions) {
    throw new Error(`Gemini could not generate ${questionCount} valid, non-repeating questions. Please try again.`);
  }

  const saved = await db.prepGeneratedQuestionSet.create({
    data: { profileId: profileId ?? null, ownerId, purpose, questions: JSON.stringify(questions) },
    select: { id: true, questions: true },
  });
  const parsedQuestions = parseQuestionSet(saved.questions);
  return {
    id: saved.id,
    questions: parsedQuestions.map(({ answer, ...question }) => question),
  };
}

export async function getOwnedQuestionSet({ ownerId, questionSetId, purpose }) {
  if (typeof questionSetId !== "string" || !questionSetId) {
    throw new Error("The generated question set is missing. Generate a fresh test before submitting.");
  }
  const saved = await db.prepGeneratedQuestionSet.findFirst({
    where: { id: questionSetId, ownerId, purpose },
    select: { id: true, questions: true },
  });
  if (!saved) throw new Error("This generated test could not be verified. Please start a new test.");
  return { ...saved, questions: parseQuestionSet(saved.questions) };
}

export async function claimQuestionSet({ transaction, ownerId, questionSetId, purpose }) {
  const claimed = await transaction.prepGeneratedQuestionSet.updateMany({
    where: { id: questionSetId, ownerId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new Error("This generated question set has already been submitted. Generate a fresh test to continue.");
  }
}
