import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfileCompleteness, studentProfileSchema } from "./student-profile.js";

test("keeps unfilled profile values empty", () => {
  const result = studentProfileSchema.parse({});
  assert.equal(result.academic.gpa, "");
  assert.equal(result.academic.gradingScale, "");
  assert.deepEqual(result.skills, []);
  assert.equal(result.preferences.willingToRelocate, "");
});

test("validates GPA against the selected grading scale", () => {
  const missingScale = studentProfileSchema.safeParse({
    academic: { gpa: "3.2" },
  });
  assert.equal(missingScale.success, false);
  assert.ok(missingScale.error.issues.some((issue) => issue.path.join(".") === "academic.gradingScale"));
  const result = studentProfileSchema.safeParse({
    academic: { gradingScale: "4", gpa: "4.1" },
  });
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].path.join("."), "academic.gpa");
});

test("requires a custom maximum for an unlisted grading scale", () => {
  assert.equal(studentProfileSchema.safeParse({
    academic: { gradingScale: "other", gpa: "8" },
  }).success, false);
  assert.equal(studentProfileSchema.safeParse({
    academic: { gradingScale: "other", gpa: "8", gpaMaximum: "12" },
  }).success, true);
});

test("rejects invalid dates, reversed ranges, and unsafe URL schemes", () => {
  assert.equal(studentProfileSchema.safeParse({
    projects: [{ title: "Project", startDate: "2024-02-30" }],
  }).success, false);
  assert.equal(studentProfileSchema.safeParse({
    projects: [{ title: "Project", startDate: "2024-05", endDate: "2024-04" }],
  }).success, false);
  assert.equal(studentProfileSchema.safeParse({
    links: { website: "javascript:alert(1)" },
  }).success, false);
});

test("rejects duplicate skills after case normalization", () => {
  const result = studentProfileSchema.safeParse({
    skills: [{ name: "React" }, { name: " react " }],
  });
  assert.equal(result.success, false);
});

test("calculates completeness only from entered profile data", () => {
  assert.equal(calculateProfileCompleteness({}), 0);
  assert.equal(calculateProfileCompleteness({
    academic: { institution: "College", degree: "B.Tech", branch: "CSE", expectedGraduationYear: "2027" },
    skills: [{}],
    projects: [],
    summary: "",
    phone: "",
  }), 63);
});
