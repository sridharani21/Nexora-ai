"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateAIInsights } from "./dashboard";

/* ===============================
   UPDATE USER
================================ */
export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // 1️⃣ Check if industry insight already exists
    let industryInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    // 2️⃣ If not, generate AI insights (OUTSIDE transaction)
    if (!industryInsight) {
      const insights = await generateAIInsights(data.industry);

      industryInsight = await db.industryInsight.create({
        data: {
          industry: data.industry,
          ...insights,
          nextUpdate: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ), // 7 days
        },
      });
    }

    // 3️⃣ Update user (fast DB operation)
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        industry: data.industry,
        experience: data.experience,
        bio: data.bio,
        skills: data.skills,
      },
    });

    return {
      success: true,
      updatedUser,
      industryInsight,
    };

  } catch (error) {
    console.error("Error updating user and industry:", error);
    throw new Error("Failed to update user profile. Please try again.");
  }
}


/* ===============================
   CHECK ONBOARDING STATUS
================================ */
export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { industry: true },
    });

    if (!user) throw new Error("User not found");

    return {
      isOnboarded: !!user.industry,
    };

  } catch (error) {
    console.error("Error checking onboarding status:", error);
    throw new Error("Failed to check onboarding status.");
  }
}
