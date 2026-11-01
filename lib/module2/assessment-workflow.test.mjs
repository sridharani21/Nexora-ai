import test from "node:test";
import assert from "node:assert/strict";
import { MODULE2_BLUEPRINTS, getBlueprintForBranch, validateBlueprint } from "./blueprints.js";
import { generateAttemptQuestions } from "./assessment-generator.js";
import {
  findReusableQuestionSet,
  hasSimilarQuestion,
  isReusableQuestionSet,
  splitSectionForGeneration,
  validateAndNormalizeSection,
} from "./assessment-validation.js";
import { calculateAssessmentResult } from "./assessment-scoring.js";
import { toStudentQuestion } from "./assessment-presentation.js";
import { createPossiblePhoneDetector, getPossiblePhoneDetectorStatus } from "./phone-detector.js";
import {
  calculateCooldownSeconds,
  canAnswerBeforeDeadline,
  classifyIntegrityEvent,
  formatAssessmentDuration,
  getRemainingAssessmentSeconds,
  integrityViolationLevel,
  integrityEventGroup,
  isDeadlineExpired,
  isImmediateIntegrityTermination,
  isMobileAssessmentClient,
} from "./assessment-policy.js";
import { JUDGE0_LANGUAGE_IDS, parseJudge0Result } from "./judge0-helpers.js";

const ids = { createId: (() => {
  let next = 0;
  return () => `question-${++next}`;
})() };

function validAptitudeQuestions(section, offset = 0) {
  const difficulties = ["EASY", "MEDIUM", "HARD"].flatMap((difficulty) => (
    Array.from({ length: section.difficultyDistribution[difficulty] }, () => difficulty)
  ));
  return difficulties.map((difficulty, index) => ({
    type: "MCQ",
    sectionId: section.id,
    topic: section.topics[index % section.topics.length],
    skillTested: section.skills[index % section.skills.length],
    learningObjective: section.learningObjectives[index % section.learningObjectives.length],
    selectionReason: "This item checks a relevant skill through a concise, role-aligned scenario.",
    careerRoleRelevance: "The target role uses this skill to make reliable technical decisions.",
    expectedEvidence: "The student applies the stated concept and selects a defensible result.",
    estimatedTimeSeconds: section.durationSeconds / section.questionCount,
    evaluationCriteria: "Award credit only when the selected option satisfies the stated requirements.",
    difficulty,
    questionText: `${section.id} scenario variant${offset + index}alpha pattern${offset + index}bravo outcome${offset + index}charlie: choose the single correct result using the facts in this scenario.`,
    options: [
      { key: "A", text: `Correct ${index}` },
      { key: "B", text: `Incorrect ${index} B` },
      { key: "C", text: `Incorrect ${index} C` },
      { key: "D", text: `Incorrect ${index} D` },
    ],
    correctOption: "A",
    explanation: "The answer follows from the stated relationship and the required calculation.",
    marks: section.marks / section.questionCount,
    negativeMarks: section.marks / section.questionCount * 0.25,
  }));
}

function validCodingQuestions(section, offset = 0) {
  return ["MEDIUM", "HARD"].map((difficulty, index) => ({
    type: "CODING",
    sectionId: section.id,
    topic: section.topics[index],
    skillTested: section.skills[index],
    learningObjective: section.learningObjectives[index % section.learningObjectives.length],
    selectionReason: "This exercise measures implementation skill under the configured section time allocation.",
    careerRoleRelevance: "The target role requires translating a technical requirement into working code.",
    expectedEvidence: "The solution handles normal inputs, boundaries, and the stated constraints.",
    estimatedTimeSeconds: section.durationSeconds / section.questionCount,
    evaluationCriteria: "The implementation must produce the expected output for the public and private tests.",
    difficulty,
    title: `Coding task ${offset + index + 1}`,
    questionText: `Implement variant${offset + index}alpha pattern${offset + index}bravo outcome${offset + index}charlie as a bounded coding task and print its required result.`,
    explanation: "The reference method uses a direct traversal and handles each input case.",
    solution: "def solve():\n    print(0)\n",
    inputFormat: "The first line contains an integer n followed by values.",
    outputFormat: "Print the calculated result on a single line.",
    constraints: "1 <= n <= 100",
    starterCode: { "Python 3": "" },
    sampleExplanation: "For the example input, the computed result is shown.",
    publicTestCases: [{ input: "1\n0", expectedOutput: "0" }],
    privateTestCases: [
      { input: "1\n1", expectedOutput: "1" },
      { input: "2\n1 2", expectedOutput: "3" },
      { input: "2\n-1 1", expectedOutput: "0" },
      { input: "3\n1 2 3", expectedOutput: "6" },
    ],
    supportedLanguages: ["Python 3"],
    timeLimitSeconds: 3,
    memoryLimitMb: 128,
    marks: section.marks / section.questionCount,
    negativeMarks: 0,
  }));
}

