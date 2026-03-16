import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/prisma";

// Helper to find DB user from Clerk userId
async function getDbUser(clerkUserId) {
  // Tries common field names used for Clerk ID
  let user = null;

  try {
    user = await db.user.findUnique({
      where: { clerkUserId: clerkUserId },
    });
  } catch {}

  if (!user) {
    try {
      user = await db.user.findUnique({
        where: { clerkId: clerkUserId },
      });
    } catch {}
  }

  if (!user) {
    try {
      user = await db.user.findFirst({
        where: { id: clerkUserId },
      });
    } catch {}
  }

  return user;
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("resume");
    const domain = formData.get("domain");

    if (!file || !domain) {
      return NextResponse.json(
        { error: "Resume and domain are required" },
        { status: 400 }
      );
    }

    // Find DB user
    const dbUser = await getDbUser(userId);
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found. Please sign out and sign in again." },
        { status: 404 }
      );
    }

    // Parse PDF to text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const PDFParser = (await import("pdf2json")).default;

    const resumeText = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (err) =>
        reject(new Error(err.parserError))
      );
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(buffer);
    });

    if (!resumeText || resumeText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. Please try another file." },
        { status: 400 }
      );
    }

    // Trigger Inngest background job with DB user id
    await inngest.send({
      name: "courses/analyze",
      data: {
        userId: dbUser.id, // ← real DB id
        resumeText,
        domain,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Analysis started. Please wait...",
    });
  } catch (error) {
    console.error("Course recommendation error:", error);
    return NextResponse.json(
      { error: "Something went wrong: " + error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find DB user
    const dbUser = await getDbUser(userId);
    if (!dbUser) {
      return NextResponse.json({ recommendations: [] });
    }

    const recommendations = await db.courseRecommendation.findMany({
      where: { userId: dbUser.id }, // ← real DB id
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Fetch recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}