"use server";

import { db } from "@/lib/prisma";
import { getPrepClerkIdentity, getCurrentPrepStudentProfile } from "@/lib/prep-student-profile";

export async function saveProfile(input) {
  const identity = await getPrepClerkIdentity();
  if (!identity) throw new Error("Sign in with Nexora before saving your profile.");
  if (!input?.fullName?.trim()) {
    throw new Error("Full name is required.");
  }
  if (input.email?.trim() && input.email.trim().toLowerCase() !== identity.email) {
    throw new Error("Your profile email must match your Nexora login email.");
  }
  const profileData = {
    fullName: input.fullName.trim(),
    clerkUserId: identity.clerkUserId,
    email: identity.email,
    education: input.education?.trim() || null,
    skills: input.skills?.trim() || "",
    languages: input.languages?.trim() || "",
    interests: input.interests?.trim() || "",
    preferredRole: input.preferredRole?.trim() || null,
    targetCompany: input.targetCompany?.trim() || null,
    location: input.location?.trim() || null,
  };
  const linkedProfile = await db.prepStudentProfile.findUnique({
    where: { clerkUserId: identity.clerkUserId },
  });
  if (linkedProfile) {
    return db.prepStudentProfile.update({
      where: { id: linkedProfile.id },
      data: profileData,
    });
  }

  const emailProfile = await db.prepStudentProfile.findUnique({ where: { email: identity.email } });
  if (emailProfile?.clerkUserId && emailProfile.clerkUserId !== identity.clerkUserId) {
    throw new Error("This email is already registered to another Nexora account.");
  }
  if (emailProfile) {
    return db.prepStudentProfile.update({
      where: { id: emailProfile.id },
      data: profileData,
    });
  }

  try {
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
