"use server";

import { db } from "@/lib/prisma";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";
import { INTERVIEW_ROLES } from "@/data/prep-interview";

const STAGE_DEFINITIONS = [
  { stageKey: "APTITUDE", title: "Aptitude & reasoning", order: 1, timeLimitSeconds: 12 * 60 },
  { stageKey: "TECHNICAL_CODING", title: "Technical & coding concepts", order: 2, timeLimitSeconds: 18 * 60 },
  { stageKey: "AI_INTERVIEW", title: "AI interview", order: 3, timeLimitSeconds: 0 },
];

const QUESTION_BANK = {
  APTITUDE: [
    { id: "apt-discount", topic: "Numerical reasoning", prompt: "A product priced at 800 is discounted by 15%. What is the sale price?", options: [["680", "680"], ["700", "700"], ["720", "720"], ["740", "740"]], answer: "680" },
    { id: "apt-sequence", topic: "Number sequences", prompt: "What number comes next: 3, 7, 13, 21, 31, ?", options: [["41", "41"], ["42", "42"], ["43", "43"], ["45", "45"]], answer: "43" },
    { id: "apt-work", topic: "Work and rates", prompt: "Five workers finish a task in 12 days. At the same rate, how long would 8 workers take?", options: [["6.5 days", "6.5 days"], ["7.5 days", "7.5 days"], ["8 days", "8 days"], ["9.6 days", "9.6 days"]], answer: "7.5 days" },
    { id: "apt-probability", topic: "Probability", prompt: "A bag contains 3 red and 2 blue tokens. Two are drawn without replacement. What is the probability both are blue?", options: [["1/10", "1/10"], ["1/5", "1/5"], ["2/5", "2/5"], ["1/2", "1/2"]], answer: "1/10" },
    { id: "apt-ratio", topic: "Ratios", prompt: "The ratio of developers to testers is 3:2 in a team of 25. How many are developers?", options: [["10", "10"], ["12", "12"], ["15", "15"], ["18", "18"]], answer: "15" },
    { id: "apt-logic", topic: "Logical reasoning", prompt: "All Nors are Pels. No Pels are Vims. Which statement must be true?", options: [["Some Nors are Vims", "Some Nors are Vims"], ["No Nors are Vims", "No Nors are Vims"], ["All Vims are Nors", "All Vims are Nors"], ["No Pels are Nors", "No Pels are Nors"]], answer: "No Nors are Vims" },
  ],
  TECHNICAL_CODING: [
    { id: "tc-complexity", topic: "Algorithms", prompt: "A loop processes n items and performs a binary search in a sorted array for each item. What is its time complexity?", options: [["O(log n)", "O(log n)"], ["O(n)", "O(n)"], ["O(n log n)", "O(n log n)"], ["O(n²)", "O(n²)"]], answer: "O(n log n)" },
    { id: "tc-hashmap", topic: "Data structures", prompt: "Which data structure gives average O(1) lookup by key and is useful for solving Two Sum in one pass?", options: [["Stack", "Stack"], ["Hash map", "Hash map"], ["Binary heap", "Binary heap"], ["Queue", "Queue"]], answer: "Hash map" },
    { id: "tc-sql", topic: "SQL", prompt: "Which SQL clause filters individual rows before grouping?", options: [["HAVING", "HAVING"], ["WHERE", "WHERE"], ["ORDER BY", "ORDER BY"], ["DISTINCT", "DISTINCT"]], answer: "WHERE" },
    { id: "tc-http", topic: "Web fundamentals", prompt: "Which HTTP status code most commonly indicates that a resource was created successfully?", options: [["200", "200 OK"], ["201", "201 Created"], ["204", "204 No Content"], ["301", "301 Moved Permanently"]], answer: "201" },
    { id: "tc-code-trace", topic: "Code tracing", prompt: "What does this return? `[1, 2, 3].map(x => x * 2).filter(x => x > 2).length`", options: [["1", "1"], ["2", "2"], ["3", "3"], ["6", "6"]], answer: "2" },
    { id: "tc-transactions", topic: "Databases", prompt: "Which ACID property ensures a transaction's changes are all applied or none are?", options: [["Consistency", "Consistency"], ["Isolation", "Isolation"], ["Atomicity", "Atomicity"], ["Durability", "Durability"]], answer: "Atomicity" },
  ],
};

