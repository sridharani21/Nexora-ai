import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { buildInterviewReport, evaluateInterviewAnswer } from "@/lib/module6/interview.js";
import {
  endTavusConversation,
  getTavusConversation,
  getTavusConversationStatus,
  getTavusTranscript,
  mapTavusTranscriptToAnswers,
  tavusErrorMessage,
  TavusProviderError,
  wait,
} from "@/lib/module6/tavus.js";

export async function POST(_request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to finish this interview." }, { status: 401 });
    const { sessionId } = await params;
    const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const tavusSession = await db.mockInterviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        status: true,
        questions: true,
        profileSnapshot: true,
      },
    });
    if (!tavusSession) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const tavusConversation = getTavusConversation(tavusSession.profileSnapshot);
    if (tavusSession.status === "in_progress" && tavusConversation) {
      const conversationStatus = await getTavusConversationStatus(tavusConversation.conversationId);
      if (conversationStatus !== "ended") {
        await endTavusConversation(tavusConversation.conversationId);
      }
      let transcript = null;
      for (let attempt = 0; attempt < 4 && !transcript; attempt += 1) {
        transcript = await getTavusTranscript(tavusConversation.conversationId);
        if (!transcript && attempt < 3) await wait(1000);
      }
      if (!transcript) {
        return NextResponse.json({ error: tavusErrorMessage("transcript_pending") }, { status: 409 });
      }
      const transcriptAnswers = mapTavusTranscriptToAnswers(tavusSession.questions, transcript);
      for (const transcriptAnswer of transcriptAnswers) {
        const question = tavusSession.questions.find((item) => item.id === transcriptAnswer.questionId);
        const evaluation = await evaluateInterviewAnswer(question, transcriptAnswer.answerText, { useModel: false });
        await db.mockInterviewAnswer.upsert({
          where: {
            sessionId_questionId: {
              sessionId: tavusSession.id,
              questionId: transcriptAnswer.questionId,
            },
          },
          create: {
            sessionId: tavusSession.id,
            questionId: transcriptAnswer.questionId,
            answerText: transcriptAnswer.answerText,
            evaluation: {
              ...evaluation,
              conversation: {
                mode: "tavus_video",
                interviewerTurns: transcriptAnswer.interviewerTurns.map((turn) => ({
                  ...turn,
                  savedAt: new Date().toISOString(),
                })),
              },
            },
            score: evaluation.score,
          },
          update: {
            answerText: transcriptAnswer.answerText,
            evaluation: {
              ...evaluation,
              conversation: {
                mode: "tavus_video",
                interviewerTurns: transcriptAnswer.interviewerTurns.map((turn) => ({
                  ...turn,
                  savedAt: new Date().toISOString(),
                })),
              },
            },
            score: evaluation.score,
          },
        });
      }
    }
    const result = await db.$transaction(async (tx) => {
      const session = await tx.mockInterviewSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: { answers: true },
      });
      if (!session) return null;

      const questionById = new Map(session.questions.map((question) => [question.id, question]));
      const answers = session.answers.map((answer) => ({
        ...answer.evaluation,
        questionId: answer.questionId,
        category: questionById.get(answer.questionId)?.category || "Other",
        score: answer.score,
      }));
      const report = buildInterviewReport(session, answers);
      const status = session.answers.length === session.questions.length ? "completed" : "ended";
      const updated = await tx.mockInterviewSession.update({
        where: { id: session.id },
        data: {
          status,
          report,
          overallScore: report.overallScore,
          completedAt: new Date(),
        },
        include: { answers: true },
      });
      return { session: updated, report };
    }, { maxWait: 10_000, timeout: 15_000 });
    if (!result) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

    const weakSkills = result.report.weakSkills || [];
    const planId = result.session.planId;
    let recommendations = [];
    if (planId && weakSkills.length) {
      const tasks = await db.careerPreparationTask.findMany({
        where: { planId, userId: user.id },
        select: { id: true, skill: true, title: true, status: true, weekNumber: true },
        orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }],
      });
      recommendations = weakSkills.map((skill) => {
        const matchingTask = tasks.find((task) => task.skill.toLowerCase() === skill.toLowerCase());
        return matchingTask ? {
          skill,
          title: matchingTask.title,
          href: `/skill-development/learn/${encodeURIComponent(matchingTask.id)}`,
          status: matchingTask.status,
        } : { skill, title: `Review ${skill} in your Module 5 preparation plan`, href: `/skill-development/plan?planId=${encodeURIComponent(planId)}` };
      });
    }
    return NextResponse.json({
      report: result.report,
      status: result.session.status,
      recommendations,
    });
  } catch (error) {
    console.error("Module 6 report finalization failed:", error?.category || error?.name || "unknown error");
    if (error instanceof TavusProviderError) {
      const status = error.category === "transcript_unusable" ? 409 : 502;
      return NextResponse.json({ error: tavusErrorMessage(error.category) }, { status });
    }
    return NextResponse.json({ error: "Unable to save the interview report." }, { status: 500 });
  }
}
