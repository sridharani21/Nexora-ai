// app/api/roadmap/save/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { career, months, roadmap } = await req.json();
    if (!career || !roadmap) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the DB user by clerkUserId
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const saved = await db.roadmap.create({
      data: {
        userId: user.id,
        career,
        months,
        data:  roadmap,
        title: `${career} — ${months} Month${months > 1 ? "s" : ""} Plan`,
      },
    });

    return NextResponse.json({ roadmap: saved });
  } catch (err) {
    console.error("Save roadmap error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}