import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { generateText } from "@/lib/ai/ai-provider.js";
import { isAIProviderUnavailableError } from "@/lib/ai/ai-errors.js";

const BASE_SYSTEM_PROMPT = `You are Nexora's expert Career Guidance AI — sharp, warm, and deeply knowledgeable about careers in tech and beyond.

Your specialties:
- Career path planning (software engineering, product management, data science, AI/ML, design, and more)
- Skill gap analysis — tell users exactly what skills they are missing and how to get them
- Resume review — give actionable, specific feedback on structure, wording, and impact statements
- Interview preparation — mock interviews, common questions, tips by role
- Salary benchmarks and negotiation advice
- Roadmaps for career transitions

CRITICAL FORMATTING RULES — follow strictly:
- NEVER use markdown. No **, no *, no ##, no #, no backticks, no ---, no bullet - symbols
- Write in plain conversational text only
- Use plain line breaks to separate points
- When listing skills write: SKILLS: skill1, skill2, skill3
- When identifying career paths write: CAREER: [Role Name] — one line description
- For resume feedback write numbered points like: 1) Fix this  2) Improve that
- Keep responses concise and scannable
- Always end with one follow-up question
Plain text only. No markdown symbols ever.`;

export async function POST(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true, name: true },
    });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { message, sessionId: incomingSessionId } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // ── Resolve or create session ─────────────────────────────────
    let session;
    if (incomingSessionId) {
      session = await db.chatSession.findFirst({
        where: { id: incomingSessionId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
    } else {
      const autoTitle = message.trim().slice(0, 40) + (message.length > 40 ? "..." : "");
      session = await db.chatSession.create({
        data: { userId: user.id, title: autoTitle },
        include: { messages: true },
      });
    }

    // Save user message
    await db.message.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    // Build Gemini history from DB messages
    const history = session.messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Inject resume context if uploaded
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (session.resumeText) {
      systemPrompt += `\n\nThe user has uploaded their resume. Use it as context for all advice:\n\n--- RESUME START ---\n${session.resumeText}\n--- RESUME END ---\n\nRemember: plain text only, no markdown.`;
    }

    let aiText = await generateText(message, {
      operation: "career-chat",
      systemPrompt,
      history,
    });

    // Strip any markdown that slips through
    aiText = aiText
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/^\s*[-•]\s/gm, "")
      .replace(/^\s*\d+\.\s/gm, "")
      .replace(/---+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    await db.message.create({
      data: { sessionId: session.id, role: "assistant", content: aiText },
    });
    await db.chatSession.update({
      where: { id: session.id },
      data:  { updatedAt: new Date() },
    });

    return Response.json({
      content:      aiText,
      sessionId:    session.id,
      sessionTitle: session.title,
    });

  } catch (error) {
    console.error("Career chat API error.", {
      code: error?.code || null,
      status: error?.status || null,
      name: error?.name || "Error",
    });
    if (isAIProviderUnavailableError(error) || error?.name === "AbortError") {
      const message = error?.code === "AI_PROVIDER_QUOTA_EXHAUSTED"
        ? error.message
        : "Gemini is temporarily unavailable or rate-limited. Please retry shortly.";
      return Response.json(
        { error: message },
        { status: 503 },
      );
    }
    return Response.json({ error: "Failed to get response. Please try again." }, { status: 500 });
  }
}