import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function getAuthenticatedStudent() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const verifiedEmail = clerkUser?.emailAddresses?.find(
    (address) => address.verification?.status === "verified"
  )?.emailAddress;
  if (!verifiedEmail) throw new Error("Your account needs a verified email address.");

  let student = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { profile: true },
  });
  if (student) return { ...student, email: verifiedEmail };

  student = await db.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email: verifiedEmail,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
    include: { profile: true },
  });
  return student;
}
