import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { generateCareerInterviewQuestions, interviewSetupSchema } from "@/lib/module6/interview.js";
import { isTavusConfigured } from "@/lib/module6/tavus.js";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to access Module 6." }, { status: 401 });
    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true, skills: true, experience: true, profile: { select: { skills: true, education: true, experience: true } } },
    });
    if (!user) return NextResponse.json({ career: null, sessions: [] });

    const [goal, sessions, module2Attempts] = await Promise.all([
      db.module4CareerGoal.findFirst({
        where: { userId: user.id, isCurrent: true },
        orderBy: { selectedAt: "desc" },
        include: { career: { include: { skillRequirements: true } } },
      }),
      db.mockInterviewSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, careerTitle: true, interviewType: true, difficulty: true,
          duration: true, status: true, overallScore: true, createdAt: true,
        },
      }),
      db.module2Attempt.findMany({
        where: { userId: user.id, status: { in: ["SUBMITTED", "EXPIRED"] }, result: { not: null } },
        orderBy: { submittedAt: "desc" },
        take: 2,
        select: { branch: true, result: true, submittedAt: true },
      }),
    ]);
    const latestCompleted = sessions.find((session) => session.status === "completed" && session.overallScore !== null) || null;
    return NextResponse.json({
      tavusAvailable: isTavusConfigured(),
      geminiLiveAvailable: Boolean(process.env.GEMINI_API_KEY?.trim()),
      career: goal ? {
        id: goal.careerId,
        goalId: goal.id,
        title: goal.career.title,
        skills: goal.career.skillRequirements.map((skill) => skill.skillName),
      } : null,
      profile: {
        skills: [...new Set([...(user.skills || []), ...(user.profile?.skills || [])])],
        experience: user.profile?.experience || (user.experience === null ? null : `${user.experience} years`),
        education: user.profile?.education || null,
        module2Assessments: summarizeModule2Attempts(module2Attempts),
      },
      latestCompleted,
      completedCount: sessions.filter((session) => session.status === "completed").length,
      sessions,
    });
  } catch (error) {
    console.error("Module 6 dashboard load failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to load Module 6." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to start an interview." }, { status: 401 });
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a valid interview configuration." }, { status: 400 });
    }
    const parsed = interviewSetupSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Review the interview settings and try again." }, { status: 400 });

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true, skills: true, experience: true, profile: { select: { skills: true, education: true, experience: true } } },
    });
    if (!user) return NextResponse.json({ error: "Student account not found." }, { status: 404 });
    const goal = await db.module4CareerGoal.findFirst({
      where: { userId: user.id, isCurrent: true },
      orderBy: { selectedAt: "desc" },
      include: { career: { include: { skillRequirements: true } } },
    });
    if (!goal) return NextResponse.json({ error: "Choose your current career in Module 4 before starting an interview." }, { status: 403 });

    let plan = null;
    if (parsed.data.planId) {
      plan = await db.careerPreparationPlan.findFirst({
        where: { id: parsed.data.planId, userId: user.id, careerId: goal.careerId },
        include: { tasks: { where: { status: "completed" }, select: { skill: true, title: true } } },
      });
      if (!plan) return NextResponse.json({ error: "That preparation plan does not belong to your current career." }, { status: 403 });
    } else {
      plan = await db.careerPreparationPlan.findFirst({
        where: { userId: user.id, careerId: goal.careerId },
        orderBy: { createdAt: "desc" },
        include: { tasks: { where: { status: "completed" }, select: { skill: true, title: true } } },
      });
    }

    const skills = [...new Set([
      ...goal.career.skillRequirements.map((skill) => skill.skillName),
      ...(goal.career.technicalTopics || []),
    ])];
    const module2Attempts = await db.module2Attempt.findMany({
      where: { userId: user.id, status: { in: ["SUBMITTED", "EXPIRED"] }, result: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 2,
      select: { branch: true, result: true, submittedAt: true },
    });
    const generatedSet = await generateCareerInterviewQuestions({
      career: goal.career.title,
      skills,
      interviewType: parsed.data.interviewType,
      difficulty: parsed.data.difficulty,
      duration: parsed.data.duration,
      focus: parsed.data.focus,
    });
    const questions = generatedSet.questions;
    const profileSnapshot = {
      skills: [...new Set([...(user.skills || []), ...(user.profile?.skills || [])])],
      experience: user.profile?.experience || (user.experience === null ? null : `${user.experience} years`),
      education: user.profile?.education || null,
      module2Assessments: summarizeModule2Attempts(module2Attempts),
      completedPreparationTopics: plan?.tasks.map((task) => ({ skill: task.skill, title: task.title })) || [],
      preparationPlanId: plan?.id || null,
      questionGenerationMethod: generatedSet.generationMethod,
      interviewFocus: parsed.data.focus,
      recording: { enabled: false, policyVersion: "module6-no-media-recording-v1" },
    };
    const session = await db.mockInterviewSession.create({
      data: {
        userId: user.id,
        careerId: goal.careerId,
        goalId: goal.id,
        planId: plan?.id || null,
        careerTitle: goal.career.title,
        interviewType: parsed.data.interviewType,
        difficulty: parsed.data.difficulty,
        duration: parsed.data.duration,
        language: parsed.data.language,
        questions,
        profileSnapshot,
      },
      select: { id: true, careerTitle: true, interviewType: true, difficulty: true, duration: true, createdAt: true },
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Module 6 session creation failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to start the interview. Please try again." }, { status: 500 });
  }
}

function summarizeModule2Attempts(attempts) {
  return attempts.map((attempt) => {
    const result = attempt.result && typeof attempt.result === "object" ? attempt.result : {};
    return {
      branch: attempt.branch,
      score: typeof result.score === "number" ? result.score : null,
      maxMarks: typeof result.maxMarks === "number" ? result.maxMarks : null,
      percentage: typeof result.percentage === "number" ? result.percentage : null,
      topics: Array.isArray(result.topics)
        ? result.topics.filter((topic) => typeof topic?.topic === "string").map((topic) => ({
          topic: topic.topic,
          percentage: typeof topic.percentage === "number" ? topic.percentage : null,
        }))
        : [],
      submittedAt: attempt.submittedAt,
    };
  });
}
