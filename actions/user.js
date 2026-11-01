"use server";

import { after } from "next/server";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateAIInsights } from "./dashboard";

async function generateAndAttachIndustryInsights(userId, industry) {
  try {
    let industryInsight = await db.industryInsight.findUnique({
      where: { industry },
    });

    if (!industryInsight) {
      const insights = await generateAIInsights(industry);
      industryInsight = await db.industryInsight.upsert({
        where: { industry },
        update: {},
        create: {
          industry,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await db.user.update({
      where: { id: userId },
      data: { industry },
    });
  } catch (error) {
    console.error("Onboarding industry insight generation failed:", error?.name || "unknown error");
  }
}

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
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        experience: data.experience,
        bio: data.bio,
        skills: data.skills,
      },
    });

    after(() => generateAndAttachIndustryInsights(user.id, data.industry));
    return { success: true, updatedUser };
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
