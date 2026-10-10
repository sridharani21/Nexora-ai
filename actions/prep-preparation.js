"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { getReadiness } from "@/actions/prep-readiness";
import { TOPIC_MAP, difficultyForScore, planTaskMinutes, taskPriority } from "@/data/prep-preparation";
import { getCurrentPrepStudentProfile, requirePrepStudentProfile } from "@/lib/prep-student-profile";

export async function getPreparationPlans() {
  const profile = await getCurrentPrepStudentProfile();
  if (!profile) return null;
  const id = profile.id;
  return db.prepPreparationPlan.findMany({
    where: { profileId: id },
    orderBy: [{ createdAt: "desc" }, { weekNumber: "desc" }],
    include: { tasks: { orderBy: [{ day: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function getPreparationPlan() {
  const plans = await getPreparationPlans();
  return plans?.[0] || null;
}

export async function generatePreparationPlan({ availableMinutesPerDay = 120, weeks = 1 } = {}) {
  const profile = await requirePrepStudentProfile();
  const id = profile.id;
  const existingPlan = await db.prepPreparationPlan.findFirst({
    where: { profileId: id },
    orderBy: [{ createdAt: "desc" }, { weekNumber: "desc" }],
    include: { tasks: true },
  });
  const requestedWeeks = Math.max(1, Math.min(12, Number(weeks) || 1));
  const continuingSequence = Boolean(
    existingPlan?.sequenceId && existingPlan.weekNumber < existingPlan.totalWeeks,
  );
  if (existingPlan?.tasks.some((task) => task.status !== "COMPLETED")) {
    throw new Error("Complete every task in your current week before creating the next week.");
  }
  const weekNumber = continuingSequence ? existingPlan.weekNumber + 1 : 1;
  const totalWeeks = continuingSequence ? existingPlan.totalWeeks : requestedWeeks;
  const sequenceId = continuingSequence ? existingPlan.sequenceId : randomUUID();
  const readiness = await getReadiness();
  if (!readiness) throw new Error("Generate your readiness analysis before creating a preparation plan.");
  const gaps = readiness.skillGaps.filter((item) => item.gap > 0).sort((a, b) => b.gap - a.gap);
  const selected = (gaps.length ? gaps : Object.entries(readiness.skillProfile).map(([skill, item]) => ({ skill, label: skill, gap: 1, currentScore: item.score }))).slice(0, 5);
  const dailyMinutes = continuingSequence
    ? existingPlan.availableMinutesPerDay
    : Math.max(45, Math.min(360, Number(availableMinutesPerDay) || 120));
  const start = continuingSequence ? new Date(existingPlan.weekEnd) : new Date();
  if (continuingSequence) start.setDate(start.getDate() + 1);
  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 6);
  return db.prepPreparationPlan.create({
    data: {
      profileId: id,
      sequenceId,
      weekNumber,
      totalWeeks,
      title: `Personalized placement preparation · Week ${weekNumber}`,
      targetRole: readiness.careerSuitability[0]?.role || "Software Engineer",
      targetCompany: readiness.targetCompany || null,
      weeklyGoal: `Improve ${selected[0]?.label || "priority skills"} while maintaining strong areas${readiness.targetCompany ? ` for the configured ${readiness.targetCompany} target` : ""}.`,
      availableMinutesPerDay: dailyMinutes,
      weekStart: start,
      weekEnd,
      estimatedMinutes: dailyMinutes * 7,
      priorities: JSON.stringify(selected.map((item) => item.label)),
      tasks: {
        create: Array.from({ length: 7 }, (_, dayIndex) => {
          const day = dayIndex + 1;
          const planDay = (weekNumber - 1) * 7 + dayIndex;
          const date = new Date(start);
          date.setDate(start.getDate() + dayIndex);
          const dailyTasks = selected.map((item, subjectIndex) => {
            const map = TOPIC_MAP[item.skill] || { topics: [item.label], category: item.label };
            const level = difficultyForScore(item.currentScore || 0);
            const topic = map.topics[(planDay + subjectIndex) % map.topics.length];
            const priority = taskPriority(item.gap);
            const isReviewDay = day % 7 === 0;
            const type = isReviewDay ? "REVISION" : item.gap >= 20 && day <= 3 ? "REMEDIAL" : subjectIndex === 0 ? "LEARNING" : "PRACTICE";
            return {
              day,
              category: map.category,
              type,
              topic,
              objective: isReviewDay ? `Review ${topic}, revisit mistakes, and test your understanding.` : item.gap >= 20 ? `Build foundations in ${topic} before moving to advanced practice.` : `Improve ${topic} toward the target-role requirement.`,
              reason: `${map.category} is a ${priority.toLowerCase()} priority because the current score is ${item.currentScore}% against the target-role gap.`,
              difficulty: level.label,
              priority,
              resource: `Study the key ideas in ${topic}, write a short summary, then complete ${level.practiceCount} targeted practice problems.`,
              dueDate: date,
              minutes: Math.max(10, Math.min(planTaskMinutes(dailyMinutes, priority), Math.floor(dailyMinutes / selected.length))),
              practiceCount: level.practiceCount,
            };
          });
          return dailyTasks;
        }).flat(),
      },
    },
    include: { tasks: true },
  });
}

export async function updatePreparationTask(taskId, status) {
  const { id } = await requirePrepStudentProfile();
  const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "NEEDS_REVISION"];
  if (!id || !taskId || !validStatuses.includes(status)) throw new Error("Invalid preparation task update.");
  const task = await db.prepPreparationTask.findFirst({ where: { id: taskId, plan: { profileId: id } } });
  if (!task) throw new Error("Preparation task not found.");
  return db.prepPreparationTask.update({ where: { id: task.id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null } });
}

export async function completePreparationTask(taskId) {
  const { id } = await requirePrepStudentProfile();
  if (!id || !taskId) throw new Error("A valid preparation task is required.");
  const task = await db.prepPreparationTask.findFirst({ where: { id: taskId, plan: { profileId: id } } });
  if (!task) throw new Error("Preparation task not found.");
  return updatePreparationTask(task.id, "COMPLETED");
}
