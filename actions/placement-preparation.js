"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getPlacementReadiness } from "@/actions/placement-readiness";

const taskUpdateSchema = z.object({
  taskId: z.string().min(1),
  completed: z.boolean(),
});

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getDifficulty(score) {
  if (score >= 75) return "advanced";
  if (score >= 55) return "intermediate";
  return "foundation";
}

function buildTasks(gaps, difficulty) {
  const prioritized = [...gaps]
    .sort((first, second) => second.gap - first.gap)
    .filter((gap) => gap.priority !== "maintain");
  const focus = prioritized.length ? prioritized : [{ skill: "Target-role practice", gap: 10, priority: "medium" }];

  return Array.from({ length: 7 }, (_, index) => {
    const gap = focus[index % focus.length];
    const taskType = index % 3 === 0 ? "learn" : index % 3 === 1 ? "practice" : "review";
    return {
      day: index + 1,
      title: `${taskType === "learn" ? "Learn" : taskType === "practice" ? "Practise" : "Review"} ${gap.skill}`,
      description:
        taskType === "learn"
          ? `Study the core concepts of ${gap.skill} and write down three practical takeaways.`
          : taskType === "practice"
            ? `Complete a focused ${gap.skill} practice set and explain each missed answer.`
            : `Review your ${gap.skill} notes, then solve one timed question without hints.`,
      topic: gap.skill,
      taskType,
      difficulty,
      goal: `${Math.max(3, Math.min(10, Math.ceil(gap.gap / 10)))} focused questions`,
      dueDate: new Date(Date.now() + index * 86400000),
    };
  });
}

export async function getPlacementPreparation() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { report } = await getPlacementReadiness();
  const practiceAttempts = await db.practiceAttempt.findMany({
    where: { journeyId: report.journeyId },
    orderBy: { completedAt: "desc" },
    take: 12,
    select: { score: true, weakTopics: true },
  });
  const recentScore = practiceAttempts.length
    ? Math.round(practiceAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / practiceAttempts.length)
    : null;
  const practiceWeakTopics = practiceAttempts.flatMap((attempt) => arrayValue(attempt.weakTopics));
  const careerTwin = await db.careerTwin.findUnique({
    where: { journeyId: report.journeyId },
    select: { weaknesses: true, skillScores: true },
  });
  const twinWeaknesses = arrayValue(careerTwin?.weaknesses);
  const gaps = arrayValue(report.skillGaps);
  const practiceGaps = [...new Set(practiceWeakTopics)].map((skill) => ({
    skill,
    currentScore: 40,
    targetScore: 75,
    gap: 35,
    priority: "high",
  }));
  const twinScores = objectValue(careerTwin?.skillScores);
  const twinGaps = twinWeaknesses.map((skill) => ({
    skill,
    currentScore: Number(twinScores[skill] ?? 40),
    targetScore: 75,
    gap: Math.max(0, 75 - Number(twinScores[skill] ?? 40)),
    priority: "high",
  }));
  const prioritizedGaps = [...twinGaps, ...practiceGaps, ...gaps].filter(
    (gap, index, all) => all.findIndex((item) => item.skill === gap.skill) === index
  );
  const difficulty = recentScore === null
    ? getDifficulty(report.overallScore)
    : recentScore >= 85
      ? "advanced"
      : recentScore < 50
        ? "foundation"
        : "intermediate";
  const recommendations = [
    prioritizedGaps[0]?.gap > 0 ? `Prioritize ${prioritizedGaps[0].skill} before broadening your study plan.` : "Maintain your current strengths with timed practice.",
    recentScore === null ? "Complete a practice set to calibrate your adaptive difficulty." : `Your recent practice average is ${recentScore}%; the plan has adjusted difficulty accordingly.`,
    "Use short daily sessions and increase difficulty after two consistent attempts.",
    "Review every mistake and repeat weak topics within 48 hours.",
  ];
  const planData = {
    generatedFromReadinessScore: report.overallScore,
    recentPracticeScore: recentScore,
    targetRole: report.targetRole,
    targetCompany: report.targetCompany,
    focusTopics: prioritizedGaps.filter((gap) => gap.gap > 0).map((gap) => gap.skill),
    adaptiveRule: "Difficulty increases after two attempts at 75% or higher and decreases after a score below 50%.",
  };

  const plan = await db.placementPreparationPlan.upsert({
    where: { journeyId: report.journeyId },
    create: { journeyId: report.journeyId, adaptiveDifficulty: difficulty, recommendations, planData },
    update: { adaptiveDifficulty: difficulty, recommendations, planData },
    include: { tasks: { orderBy: { day: "asc" } } },
  });

  let tasks = plan.tasks;
  if (!tasks.length) {
    tasks = await db.$transaction(
      buildTasks(prioritizedGaps, difficulty).map((task) =>
        db.placementPreparationTask.create({ data: { planId: plan.id, ...task } })
      )
    );
  }

  await db.placementJourney.update({
    where: { id: report.journeyId },
    data: { currentModule: 4 },
  });
  return { plan: { ...plan, tasks }, report };
}

export async function updatePreparationTask(input) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const { taskId, completed } = taskUpdateSchema.parse(input);
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { placementJourney: { select: { id: true } } },
  });
  if (!user?.placementJourney) throw new Error("Placement journey not found.");

  const task = await db.placementPreparationTask.findFirst({
    where: { id: taskId, plan: { journeyId: user.placementJourney.id } },
  });
  if (!task) throw new Error("Preparation task not found.");
  return db.placementPreparationTask.update({ where: { id: taskId }, data: { completed } });
}