test("branch blueprints enforce question counts, duration rules, marks, and branch-specific coding", () => {
  assert.equal(MODULE2_BLUEPRINTS.length, 6);
  for (const blueprint of MODULE2_BLUEPRINTS) {
    assert.equal(validateBlueprint(blueprint).success, true);
    assert.equal(blueprint.durationSeconds, blueprint.sections.reduce((sum, section) => sum + section.durationSeconds, 0));
    assert.equal(blueprint.sections.reduce((sum, section) => sum + section.marks, 0), 100);
    assert.equal(
      blueprint.sections.some((section) => section.questionType === "CODING"),
      ["CSE", "IT"].includes(blueprint.branch),
    );
    if (["CSE", "IT"].includes(blueprint.branch)) {
      assert.equal(blueprint.sections.reduce((sum, section) => sum + section.questionCount, 0), 40);
      assert.equal(blueprint.sections.find((section) => section.questionType === "CODING").questionCount, 2);
      assert.equal(blueprint.durationSeconds, 3600);
    } else {
      assert.equal(blueprint.sections.reduce((sum, section) => sum + section.questionCount, 0), 40);
      assert.equal(blueprint.durationSeconds, 1600);
    }
  }
  assert.deepEqual(
    getBlueprintForBranch("CSE").sections.map(({ questionCount, durationSeconds }) => [questionCount, durationSeconds]),
    [[10, 300], [8, 300], [5, 240], [5, 180], [5, 180], [5, 600], [2, 1800]],
  );
  assert.equal(getBlueprintForBranch("Electronic and Communication Engineering").branch, "ECE");

  const invalidBlueprint = structuredClone(getBlueprintForBranch("CSE"));
  invalidBlueprint.sections[0].questionCount -= 1;
  assert.equal(validateBlueprint(invalidBlueprint).success, false);
});

test("generation batches remain small while preserving section marks, time, and difficulty mix", () => {
  const section = getBlueprintForBranch("CSE").sections[0];
  const batches = splitSectionForGeneration(section);
  assert.deepEqual(batches.map((batch) => batch.questionCount), [4, 4, 2]);
  assert.equal(batches.reduce((sum, batch) => sum + batch.marks, 0), section.marks);
  assert.equal(batches.reduce((sum, batch) => sum + batch.durationSeconds, 0), section.durationSeconds);
  assert.deepEqual(
    batches.reduce((totals, batch) => ({
      EASY: totals.EASY + batch.difficultyDistribution.EASY,
      MEDIUM: totals.MEDIUM + batch.difficultyDistribution.MEDIUM,
      HARD: totals.HARD + batch.difficultyDistribution.HARD,
    }), { EASY: 0, MEDIUM: 0, HARD: 0 }),
    section.difficultyDistribution,
  );
  assert.deepEqual(
    splitSectionForGeneration(getBlueprintForBranch("CSE").sections.at(-1)).map((batch) => batch.questionCount),
    [1, 1],
  );
});

test("CSE validation produces exactly 40 questions including two timed coding problems", () => {
  const blueprint = getBlueprintForBranch("CSE");
  const questions = blueprint.sections.flatMap((section) => (
    validateAndNormalizeSection(blueprint, section, {
      questions: section.questionType === "CODING"
        ? validCodingQuestions(section)
        : validAptitudeQuestions(section),
    }, ids)
  ));
  assert.equal(questions.length, 40);
  assert.equal(questions.filter((question) => question.type === "CODING").length, 2);
  assert.deepEqual(
    questions.filter((question) => question.type === "CODING").map((question) => question.estimatedTimeSeconds),
    [900, 900],
  );
  assert.ok(Math.abs(questions.reduce((sum, question) => sum + question.marks, 0) - 100) < 0.01);
});

