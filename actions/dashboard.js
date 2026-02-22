"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export const generateAIInsights = async (industry) => {
  if (!industry) {
    throw new Error("Industry is required to generate insights.");
  }

  const prompt = `
    Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
      ],
      "growthRate": number,
      "demandLevel": "HIGH" | "MEDIUM" | "LOW",
      "topSkills": ["skill1", "skill2"],
      "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "keyTrends": ["trend1", "trend2"],
      "recommendedSkills": ["skill1", "skill2"]
    }

    IMPORTANT: Return ONLY the JSON.
    Include at least 5 roles.
    Include at least 5 skills and trends.
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  return JSON.parse(cleanedText);
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
