"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const maximumGraduationYear = new Date().getFullYear() + 10;

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(30).optional(),
  educationLevel: z.string().trim().max(100).optional(),
  institution: z.string().trim().max(200).optional(),
  degree: z.string().trim().max(150).optional(),
  graduationYear: z.number().int().min(1950).max(maximumGraduationYear).nullable().optional(),
  cgpa: z.string().trim().max(30).optional(),
  academicDetails: z.string().trim().max(5000).optional(),
  skills: z.array(z.string().trim().min(1)).max(100),
  programmingLanguages: z.array(z.string().trim().min(1)).max(100),
  projects: z.array(z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().max(2000).optional(),
    technologies: z.array(z.string().trim().min(1)).max(50),
    link: z.string().trim().url().optional().or(z.literal("")),
  })).max(50),
  certifications: z.array(z.object({
    name: z.string().trim().min(1),
    issuer: z.string().trim().max(200).optional(),
    issueDate: z.string().trim().max(50).optional(),
    credentialUrl: z.string().trim().url().optional().or(z.literal("")),
  })).max(50),
  resumeUrl: z.string().trim().url().optional().or(z.literal("")),
  resumeText: z.string().trim().max(100000).optional(),
  careerInterests: z.array(z.string().trim().min(1)).max(50),
  preferredRole: z.string().trim().max(150).optional(),
  targetCompany: z.string().trim().max(200).optional(),
  companyType: z.string().trim().max(100).optional(),
  preferredLocations: z.array(z.string().trim().min(1)).max(50),
});

function cleanList(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function getPlacementProfile() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      email: true,
      name: true,
      placementJourney: {
        include: {
          profile: true,
          assessmentAttempts: {
            select: { id: true },
            take: 1,
            orderBy: { completedAt: "desc" },
          },
          careerTwin: true,
        },
      },
    },
  });

  if (!user) throw new Error("User not found");

  return {
    journey: user.placementJourney,
    defaults: {
      fullName: user.name ?? "",
      email: user.email,
    },
  };
}

export async function savePlacementProfile(input) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const profile = profileSchema.parse({
    ...input,
    skills: cleanList(input.skills ?? []),
    programmingLanguages: cleanList(input.programmingLanguages ?? []),
    careerInterests: cleanList(input.careerInterests ?? []),
    preferredLocations: cleanList(input.preferredLocations ?? []),
  });

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("User not found");
  const loginEmail = user.email.trim().toLowerCase();
  if (profile.email.toLowerCase() !== loginEmail) {
    throw new Error("Use the email address associated with your Nexora login.");
  }
  const normalizedProfile = { ...profile, email: loginEmail };

  const journey = await db.placementJourney.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
  const existingEmailProfile = await db.studentProfile.findFirst({
    where: {
      email: loginEmail,
      journeyId: { not: journey.id },
    },
    select: { id: true },
  });
  if (existingEmailProfile) {
    throw new Error("This email is already registered to another placement profile. Sign in with the matching Nexora account.");
  }

  const savedProfile = await db.studentProfile.upsert({
    where: { journeyId: journey.id },
    create: {
      journeyId: journey.id,
      ...normalizedProfile,
      profileCompleted: true,
    },
    update: {
      ...normalizedProfile,
      profileCompleted: true,
    },
  });

  await db.careerTwin.upsert({
    where: { journeyId: journey.id },
    create: {
      journeyId: journey.id,
      currentSkills: [...normalizedProfile.skills, ...normalizedProfile.programmingLanguages],
      skillScores: {},
      interests: normalizedProfile.careerInterests,
      strengths: [],
      weaknesses: [],
      recommendedRoles: normalizedProfile.preferredRole ? [normalizedProfile.preferredRole] : [],
      alternativeRoles: [],
      evidence: {
        initializedFrom: "student-profile",
        targetCompany: normalizedProfile.targetCompany || null,
      },
    },
    update: {
      currentSkills: [...normalizedProfile.skills, ...normalizedProfile.programmingLanguages],
      interests: normalizedProfile.careerInterests,
      evidence: {
        initializedFrom: "student-profile",
        targetCompany: normalizedProfile.targetCompany || null,
      },
    },
  });

  const savedJourney = await db.placementJourney.update({
    where: { id: journey.id },
    data: {
      status: "active",
      currentModule: Math.max(journey.currentModule, 1),
    },
    include: { profile: true },
  });

  return { success: true, journey: savedJourney, profile: savedProfile };
}
