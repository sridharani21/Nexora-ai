import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeterministicCareerRoadmap,
  getRoadmapProgress,
  getRoadmapTasks,
  updateRoadmapTask,
} from "./learning-roadmap.js";

const roadmap = {
  months: [{
    month: 1,
    weeks: [
      { week: 1, topics: ["HTML foundations", "Build a profile page"] },
      { week: 2, topics: ["CSS layout", "Make the page responsive"] },
    ],
  }],
};

test("calculates actual task progress and next incomplete item", () => {
  const tasks = getRoadmapTasks(roadmap);
  assert.equal(tasks.length, 4);
  const updated = updateRoadmapTask(roadmap, tasks[0].id, true);
  assert.equal(updated.success, true);
  assert.deepEqual(getRoadmapProgress(updated.roadmap), {
    total: 4,
    completed: 1,
    percentage: 25,
    nextTask: tasks[1],
  });
});

test("enforces sequential prerequisites and prevents reopening a task with completed dependents", () => {
  const tasks = getRoadmapTasks(roadmap);
  assert.match(updateRoadmapTask(roadmap, tasks[2].id, true).error, /earlier task/);
  const first = updateRoadmapTask(roadmap, tasks[0].id, true).roadmap;
  const second = updateRoadmapTask(first, tasks[1].id, true).roadmap;
  assert.match(updateRoadmapTask(second, tasks[0].id, false).error, /later task/);
});

test("does not invent progress for missing or malformed roadmap data", () => {
  assert.deepEqual(getRoadmapProgress(null), { total: 0, completed: 0, percentage: 0, nextTask: null });
  assert.equal(updateRoadmapTask(roadmap, "8:8:8", true).success, false);
});

test("builds a fixed-length career plan from the trusted skills and progression", () => {
  const plan = buildDeterministicCareerRoadmap({
    career: "Software Developer",
    months: 2,
    careerSkills: [
      { name: "Databases", importance: "related" },
      { name: "Programming", importance: "core" },
    ],
    competencyProgression: {
      beginner: { title: "Beginner", competencies: ["Explain programming basics"] },
      intermediate: { title: "Intermediate", competencies: ["Build a database-backed app"] },
    },
  });
  assert.equal(plan.months.length, 2);
  assert.deepEqual(plan.months.map((month) => month.month), [1, 2]);
  assert.equal(plan.months.every((month) => month.weeks.length === 4), true);
  assert.equal(plan.months.every((month) => month.weeks.every((week) => week.topics.length === 2)), true);
  assert.match(plan.months[0].weeks[0].topics[0], /Programming/);
  assert.match(plan.months[0].weeks[0].topics[1], /Explain programming basics/);
});
