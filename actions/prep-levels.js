"use server";

import { db } from "@/lib/prisma";
import { LEVEL_SKILLS, evaluateSkill, levelName } from "@/data/prep-levels";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

export async function getSkillLevels() {
  const { id } = await requirePrepStudentProfile();
  const [attempts, stored, history] = await Promise.all([
    db.prepPracticeAttempt.findMany({ where: { profileId: id }, orderBy: { completedAt: "desc" } }),
    db.prepStudentSkillLevel.findMany({ where: { profileId: id } }),
    db.prepLevelHistory.findMany({ where: { profileId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const storedBySkill = new Map(stored.map((item) => [item.skill, item]));
  const evaluated = [];
  for (const skill of LEVEL_SKILLS) {
    const skillAttempts = attempts.filter((attempt) => attempt.subject === skill.id);
    const previous = storedBySkill.get(skill.id);
    const result = evaluateSkill(skill, skillAttempts, previous?.currentLevel || 1);
    if (!previous || previous.currentLevel !== result.currentLevel || previous.levelScore !== result.levelScore || previous.topicCoverage !== result.topicCoverage || previous.recommendedDifficulty !== result.recommendedDifficulty) {
      await db.prepStudentSkillLevel.upsert({
        where: { profileId_skill: { profileId: id, skill: skill.id } },
        create: { profileId: id, skill: skill.id, currentLevel: result.currentLevel, levelScore: result.levelScore, progress: result.progress, recentAccuracy: result.recentAccuracy, topicCoverage: result.topicCoverage, recommendedDifficulty: result.recommendedDifficulty, nextLevelReason: result.nextLevelReason },
        update: { currentLevel: result.currentLevel, levelScore: result.levelScore, progress: result.progress, recentAccuracy: result.recentAccuracy, topicCoverage: result.topicCoverage, recommendedDifficulty: result.recommendedDifficulty, nextLevelReason: result.nextLevelReason },
      });
      if (previous && previous.currentLevel !== result.currentLevel) {
        await db.prepLevelHistory.create({ data: { profileId: id, skill: skill.id, previousLevel: previous.currentLevel, newLevel: result.currentLevel, reason: result.demotion ? "Recent performance dropped below the stability threshold." : `Sustained performance met the ${levelName(result.currentLevel)} criteria.`, score: result.levelScore } });
      }
    }
    evaluated.push({ ...skill, ...result, attempts: skillAttempts.length });
  }
  return { skills: evaluated, history };
}
