import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCareerSkills,
  buildPreparationTasks,
  buildWeeklyGoals,
  buildTopicQuestions,
  ensureTaskResources,
  getPreparationProgress,
  gradeTopicAnswers,
  MODULE5_PASS_THRESHOLD,
  preparationSetupSchema,
  summarizeAssessment,
  summarizeWeeklyAssessments,
  validateTopicAnswers,
} from "./preparation-plan.js";

const validSetup = {
  careerId: "00000000-0000-4000-8000-000000000001",
  goalId: "00000000-0000-4000-8000-000000000002",
  weeks: 8,
  dailyHours: 2,
  studyDays: 5,
  startDate: "2026-11-02",
  skillLevel: "beginner",
  learningPreference: "mixed",
};

test("validates schedule limits and rejects malformed career handoff inputs", () => {
  assert.equal(preparationSetupSchema.safeParse(validSetup).success, true);
  assert.equal(preparationSetupSchema.safeParse({ ...validSetup, weeks: 53 }).success, false);
  assert.equal(preparationSetupSchema.safeParse({ ...validSetup, careerId: "forged-id" }).success, false);
});

test("keeps missing evidence unknown and preserves self-reported status", () => {
  const analysis = analyzeCareerSkills([
    { name: "SQL", category: "data", importance: "core" },
    { name: "Communication", category: "people", importance: "related" },
  ], [{ skill: "Communication", status: "Self-reported", evidence: ["profile"] }]);

  assert.equal(analysis[0].status, "Not yet assessed");
  assert.equal(analysis[0].needsDevelopment, false);
  assert.equal(analysis[0].priority, "essential");
  assert.equal(analysis[1].status, "Self-reported");
  assert.equal(analysis[1].currentProficiency, "Self-reported; not independently verified");
});

test("creates tasks that match the selected weekly schedule and stay within daily study time", () => {
  const tasks = buildPreparationTasks({
    career: "Data Analyst",
    ...validSetup,
    learningResources: [{
      title: "SQL guide",
      url: "https://example.test/sql",
      relatedSkill: "SQL",
      provider: "Guide",
      contentType: "Official documentation",
      cost: "free",
    }],
    skillAnalysis: [
      { name: "SQL", priority: "essential", needsDevelopment: true },
      { name: "Communication", priority: "important", needsDevelopment: false },
    ],
  });

  assert.equal(tasks.length, validSetup.weeks * validSetup.studyDays);
  assert.equal(tasks[0].scheduledDate.toISOString().slice(0, 10), validSetup.startDate);
  assert.equal(tasks[4].weekNumber, 1);
  assert.equal(tasks[5].scheduledDate.toISOString().slice(0, 10), "2026-11-09");
  assert.ok(tasks.every((task) => task.durationMinutes <= validSetup.dailyHours * 60));
  assert.ok(tasks.every((task) => task.resources.every((resource) => resource.url.startsWith("https://"))));
  assert.match(tasks[0].activity, /reference/);
  assert.equal(tasks[0].resources[0].contentType, "Official documentation");
});

test("learning preference changes practice guidance and matched resource order", () => {
  const skillAnalysis = [{ name: "SQL", priority: "essential", needsDevelopment: true }];
  const learningResources = [
    { title: "SQL course", url: "https://example.test/course", relatedSkill: "SQL", contentType: "Video course" },
    { title: "SQL docs", url: "https://example.test/docs", relatedSkill: "SQL", contentType: "Official documentation" },
  ];
  const videoPlan = buildPreparationTasks({
    career: "Data Analyst",
    ...validSetup,
    learningPreference: "videos",
    skillAnalysis,
    learningResources,
  });
  const readingPlan = buildPreparationTasks({
    career: "Data Analyst",
    ...validSetup,
    learningPreference: "reading",
    skillAnalysis,
    learningResources,
  });

  assert.match(videoPlan[0].activity, /Watch/);
  assert.equal(videoPlan[0].resources[0].title, "SQL course");
  assert.match(readingPlan[0].activity, /Read/);
  assert.equal(readingPlan[0].resources[0].title, "SQL docs");
});

test("provides a skill-specific resource search for every task without a catalogue match", () => {
  const tasks = buildPreparationTasks({
    career: "Community Health Worker",
    ...validSetup,
    learningPreference: "reading",
    skillAnalysis: [
      { name: "Patient communication", priority: "essential", needsDevelopment: false },
      { name: "Community outreach", priority: "important", needsDevelopment: false },
    ],
    learningResources: [],
  });

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.resources.length > 0));
  assert.ok(tasks.every((task) => task.resources[0].url.startsWith("https://")));
  assert.ok(tasks.every((task) => task.resources[0].relatedSkill === task.skill));
  assert.ok(tasks.every((task) => task.resources[0].title.includes(task.skill)));
  assert.equal(ensureTaskResources([], "Patient communication", "reading")[0].relatedSkill, "Patient communication");
});

