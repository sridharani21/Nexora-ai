import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  createTavusConversation,
  endTavusConversation,
  getTavusConversationStatus,
  isTavusConfigured,
  getTavusConversation,
  tavusErrorMessage,
  TavusProviderError,
  validateTavusRoomUrl,
  withTavusConversation,
} from "@/lib/module6/tavus.js";

export async function POST(_request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to start this interview." }, { status: 401 });
    if (!isTavusConfigured()) {
      return NextResponse.json({ error: tavusErrorMessage("not_configured") }, { status: 503 });
    }
    const { sessionId } = await params;
    const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const session = await db.mockInterviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        careerTitle: true,
        interviewType: true,
        difficulty: true,
        duration: true,
        questions: true,
        profileSnapshot: true,
        status: true,
      },
    });
    if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "This interview is already closed." }, { status: 409 });
    }
    const existingConversation = getTavusConversation(session.profileSnapshot);
    if (existingConversation) {
      const remoteStatus = await getTavusConversationStatus(existingConversation.conversationId);
      if (remoteStatus !== "ended") {
        return NextResponse.json({
          conversationUrl: validateTavusRoomUrl(existingConversation.conversationUrl),
          reused: true,
        }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    const conversation = await createTavusConversation(session);
    try {
      const claimed = await db.mockInterviewSession.updateMany({
        where: {
          id: session.id,
          userId: user.id,
          status: "in_progress",
          profileSnapshot: { equals: session.profileSnapshot },
        },
        data: { profileSnapshot: withTavusConversation(session.profileSnapshot, conversation) },
      });
      if (claimed.count === 1) {
        return NextResponse.json({
          conversationUrl: conversation.conversationUrl,
          reused: false,
        }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
    } catch (error) {
      await endTavusConversation(conversation.conversationId).catch((cleanupError) => {
        console.error("Tavus duplicate conversation cleanup failed:", cleanupError?.category || "provider error");
      });
      if (error?.code !== "P2002") throw error;
    }

    const existing = await db.mockInterviewSession.findFirst({
      where: { id: session.id, userId: user.id, status: "in_progress" },
      select: { profileSnapshot: true },
    });
    const winner = getTavusConversation(existing?.profileSnapshot);
    if (winner) {
      await endTavusConversation(conversation.conversationId).catch((cleanupError) => {
        console.error("Tavus duplicate conversation cleanup failed:", cleanupError?.category || "provider error");
      });
      return NextResponse.json({
        conversationUrl: validateTavusRoomUrl(winner.conversationUrl),
        reused: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    await endTavusConversation(conversation.conversationId).catch((cleanupError) => {
      console.error("Tavus duplicate conversation cleanup failed:", cleanupError?.category || "provider error");
    });
    return NextResponse.json({ error: "This interview changed while the video room was starting. Please retry." }, { status: 409 });
  } catch (error) {
    console.error("Module 6 Tavus room creation failed:", error?.category || error?.name || "provider error");
    const category = error instanceof TavusProviderError ? error.category : null;
    const message = category
      ? tavusErrorMessage(category)
      : "Unable to start the video interview. Please retry or use audio-only practice.";
    const status = category === "not_configured" ? 503 : category ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
