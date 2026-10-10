"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function savePlacementAssessment({
  score,
  answers,
  interests,
  categoryScores,
  strengths,
  improvementAreas,
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  if (!user) throw new Error("User not found");

  const result = await db.assessment.create({
    data: {
      userId: user.id,
      quizScore: score,
      category: "Placement diagnostic",
      questions: [
        ...answers,
        {
          question: "Selected interest areas",
          category: "Career interests",
          userAnswer: interests,
          isCorrect: true,
        },
        {
          question: "Placement readiness profile",
          category: "Assessment summary",
          score,
          categoryScores,
          strengths,
          improvementAreas,
        },
      ],
      improvementTip:
        score >= 70
          ? "Keep building role-specific projects and practise interviews."
          : "Strengthen the highlighted fundamentals before moving to advanced preparation.",
    },
    select: { id: true, quizScore: true, createdAt: true },
  });

  return { ...result, interests };
}
