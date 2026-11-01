import { z } from "zod";

export const MODULE5_PASS_THRESHOLD = 70;
export const MODULE5_ASSESSMENT_VERSION = "module5-topic-check-v2";

const preferredResourceTypes = {
  videos: ["video", "course"],
  reading: ["documentation", "guide", "tutorial", "reading"],
  practice: ["interactive", "exercise", "lab", "practice"],
  mixed: [],
};

function buildSkillResourceSearch(skill, learningPreference) {
  const query = learningPreference === "videos"
    ? `${skill} tutorial`
    : learningPreference === "reading"
      ? `${skill} official guide`
      : learningPreference === "practice"
        ? `${skill} hands-on practice`
        : `${skill} course tutorial`;
  const useYouTube = learningPreference === "videos";
  const url = new URL(useYouTube ? "https://www.youtube.com/results" : "https://www.coursera.org/search");
  url.searchParams.set(useYouTube ? "search_query" : "query", query);

  return {
    title: `Search ${useYouTube ? "video lessons" : "courses and learning resources"} for ${skill}`,
    url: url.toString(),
    provider: useYouTube ? "YouTube search" : "Coursera course search",
    contentType: useYouTube ? "Video search" : "Course catalogue search",
    cost: "Free to browse; access varies",
    relatedSkill: skill,
    description: "Search results are not individually reviewed. Check the publisher, level, and suitability before using a resource.",
  };
}

export function ensureTaskResources(resources, skill, learningPreference) {
  const available = Array.isArray(resources)
    ? resources.filter((resource) => (
      typeof resource?.url === "string" && resource.url.startsWith("https://")
    ))
    : [];
  return available.length ? available : [buildSkillResourceSearch(skill, learningPreference)];
}

