"use server";

import { db } from "@/lib/prisma";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

export async function getAssessmentAccess() {
  const profile = await requirePrepStudentProfile();
  const now = new Date();
  return {
    allowed: !profile.assessmentLockedUntil || profile.assessmentLockedUntil <= now,
    lockedUntil: profile.assessmentLockedUntil,
    malpracticeAttempts: profile.malpracticeAttempts,
  };
}

export async function recordIntegrityEvent(type, metadata = {}) {
  const profile = await requirePrepStudentProfile();
  await db.prepAssessmentIntegrityEvent.create({
    data: { profileId: profile.id, type, metadata: JSON.stringify(metadata) },
  });
  return { recorded: true };
}

export async function lockAssessment() {
  const profile = await requirePrepStudentProfile();
  const attemptNumber = profile.malpracticeAttempts + 1;
  const lockedUntil = new Date(Date.now() + attemptNumber * 5 * 60 * 1000);
  await db.prepStudentProfile.update({
    where: { id: profile.id },
    data: { malpracticeAttempts: attemptNumber, assessmentLockedUntil: lockedUntil },
  });
  return { lockedUntil, attemptNumber, waitMinutes: attemptNumber * 5 };
}
