import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { buildLiveTokenConfig, GEMINI_LIVE_MODEL } from "@/lib/module6/live-provider.js";

export async function POST(_request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "Sign in to start a live interview." }, { status: 401 });
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Live interviews are unavailable because the server Gemini key is not configured." }, { status: 503 });
    }

    const { sessionId } = await params;
    const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    const interview = await db.mockInterviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        careerTitle: true,
        interviewType: true,
        difficulty: true,
        questions: true,
        profileSnapshot: true,
        status: true,
        answers: { select: { questionId: true } },
      },
    });
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    if (interview.status !== "in_progress") {
      return NextResponse.json({ error: "This interview is already closed." }, { status: 409 });
    }

    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha" },
    });
    const token = await client.authTokens.create({ config: buildLiveTokenConfig(interview) });
    if (!token?.name) {
      return NextResponse.json({ error: "Gemini did not issue a live interview token." }, { status: 502 });
    }
    return NextResponse.json(
      { token: token.name, model: GEMINI_LIVE_MODEL, expiresInSeconds: 60 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Module 6 live token creation failed:", error?.name || "provider error");
    return NextResponse.json({ error: "Unable to connect to the live interview provider. Please retry or use text practice." }, { status: 502 });
  }
}
