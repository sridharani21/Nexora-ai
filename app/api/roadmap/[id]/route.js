// app/api/roadmap/[id]/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(_req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const roadmap = await db.roadmap.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!roadmap) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ roadmap });
  } catch (err) {
    console.error("Get roadmap error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.roadmap.deleteMany({
      where: { id: params.id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete roadmap error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}