test("weekly goals incorporate the selected career competency stage", () => {
  const tasks = [
    { weekNumber: 1, skill: "Programming" },
    { weekNumber: 1, skill: "Databases" },
    { weekNumber: 2, skill: "Programming" },
  ];
  const goals = buildWeeklyGoals(tasks, {
    skillLevel: "beginner",
    competencyProgression: {
      beginner: {
        competencies: [
          "Explain the fundamentals of Programming and complete a guided exercise.",
          "Explain the fundamentals of Databases and complete a guided exercise.",
        ],
      },
    },
  });
  assert.equal(goals.length, 2);
  assert.equal(goals[0].scheduledStudyDays, 2);
  assert.equal(goals[0].goals.length, 2);
  assert.match(goals[1].goals[0], /Programming/);
});

test("weekly assessment history aggregates the correct attempts and reports latest score", () => {
  const summary = summarizeWeeklyAssessments([
    { kind: "weekly", weekNumber: 2, score: 80, passed: true, submittedAt: "2026-10-20T02:00:00Z" },
    { kind: "daily", weekNumber: 2, score: 40, passed: false },
    { kind: "weekly", weekNumber: 1, score: 60, passed: false, submittedAt: "2026-10-18T00:00:00Z" },
    { kind: "weekly", weekNumber: 2, score: 50, passed: false, submittedAt: "2026-10-20T01:00:00Z" },
  ]);

  assert.deepEqual(summary, [
    { weekNumber: 1, attempts: 1, averageScore: 60, latestScore: 60, latestPassed: false },
    { weekNumber: 2, attempts: 2, averageScore: 65, latestScore: 80, latestPassed: true },
  ]);
});

test("grades checks on the server threshold and returns actionable concept feedback", () => {
  const questions = buildTopicQuestions({ career: "Data Analyst", skill: "SQL" });
  assert.equal(questions.length, 30);
  assert.equal(new Set(questions.map((question) => question.prompt)).size, 30);
  assert.equal(new Set(questions.map((question) => question.concept)).size, 30);
  assert.ok(questions.every((question) => question.prompt.includes("SQL") || question.prompt.includes("Data Analyst")));
  assert.ok(questions.every((question) => !question.prompt.includes("{skill}") && !question.prompt.includes("{career}")));
  assert.ok(new Set(questions.map((question) => question.correctAnswer)).size > 1);
  const correctAnswers = Object.fromEntries(questions.map((question) => [question.id, question.correctAnswer]));
  assert.equal(validateTopicAnswers(questions, correctAnswers), true);
  assert.equal(validateTopicAnswers(questions, { ...correctAnswers, unexpected: 0 }), false);
  assert.equal(validateTopicAnswers(questions, { ...correctAnswers, q1: 99 }), false);
  assert.equal(validateTopicAnswers(questions, { q1: questions[0].correctAnswer }), false);
  assert.equal(buildTopicQuestions({ career: "Data Analyst", skill: "SQL", limit: 5 }).length, 5);
  const summary = summarizeAssessment({
    id: "attempt",
    kind: "daily",
    weekNumber: 1,
    attemptNumber: 1,
    score: 100,
    passed: true,
    submittedAt: new Date("2026-10-20T00:00:00Z"),
    feedback: { results: [{ correctAnswer: 0 }] },
  });
  assert.equal("feedback" in summary, false);
  const fullScore = gradeTopicAnswers(
    questions,
    correctAnswers,
  );
  assert.equal(fullScore.score, 100);
  assert.equal(fullScore.passed, true);

  const passingAnswers = Object.fromEntries(
    questions.slice(0, 21).map((question) => [question.id, question.correctAnswer]),
  );
  const passing = gradeTopicAnswers(questions, passingAnswers);
  assert.equal(MODULE5_PASS_THRESHOLD, 70);
  assert.equal(passing.score, 70);
  assert.equal(passing.passed, true);

  const failing = gradeTopicAnswers(questions, { q1: questions[0].correctAnswer });
  assert.equal(failing.score, 3);
  assert.equal(failing.passed, false);
  assert.ok(failing.weakConcepts.length > 0);
});

test("calculates persisted-task progress without inventing a score", () => {
  const progress = getPreparationProgress([
    { status: "completed" },
    { status: "pending" },
    { status: "started" },
  ], [
    {
      kind: "daily",
      taskId: "task-a",
      score: 80,
      submittedAt: "2026-10-19T00:00:00Z",
      feedback: { weakConcepts: ["SQL"] },
    },
    {
      kind: "daily",
      taskId: "task-a",
      score: 100,
      submittedAt: "2026-10-20T00:00:00Z",
      feedback: { weakConcepts: [] },
    },
    {
      kind: "weekly",
      weekNumber: 1,
      score: 60,
      submittedAt: "2026-10-20T01:00:00Z",
      feedback: { weakConcepts: ["revision"] },
    },
  ]);

  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.progressPercent, 33);
  assert.equal(progress.assessmentAverage, 80);
  assert.equal(progress.assessmentCount, 3);
  assert.equal(progress.topicCheckCount, 2);
  assert.equal(progress.weeklyAssessmentCount, 1);
  assert.deepEqual(progress.weakConcepts, ["revision"]);
  assert.deepEqual(progress.nextTask, { status: "pending" });
  assert.equal(getPreparationProgress([], []).assessmentAverage, null);
});
