export function getRoadmapTasks(roadmap) {
  if (!Array.isArray(roadmap?.months)) return [];
  return roadmap.months.flatMap((month) => (
    Array.isArray(month.weeks) ? month.weeks.flatMap((week) => (
      Array.isArray(week.topics) ? week.topics.map((topic, topicIndex) => ({
        id: `${month.month}:${week.week}:${topicIndex}`,
        month: month.month,
        week: week.week,
        topicIndex,
        title: topic,
      })) : []
    )) : []
  ));
}

export function buildDeterministicCareerRoadmap({ career, months, careerSkills = [], competencyProgression = null }) {
  const skills = careerSkills
    .filter((skill) => typeof skill?.name === "string")
    .sort((left, right) => (
      (left.importance === "core" ? 0 : 1) - (right.importance === "core" ? 0 : 1)
    ));
  const priorities = [...new Set(skills.map((skill) => skill.name))];
  const gaps = competencyProgression && typeof competencyProgression === "object"
    ? Object.values(competencyProgression).flatMap((stage) => (
      Array.isArray(stage?.competencies) ? stage.competencies : []
    ))
    : [];
  const stages = Object.keys(competencyProgression || {});
  const sequence = priorities.length ? priorities : [career];
  return {
    months: Array.from({ length: months }, (_, monthIndex) => ({
      month: monthIndex + 1,
      title: stages.length
        ? `${stages[Math.min(stages.length - 1, Math.floor(monthIndex * stages.length / months))]}: ${sequence[monthIndex % sequence.length]}`
        : `${career} foundations`,
      weeks: Array.from({ length: 4 }, (_, weekIndex) => {
        const first = sequence[(monthIndex * 4 + weekIndex) % sequence.length];
        const second = sequence[(monthIndex * 4 + weekIndex + 1) % sequence.length];
        const progression = gaps.length ? gaps[(monthIndex * 4 + weekIndex) % gaps.length] : null;
        return {
          week: weekIndex + 1,
          topics: [
            `Study ${first} fundamentals for ${career}`,
            progression || (second === first ? `Apply ${first} in a small practical exercise` : `Practise ${second} with a career-related exercise`),
          ],
        };
      }),
    })),
  };
}

export function getRoadmapProgress(roadmap) {
  const tasks = getRoadmapTasks(roadmap);
  const completed = new Set(Array.isArray(roadmap?.completedTasks) ? roadmap.completedTasks : []);
  const completedCount = tasks.filter((task) => completed.has(task.id)).length;
  return {
    total: tasks.length,
    completed: completedCount,
    percentage: tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0,
    nextTask: tasks.find((task) => !completed.has(task.id)) || null,
  };
}

export function updateRoadmapTask(roadmap, taskId, isCompleted) {
  const tasks = getRoadmapTasks(roadmap);
  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return { success: false, error: "Learning task was not found." };

  const completed = new Set(Array.isArray(roadmap.completedTasks) ? roadmap.completedTasks : []);
  if (isCompleted) {
    const prerequisite = tasks.slice(0, taskIndex).find((task) => !completed.has(task.id));
    if (prerequisite) {
      return {
        success: false,
        error: `Complete the earlier task first: ${prerequisite.title}`,
      };
    }
    completed.add(taskId);
  } else {
    const dependent = tasks.slice(taskIndex + 1).find((task) => completed.has(task.id));
    if (dependent) {
      return {
        success: false,
        error: `Reopen the later task first: ${dependent.title}`,
      };
    }
    completed.delete(taskId);
  }

  return { success: true, roadmap: { ...roadmap, completedTasks: [...completed] } };
}
