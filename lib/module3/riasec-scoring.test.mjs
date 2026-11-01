import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeterministicInterpretation,
  calculateRiasecScores,
  RIASEC_DIMENSIONS,
} from "./riasec-scoring.js";
import {
  QUESTIONS_PER_DIMENSION,
  RIASEC_QUESTION_COUNT,
  generateRiasecQuestions,
  validateRiasecQuestions,
  validateRiasecResponses,
} from "./riasec-questions.js";

function makeQuestions() {
  return RIASEC_DIMENSIONS.flatMap((dimension) => Array.from({ length: QUESTIONS_PER_DIMENSION }, (_, index) => ({
    id: `${dimension}-${index}`,
    dimension,
    statement: `${dimension} activity prompt number ${index} describes a distinct interest.`,
  })));
}

test("validates exactly balanced question coverage and assigns stable IDs", () => {
  const source = makeQuestions().map(({ dimension, statement }) => ({ dimension, statement }));
  let id = 0;
  const questions = validateRiasecQuestions({ questions: source }, { createId: () => `question-${id++}` });
  assert.equal(questions.length, RIASEC_QUESTION_COUNT);
  assert.deepEqual(
    Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, questions.filter((question) => question.dimension === dimension).length])),
    Object.fromEntries(RIASEC_DIMENSIONS.map((dimension) => [dimension, QUESTIONS_PER_DIMENSION])),
  );
  assert.equal(questions[0].id, "question-0");
});

test("question generation retries invalid output once and validates before returning", async () => {
  const valid = makeQuestions().map(({ dimension, statement }) => ({ dimension, statement }));
  let calls = 0;
  const questions = await generateRiasecQuestions({
    maxAttempts: 2,
    generate: async (prompt) => {
      assert.match(prompt, /exactly 4 per dimension/);
      calls += 1;
      return calls === 1 ? { questions: [] } : { questions: valid };
    },
  });
  assert.equal(calls, 2);
  assert.equal(questions.length, RIASEC_QUESTION_COUNT);
});

test("rejects unbalanced, duplicated, invalid-currency, and malformed question sets", () => {
  const questions = makeQuestions().map(({ dimension, statement }) => ({ dimension, statement }));
  const unbalanced = [...questions];
  unbalanced[0] = { ...unbalanced[0], dimension: "I" };
  assert.throws(() => validateRiasecQuestions({ questions: unbalanced }), /equally/);

  const duplicated = [...questions];
  duplicated[1] = { ...duplicated[1], statement: duplicated[0].statement };
  assert.throws(() => validateRiasecQuestions({ questions: duplicated }), /duplicates/);

  const withMoney = [...questions];
  withMoney[0] = { ...withMoney[0], statement: "I enjoy working with a salary of $500 every day." };
  assert.throws(() => validateRiasecQuestions({ questions: withMoney }), /money/);
  assert.throws(() => validateRiasecQuestions({ questions: questions.slice(1) }), /structure/);
});

test("calculates dimension means and 0–100 response-scale percentages deterministically", () => {
  const questions = makeQuestions();
  const responseValues = { R: 1, I: 2, A: 3, S: 4, E: 5, C: 4 };
  const responses = Object.fromEntries(questions.map((question) => [question.id, responseValues[question.dimension]]));
  const result = calculateRiasecScores(questions, responses);
  assert.equal(result.scores.R.mean, 1);
  assert.equal(result.scores.R.percentage, 0);
  assert.equal(result.scores.A.mean, 3);
  assert.equal(result.scores.A.percentage, 50);
  assert.equal(result.scores.E.mean, 5);
  assert.equal(result.scores.E.percentage, 100);
  assert.equal(result.interestCode, "E-S-C");
  assert.deepEqual(result.topThree, ["E", "S", "C"]);
});

test("uses stable tie ordering and exposes tied highest dimensions", () => {
  const questions = makeQuestions();
  const responses = Object.fromEntries(questions.map((question) => [question.id, 3]));
  const result = calculateRiasecScores(questions, responses);
  assert.deepEqual(result.ranking, RIASEC_DIMENSIONS);
  assert.deepEqual(result.tiedTop, RIASEC_DIMENSIONS);
  assert.match(buildDeterministicInterpretation(result), /tied/);
  assert.match(buildDeterministicInterpretation(result), /not ability/);
});

test("rejects incomplete, invalid, and unknown responses", () => {
  const questions = makeQuestions();
  const complete = Object.fromEntries(questions.map((question) => [question.id, 3]));
  assert.throws(() => calculateRiasecScores(questions, { ...complete, [questions[0].id]: undefined }), /1-to-5/);
  assert.throws(() => calculateRiasecScores(questions, { ...complete, unknown: 3 }), /unknown question/);
  assert.throws(() => calculateRiasecScores(questions, { ...complete, [questions[0].id]: 6 }), /1-to-5/);
  assert.throws(() => calculateRiasecScores(questions, Object.fromEntries(Object.entries(complete).slice(1))), /every question/);
  assert.throws(() => validateRiasecResponses(questions, { ...complete, unknown: 2 }), /five response options/);
  assert.throws(() => calculateRiasecScores(questions.slice(1), Object.fromEntries(Object.entries(complete).slice(1))), /exactly four/);
});
