import { z } from "zod";
import { generateJson } from "../llm.js";
import { hasAIProviderConfigured } from "../ai/ai-config.js";

export const interviewSetupSchema = z.object({
  interviewType: z.enum(["mixed", "technical", "behavioral", "project", "coding"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  duration: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  language: z.literal("English"),
  focus: z.enum(["skills", "projects", "problem_solving", "communication", "job_readiness"]).default("job_readiness"),
  planId: z.string().uuid().optional().nullable(),
}).strict();

const typeSequence = {
  mixed: ["introduction", "technical", "scenario", "project", "behavioral", "technical", "hr", "reflection", "technical", "behavioral", "scenario", "project"],
  technical: ["introduction", "technical", "technical", "scenario", "technical", "project", "technical", "scenario", "technical", "behavioral", "technical", "reflection"],
  behavioral: ["introduction", "behavioral", "behavioral", "scenario", "project", "behavioral", "hr", "reflection", "behavioral", "scenario", "behavioral", "project"],
  project: ["introduction", "project", "project", "scenario", "technical", "project", "behavioral", "scenario", "project", "technical", "reflection", "project"],
  coding: ["introduction", "coding", "coding", "coding", "technical", "scenario", "coding", "project", "coding", "technical", "behavioral", "reflection"],
};

const prompts = {
  introduction: (career) => `Please introduce yourself and explain what interests you about working as a ${career}.`,
  technical: (skill, career) => `For a ${career} role, explain how you would use ${skill} in a real task. Describe the key steps and one trade-off you would consider.`,
  scenario: (skill, career) => `You are working as a ${career} and encounter an unfamiliar problem involving ${skill}. How would you investigate it, decide on an approach, and check whether your solution worked?`,
  project: (skill, career) => `Tell me about a project or practical exercise relevant to ${career}${skill ? `, especially one involving ${skill}` : ""}. What was your contribution, what challenge did you face, and what would you improve?`,
  behavioral: (career) => `Describe a time you received difficult feedback or had to change your approach while working toward a ${career}-related goal. What did you do and learn?`,
  hr: (career) => `Why are you interested in this ${career} career, and what would you want to learn in your first six months?`,
  reflection: (career) => `Which part of preparing for a ${career} role do you currently find most challenging, and what practical step would you take next?`,
  coding: (skill, career) => `Write or outline a small solution for a ${career}-related problem involving ${skill || "a core role skill"}. Explain your approach, edge cases, and how you would test it. Code is collected as text and is not executed in this interview.`,
};

const categoryLabels = {
  introduction: "Communication",
  technical: "Role knowledge",
  scenario: "Problem solving",
  project: "Project discussion",
  behavioral: "Behavioral",
  hr: "Career motivation",
  reflection: "Reflection",
  coding: "Coding reasoning",
};

export function buildInterviewQuestions({ career, skills, interviewType, difficulty, duration }) {
  const count = duration === 15 ? 5 : duration === 30 ? 8 : 12;
  const normalizedSkills = [...new Set((skills || []).filter((skill) => typeof skill === "string" && skill.trim()).map((skill) => skill.trim()))];
  const sequence = typeSequence[interviewType];
  return Array.from({ length: count }, (_, index) => {
    const kind = sequence[index % sequence.length];
    const skill = normalizedSkills[index % Math.max(1, normalizedSkills.length)] || null;
    const prompt = prompts[kind];
    return {
      id: `q${index + 1}`,
      category: categoryLabels[kind],
      kind,
      difficulty,
      skill,
      question: prompt(skill, career),
      expectedCriteria: [
        "Directly answer the question asked.",
        skill ? `Use accurate, relevant reasoning about ${skill}.` : "Use a relevant example or clear reasoning.",
        "Explain the approach or evidence rather than making unsupported claims.",
        kind === "behavioral" || kind === "project" ? "Describe the situation, personal actions, and learning." : "Mention a practical validation step or trade-off.",
      ],
      rubric: {
        relevance: "Addresses the specific question and role.",
        completeness: "Covers the important steps, evidence, or context.",
        reasoning: "Explains sound reasoning and practical validation.",
        communication: "Organizes the answer clearly and specifically.",
      },
    };
  });
}

const generatedQuestionSetSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    question: z.string().trim().min(20).max(500),
  }).strict()),
}).strict();

