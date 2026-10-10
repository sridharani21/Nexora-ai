import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function getPrepClerkIdentity() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const verifiedAddresses = user?.emailAddresses?.filter(
    (address) => address.verification?.status === "verified",
  ) || [];
  const email =
    verifiedAddresses.find((address) => address.id === user?.primaryEmailAddressId)?.emailAddress ||
    verifiedAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("Add and verify an email address in your Nexora account before continuing.");
  }

  return {
    clerkUserId: userId,
    email: email.trim().toLowerCase(),
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
  };
}

export async function getCurrentPrepStudentProfile(include) {
  const identity = await getPrepClerkIdentity();
  if (!identity) return null;

  const profile = await db.prepStudentProfile.findUnique({
    where: { clerkUserId: identity.clerkUserId },
    ...(include ? { include } : {}),
  });
  if (profile) return profile;

  const emailProfile = await db.prepStudentProfile.findUnique({
    where: { email: identity.email },
  });
  if (!emailProfile) return null;
  if (emailProfile.clerkUserId !== identity.clerkUserId) {
    throw new Error("This email is already linked to another Nexora account.");
  }

  return db.prepStudentProfile.update({
    where: { id: emailProfile.id },
    data: { clerkUserId: identity.clerkUserId },
    ...(include ? { include } : {}),
  });
}

export async function requirePrepStudentProfile(include) {
  const identity = await getPrepClerkIdentity();
  if (!identity) throw new Error("Sign in with Nexora before continuing.");

  const profile = await getCurrentPrepStudentProfile(include);
  if (!profile) throw new Error("Complete your student profile before continuing.");
  return profile;
}
