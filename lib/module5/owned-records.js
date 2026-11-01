export function findOwnedPlan(database, userId, planId, { include, select, extraWhere = {} } = {}) {
  return database.careerPreparationPlan.findFirst({
    where: { ...extraWhere, id: planId, userId },
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  });
}

export function findOwnedTask(database, userId, taskId, { include, select, planId } = {}) {
  return database.careerPreparationTask.findFirst({
    where: { ...(planId ? { planId } : {}), id: taskId, userId },
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  });
}