test("assessment question generation preserves the validated full blueprint", async () => {
  const blueprint = getBlueprintForBranch("CSE");
  let generationQuestionOffset = 0;
  const questions = await generateAttemptQuestions(blueprint, {
    maxAttempts: 1,
    generate: async (_prompt, questionType, _attempt, requestSection) => {
      const questionOffset = generationQuestionOffset;
      generationQuestionOffset += requestSection.questionCount;
      return {
        questions: (questionType === "CODING"
        ? validCodingQuestions(requestSection, questionOffset)
          .filter((question) => requestSection.difficultyDistribution[question.difficulty] > 0)
          .slice(0, requestSection.questionCount)
        : validAptitudeQuestions(requestSection, questionOffset)),
      };
    },
  });
  assert.equal(questions.length, 40);
  assert.equal(questions.filter((question) => question.type === "CODING").length, 2);
  assert.ok(Math.abs(questions.reduce((sum, question) => sum + question.marks, 0) - 100) < 0.01);
});

test("generation validation rejects malformed choices, invalid mark weights, wrong branch topics and difficulty mix", () => {
  const blueprint = getBlueprintForBranch("CSE");
  const section = blueprint.sections[0];
  const questions = validAptitudeQuestions(section);
  const accepted = validateAndNormalizeSection(blueprint, section, { questions }, ids);
  assert.equal(accepted.length, 10);
  assert.equal(accepted.reduce((sum, question) => sum + question.marks, 0), section.marks);

  const duplicateOption = structuredClone(questions);
  duplicateOption[0].options[1].text = duplicateOption[0].options[0].text;
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: duplicateOption }, ids),
    /required structure|distinct/,
  );

  const invalidMarks = structuredClone(questions);
  invalidMarks[0].marks = 4;
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: invalidMarks }, ids),
    /marks/,
  );

  const wrongTopic = structuredClone(questions);
  wrongTopic[0].topic = "Thermodynamics";
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: wrongTopic }, ids),
    /unapproved topic/,
  );

  const foreignCurrency = structuredClone(questions);
  foreignCurrency[0].questionText = "A product costs $120. Calculate its final price after the discount.";
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: foreignCurrency }, ids),
    /Indian rupees/,
  );

  const wrongDifficulty = structuredClone(questions);
  wrongDifficulty[0].difficulty = "HARD";
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: wrongDifficulty }, ids),
    /difficulty mix/,
  );
});

test("cached question sets must match the branch blueprint and avoid recent questions", () => {
  const blueprint = getBlueprintForBranch("CIVIL");
  let serial = 0;
  const questions = blueprint.sections.flatMap((section) => (
    ["EASY", "MEDIUM", "HARD"].flatMap((difficulty) => (
      Array.from({ length: section.difficultyDistribution[difficulty] }, (_, index) => ({
        id: `${section.id}-${difficulty}-${index}`,
        sectionId: section.id,
        topic: section.topics[0],
        difficulty,
        type: section.questionType,
        questionText: `Scenario ${++serial} requires choosing among engineering options. Evaluate detail${serial}factor, method${serial}value, context${serial}data, result${serial}case, parameter${serial}rule, and output${serial}target.`,
        skillTested: section.skills[0],
        learningObjective: section.learningObjectives[0],
        estimatedTimeSeconds: section.durationSeconds / section.questionCount,
        marks: section.marks / section.questionCount,
      }))
    ))
  ));
  assert.equal(isReusableQuestionSet(blueprint, questions), true);
  assert.equal(isReusableQuestionSet(blueprint, questions.slice(1)), false);
  assert.equal(isReusableQuestionSet(blueprint, questions, [questions[0].questionText]), false);
  assert.equal(isReusableQuestionSet(blueprint, [{ ...questions[0], marks: 50 }, ...questions.slice(1)]), false);
  assert.equal(isReusableQuestionSet(blueprint, [{ ...questions[0], explanation: "Cost: $250." }, ...questions.slice(1)]), false);
  assert.equal(findReusableQuestionSet(blueprint, [{ questions: questions.slice(1) }]), null);
  assert.deepEqual(
    findReusableQuestionSet(blueprint, [{ questions: questions.slice(1) }, { questions }]),
    { questions },
  );
  assert.equal(
    findReusableQuestionSet(blueprint, [{ questions }], [questions[0].questionText]),
    null,
  );
});

