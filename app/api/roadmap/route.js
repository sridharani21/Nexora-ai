// app/api/roadmap/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function POST(req) {
  try {
    const { career, months } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
Create a learning roadmap for becoming a ${career}.
Duration: ${months} months.
Return ONLY valid JSON, no markdown, no explanation:
{
  "months": [
    {
      "month": 1,
      "title": "Phase title",
      "weeks": [
        { "week": 1, "topics": ["topic1", "topic2", "topic3"] },
        { "week": 2, "topics": ["topic1", "topic2", "topic3"] },
        { "week": 3, "topics": ["topic1", "topic2"] },
        { "week": 4, "topics": ["topic1", "topic2"] }
      ]
    }
  ]
}
Rules: exactly 4 weeks per month, 2-3 topics per week, short title per month.`;

    const result = await model.generateContent(prompt);
    let text = await result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const roadmap = JSON.parse(text);
    return Response.json({ roadmap });

  } catch (err) {
    console.error("Roadmap generation error:", err);
    return Response.json({
      roadmap: null,
      error: err.message?.includes("429")
        ? "API quota exceeded. Try again later."
        : "Failed to generate roadmap. Please try again.",
    });
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the DB user by clerkUserId
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return NextResponse.json({ roadmaps: [] });

    const roadmaps = await db.roadmap.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true, career: true, months: true, createdAt: true },
    });

    return NextResponse.json({ roadmaps });
  } catch (err) {
    console.error("List roadmaps error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}