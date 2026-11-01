import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInterviewQuestions,
  buildInterviewReport,
  evaluateInterviewAnswer,
  generateCareerInterviewQuestions,
  interviewSetupSchema,
  publicInterviewQuestion,
} from "./interview.js";
import { buildLiveTokenConfig, GEMINI_LIVE_MODEL } from "./live-provider.js";

test("validates Module 6 setup choices and rejects unsupported options", () => {
  const parsed = interviewSetupSchema.safeParse({
    interviewType: "mixed",
    difficulty: "intermediate",
    duration: 30,
    language: "English",
    planId: null,
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.focus, "job_readiness");
  assert.equal(interviewSetupSchema.safeParse({
    interviewType: "unrelated",
    difficulty: "intermediate",
    duration: 30,
    language: "English",
  }).success, false);
});

test("locks Gemini Live tokens to one short-lived spoken interview configuration", () => {
  const now = Date.parse("2026-10-20T00:00:00.000Z");
  const config = buildLiveTokenConfig({
    careerTitle: "Data Analyst",
    interviewType: "technical",
    difficulty: "intermediate",
    questions: [
      { id: "q1", question: "Explain a SQL validation approach." },
      { id: "q2", question: "Describe how you would investigate a data issue." },
    ],
    answers: [{ questionId: "q1" }],
    profileSnapshot: { interviewFocus: "problem_solving" },
  }, now);
  assert.equal(config.uses, 1);
  assert.equal(config.newSessionExpireTime, new Date(now + 60_000).toISOString());
  assert.equal(config.expireTime, new Date(now + 60 * 60_000).toISOString());
  assert.equal(config.liveConnectConstraints.model, GEMINI_LIVE_MODEL);
  assert.deepEqual(config.liveConnectConstraints.config.responseModalities, ["AUDIO"]);
  assert.ok(config.liveConnectConstraints.config.inputAudioTranscription);
  assert.match(config.liveConnectConstraints.config.systemInstruction.parts[0].text, /Data Analyst/);
  assert.match(config.liveConnectConstraints.config.systemInstruction.parts[0].text, /problem_solving/);
  assert.match(config.liveConnectConstraints.config.systemInstruction.parts[0].text, /Resume with question 2/);
  assert.match(config.liveConnectConstraints.config.systemInstruction.parts[0].text, /Previously answered question IDs: q1/);
});

test("generates role-specific, duration-bounded questions without exposing rubrics", () => {
  const questions = buildInterviewQuestions({
    career: "Electrical Engineer",
    skills: ["Circuit design", "Testing"],
    interviewType: "mixed",
    difficulty: "beginner",
    duration: 15,
  });
  assert.equal(questions.length, 5);
  assert.ok(questions.some((question) => question.question.includes("Electrical Engineer")));
  assert.ok(questions.some((question) => question.skill === "Circuit design"));
  assert.ok(questions.every((question) => question.rubric && question.expectedCriteria.length > 0));
  assert.equal("rubric" in publicInterviewQuestion(questions[0]), false);
  assert.equal("expectedCriteria" in publicInterviewQuestion(questions[0]), false);
});

test("validates Gemini question rewrites and falls back to the bounded role question bank", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  const options = {
    career: "Cloud Platform Engineer",
    skills: ["Cloud infrastructure"],
    interviewType: "technical",
    difficulty: "intermediate",
    duration: 15,
  };
  try {
    const generated = await generateCareerInterviewQuestions(options, async () => ({
      questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index + 1}`, question: `For this role, explain a validated cloud platform decision number ${index + 1}?` })),
    }));
    assert.equal(generated.generationMethod, "ai_provider_role_adaptation");
    assert.equal(generated.questions.length, 5);
    assert.match(generated.questions[1].question, /validated cloud platform decision/);

    const fallback = await generateCareerInterviewQuestions(options, async () => ({ questions: [] }));
    assert.equal(fallback.generationMethod, "role_question_bank");
    assert.equal(fallback.questions.length, 5);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("evaluates answer content only and reports review areas without claiming hiring outcomes", async () => {
  const question = buildInterviewQuestions({
    career: "Data Analyst",
    skills: ["SQL"],
    interviewType: "technical",
    difficulty: "beginner",
    duration: 15,
  })[1];
  const evaluation = await evaluateInterviewAnswer(question, "I would use SQL because I can validate it with a test query. For example, in my project I checked the result.");
  assert.ok(evaluation.score >= 0 && evaluation.score <= 100);
  assert.equal(evaluation.reviewSkill, "SQL");
  assert.equal(evaluation.evaluationMethod, "structured_practice_review");
  assert.ok(Array.isArray(evaluation.improvements));
});

test("builds honest aggregate reports for answered and skipped questions", () => {
  const questions = buildInterviewQuestions({
    career: "Product Designer",
    skills: ["Prototyping"],
    interviewType: "mixed",
    difficulty: "intermediate",
    duration: 15,
  });
  const report = buildInterviewReport({ questions }, [
    { category: questions[0].category, score: 80, strengths: ["Clear example"], improvements: [], reviewSkill: null },
    { category: questions[1].category, score: 50, strengths: [], improvements: ["Explain trade-offs"], reviewSkill: "Prototyping" },
  ]);
  assert.equal(report.overallScore, 65);
  assert.equal(report.completedAnswers, 2);
  assert.equal(report.totalQuestions, 5);
  assert.deepEqual(report.weakSkills, ["Prototyping"]);
  assert.match(report.note, /not a hiring decision/);
});