test("near-duplicate detection compares normalized question wording", () => {
  assert.equal(
    hasSimilarQuestion(
      "Which operation removes the most recently added item from a stack data structure?",
      "Which operation removes the most recently added item from a stack data structure!",
    ),
    true,
  );
  assert.equal(hasSimilarQuestion("Choose one", "Choose another"), false);
});

test("coding-question validation requires a complete statement, solution, and private tests", () => {
  const blueprint = getBlueprintForBranch("CSE");
  const section = blueprint.sections.find((item) => item.questionType === "CODING");
  const questions = validCodingQuestions(section);
  const normalized = validateAndNormalizeSection(blueprint, section, { questions }, ids);
  assert.equal(normalized.length, 2);
  assert.ok(normalized.every((question) => question.privateTestCases.length >= 3 && question.solution));

  const missingSolution = structuredClone(questions);
  delete missingSolution[0].solution;
  assert.throws(
    () => validateAndNormalizeSection(blueprint, section, { questions: missingSolution }, ids),
    /required structure/,
  );
});

test("student question projection omits keys, explanations and private test cases", () => {
  const projected = toStudentQuestion({
    id: "q-1",
    type: "CODING",
    correctOption: "A",
    explanation: "Private answer explanation",
    evaluationCriteria: "Private evaluation criteria",
    privateTestCases: [{ input: "hidden input", expectedOutput: "hidden output" }],
    solution: "private reference solution",
    publicTestCases: [{ input: "public input", expectedOutput: "public output", explanation: "visible explanation" }],
  });
  assert.equal("correctOption" in projected, false);
  assert.equal("explanation" in projected, false);
  assert.equal("evaluationCriteria" in projected, false);
  assert.equal("privateTestCases" in projected, false);
  assert.equal("solution" in projected, false);
  assert.deepEqual(projected.publicTestCases, [{ input: "public input", expectedOutput: "public output" }]);
});

test("phone detector integration reports unavailable rather than emitting fake detections", async () => {
  const status = getPossiblePhoneDetectorStatus();
  assert.equal(status.available, false);
  assert.equal(status.status, "not_configured");
  assert.match(status.message, /no camera object inference runs/);
  assert.deepEqual(await createPossiblePhoneDetector(), status);
});

test("server-side scoring applies negative marks, zero unanswered, saved coding test ratios and caps", () => {
  const blueprint = getBlueprintForBranch("CSE");
  const questions = [
    { id: "right", sectionId: "aptitude", sectionName: "Aptitude", topic: "Quantitative Aptitude", difficulty: "EASY", type: "MCQ", questionText: "Question", options: [], correctOption: "A", explanation: "Explanation", marks: 2, negativeMarks: 0.5 },
    { id: "wrong", sectionId: "aptitude", sectionName: "Aptitude", topic: "Quantitative Aptitude", difficulty: "EASY", type: "MCQ", questionText: "Question", options: [], correctOption: "B", explanation: "Explanation", marks: 2, negativeMarks: 0.5 },
    { id: "blank", sectionId: "aptitude", sectionName: "Aptitude", topic: "Logical Reasoning", difficulty: "EASY", type: "MCQ", questionText: "Question", options: [], correctOption: "A", explanation: "Explanation", marks: 2, negativeMarks: 0.5 },
    { id: "code", sectionId: "coding", sectionName: "Coding", topic: "Python", difficulty: "MEDIUM", type: "CODING", questionText: "Question", explanation: "Explanation", marks: 25, negativeMarks: 0 },
  ];
  const result = calculateAssessmentResult({
    blueprint,
    questions,
    answers: {
      right: { choice: "A" },
      wrong: { choice: "A" },
      code: { coding: { submitted: true, passed: 2, total: 4, status: "PARTIAL" } },
    },
    completionReason: "MANUAL_SUBMISSION",
    questionTime: { right: 37 },
    integrityEvents: [{ severity: "WARNING" }, { severity: "TECHNICAL" }],
  });
  assert.equal(result.score, 14);
  assert.equal(result.maxMarks, 31);
  assert.equal(result.correct, 1);
  assert.equal(result.incorrect, 2);
  assert.equal(result.unanswered, 1);
  assert.equal(result.accuracy, 50);
  assert.equal(result.integritySummary.totalEvents, 2);
  assert.deepEqual(result.integritySummary.eventTypes, []);
  assert.equal(result.codingOutcomes[0].passed, 2);
  assert.equal(result.questionTimes[0].seconds, 37);
});