const STAGE_WEIGHTS = { APTITUDE: 25, TECHNICAL_CODING: 35, AI_INTERVIEW: 40 };

function normalizeCompanyName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

function stageQuestions(stageKey) {
  return (QUESTION_BANK[stageKey] || []).map(({ answer, ...question }) => ({
    ...question,
    options: question.options.map(([value, label]) => ({ value, label })),
  }));
}

function buildSimulationResult(simulation, stages) {
  const complete = stages.every((stage) => stage.status === "COMPLETED" && Number.isInteger(stage.score));
  const overallScore = complete
    ? Math.round(stages.reduce((sum, stage) => sum + stage.score * STAGE_WEIGHTS[stage.stageKey], 0) / 100)
    : null;
  return { complete, overallScore };
}

export async function getPlacementSimulationDashboard() {
  const profile = await requirePrepStudentProfile();
  const simulations = await db.placementSimulation.findMany({
    where: { profileId: profile.id },
    orderBy: { startedAt: "desc" },
    take: 12,
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return {
    defaultRole: INTERVIEW_ROLES.includes(profile.preferredRole) ? profile.preferredRole : INTERVIEW_ROLES[0],
    defaultCompany: profile.targetCompany || "",
    simulations: simulations.map((simulation) => ({
      id: simulation.id,
      simulationType: simulation.simulationType,
      role: simulation.role,
      companyName: simulation.companyName,
      status: simulation.status,
      overallScore: simulation.overallScore,
      startedAt: simulation.startedAt,
      completedAt: simulation.completedAt,
      stages: simulation.stages.map(({ stageKey, title, status, score }) => ({ stageKey, title, status, score })),
    })),
    roles: INTERVIEW_ROLES,
  };
}

export async function startPlacementSimulation({ simulationType, role, companyName = "" }) {
  if (!["GENERAL", "COMPANY"].includes(simulationType)) throw new Error("Choose a valid simulation type.");
  if (!INTERVIEW_ROLES.includes(role)) throw new Error("Choose a supported interview role.");
  const normalizedCompany = normalizeCompanyName(companyName);
  if (simulationType === "COMPANY" && !normalizedCompany) throw new Error("Enter the company context for a company-focused simulation.");
  const profile = await requirePrepStudentProfile();
  const startedAt = new Date();
  const simulation = await db.placementSimulation.create({
    data: {
      profileId: profile.id,
      simulationType,
      role,
      companyName: simulationType === "COMPANY" ? normalizedCompany : null,
      stages: {
        create: STAGE_DEFINITIONS.map((stage, index) => ({
          ...stage,
          status: index === 0 ? "IN_PROGRESS" : "LOCKED",
          startedAt: index === 0 ? startedAt : null,
        })),
      },
    },
    select: { id: true },
  });
  return { simulationId: simulation.id };
}

export async function getPlacementSimulation(simulationId) {
  if (typeof simulationId !== "string" || !simulationId) throw new Error("Simulation not found.");
  const profile = await requirePrepStudentProfile();
  const simulation = await db.placementSimulation.findFirst({
    where: { id: simulationId, profileId: profile.id },
    include: {
      stages: { orderBy: { order: "asc" } },
      interviewSessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          evaluation: { select: { id: true, overallScore: true } },
        },
      },
    },
  });
  if (!simulation) throw new Error("Simulation not found.");
  const stages = simulation.stages.map((stage) => ({
    id: stage.id,
    stageKey: stage.stageKey,
    title: stage.title,
    order: stage.order,
    status: stage.status,
    timeLimitSeconds: stage.timeLimitSeconds,
    score: stage.score,
    evidence: JSON.parse(stage.evidence || "{}"),
    durationSeconds: stage.durationSeconds,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    sourceRecordId: stage.sourceRecordId,
    questions: stage.status === "IN_PROGRESS" && stage.stageKey !== "AI_INTERVIEW"
      ? stageQuestions(stage.stageKey)
      : [],
    interviewSessionId: stage.stageKey === "AI_INTERVIEW" ? simulation.interviewSessions[0]?.id || null : null,
    interviewStatus: stage.stageKey === "AI_INTERVIEW" ? simulation.interviewSessions[0]?.status || null : null,
    evaluationId: stage.stageKey === "AI_INTERVIEW" ? simulation.interviewSessions[0]?.evaluation?.id || null : null,
  }));
  return {
    id: simulation.id,
    simulationType: simulation.simulationType,
    role: simulation.role,
    companyName: simulation.companyName,
    status: simulation.status,
    currentStage: simulation.currentStage,
    overallScore: simulation.overallScore,
    startedAt: simulation.startedAt,
    completedAt: simulation.completedAt,
    stages,
    weights: STAGE_WEIGHTS,
  };
}

