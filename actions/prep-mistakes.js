"use server";

import { db } from "@/lib/prisma";
import { classifyMistake, MISTAKE_TYPES } from "@/data/prep-mistakes";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

function parse(value, fallback) {
  try { return JSON.parse(value || ""); } catch { return fallback; }
}

async function currentProfile() {
  return requirePrepStudentProfile({
    practiceAttempts: { orderBy: { completedAt: "desc" }, take: 50 },
  });
}

export async function getMistakeAnalysis() {
  const profile = await currentProfile();
  const mistakes = profile.practiceAttempts.flatMap((attempt) => parse(attempt.mistakes, []).map((mistake) => ({ ...mistake, attempt })));
  const occurrences = new Map();
  mistakes.forEach((item) => occurrences.set(item.questionId, (occurrences.get(item.questionId) || 0) + 1));
  const analyzed = mistakes.map((item) => ({
    questionId: item.questionId,
    topic: item.topic || item.attempt.topic,
    prompt: item.prompt,
    selected: item.selected,
    correct: item.correct,
    explanation: item.explanation,
    type: classifyMistake(item, item.attempt, occurrences.get(item.questionId) || 1),
    repetitionCount: occurrences.get(item.questionId) || 1,
    completedAt: item.attempt.completedAt,
  }));
  const byTopic = new Map();
  analyzed.forEach((item) => {
    const current = byTopic.get(item.topic) || { topic: item.topic, mistakes: 0, repeated: 0, types: new Set() };
    current.mistakes += 1;
    current.repeated += item.type === MISTAKE_TYPES.REPEATED_MISTAKE ? 1 : 0;
    current.types.add(item.type);
    byTopic.set(item.topic, current);
  });
  const topics = [...byTopic.values()].map((item) => ({ ...item, types: [...item.types] })).sort((a, b) => b.mistakes - a.mistakes);
  const typeCounts = Object.values(MISTAKE_TYPES).map((type) => ({ type, count: analyzed.filter((item) => item.type === type).length }));
  const priority = topics.slice(0, 5).map((item) => ({
    topic: item.topic,
    action: item.repeated ? "Repeat remedial practice, then retry a timed question." : "Review the concept explanation and complete two focused questions.",
  }));
  return { attempts: profile.practiceAttempts.length, totalMistakes: analyzed.length, topics, typeCounts, recentMistakes: analyzed.slice(0, 12), priority };
}
