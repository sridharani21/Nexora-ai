export const LEVELS = [
  { number: 1, name: "Beginner", goal: "Understand fundamental concepts." },
  { number: 2, name: "Foundation", goal: "Apply concepts to standard problems." },
  { number: 3, name: "Intermediate", goal: "Solve unfamiliar placement-level problems." },
  { number: 4, name: "Advanced", goal: "Handle complex problems and optimize solutions." },
  { number: 5, name: "Placement Ready", goal: "Perform consistently under placement pressure." },
  { number: 6, name: "Interview Ready", goal: "Explain, solve, optimize, and handle follow-ups." },
];

export const LEVEL_SKILLS = [
  { id: "aptitude", label: "Aptitude", topics: ["Percentages", "Ratios", "Probability"] },
  { id: "reasoning", label: "Logical reasoning", topics: ["Sequences", "Syllogisms", "Patterns"] },
  { id: "verbal", label: "Verbal ability", topics: ["Grammar", "Reading comprehension", "Vocabulary"] },
  { id: "dsa", label: "DSA", topics: ["Arrays", "Trees", "Graphs"] },
  { id: "coding", label: "Programming", topics: ["Algorithms", "Debugging", "Complexity"] },
  { id: "sql", label: "SQL", topics: ["Queries", "Joins", "Aggregation"] },
  { id: "oop", label: "OOP", topics: ["Encapsulation", "Inheritance", "Polymorphism"] },
  { id: "dbms", label: "DBMS", topics: ["Normalization", "Transactions", "Indexing"] },
  { id: "os", label: "Operating systems", topics: ["Processes", "Memory", "Deadlocks"] },
  { id: "networks", label: "Computer networks", topics: ["HTTP", "TCP/IP", "DNS"] },
  { id: "core", label: "Core technical", topics: ["Web fundamentals", "Security basics", "System design"] },
  { id: "role", label: "Role-specific", topics: ["Frontend", "Backend", "Data", "Cloud", "Security"] },
];

export function levelName(number) {
  return LEVELS.find((level) => level.number === number)?.name || LEVELS[0].name;
}

export function evaluateSkill(skill, attempts, storedLevel = 1) {
  const recent = attempts.slice(0, 5);
  if (!recent.length) {
    return {
      hasEvidence: false,
      currentLevel: null,
      levelScore: null,
      recentAccuracy: null,
      topicCoverage: 0,
      progress: 0,
      recommendedDifficulty: "EASY",
      nextLevelReason: "Complete a practice attempt in this skill to establish a measured starting level.",
      advanced: false,
      demotion: false,
    };
  }
  const average = recent.length ? Math.round(recent.reduce((sum, attempt) => sum + attempt.score, 0) / recent.length) : 0;
  const topics = new Set(recent.flatMap((attempt) => (
    Array.isArray(attempt.topics) ? attempt.topics : [attempt.topic]
  )).filter((topic) => skill.topics.includes(topic)));
  const topicCoverage = Math.round((topics.size / skill.topics.length) * 100);
  const timed = recent.filter((attempt) => ["TIMED", "COMPANY_PATTERN", "MISTAKE_REVIEW"].includes(attempt.mode));
  const timedAverage = timed.length ? Math.round(timed.reduce((sum, attempt) => sum + attempt.score, 0) / timed.length) : 0;
  const successfulAttempts = recent.filter((attempt) => attempt.score >= 80).length;
  let earnedLevel = 1;
  if (recent.length >= 3 && average >= 80 && topicCoverage >= 70) earnedLevel = 2;
  if (recent.length >= 6 && average >= 82 && topicCoverage >= 70) earnedLevel = 3;
  if (recent.length >= 9 && average >= 85 && topicCoverage >= 80) earnedLevel = 4;
  if (recent.length >= 12 && average >= 85 && topicCoverage >= 80 && timedAverage >= 75) earnedLevel = 5;
  if (recent.length >= 15 && average >= 88 && topicCoverage >= 80 && timedAverage >= 80) earnedLevel = 6;
  const demotion = recent.length >= 3 && average < 50;
  const currentLevel = demotion ? Math.max(1, storedLevel - 1) : Math.max(storedLevel, earnedLevel);
  const nextLevel = Math.min(6, currentLevel + 1);
  const requirements = [
    `${Math.max(3, nextLevel * 3)} recent attempts`,
    "80%+ recent accuracy",
    "70%+ topic coverage",
    nextLevel >= 5 ? "75%+ timed/company-pattern performance" : "Consistent performance across topics",
  ];
  const progress = currentLevel === 6 ? 100 : Math.min(99, Math.round((average / 80) * 45 + (topicCoverage / 70) * 35 + (successfulAttempts / Math.max(3, nextLevel * 3)) * 20));
  const recommendedDifficulty = average < 60 ? "EASY" : average < 80 ? "MEDIUM" : currentLevel >= 4 ? "HARD" : "MEDIUM";
  return {
    hasEvidence: true,
    currentLevel, levelScore: average, recentAccuracy: average, topicCoverage,
    progress: Math.max(0, progress), recommendedDifficulty, nextLevelReason: currentLevel === 6 ? "Interview-ready evidence is being maintained." : `To reach ${levelName(nextLevel)}: ${requirements.join("; ")}.`,
    advanced: earnedLevel > storedLevel, demotion,
  };
}
