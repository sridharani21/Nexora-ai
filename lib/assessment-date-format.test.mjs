import test from "node:test";
import assert from "node:assert/strict";
import { formatAssessmentDateTime, formatAssessmentTime } from "./assessment-date-format.js";

test("assessment timestamps use the same Indian locale and timezone everywhere", () => {
  const date = "2026-10-19T12:50:55.000Z";
  assert.equal(formatAssessmentDateTime(date), "19/10/2026, 6:20:55 pm");
  assert.equal(formatAssessmentTime(date), "6:20 pm");
  assert.equal(formatAssessmentDateTime("2026-10-19T12:50:55.000-07:00"), "20/10/2026, 1:20:55 am");
});
