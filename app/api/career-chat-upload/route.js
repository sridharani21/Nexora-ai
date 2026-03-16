import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { extractText, getDocumentProxy } from "unpdf";

export async function POST(req) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const formData  = await req.formData();
    const file      = formData.get("file");
    const sessionId = formData.get("sessionId");

    if (!file)      return Response.json({ error: "No file provided" },      { status: 400 });
    if (!sessionId) return Response.json({ error: "No sessionId provided" }, { status: 400 });

    const session = await db.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

    const fileName    = file.name?.toLowerCase() || "";
    const arrayBuffer = await file.arrayBuffer();

    let resumeText = "";

    if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      resumeText = Buffer.from(arrayBuffer).toString("utf-8");

    } else if (fileName.endsWith(".pdf")) {
      try {
        const buffer = new Uint8Array(arrayBuffer);
        const pdf    = await getDocumentProxy(buffer);

        // unpdf extractText returns { text: string[], totalPages: number }
        // NOT a plain string — this was the root cause of the error
        const result = await extractText(pdf, { mergePages: true });

        // Safely extract the string from whatever shape unpdf returns
        if (typeof result === "string") {
          resumeText = result;
        } else if (result && typeof result === "object") {
          if (typeof result.text === "string") {
            // shape: { text: "...", totalPages: N }
            resumeText = result.text;
          } else if (Array.isArray(result.text)) {
            // shape: { text: ["page1", "page2"], totalPages: N }
            resumeText = result.text.join("\n");
          } else if (Array.isArray(result)) {
            // shape: ["page1", "page2"]
            resumeText = result.join("\n");
          } else {
            // Last resort — stringify and clean up
            resumeText = JSON.stringify(result);
          }
        }

        // Ensure it's always a string before calling .trim()
        resumeText = String(resumeText || "").trim();

        if (resumeText.length < 30) {
          return Response.json(
            {
              error:
                "This PDF appears to be image-based or scanned. " +
                "Please copy your resume text and paste it into the chat, " +
                "or save it as a .txt file and upload that.",
            },
            { status: 422 }
          );
        }

      } catch (pdfError) {
        console.error("PDF extract error:", pdfError);
        return Response.json(
          {
            error:
              "Could not read this PDF. Please save your resume as a .txt file and upload that instead.",
          },
          { status: 422 }
        );
      }

    } else {
      return Response.json(
        { error: "Unsupported file type. Please upload a PDF or TXT file." },
        { status: 415 }
      );
    }

    // Final safety — always a string, trimmed, max 8000 chars
    const trimmedText = String(resumeText).slice(0, 8000).trim();

    if (!trimmedText) {
      return Response.json(
        { error: "Could not extract any text. Please paste your resume text directly into the chat." },
        { status: 422 }
      );
    }

    await db.chatSession.update({
      where: { id: sessionId },
      data:  { resumeText: trimmedText },
    });

    return Response.json({
      success:   true,
      preview:   trimmedText.slice(0, 200) + "...",
      charCount: trimmedText.length,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}