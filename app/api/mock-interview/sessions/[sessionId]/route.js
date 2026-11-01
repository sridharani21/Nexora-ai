import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { evaluateInterviewAnswer, publicInterviewQuestion } from "@/lib/module6/interview.js";
import { publicProfileSnapshot } from "@/lib/module6/tavus.js";

export async function GET(_request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to access this interview." }, { status: 401 });
    const { sessionId } = await params;
    const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const session = await db.mockInterviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: { answers: { orderBy: { submittedAt: "asc" } } },
    });
    if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    let recommendations = [];
    if (session.report?.weakSkills?.length && session.planId) {
      const tasks = await db.careerPreparationTask.findMany({
        where: { planId: session.planId, userId: user.id },
        select: { id: true, skill: true, title: true, status: true },
      });
      recommendations = session.report.weakSkills.map((skill) => {
        const matchingTask = tasks.find((task) => task.skill.toLowerCase() === skill.toLowerCase());
        return matchingTask ? {
          skill,
          title: matchingTask.title,
          href: `/skill-development/learn/${encodeURIComponent(matchingTask.id)}`,
          status: matchingTask.status,
        } : {
          skill,
          title: `Review ${skill} in your Module 5 preparation plan`,
          href: `/skill-development/plan?planId=${encodeURIComponent(session.planId)}`,
        };
      });
    }
    return NextResponse.json({
      session: {
        id: session.id,
        careerTitle: session.careerTitle,
        interviewType: session.interviewType,
        difficulty: session.difficulty,
        duration: session.duration,
        language: session.language,
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        tavusAvailable: Boolean(process.env.TAVUS_API_KEY?.trim() && process.env.TAVUS_PAL_ID?.trim()),
        geminiLiveAvailable: Boolean(process.env.GEMINI_API_KEY?.trim()),
        profileSnapshot: publicProfileSnapshot(session.profileSnapshot),
        questions: session.questions.map(publicInterviewQuestion),
        answers: session.answers.map((answer) => ({
          questionId: answer.questionId,
          answerText: answer.answerText,
          evaluation: answer.evaluation,
          score: answer.score,
          submittedAt: answer.submittedAt,
        })),
        report: session.report,
      },
      recommendations,
    });
  } catch (error) {
    console.error("Module 6 session load failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to load this interview." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to submit an answer." }, { status: 401 });
    const { sessionId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a valid answer." }, { status: 400 });
    }
    if (typeof body?.questionId !== "string" || !/^q([1-9]|1[0-2])$/.test(body.questionId)
      || typeof body?.answerText !== "string" || body.answerText.trim().length < 5
      || body.answerText.length > 12000
      || (body?.append !== undefined && typeof body.append !== "boolean")
      || (body?.interviewerText !== undefined &&
        (typeof body.interviewerText !== "string" || body.interviewerText.length > 8000))) {
      return NextResponse.json({ error: "Enter an answer between 5 and 12,000 characters." }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const session = await db.mockInterviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true, status: true, questions: true },
    });
    if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    if (session.status !== "in_progress") return NextResponse.json({ error: "This interview is already closed." }, { status: 409 });
    const question = session.questions.find((item) => item.id === body.questionId);
    if (!question) return NextResponse.json({ error: "Question does not belong to this interview." }, { status: 404 });

    const existing = await db.mockInterviewAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId: question.id } },
    });
    if (existing && body.append !== true) {
      return NextResponse.json({ answer: {
        questionId: existing.questionId,
        answerText: existing.answerText,
        evaluation: existing.evaluation,
        score: existing.score,
        submittedAt: existing.submittedAt,
      } });
    }
    const answerText = existing
      ? `${existing.answerText}\n\nFollow-up response: ${body.answerText.trim()}`
      : body.answerText.trim();
    if (answerText.length > 12000) {
      return NextResponse.json({ error: "The combined answer is too long to save." }, { status: 400 });
    }
    const evaluation = await evaluateInterviewAnswer(question, answerText);
    const previousInterviewerTurns = Array.isArray(existing?.evaluation?.conversation?.interviewerTurns)
      ? existing.evaluation.conversation.interviewerTurns
      : [];
    const interviewerText = body.interviewerText?.trim();
    const evaluationWithConversation = {
      ...evaluation,
      conversation: {
        mode: interviewerText ? "gemini-live-spoken" : "text-practice",
        interviewerTurns: interviewerText
          ? [...previousInterviewerTurns, { text: interviewerText, savedAt: new Date().toISOString() }]
          : previousInterviewerTurns,
      },
    };
    try {
      const answer = existing
        ? await db.mockInterviewAnswer.update({
          where: { id: existing.id },
          data: { answerText, evaluation: evaluationWithConversation, score: evaluationWithConversation.score },
        })
        : await db.mockInterviewAnswer.create({
          data: {
            sessionId,
            questionId: question.id,
            answerText,
            evaluation: evaluationWithConversation,
            score: evaluationWithConversation.score,
          },
        });
      return NextResponse.json({ answer: {
        questionId: answer.questionId,
        answerText: answer.answerText,
        evaluation: answer.evaluation,
        score: answer.score,
        submittedAt: answer.submittedAt,
      } }, { status: 201 });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const answer = await db.mockInterviewAnswer.findUnique({
        where: { sessionId_questionId: { sessionId, questionId: question.id } },
      });
      if (!answer) throw error;
      return NextResponse.json({ answer: {
        questionId: answer.questionId,
        answerText: answer.answerText,
        evaluation: answer.evaluation,
        score: answer.score,
        submittedAt: answer.submittedAt,
      } });
    }
  } catch (error) {
    console.error("Module 6 answer submission failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Unable to save this answer. Please retry." }, { status: 500 });
  }
}
