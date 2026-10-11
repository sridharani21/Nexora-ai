import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlacementScore,
  PLACEMENT_SCORE_FORMULA_VERSION,
  weightedAverageMeasured,
} from "../lib/prep-score.js";
import { aggregateReadinessSkills } from "../lib/prep-evidence.js";
import { evaluateSkill } from "../data/prep-levels.js";
import { buildPrepProfileData, prepProfileInputSchema } from "../lib/prep-profile-input.js";

test("placement score renormalizes weights over measured components only", () => {
  const result = calculatePlacementScore({
    technical: 80,
    coding: 60,
    aptitude: null,
    communication: undefined,
    interview: null,
    resume: null,
  });

  assert.equal(result.overallReadiness, 70);
  assert.equal(result.evidenceCoverage, 50);
  assert.equal(result.scoreComponents.technical.effectiveWeight, 50);
  assert.equal(result.scoreComponents.coding.effectiveWeight, 50);
  assert.equal(result.scoreComponents.interview.status, "UNKNOWN");
  assert.equal(result.scoreComponents.interview.effectiveWeight, 0);
});

test("placement score reports no result when no components have evidence", () => {
  const result = calculatePlacementScore({});
  assert.equal(result.overallReadiness, null);
  assert.equal(result.evidenceCoverage, 0);
  assert.ok(Object.values(result.scoreComponents).every((component) => component.status === "UNKNOWN"));
});

test("placement score formula is versioned", () => {
  assert.equal(PLACEMENT_SCORE_FORMULA_VERSION, "placement-score-v3");
});

test("topic composite score renormalizes when one input has no evidence", () => {
  assert.equal(weightedAverageMeasured([[80, 0.55], [null, 0.45]]), 80);
  assert.equal(weightedAverageMeasured([[80, 0.55], [60, 0.45]]), 71);
});

test("readiness aggregation records assessment and practice evidence without inventing unknown scores", () => {
  const skills = aggregateReadinessSkills({
    assessmentId: "assessment-1",
    assessmentScores: { dsa: 70 },
    previousAssessmentScores: { dsa: 60 },
    practiceAttempts: [
      { id: "practice-1", subject: "dsa", score: 80 },
      { id: "practice-2", subject: "coding", score: 90 },
    ],
  });

  assert.equal(skills.dsa.score, 75);
  assert.equal(skills.dsa.trend, "Improving");
  assert.deepEqual(skills.dsa.evidenceRecordIds, ["assessment-1", "practice-1"]);
  assert.equal(skills.programming.score, 90);
  assert.deepEqual(skills.programming.evidenceRecordIds, ["practice-2"]);
  assert.equal(skills.technical.score, null);
  assert.equal(skills.technical.evidenceCount, 0);
});

test("mixed practice attempts contribute separately to each measured skill and topic", () => {
  const skills = aggregateReadinessSkills({
    practiceAttempts: [{
      id: "mixed-1",
      subject: "mixed",
      questionIds: JSON.stringify(["p7", "p13"]),
      answers: JSON.stringify({ p7: "0", p13: "where" }),
    }],
  });

  assert.equal(skills.dsa.score, 100);
  assert.equal(skills.technical.score, 100);
  assert.equal(skills.dsa.topicEvidence.Arrays.accuracy, 100);
  assert.equal(skills.technical.topicEvidence.Queries.questionCount, 1);
  assert.deepEqual(skills.dsa.evidenceRecordIds, ["mixed-1"]);
});

test("readiness uses saved Gemini questions to attribute generated practice to each skill", () => {
  const question = {
    id: "generated-dsa-1",
    subject: "dsa",
    topic: "Graphs",
    difficulty: "hard",
    answer: "b",
  };
  const skills = aggregateReadinessSkills({
    practiceAttempts: [{
      id: "generated-practice-1",
      subject: "mixed",
      questionIds: JSON.stringify([question.id]),
      questionData: JSON.stringify([question]),
      answers: JSON.stringify({ [question.id]: "b" }),
    }],
  });

  assert.equal(skills.dsa.score, 100);
  assert.equal(skills.dsa.topicEvidence.Graphs.questionCount, 1);
  assert.deepEqual(skills.dsa.evidenceRecordIds, ["generated-practice-1"]);
  assert.equal(skills.technical.score, null);
});

test("adaptive learning does not assign a proficiency level without attempts", () => {
  const result = evaluateSkill({ id: "dsa", topics: ["Arrays", "Trees", "Graphs"] }, []);
  assert.equal(result.hasEvidence, false);
  assert.equal(result.currentLevel, null);
  assert.equal(result.levelScore, null);
  assert.match(result.nextLevelReason, /Complete a practice attempt/);
});

test("profile partial updates preserve unedited fields and allow intentional clears", () => {
  const identity = { clerkUserId: "clerk-1", email: "student@example.com", fullName: "Student One" };
  const existing = {
    fullName: "Saved Student",
    education: "BSc",
    skills: "JavaScript",
    projects: "Portfolio project",
    certifications: "Cloud certification",
    preferredRole: "Frontend Developer",
    targetCompany: "Example",
    location: "Remote",
  };
  const validated = prepProfileInputSchema.parse({ preferredRole: "", projects: "New project" });
  const update = buildPrepProfileData(validated, existing, identity);

  assert.equal(update.skills, existing.skills);
  assert.equal(update.certifications, existing.certifications);
  assert.equal(update.education, existing.education);
  assert.equal(update.projects, "New project");
  assert.equal(update.preferredRole, null);
  assert.equal(update.email, identity.email);
});
