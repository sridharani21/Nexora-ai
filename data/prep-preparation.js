export const TOPIC_MAP = {
  aptitude: { topics: ["Percentages", "Ratios and work-rate", "Probability"], category: "Aptitude" },
  programming: { topics: ["Debugging and testing", "Recursion fundamentals", "Complexity and clean code"], category: "Programming" },
  dsa: { topics: ["Arrays and binary search", "Trees and recursion", "Graphs and problem solving"], category: "DSA" },
  technical: { topics: ["SQL and DBMS", "Operating systems", "Networks and OOP"], category: "Core technical" },
  communication: { topics: ["Technical explanation", "Feedback and collaboration", "Incident communication"], category: "Communication" },
};

export function difficultyForScore(score) {
  if (score < 50) return { label: "Beginner", practiceCount: 3 };
  if (score < 75) return { label: "Intermediate", practiceCount: 5 };
  return { label: "Advanced", practiceCount: 7 };
}

export function taskPriority(gap) {
  return gap >= 20 ? "HIGH" : gap >= 8 ? "MEDIUM" : "LOW";
}

export function planTaskMinutes(availableMinutes, priority) {
  if (availableMinutes <= 60) return priority === "HIGH" ? 25 : 15;
  if (availableMinutes >= 180) return priority === "HIGH" ? 50 : 30;
  return priority === "HIGH" ? 40 : 25;
}