export const preparationSetupSchema = z.object({
  careerId: z.string().uuid(),
  goalId: z.string().uuid(),
  weeks: z.number().int().min(1).max(52),
  dailyHours: z.number().min(0.5).max(12),
  studyDays: z.number().int().min(1).max(7),
  startDate: z.string().date(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  learningPreference: z.enum(["videos", "reading", "practice", "mixed"]),
}).strict();

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function analyzeCareerSkills(careerSkills, skillEvidence) {
  const evidenceBySkill = new Map(
    (Array.isArray(skillEvidence) ? skillEvidence : [])
      .filter((item) => typeof item?.skill === "string")
      .map((item) => [item.skill.toLowerCase(), item]),
  );
  return (Array.isArray(careerSkills) ? careerSkills : []).map((skill) => {
    const evidence = evidenceBySkill.get(String(skill.name).toLowerCase());
    const status = evidence?.status || "Not yet assessed";
    return {
      name: skill.name,
      category: skill.category || "career skill",
      importance: skill.importance || "related",
      priority: skill.importance === "core"
        ? "essential"
        : ["related", "preferred"].includes(skill.importance) ? "important" : "optional",
      status,
      evidence: Array.isArray(evidence?.evidence) ? evidence.evidence : [],
      currentProficiency: status === "Demonstrated"
        ? "Demonstrated by available assessment or project evidence"
        : status === "Self-reported"
          ? "Self-reported; not independently verified"
          : null,
      needsDevelopment: ["Developing", "Gap identified"].includes(status),
      reason: skill.importance === "core"
        ? `This is a core skill in the ${skill.category || "career"} requirements.`
        : `This skill is listed in the ${skill.category || "career"} requirements.`,
    };
  });
}

export function buildPreparationTasks({
  career,
  weeks,
  dailyHours,
  studyDays,
  startDate,
  skillLevel,
  learningPreference,
  skillAnalysis,
  learningResources,
}) {
  const orderedSkills = [...skillAnalysis].sort((left, right) => (
    ["essential", "important", "optional"].indexOf(left.priority) -
      ["essential", "important", "optional"].indexOf(right.priority) ||
    Number(right.needsDevelopment) - Number(left.needsDevelopment)
  ));
  const skills = orderedSkills.length ? orderedSkills : [{
    name: career,
    priority: "important",
    status: "Not yet assessed",
    reason: "Build an initial foundation for the selected career.",
  }];
  const dailyMinutes = Math.round(dailyHours * 60);
  const learningMinutes = Math.max(20, dailyMinutes - 10);
  const preferenceActivities = {
    videos: "Watch or follow a focused lesson, capture its key steps, and try the skill in a small example.",
    reading: "Read a focused official guide, summarize its key idea, and apply it in a small example.",
    practice: "Work through a hands-on exercise, record the steps you tried, and explain the result.",
    mixed: "Use a short reference, make a worked example, and explain what you learned.",
  };
  const tasks = [];
  for (let weekNumber = 1; weekNumber <= weeks; weekNumber += 1) {
    for (let dayNumber = 1; dayNumber <= studyDays; dayNumber += 1) {
      const skill = skills[((weekNumber - 1) * studyDays + dayNumber - 1) % skills.length];
      const scheduledDate = addDays(startDate, (weekNumber - 1) * 7 + dayNumber - 1);
      const matchingResources = learningResources.filter((resource) => (
        typeof resource?.url === "string" &&
        resource.url.startsWith("https://") &&
        String(resource.relatedSkill || "").toLowerCase().includes(skill.name.toLowerCase())
      ));
      const preferredTypes = preferredResourceTypes[learningPreference];
      const skillResources = matchingResources.sort((left, right) => {
        const leftType = String(left.contentType || left.type || "").toLowerCase();
        const rightType = String(right.contentType || right.type || "").toLowerCase();
        const leftRank = preferredTypes.findIndex((type) => leftType.includes(type));
        const rightRank = preferredTypes.findIndex((type) => rightType.includes(type));
        return (leftRank < 0 ? preferredTypes.length : leftRank) -
          (rightRank < 0 ? preferredTypes.length : rightRank);
      }).slice(0, 3);
      tasks.push({
        weekNumber,
        dayNumber,
        scheduledDate,
        skill: skill.name,
        title: `${skillLevel[0].toUpperCase()}${skillLevel.slice(1)} ${skill.name} practice`,
        description: `Learn and apply ${skill.name} for ${career}. Preference: ${learningPreference}. Prioritize this as an exploration task; completion does not certify proficiency.`,
        objectives: [
          `Explain a foundational concept in ${skill.name}.`,
          `Apply ${skill.name} to a small career-related task.`,
        ],
        durationMinutes: learningMinutes,
        activity: `${preferenceActivities[learningPreference]} Create a short artifact showing how ${skill.name} applies to ${career}. Record one question for follow-up.`,
        completionCriteria: "Review the objectives, finish the practical activity, and submit the associated topic check. A quiz score is evidence, not a mastery certification.",
        resources: ensureTaskResources(skillResources, skill.name, learningPreference),
        status: "pending",
      });
    }
  }
  return tasks;
}

export function buildWeeklyGoals(tasks, { skillLevel, competencyProgression } = {}) {
  const weeks = new Map();
  for (const task of tasks) {
    if (!weeks.has(task.weekNumber)) weeks.set(task.weekNumber, []);
    weeks.get(task.weekNumber).push(task);
  }
  const progression = competencyProgression && typeof competencyProgression === "object"
    ? competencyProgression[skillLevel]
    : null;
  const competencies = Array.isArray(progression?.competencies)
    ? progression.competencies.filter((item) => typeof item === "string")
    : [];
  return [...weeks].map(([weekNumber, weekTasks]) => {
    const skills = [...new Set(weekTasks.map((task) => task.skill))];
    const stageGoals = competencies.filter((competency) => (
      skills.some((skill) => competency.toLowerCase().includes(skill.toLowerCase()))
    ));
    return {
      weekNumber,
      skills,
      goals: stageGoals.length
        ? [...new Set(stageGoals)]
        : skills.map((skill) => `Practise ${skill} in a career-related activity and complete its scheduled topic check.`),
      scheduledStudyDays: weekTasks.length,
    };
  });
}

const career = "{career}";
const skill = "{skill}";
const topicQuestionTemplates = [
  {
    prompt: `A task for a ${career} role requires ${skill}. What should you do before choosing an approach?`,
    correct: "Clarify the goal, constraints, and evidence that would show the task is complete.",
    distractors: ["Start with the most complex tool available.", "Assume the first idea is correct.", "Skip the requirements and focus only on speed."],
    explanation: "Clear requirements and success criteria help keep the work relevant and verifiable.",
    concept: "requirements and success criteria",
  },
  {
    prompt: `You are beginning a new ${skill} exercise. Which plan is most useful?`,
    correct: "Break the goal into small steps, identify what is uncertain, and test the riskiest assumption early.",
    distractors: ["Attempt every step at once without checkpoints.", "Choose a solution before understanding the goal.", "Avoid testing until all work is finished."],
    explanation: "A staged plan makes uncertainty visible and lets you catch issues early.",
    concept: "planning",
  },
  {
    prompt: `A result from your ${skill} work looks plausible. How should you check it?`,
    correct: "Compare it with an independent expectation or test case that matches the goal.",
    distractors: ["Accept it because it looks polished.", "Repeat the same action without checking the output.", "Report success before reviewing the result."],
    explanation: "A relevant check provides evidence that the result meets the intended requirement.",
    concept: "validation",
  },
  {
    prompt: `A ${skill} task behaves differently than expected. What is the best first response?`,
    correct: "Reproduce the issue, inspect the evidence, and change one likely cause at a time.",
    distractors: ["Make several unrelated changes together.", "Hide the result and move on.", "Assume the tool is always at fault."],
    explanation: "Reproduction and controlled changes make troubleshooting more reliable.",
    concept: "troubleshooting",
  },
  {
    prompt: `Which evidence best supports a claim that you practised ${skill}?`,
    correct: "A small work sample with the goal, steps, result, and limitations explained.",
    distractors: ["A list of tools with no example.", "A claim that the task was easy.", "A screenshot with no context or result."],
    explanation: "A contextualized work sample is reviewable and avoids overstating what one exercise proves.",
    concept: "learning evidence",
  },
  {
    prompt: `When choosing between two ways to apply ${skill}, what should guide your decision?`,
    correct: "The task requirements, constraints, likely risks, and how each result can be validated.",
    distractors: ["Which option sounds most impressive.", "Which option uses the most tools.", "A preference unrelated to the task."],
    explanation: "Trade-offs should be judged against the real objective and constraints.",
    concept: "trade-offs",
  },
  {
    prompt: `A ${skill} solution works for the typical case. What should you check next?`,
    correct: "Test a reasonable edge case and confirm the expected behavior is still clear.",
    distractors: ["Assume the typical case covers every situation.", "Remove checks to make the solution shorter.", "Stop without reviewing any boundaries."],
    explanation: "Edge cases can reveal gaps that ordinary examples do not expose.",
    concept: "edge cases",
  },
  {
    prompt: `You find a learning resource about ${skill}. How can you assess whether it is trustworthy?`,
    correct: "Check its source, date, evidence, and whether its guidance fits the task and current context.",
    distractors: ["Trust it because it is the first search result.", "Use it because it makes a bold claim.", "Ignore the author and publication context."],
    explanation: "Source quality and relevance matter when applying technical or professional guidance.",
    concept: "source evaluation",
  },
  {
    prompt: `A first attempt at a ${skill} activity is unsuccessful. What is a productive next step?`,
    correct: "Use the feedback to identify one gap, revise the work, and try a focused follow-up.",
    distractors: ["Treat one attempt as proof the skill cannot be learned.", "Repeat the exact attempt without reviewing it.", "Mark the activity complete without checking."],
    explanation: "Targeted revision turns feedback into a concrete next learning step.",
    concept: "iteration",
  },
  {
    prompt: `How should you explain a ${skill} decision to a teammate?`,
    correct: "State the goal, the decision, the relevant evidence, and the main trade-off in plain language.",
    distractors: ["Use unexplained jargon to sound certain.", "Describe every detail without stating the decision.", "Report only that the work is finished."],
    explanation: "A concise explanation helps others understand the reasoning and verify the outcome.",
    concept: "communication",
  },
  {
    prompt: `A reviewer gives feedback on your ${skill} work. What response best supports improvement?`,
    correct: "Ask about unclear points, compare the feedback with the goal, and decide what to revise.",
    distractors: ["Ignore all feedback that differs from your first idea.", "Accept every suggestion without considering the task.", "Change the work without checking what the feedback means."],
    explanation: "Clarifying and evaluating feedback helps you make relevant revisions while retaining judgment.",
    concept: "feedback",
  },
  {
    prompt: `You need to collaborate on a ${skill} task with another learner. What should you agree on first?`,
    correct: "The shared objective, responsibilities, assumptions, and how you will review the result.",
    distractors: ["Let everyone work toward a different goal.", "Avoid sharing progress until the deadline.", "Assign work without clarifying ownership."],
    explanation: "Shared goals and clear responsibilities reduce avoidable coordination problems.",
    concept: "collaboration",
  },
  {
    prompt: `Your ${skill} exercise involves information that should not be shared widely. What is the responsible choice?`,
    correct: "Use only the information needed, follow the relevant access rules, and avoid exposing sensitive details.",
    distractors: ["Copy all information into a public example.", "Share access credentials so others can reproduce it.", "Keep unnecessary personal data in the final artifact."],
    explanation: "Minimizing data and respecting access boundaries are part of responsible practice.",
    concept: "privacy and responsibility",
  },
  {
    prompt: `How can you make a ${skill} result easier for people with different needs to use?`,
    correct: "Check relevant accessibility needs and test the result with appropriate alternatives or assistive support.",
    distractors: ["Assume one presentation works for everyone.", "Remove labels to make the interface look simpler.", "Treat accessibility as unrelated to quality."],
    explanation: "Considering accessibility helps ensure the result works for a wider range of users.",
    concept: "accessibility",
  },
  {
    prompt: `A ${skill} task has a short deadline. How should you prioritize?`,
    correct: "Deliver the highest-value required outcome first and keep time to validate it.",
    distractors: ["Polish minor details before meeting core requirements.", "Skip validation to use every minute on implementation.", "Start extra features before the required work."],
    explanation: "Prioritizing essential outcomes while reserving validation time balances scope and quality.",
    concept: "prioritization",
  },
  {
    prompt: `Which note would make your ${skill} work easier to reproduce later?`,
    correct: "Record the relevant setup, inputs, key steps, expected result, and any known limitations.",
    distractors: ["Write only that it worked.", "Record an unexplained final number.", "Depend on memory instead of documenting the process."],
    explanation: "Useful notes capture enough context for another person or your future self to repeat the check.",
    concept: "documentation",
  },
  {
    prompt: `You need to confirm that a ${skill} workflow is repeatable. What is the best check?`,
    correct: "Repeat it with the same documented inputs and compare the outcome against the expected behavior.",
    distractors: ["Run it once and assume it will always work.", "Change the inputs each time without recording them.", "Skip the expected outcome."],
    explanation: "Repeatable conditions and an expected result make the check meaningful.",
    concept: "reproducibility",
  },
  {
    prompt: `Before sharing a ${skill} deliverable, what quality check is most appropriate?`,
    correct: "Review it against the requirements, verify important outputs, and note any remaining limitations.",
    distractors: ["Share it immediately because it is complete-looking.", "Check only the title and formatting.", "Remove any mention of unresolved issues."],
    explanation: "A final requirements check and transparent limitations help prevent misleading handoffs.",
    concept: "quality review",
  },
  {
    prompt: `A tool used in your ${skill} workflow becomes unavailable. What should you do?`,
    correct: "Protect the current work, assess the impact, and choose a safe alternative that still meets the goal.",
    distractors: ["Discard the work and start over without checking.", "Pretend the task succeeded.", "Switch tools without checking compatibility or data safety."],
    explanation: "A safe recovery preserves work and verifies that an alternative still satisfies the requirements.",
    concept: "recovery planning",
  },
  {
    prompt: `A stakeholder requests a change to a ${skill} task halfway through. What should you clarify?`,
    correct: "The revised outcome, its priority, the impact on scope or timing, and who approves the change.",
    distractors: ["Make the change without checking its impact.", "Ignore the request without discussion.", "Add the change while keeping every original deadline unchanged."],
    explanation: "Clarifying the change and its trade-offs helps keep expectations realistic.",
    concept: "change management",
  },
  {
    prompt: `How should you choose a measure for a ${skill} task?`,
    correct: "Use a measure that directly reflects the stated goal and can be checked from available evidence.",
    distractors: ["Choose a number that is easy to collect even if irrelevant.", "Use a measure that rewards activity but not the outcome.", "Select a metric after seeing which one looks best."],
    explanation: "A useful measure reflects the desired outcome rather than merely convenient activity.",
    concept: "measurement",
  },
  {
    prompt: `You notice a possible risk in your ${skill} approach. What should you do?`,
    correct: "Describe the risk, estimate its impact, and choose a proportionate way to reduce or monitor it.",
    distractors: ["Ignore it unless a problem has already happened.", "Assume every risk requires abandoning the task.", "Hide the risk to avoid slowing the work."],
    explanation: "Proportionate risk handling makes concerns visible without overreacting.",
    concept: "risk management",
  },
  {
    prompt: `A ${skill} activity can be completed in several ways. How do you avoid unnecessary work?`,
    correct: "Confirm the required scope and deliver the smallest result that meets it and can be validated.",
    distractors: ["Build every optional feature before checking the core need.", "Add complexity to make the result seem advanced.", "Avoid defining what completion means."],
    explanation: "Clear scope helps focus effort on a useful and verifiable outcome.",
    concept: "scope control",
  },
  {
    prompt: `You are unsure whether a ${skill} assumption is correct. What is the strongest next step?`,
    correct: "State the assumption and run a small, relevant check before relying on it.",
    distractors: ["Treat the assumption as fact because it seems familiar.", "Avoid recording the assumption.", "Build more work on top of it without checking."],
    explanation: "A focused check can validate or revise an assumption before it affects more work.",
    concept: "assumption testing",
  },
  {
    prompt: `How should you handle an error in a ${skill} result that affects only some cases?`,
    correct: "Identify which cases are affected, correct the cause, and retest both affected and unaffected cases.",
    distractors: ["Check only the example where the error first appeared.", "Remove the failing case from the report.", "Make a broad change without regression checks."],
    explanation: "Testing affected and unaffected cases helps confirm the fix without introducing regressions.",
    concept: "regression checking",
  },
  {
    prompt: `A ${skill} task has more work than the available time. What is the responsible response?`,
    correct: "Communicate the constraint early, agree on priorities, and identify what will be deferred.",
    distractors: ["Promise the entire scope without checking feasibility.", "Silently omit requirements at the end.", "Hide the delay until the deadline passes."],
    explanation: "Early, specific communication allows priorities and expectations to be adjusted.",
    concept: "expectation management",
  },
  {
    prompt: `What is a good way to reflect after practising ${skill}?`,
    correct: "Record what worked, what remains uncertain, and one specific next practice step.",
    distractors: ["Write only that the activity is done.", "Claim mastery based on completing one exercise.", "Focus only on mistakes without deciding what to try next."],
    explanation: "A useful reflection connects evidence and uncertainty to an actionable next step.",
    concept: "reflection",
  },
  {
    prompt: `You are preparing a ${skill} example for a portfolio. Which description is most accurate?`,
    correct: "Explain your contribution, the goal, your approach, the result, and what the example does not demonstrate.",
    distractors: ["Claim team outcomes as entirely your own.", "Omit your role and describe only the tools.", "Present a practice exercise as professional experience."],
    explanation: "Accurate context helps readers understand the evidence without overstating experience.",
    concept: "evidence integrity",
  },
  {
    prompt: `A ${skill} result meets the technical requirement but is difficult to maintain. What should you consider?`,
    correct: "Balance the immediate requirement with clarity, maintainability, and the cost of future changes.",
    distractors: ["Ignore future use because the current task is complete.", "Choose the shortest result regardless of clarity.", "Rewrite everything without checking whether the risk is real."],
    explanation: "Maintainability is a trade-off to evaluate in proportion to the task and expected future use.",
    concept: "maintainability",
  },
  {
    prompt: `How should you close out a completed ${skill} learning task?`,
    correct: "Check completion criteria, save the relevant evidence, and note any follow-up learning need.",
    distractors: ["Mark it complete before checking the criteria.", "Delete the work so there is no evidence to review.", "Assume completion means the skill is fully mastered."],
    explanation: "A clear close-out preserves evidence and separates task completion from mastery claims.",
    concept: "completion and next steps",
  },
];

export function buildTopicQuestions({ career, skill, limit = 30 }) {
  return topicQuestionTemplates.slice(0, limit).map((template, index) => {
    const correctOption = template.correct.replaceAll("{skill}", skill).replaceAll("{career}", career);
    const correctAnswer = (index * 3) % 4;
    const distractors = template.distractors.map((option) => option.replaceAll("{skill}", skill).replaceAll("{career}", career));
    const options = [...distractors];
    options.splice(correctAnswer, 0, correctOption);
    return {
      id: `q${index + 1}`,
      prompt: template.prompt.replaceAll("{skill}", skill).replaceAll("{career}", career),
      options,
      correctAnswer,
      explanation: template.explanation,
      concept: template.concept,
      version: MODULE5_ASSESSMENT_VERSION,
    };
  });
}

export function gradeTopicAnswers(questions, answers) {
  const safeAnswers = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  const results = questions.map((question) => {
    const selectedAnswer = safeAnswers[question.id];
    const isCorrect = selectedAnswer === question.correctAnswer;
    return {
      questionId: question.id,
      concept: question.concept,
      selectedAnswer: Number.isInteger(selectedAnswer) ? selectedAnswer : null,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation,
    };
  });
  const correctCount = results.filter((result) => result.isCorrect).length;
  const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  return {
    score,
    correctCount,
    total: questions.length,
    passed: score >= MODULE5_PASS_THRESHOLD,
    threshold: MODULE5_PASS_THRESHOLD,
    results,
    weakConcepts: [...new Set(results.filter((result) => !result.isCorrect).map((result) => result.concept))],
  };
}

export function validateTopicAnswers(questions, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  const expectedIds = questions.map((question) => question.id).sort();
  const submittedIds = Object.keys(answers).sort();
  return expectedIds.length === submittedIds.length &&
    expectedIds.every((id, index) => id === submittedIds[index]) &&
    questions.every((question) => (
      Number.isInteger(answers[question.id]) &&
      answers[question.id] >= 0 &&
      answers[question.id] < question.options.length
    ));
}

export function summarizeAssessment(attempt) {
  return {
    id: attempt.id,
    kind: attempt.kind,
    weekNumber: attempt.weekNumber,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
  };
}

export function summarizeWeeklyAssessments(attempts) {
  const summaries = new Map();
  for (const attempt of attempts) {
    if (attempt.kind !== "weekly") continue;
    if (!summaries.has(attempt.weekNumber)) summaries.set(attempt.weekNumber, []);
    summaries.get(attempt.weekNumber).push(attempt);
  }
  return [...summaries]
    .sort(([left], [right]) => left - right)
    .map(([weekNumber, weekAttempts]) => {
      const ordered = [...weekAttempts].sort((left, right) => (
        new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
      ));
      return {
        weekNumber,
        attempts: ordered.length,
        averageScore: Math.round(ordered.reduce((sum, attempt) => sum + attempt.score, 0) / ordered.length),
        latestScore: ordered[0].score,
        latestPassed: ordered[0].passed,
      };
    });
}

export function getPreparationProgress(tasks, attempts) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const completed = safeTasks.filter((task) => task.status === "completed").length;
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  const scores = safeAttempts.map((attempt) => attempt.score).filter(Number.isFinite);
  const attemptsByRecency = [...safeAttempts].sort((left, right) => (
    new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()
  ));
  const latestAttemptByAssessment = new Map();
  for (const attempt of attemptsByRecency) {
    const scope = attempt.kind === "daily" ? attempt.taskId : attempt.weekNumber;
    const key = `${attempt.kind}:${scope}`;
    if (!latestAttemptByAssessment.has(key)) latestAttemptByAssessment.set(key, attempt);
  }
  const latestAttempts = [...latestAttemptByAssessment.values()];
  return {
    taskCount: safeTasks.length,
    completedTasks: completed,
    progressPercent: safeTasks.length ? Math.round((completed / safeTasks.length) * 100) : 0,
    assessmentCount: scores.length,
    topicCheckCount: safeAttempts.filter((attempt) => attempt.kind === "daily").length,
    weeklyAssessmentCount: safeAttempts.filter((attempt) => attempt.kind === "weekly").length,
    assessmentAverage: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    weakConcepts: latestAttempts.flatMap((attempt) => (
      Array.isArray(attempt.feedback?.weakConcepts) ? attempt.feedback.weakConcepts : []
    )),
    recentScores: attemptsByRecency.slice(0, 5).map((attempt) => ({
      kind: attempt.kind,
      weekNumber: attempt.weekNumber,
      score: attempt.score,
      submittedAt: attempt.submittedAt,
    })),
    nextTask: safeTasks.find((task) => task.status !== "completed") || null,
  };
}