test("deadline and integrity policy are server-oriented and do not auto-penalize one event", () => {
  const deadline = new Date("2026-10-19T10:00:00.000Z");
  assert.equal(isDeadlineExpired(deadline, deadline.getTime() - 1), false);
  assert.equal(isDeadlineExpired(deadline, deadline.getTime()), true);
  assert.equal(canAnswerBeforeDeadline(deadline, deadline.getTime() - 1), true);
  assert.equal(canAnswerBeforeDeadline(deadline, deadline.getTime()), false);
  assert.equal(canAnswerBeforeDeadline(deadline, deadline.getTime() + 1), false);
  assert.equal(getRemainingAssessmentSeconds(deadline, deadline.getTime() - 1_001), 2);
  assert.equal(getRemainingAssessmentSeconds(deadline, deadline.getTime() - 1_000), 1);
  assert.equal(getRemainingAssessmentSeconds(deadline, deadline.getTime()), 0);
  assert.equal(formatAssessmentDuration(1600), "26 min 40 sec");
  assert.equal(formatAssessmentDuration(3600), "60 min");
  assert.equal(integrityViolationLevel(1), "WARNING");
  assert.equal(integrityViolationLevel(2), "STRONG");
  assert.equal(integrityViolationLevel(3), "REVIEW");
  assert.equal(integrityViolationLevel(0), null);
  assert.equal(classifyIntegrityEvent("TAB_HIDDEN"), "WARNING");
  assert.equal(classifyIntegrityEvent("CAMERA_DISCONNECTED"), "TECHNICAL");
  assert.equal(integrityEventGroup("TAB_HIDDEN"), integrityEventGroup("WINDOW_BLUR"));
  assert.equal(integrityEventGroup("CLIPBOARD_COPY"), integrityEventGroup("CLIPBOARD_PASTE"));
  assert.equal(integrityEventGroup("CLIPBOARD_CUT"), integrityEventGroup("CONTEXT_MENU_ATTEMPT"));
  assert.equal(isImmediateIntegrityTermination("MICROPHONE_DISCONNECTED"), true);
  assert.equal(isImmediateIntegrityTermination("CAMERA_DISCONNECTED"), true);
  assert.equal(isImmediateIntegrityTermination("TAB_HIDDEN"), false);
  assert.equal(isMobileAssessmentClient("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), true);
  assert.equal(isMobileAssessmentClient("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
  assert.equal(calculateCooldownSeconds(new Date(deadline.getTime() + 60_000), deadline.getTime()), 60);
});

test("Judge0 result handling distinguishes accepted output from compilation and runtime failures", () => {
  assert.equal(JUDGE0_LANGUAGE_IDS["Python 3"], 71);
  const accepted = parseJudge0Result({
    status: { id: 3, description: "Accepted" },
    stdout: Buffer.from("42\n").toString("base64"),
    time: "0.01",
    memory: 2048,
  }, "42");
  assert.equal(accepted.passed, true);

  const compileError = parseJudge0Result({
    status: { id: 6, description: "Compilation Error" },
    compile_output: Buffer.from("compiler diagnostic").toString("base64"),
  }, "42");
  assert.equal(compileError.passed, false);
  assert.equal(compileError.diagnostic, "compiler diagnostic");
});
