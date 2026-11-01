import test from "node:test";
import assert from "node:assert/strict";
import { findOwnedPlan, findOwnedTask } from "./owned-records.js";

function scopedDatabase() {
  const records = {
    plans: [{ id: "plan-a", userId: "account-a", status: "active" }],
    tasks: [{ id: "task-a", userId: "account-a", planId: "plan-a", status: "pending" }],
  };
  const matches = (record, where) => record &&
    Object.entries(where).every(([key, value]) => record[key] === value);
  return {
    records,
    careerPreparationPlan: {
      async findFirst({ where }) {
        return records.plans.find((record) => matches(record, where)) || null;
      },
    },
    careerPreparationTask: {
      async findFirst({ where }) {
        return records.tasks.find((record) => matches(record, where)) || null;
      },
    },
  };
}

test("preparation plan and task lookups always scope forged IDs to the authenticated owner", async () => {
  const database = scopedDatabase();

  assert.equal((await findOwnedPlan(database, "account-a", "plan-a")).id, "plan-a");
  assert.equal(await findOwnedPlan(database, "account-b", "plan-a"), null);
  assert.equal((await findOwnedTask(database, "account-a", "task-a")).id, "task-a");
  assert.equal(await findOwnedTask(database, "account-b", "task-a"), null);
  assert.equal(await findOwnedTask(database, "account-a", "task-a", { planId: "plan-forged" }), null);
});
