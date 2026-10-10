"use server";

import { db } from "@/lib/prisma";
import { getPrepClerkIdentity, getCurrentPrepStudentProfile } from "@/lib/prep-student-profile";
import { buildPrepProfileData, prepProfileInputSchema } from "@/lib/prep-profile-input";

export async function saveProfile(input) {
  const identity = await getPrepClerkIdentity();
  if (!identity) throw new Error("Sign in with Nexora before saving your profile.");

  const parsed = prepProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Check the profile fields and make sure they are within the allowed length.");
  }
  const values = parsed.data;
  if (values.email?.trim() && values.email.trim().toLowerCase() !== identity.email) {
    throw new Error("Your profile email must match your Nexora login email.");
  }

  const linkedProfile = await db.prepStudentProfile.findUnique({
    where: { clerkUserId: identity.clerkUserId },
  });
  const emailProfile = linkedProfile
    ? null
    : await db.prepStudentProfile.findUnique({ where: { email: identity.email } });
  if (emailProfile?.clerkUserId && emailProfile.clerkUserId !== identity.clerkUserId) {
    throw new Error("This email is already registered to another Nexora account.");
  }

  const existingProfile = linkedProfile || emailProfile;
  const profileData = buildPrepProfileData(values, existingProfile, identity);

  try {
    if (existingProfile) {
      return await db.prepStudentProfile.update({
        where: { id: existingProfile.id, clerkUserId: identity.clerkUserId },
        data: profileData,
      });
    }
    return await db.prepStudentProfile.create({ data: profileData });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new Error("This email is already registered to another Nexora account.");
    }
    throw error;
  }
}

export async function getCurrentProfile() {
  return getCurrentPrepStudentProfile({
      assessments: { orderBy: { completedAt: "desc" }, take: 5 },
      readiness: true,
      preparationPlans: {
        orderBy: [{ createdAt: "desc" }, { weekNumber: "desc" }],
        take: 12,
        include: { tasks: true },
      },
  });
}