export async function generateCareerInterviewQuestions(options, generate = generateJson) {
  const questions = buildInterviewQuestions(options);
  if (!hasAIProviderConfigured()) return { questions, generationMethod: "role_question_bank" };

  try {
    const generated = await generate(
      `Rewrite each draft as a clear, realistic interview question tailored to the specified career, interview type, and difficulty.
Preserve each question ID and return exactly the same number of questions in the same order.
Do not add answer keys, scoring, markdown, or extra fields. Do not assume experience or personal history.
Career: ${options.career}
Interview type: ${options.interviewType}
Difficulty: ${options.difficulty}
Focus: ${options.focus || "job readiness"}
Relevant role skills: ${(options.skills || []).join(", ") || "use role context"}
Draft question set: ${JSON.stringify(questions.map(({ id, category, skill, question }) => ({ id, category, skill, question })))}

Return {"questions":[{"id":"q1","question":"..."}]}.`,
      {
        operation: "mock-interview-question-adaptation",
        validateOutput: (output) => {
          const parsed = generatedQuestionSetSchema.safeParse(output);
          if (!parsed.success || parsed.data.questions.length !== questions.length) return false;
          const returnedIds = parsed.data.questions.map((item) => item.id);
          if (new Set(returnedIds).size !== questions.length ||
              questions.some((question, index) => returnedIds[index] !== question.id)) {
            return false;
          }
          return parsed.data;
        },
      },
    );
    const parsed = generatedQuestionSetSchema.safeParse(generated);
    if (!parsed.success || parsed.data.questions.length !== questions.length) {
      throw new Error("Gemini returned an invalid question set.");
    }
    const returnedIds = parsed.data.questions.map((item) => item.id);
    if (new Set(returnedIds).size !== questions.length || questions.some((question, index) => returnedIds[index] !== question.id)) {
      throw new Error("Gemini returned mismatched question identifiers.");
    }
    return {
      questions: questions.map((question, index) => ({ ...question, question: parsed.data.questions[index].question })),
      generationMethod: "ai_provider_role_adaptation",
    };
  } catch (error) {
    console.warn("Module 6 question generation used the role question bank.", error?.code || error?.name || "provider error");
    return { questions, generationMethod: "role_question_bank" };
  }
}

export function publicInterviewQuestion(question) {
  const { rubric, expectedCriteria, ...publicQuestion } = question;
  return publicQuestion;
}

function deterministicEvaluation(question, answerText) {
  const answer = answerText.trim();
  const normalized = answer.toLowerCase();
  const skillMentioned = question.skill && normalized.includes(question.skill.toLowerCase());
  const hasExample = /\b(for example|for instance|such as|i built|i worked|we used|in my project|when i)\b/i.test(answer);
  const hasReasoning = /\b(because|therefore|first|then|trade-?off|validate|test|measure|evidence|result)\b/i.test(answer);
  const lengthScore = Math.min(25, Math.round((answer.split(/\s+/).length / 60) * 25));
  const relevance = Math.min(100, 35 + (skillMentioned ? 35 : 0) + (hasExample ? 20 : 0) + (answer.length > 60 ? 10 : 0));
  const completeness = Math.min(100, lengthScore * 2 + (hasExample ? 25 : 0) + (hasReasoning ? 25 : 0));
  const reasoning = Math.min(100, 30 + (hasReasoning ? 40 : 0) + (hasExample ? 20 : 0) + (answer.length > 100 ? 10 : 0));
  const communication = Math.min(100, 30 + (answer.split(/\s+/).length >= 20 ? 35 : 0) + (/[.!?]/.test(answer) ? 20 : 0) + (hasExample ? 15 : 0));
  const criteria = { relevance, completeness, reasoning, communication };
  const score = Math.round(Object.values(criteria).reduce((total, value) => total + value, 0) / 4);
  return {
    score,
    criteria,
    strengths: [
      ...(skillMentioned ? [`Connected the answer to ${question.skill}.`] : []),
      ...(hasExample ? ["Included a practical example."] : []),
      ...(hasReasoning ? ["Explained reasoning or validation."] : []),
    ].slice(0, 3),
    improvements: [
      ...(!skillMentioned && question.skill ? [`Make the connection to ${question.skill} more explicit.`] : []),
      ...(!hasExample ? ["Add a specific example or evidence from a project, exercise, or experience."] : []),
      ...(!hasReasoning ? ["Explain why you chose the approach and how you would check the result."] : []),
      ...(answer.split(/\s+/).length < 20 ? ["Expand the response with clear steps and relevant detail."] : []),
    ].slice(0, 3),
    reviewSkill: question.skill,
    evaluationMethod: "structured_practice_review",
  };
}

