import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

async function verifyOwnership(clerkUserId, sessionId) {
  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return null;

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  return session ? user : null;
}

export async function PATCH(req, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;
    const { title } = await req.json();

    if (!title?.trim()) {
      return Response.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    const user = await verifyOwnership(clerkUserId, sessionId);
    if (!user) return Response.json({ error: "Session not found" }, { status: 404 });

    const updated = await db.chatSession.update({
      where: { id: sessionId },
      data: { title: title.trim() },
      select: { id: true, title: true, updatedAt: true },
    });

    return Response.json({ session: updated });
  } catch (error) {
    console.error("PATCH session error:", error);
    return Response.json({ error: "Failed to rename session" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;

    const user = await verifyOwnership(clerkUserId, sessionId);
    if (!user) return Response.json({ error: "Session not found" }, { status: 404 });

    await db.chatSession.delete({ where: { id: sessionId } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE session error:", error);
    return Response.json({ error: "Failed to delete session" }, { status: 500 });
  }
}