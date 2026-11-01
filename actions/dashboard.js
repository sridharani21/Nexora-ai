"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateStructuredOutput } from "@/lib/ai/ai-provider.js";

const industryInsightsSchema = z.object({
  salaryRanges: z.array(z.object({
    role: z.string().trim().min(1),
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    median: z.number().nonnegative(),
    currency: z.literal("INR"),
    location: z.string().trim().min(1),
  }).strict()).min(5),
  growthRate: z.number(),
  demandLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  topSkills: z.array(z.string().trim().min(1)).min(5),
  marketOutlook: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  keyTrends: z.array(z.string().trim().min(1)).min(5),
  recommendedSkills: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const generateAIInsights = async (industry) => {
  if (!industry) {
    throw new Error("Industry is required to generate insights.");
  }

  const prompt = `
    Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "currency": "INR", "location": "string" }
      ],
      "growthRate": number,
      "demandLevel": "HIGH" | "MEDIUM" | "LOW",
      "topSkills": ["skill1", "skill2"],
      "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "keyTrends": ["trend1", "trend2"],
      "recommendedSkills": ["skill1", "skill2"]
    }

    IMPORTANT: Return ONLY the JSON.
    Provide India-based annual salary ranges in INR (Indian rupees), and include "currency": "INR" for each range. Never return USD.
    Include at least 5 roles.
    Include at least 5 skills and trends.
  `;

  return generateStructuredOutput(prompt, {
    operation: "industry-insights",
    deduplicate: true,
    validateOutput: (output) => {
      const parsed = industryInsightsSchema.safeParse(output);
      return parsed.success ? parsed.data : false;
    },
  });
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // 🚨 CRITICAL FIX: Industry must exist
  if (!user.industry) {
    redirect("/onboarding"); // change route if needed
  }

  // If insight already exists, return it
  if (user.industryInsight) {
    return user.industryInsight;
  }

  // Generate new insights
  const insights = await generateAIInsights(user.industry);

  const industryInsight = await db.industryInsight.create({
    data: {
      industry: user.industry,
      salaryRanges: insights.salaryRanges,
      growthRate: insights.growthRate,
      demandLevel: insights.demandLevel,
      topSkills: insights.topSkills,
      marketOutlook: insights.marketOutlook,
      keyTrends: insights.keyTrends,
      recommendedSkills: insights.recommendedSkills,
      nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  return industryInsight;
}
