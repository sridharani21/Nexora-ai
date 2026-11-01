import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModule5Url,
  getCurrentCareerGoalForHandoff,
  getEndedCareerGoals,
  getSavedCareerRows,
  hasCompleteCareerGoalHandoff,
  persistSavedCareer,
  selectCurrentCareerGoal,
} from "./career-store.js";

function makeMockDatabase() {
  const state = { saved: [], goals: [] };
  let timestamp = 0;

  function clientFor(target) {
    return {
      async $executeRaw(strings, ...values) {
        const sql = strings.join("?");
        if (sql.includes('INSERT INTO "Module4SavedCareer"')) {
          const [id, userId, careerId, notes] = values;
          const existing = target.saved.find((row) => row.userId === userId && row.careerId === careerId);
          if (existing) {
            existing.notes = notes;
            existing.updatedAt = ++timestamp;
          } else {
            target.saved.push({ id, userId, careerId, notes, createdAt: ++timestamp });
          }
          return 1;
        }
        if (sql.includes('DELETE FROM "Module4SavedCareer"')) {
          const [userId, careerId] = values;
          const count = target.saved.length;
          target.saved = target.saved.filter((row) => row.userId !== userId || row.careerId !== careerId);
          return count - target.saved.length;
        }
        if (sql.includes('SET "skillEvidence"')) {
          const [skillEvidence, skillGaps, recommendationId, id, userId] = values;
          const goal = target.goals.find((row) => (
            row.id === id && row.userId === userId && row.isCurrent
          ));
          if (goal) {
            goal.skillEvidence = JSON.parse(skillEvidence);
            goal.skillGaps = JSON.parse(skillGaps);
            goal.recommendationId = recommendationId || goal.recommendationId;
          }
          return goal ? 1 : 0;
        }
        if (sql.includes('SET "isCurrent" = false')) {
          const [userId] = values;
          const current = target.goals.filter((row) => row.userId === userId && row.isCurrent);
          for (const goal of current) {
            goal.isCurrent = false;
            goal.endedAt = ++timestamp;
          }
          return current.length;
        }
        if (sql.includes('INSERT INTO "Module4CareerGoal"')) {
          const [id, userId, careerId, recommendationId, skillEvidence, skillGaps] = values;
          target.goals.push({
            id,
            userId,
            careerId,
            recommendationId,
            skillEvidence: JSON.parse(skillEvidence),
            skillGaps: JSON.parse(skillGaps),
            isCurrent: true,
            selectedAt: ++timestamp,
            endedAt: null,
          });
          return 1;
        }
        throw new Error(`Unexpected execute query: ${sql}`);
      },
      async $queryRaw(strings, ...values) {
        const sql = strings.join("?");
        if (sql.includes("pg_advisory_xact_lock")) return [];
        if (sql.includes('FROM "Module4SavedCareer"')) {
          const [userId] = values;
          return target.saved.filter((row) => row.userId === userId).map((row) => ({ ...row }));
        }
        if (sql.includes('FROM "Module4CareerGoal"') && sql.includes('"isCurrent" = true')) {
          if (sql.includes('"id" = ?')) {
            const [userId, careerId, goalId] = values;
            return target.goals
              .filter((row) => row.userId === userId && row.careerId === careerId && row.id === goalId && row.isCurrent)
              .map((row) => ({
                ...row,
                title: `Career ${row.careerId}`,
                careerSkills: [{ name: "SQL", importance: "essential", category: "technical" }],
                competencyProgression: { foundation: ["SQL basics"], applied: ["Build a project"] },
              }));
          }
          const [userId, careerId] = values;
          return target.goals
            .filter((row) => row.userId === userId && row.careerId === careerId && row.isCurrent)
            .map((row) => ({ id: row.id }));
        }
        if (sql.includes('FROM "Module4CareerGoal"') && sql.includes('"isCurrent" = false')) {
          const [userId] = values;
          return target.goals
            .filter((row) => row.userId === userId && !row.isCurrent && row.endedAt !== null)
            .map((row) => ({ id: row.id, title: `Career ${row.careerId}` }));
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
  }

  const database = clientFor(state);
  database.$transaction = async (operation) => {
    const working = structuredClone(state);
    const result = await operation(clientFor(working));
    state.saved = working.saved;
    state.goals = working.goals;
    return result;
  };

  return { database, state };
}

test("save is idempotent, notes update, and unsave only persists for its owner", async () => {
  const { database, state } = makeMockDatabase();
  await persistSavedCareer(database, { userId: "account-a", careerId: "career-1", saved: true, notes: "first", id: "a1" });
  await persistSavedCareer(database, { userId: "account-a", careerId: "career-1", saved: true, notes: "updated", id: "a2" });
  await persistSavedCareer(database, { userId: "account-b", careerId: "career-1", saved: true, notes: "private to B", id: "b1" });

  assert.equal(state.saved.length, 2);
  assert.equal((await getSavedCareerRows(database, "account-a"))[0].notes, "updated");
  assert.equal((await getSavedCareerRows(database, "account-b"))[0].notes, "private to B");

  await persistSavedCareer(database, { userId: "account-b", careerId: "career-1", saved: false });
  assert.deepEqual((await getSavedCareerRows(database, "account-b")), []);
  assert.equal((await getSavedCareerRows(database, "account-a"))[0].notes, "updated");
});

test("selecting the current goal updates it, switching preserves history, and reselecting creates a new current period", async () => {
  const { database, state } = makeMockDatabase();
  const select = (careerId, id, skillGaps = []) => selectCurrentCareerGoal(database, {
    userId: "account-a",
    careerId,
    skillEvidence: [{ skill: careerId }],
    skillGaps,
    id,
  });

  const firstId = await select("career-1", "goal-1", ["SQL"]);
  assert.equal(await select("career-1", "ignored-goal", ["Python"]), firstId);
  assert.equal(state.goals.length, 1);
  assert.deepEqual(state.goals[0].skillGaps, ["Python"]);

  await select("career-2", "goal-2");
  assert.equal(state.goals.length, 2);
  assert.equal(state.goals[0].isCurrent, false);
  assert.notEqual(state.goals[0].endedAt, null);
  assert.equal(state.goals[1].isCurrent, true);

  await select("career-1", "goal-3", ["Rust"]);
  assert.equal(state.goals.length, 3);
  assert.equal(state.goals[0].id, firstId);
  assert.equal(state.goals[0].isCurrent, false);
  assert.equal(state.goals[2].isCurrent, true);
  assert.deepEqual(state.goals[2].skillGaps, ["Rust"]);
});

test("goal history and Module 5 handoff are scoped to the owner and exact current goal", async () => {
  const { database } = makeMockDatabase();
  const goalId = await selectCurrentCareerGoal(database, {
    userId: "account-a",
    careerId: "career-1",
    skillEvidence: [],
    skillGaps: ["SQL"],
    id: "goal-a",
  });

  const handoff = await getCurrentCareerGoalForHandoff(database, {
    userId: "account-a",
    careerId: "career-1",
    goalId,
  });
  assert.equal(handoff.length, 1);
  assert.deepEqual(handoff[0].careerSkills, [
    { name: "SQL", importance: "essential", category: "technical" },
  ]);
  assert.deepEqual(handoff[0].competencyProgression, {
    foundation: ["SQL basics"],
    applied: ["Build a project"],
  });
  assert.deepEqual(await getCurrentCareerGoalForHandoff(database, {
    userId: "account-b",
    careerId: "career-1",
    goalId,
  }), []);
  assert.deepEqual(await getCurrentCareerGoalForHandoff(database, {
    userId: "account-a",
    careerId: "career-2",
    goalId,
  }), []);

  const url = new URL(buildModule5Url({
    careerId: "career-1",
    goalId,
    title: "Software Developer",
  }), "https://nexora.test");
  assert.equal(url.searchParams.get("careerId"), "career-1");
  assert.equal(url.searchParams.get("goalId"), goalId);
  assert.equal(url.searchParams.get("career"), "Software Developer");
  assert.equal(url.pathname, "/skill-development/setup");
  assert.equal(url.searchParams.has("skills"), false);
});

test("another account cannot change the owner's saved career or see the owner's ended goals", async () => {
  const { database, state } = makeMockDatabase();
  await persistSavedCareer(database, {
    userId: "account-a",
    careerId: "career-1",
    saved: true,
    notes: "Account A's private note",
    id: "saved-a",
  });
  const accountAGoalId = await selectCurrentCareerGoal(database, {
    userId: "account-a",
    careerId: "career-1",
    skillEvidence: [],
    skillGaps: [],
    id: "goal-a",
  });
  await selectCurrentCareerGoal(database, {
    userId: "account-a",
    careerId: "career-3",
    skillEvidence: [],
    skillGaps: [],
    id: "goal-a-next",
  });
  await selectCurrentCareerGoal(database, {
    userId: "account-b",
    careerId: "career-2",
    skillEvidence: [],
    skillGaps: [],
    id: "goal-b",
  });
  await persistSavedCareer(database, {
    userId: "account-b",
    careerId: "career-1",
    saved: false,
  });

  const historyForB = await getEndedCareerGoals(database, "account-b");
  assert.deepEqual(historyForB, []);
  const historyForA = await getEndedCareerGoals(database, "account-a");
  assert.deepEqual(historyForA.map((goal) => goal.id), [accountAGoalId]);
  assert.equal(state.goals.find((goal) => goal.id === accountAGoalId).isCurrent, false);
  assert.equal((await getSavedCareerRows(database, "account-a"))[0].notes, "Account A's private note");
});

test("Module 5 allows generic plans but requires career and goal IDs as a pair for selected goals", () => {
  assert.equal(hasCompleteCareerGoalHandoff({}), true);
  assert.equal(hasCompleteCareerGoalHandoff({ careerId: "career-1" }), false);
  assert.equal(hasCompleteCareerGoalHandoff({ goalId: "goal-1" }), false);
  assert.equal(hasCompleteCareerGoalHandoff({ careerId: "career-1", goalId: "goal-1" }), true);
});
