"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { studentProfileSchema } from "@/lib/student-profile";
import { getAuthenticatedStudent } from "@/lib/student-profile-server";

const profileSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  profile: studentProfileSchema,
}).strict();

export async function saveStudentProfile(input) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Sign in to save your profile." };

  const parsed = profileSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Review the profile details and try again.",
    };
  }

  try {
    const student = await getAuthenticatedStudent();
    if (!student) return { success: false, error: "Sign in to save your profile." };

    const { name, profile } = parsed.data;
    const uniqueSkills = [...new Map(
      profile.skills
        .filter((skill) => skill.name)
        .map((skill) => [skill.name.toLocaleLowerCase(), skill.name])
    ).values()];
    const interests = [...new Set([
      ...profile.preferences.roles,
      ...profile.preferences.domains,
    ])];

    await db.$transaction([
      db.user.update({
        where: { id: student.id },
        data: {
          name,
          bio: profile.summary || null,
          skills: uniqueSkills,
        },
      }),
      db.userProfile.upsert({
        where: { userId: student.id },
        create: {
          userId: student.id,
          skills: uniqueSkills,
          interests,
          education: profile.academic.institution || null,
          targetRole: profile.preferences.roles[0] || null,
          profileData: profile,
        },
        update: {
          skills: uniqueSkills,
          interests,
          education: profile.academic.institution || null,
          targetRole: profile.preferences.roles[0] || null,
          profileData: profile,
        },
      }),
    ]);

    return { success: true };
  } catch {
    return {
      success: false,
      error: "We couldn't save your profile right now. Please try again.",
    };
  }
}