export async function submitPlacementSimulationStage({ simulationId, stageId, answers }) {
  if (typeof simulationId !== "string" || typeof stageId !== "string") throw new Error("Simulation round not found.");
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("Submit your selected answers to finish this round.");
  const profile = await requirePrepStudentProfile();
  const simulation = await db.placementSimulation.findFirst({
    where: { id: simulationId, profileId: profile.id, status: "ACTIVE" },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!simulation) throw new Error("This simulation is no longer active.");
  const stage = simulation.stages.find((item) => item.id === stageId);
  if (!stage || stage.status !== "IN_PROGRESS" || stage.stageKey === "AI_INTERVIEW" || stage.order !== simulation.currentStage) {
    throw new Error("This simulation round is no longer active.");
  }
  const questions = QUESTION_BANK[stage.stageKey];
  if (!questions) throw new Error("This simulation round is not supported.");
  const answerEntries = Object.entries(answers);
  if (answerEntries.some(([questionId, answer]) => (
    !questions.some((question) => question.id === questionId && question.options.some(([value]) => value === answer))
  ))) {
    throw new Error("One or more selected answers are invalid. Refresh and try again.");
  }
  const now = new Date();
  const timedOut = now.getTime() - stage.startedAt.getTime() > stage.timeLimitSeconds * 1000;
  const effectiveAnswers = timedOut ? {} : answers;
  const correctCount = questions.reduce((count, question) => count + (effectiveAnswers[question.id] === question.answer ? 1 : 0), 0);
  const score = Math.round((correctCount / questions.length) * 100);
  const topicResults = [...new Set(questions.map((question) => question.topic))].map((topic) => {
    const topicQuestions = questions.filter((question) => question.topic === topic);
    const topicCorrect = topicQuestions.filter((question) => effectiveAnswers[question.id] === question.answer).length;
    return { topic, correct: topicCorrect, total: topicQuestions.length };
  });
  const elapsed = Math.min(stage.timeLimitSeconds, Math.max(0, Math.floor((now.getTime() - stage.startedAt.getTime()) / 1000)));
  const evidence = JSON.stringify({
    questionCount: questions.length,
    answeredCount: timedOut ? 0 : answerEntries.length,
    correctCount,
    topicResults,
    scoring: "Correct answers divided by the fixed simulation question count; unanswered questions count as incorrect.",
    timedOut,
  });

  await db.$transaction(async (transaction) => {
    const updated = await transaction.simulationStage.updateMany({
      where: { id: stage.id, simulationId: simulation.id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", score, evidence, durationSeconds: elapsed, completedAt: now },
    });
    if (!updated.count) throw new Error("This round was already submitted. Refresh to see the saved result.");
    const nextStage = simulation.stages.find((item) => item.order === stage.order + 1);
    if (!nextStage) {
      const nextScores = simulation.stages.map((item) => item.id === stage.id ? { ...item, score, status: "COMPLETED" } : item);
      const result = buildSimulationResult(simulation, nextScores);
      await transaction.placementSimulation.update({
        where: { id: simulation.id },
        data: { status: result.complete ? "COMPLETED" : "ACTIVE", currentStage: stage.order, overallScore: result.overallScore, completedAt: result.complete ? now : null },
      });
      return;
    }
    const activated = await transaction.simulationStage.updateMany({
      where: { id: nextStage.id, simulationId: simulation.id, status: "LOCKED" },
      data: { status: "IN_PROGRESS", startedAt: now },
    });
    if (!activated.count) throw new Error("The next simulation round could not be started. Refresh and try again.");
    await transaction.placementSimulation.update({
      where: { id: simulation.id },
      data: { currentStage: nextStage.order },
    });
  });
  return { saved: true, score, correctCount, questionCount: questions.length };
}