const evaluationSchema = z.object({
  score: z.number().min(0).max(100),
  criteria: z.object({
    relevance: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    reasoning: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
  }).strict(),
  strengths: z.array(z.string().max(300)).max(4),
  improvements: z.array(z.string().max(300)).max(4),
  modelAnswerOutline: z.array(z.string().max(300)).max(5),
}).strict();

export async function evaluateInterviewAnswer(question, answerText, { useModel = true } = {}) {
  const fallback = deterministicEvaluation(question, answerText);
  if (!useModel || !hasAIProviderConfigured()) return fallback;

  try {
    const generated = await generateJson(
      `Evaluate this mock interview answer as practice feedback, not a hiring decision.
Question category: ${question.category}
Role skill: ${question.skill || "general"}
Question: ${question.question}
Expected criteria: ${question.expectedCriteria.join("; ")}
Candidate answer: ${answerText}

Return JSON with score (0-100), criteria (relevance, completeness, reasoning, communication each 0-100),
strengths (up to 3 concise strings), improvements (up to 3 actionable strings), and modelAnswerOutline
(up to 4 short bullet strings). Score only the answer content; never assess appearance, accent, emotion, or confidence.`,
      {
        operation: "mock-interview-answer-evaluation",
        validateOutput: (output) => {
          const parsed = evaluationSchema.safeParse(output);
          return parsed.success ? parsed.data : false;
        },
      },
    );
    const parsed = evaluationSchema.safeParse(generated);
    if (!parsed.success) throw new Error("Invalid evaluation structure.");
    return { ...parsed.data, reviewSkill: question.skill, evaluationMethod: "ai_provider_practice_feedback" };
  } catch (error) {
    console.warn("Module 6 evaluation used structured fallback.", error?.code || error?.name || "provider error");
    return fallback;
  }
}

export function buildInterviewReport(session, answers) {
  const completed = answers.length;
  const byCategory = new Map();
  for (const answer of answers) {
    const category = answer.category;
    const scores = byCategory.get(category) || [];
    scores.push(answer.score);
    byCategory.set(category, scores);
  }
  const categoryScores = Object.fromEntries([...byCategory].map(([category, scores]) => [
    category,
    Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
  ]));
  const overallScore = completed
    ? Math.round(answers.reduce((sum, answer) => sum + answer.score, 0) / completed)
    : null;
  const improvementAreas = [...new Set(answers.flatMap((answer) => answer.improvements || []))].slice(0, 6);
  const strengths = [...new Set(answers.flatMap((answer) => answer.strengths || []))].slice(0, 6);
  const weakSkills = [...new Set(answers.filter((answer) => answer.score < 70 && answer.reviewSkill).map((answer) => answer.reviewSkill))];
  return {
    overallScore,
    categoryScores,
    completedAnswers: completed,
    totalQuestions: session.questions.length,
    strengths,
    improvementAreas,
    weakSkills,
    note: "Practice feedback only. This score is not a hiring decision or a guarantee of job readiness.",
  };
}
