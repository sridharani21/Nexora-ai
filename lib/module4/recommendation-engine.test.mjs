import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareerEvidence,
  getModule4Readiness,
  MODULE4_MATCH_WEIGHTS,
  rankCareerOptions,
} from "./recommendation-engine.js";

const career = {
  slug: "software-developer",
  title: "Software Developer",
  family: "Software & Digital",
  domain: "Technology",
  skills: [
    { name: "Programming", evidenceTopics: ["programming", "coding"] },
    { name: "Databases", evidenceTopics: ["database", "sql"] },
    { name: "Software testing", evidenceTopics: ["testing"] },
  ],
  interestDimensions: ["I", "R"],
  projectIdeas: ["Build a small tested web application"],
};

test("does not interpret missing student information as a known skill deficit", () => {
  const evidence = buildCareerEvidence(career, {
    hasProfileData: false,
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
    assessment: { completed: false, topics: [] },
    riasec: { completed: false },
  });
  assert.deepEqual(evidence.unknownSkills, ["Programming", "Databases", "Software testing"]);
  assert.deepEqual(evidence.developmentSkills, []);
  assert.equal(evidence.interestAlignment.status, "RIASEC assessment not completed");
  assert.equal(evidence.technicalAssessment.status, "Technical assessment not completed");
});

test("uses stable title ordering for careers tied on every ranking signal", () => {
  const second = { ...career, slug: "research-analyst", title: "Research Analyst" };
  const student = {
    profileReady: false,
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
    assessment: { completed: false, topics: [] },
    riasec: { completed: false },
  };

  const firstOrder = rankCareerOptions([career, second], student).options.map((option) => option.slug);
  const reversedOrder = rankCareerOptions([second, career], student).options.map((option) => option.slug);

  assert.deepEqual(firstOrder, ["research-analyst", "software-developer"]);
  assert.deepEqual(reversedOrder, firstOrder);
});

test("keeps profile mentions distinct from topic-level assessment evidence", () => {
  const evidence = buildCareerEvidence(career, {
    hasProfileData: true,
    skills: [{ name: "JavaScript", source: "resume" }],
    projects: [{ title: "Inventory app", technologies: "SQL" }],
    experience: [],
    certifications: [],
    assessment: { completed: true, topics: [{ topic: "database", percentage: 72 }] },
    riasec: { completed: true, interestCode: "I-R-A", scores: { I: { mean: 4 }, R: { mean: 3 } } },
    preferences: { roles: [], domains: [], interests: [], goals: "" },
  });
  assert.equal(evidence.profileMatches.length, 0);
  assert.deepEqual(evidence.projectMatches.map((match) => match.skill), ["Databases"]);
  assert.equal(evidence.assessmentMatches[0].topic, "database");
  assert.equal(evidence.assessmentMatches[0].result, "Positive topic signal");
  assert.deepEqual(evidence.interestAlignment.dimensions, ["I", "R"]);
  assert.equal(evidence.skillEvidence.find((item) => item.skill === "Programming").status, "Not yet assessed");
});

test("uses deterministic evidence ranking and does not manufacture a match score", () => {
  const other = { ...career, slug: "research-analyst", title: "Research Analyst", family: "Research" };
  const student = { hasProfileData: false, skills: [], projects: [], experience: [], certifications: [] };
  const baseline = rankCareerOptions([career, other], student);
  assert.equal(baseline.method, "transparent-evidence-baseline-v2");
  assert.equal("score" in baseline.options[0], false);
  assert.deepEqual(baseline.options.map((item) => item.slug), ["research-analyst", "software-developer"]);
});

test("calculates the versioned weighted career match score from actual evidence", () => {
  const evidence = buildCareerEvidence(career, {
    profileReady: true,
    hasProfileData: true,
    skills: [{ name: "Programming", source: "manual" }],
    projects: [{ title: "Inventory app", technologies: "SQL" }],
    experience: [],
    certifications: [],
    assessment: { completed: true, topics: [
      { topic: "programming", percentage: 80 },
      { topic: "database", percentage: 60 },
    ] },
    riasec: {
      completed: true,
      interestCode: "I-R-A",
      scores: { I: { mean: 4 }, R: { mean: 3 } },
    },
  });

  assert.equal(evidence.dimensionScores.technicalAlignment, 70);
  assert.equal(evidence.dimensionScores.interestAlignment, 63);
  assert.equal(evidence.dimensionScores.profileAlignment, 67);
  assert.equal(evidence.matchScore, 67);
  assert.equal(evidence.scoring.method, "transparent-evidence-baseline-v2");
  assert.equal(evidence.skillEvidence.find((item) => item.skill === "Programming").status, "Demonstrated");
  assert.equal(evidence.skillEvidence.find((item) => item.skill === "Databases").status, "Developing");
  assert.equal(evidence.skillEvidence.find((item) => item.skill === "Software testing").status, "Not yet assessed");
  assert.deepEqual(evidence.scoring.weights, MODULE4_MATCH_WEIGHTS);
});

test("renormalizes available match dimensions instead of assigning missing data a zero", () => {
  const evidence = buildCareerEvidence(career, {
    profileReady: true,
    skills: [{ name: "Programming" }],
    projects: [],
    experience: [],
    certifications: [],
    assessment: { completed: true, topics: [] },
    riasec: { completed: true, interestCode: "I-R-A", scores: { I: { mean: 5 }, R: { mean: 5 } } },
  });
  assert.equal(evidence.dimensionScores.technicalAlignment, null);
  assert.deepEqual(evidence.scoring.missingDimensions, ["technicalAlignment"]);
  assert.deepEqual(evidence.scoring.weights, { interestAlignment: 0.6, profileAlignment: 0.4 });
  assert.equal(evidence.matchScore, 73);
});

test("ignores invalid scores and never emits non-finite career scores", () => {
  const evidence = buildCareerEvidence(career, {
    profileReady: true,
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
    assessment: { completed: true, topics: [
      { topic: "programming", percentage: 140 },
      { topic: "database", percentage: -10 },
    ] },
    riasec: { completed: true, interestCode: "I-R-A", scores: { I: { mean: 9 }, R: { mean: 2 } } },
  });
  assert.equal(evidence.dimensionScores.technicalAlignment, null);
  assert.equal(evidence.dimensionScores.interestAlignment, null);
  assert.equal(evidence.matchScore, 0);
  assert.ok(Number.isFinite(evidence.dimensionScores.profileAlignment));
  assert.ok(Number.isFinite(evidence.matchScore));
});

test("requires a usable profile and completed Module 2 and Module 3 evidence", () => {
  const readiness = getModule4Readiness({
    profileReady: false,
    assessment: { completed: false },
    riasec: { completed: false },
  });
  assert.equal(readiness.eligible, false);
  assert.deepEqual(readiness.missing.map((item) => item.key), ["profile", "assessment", "riasec"]);
  assert.equal(getModule4Readiness({
    profileReady: true,
    assessment: { completed: true },
    riasec: { completed: true },
  }).eligible, true);
});
