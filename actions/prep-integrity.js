"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";

const EVENT_TYPES = [
  "tab-hidden",
  "window-blur",
  "copy-blocked",
  "paste-blocked",
  "context-menu-blocked",
  "fullscreen-exited",
  "camera-track-muted",
  "camera-track-unmuted",
  "camera-track-ended",
  "microphone-track-muted",
  "microphone-track-unmuted",
  "microphone-track-ended",
];
const integrityEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  metadata: z.object({ questionId: z.string().max(100).optional() }).strict(),
});

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
  const parsed = integrityEventSchema.safeParse({ type, metadata });
  if (!parsed.success) throw new Error("The assessment integrity event is invalid.");
  if (profile.assessmentLockedUntil && profile.assessmentLockedUntil > new Date()) {
    throw new Error("The assessment is locked until the displayed cooldown expires.");
  }
  await db.prepAssessmentIntegrityEvent.create({
    data: { profileId: profile.id, type: parsed.data.type, metadata: JSON.stringify(parsed.data.metadata) },
  });
  return { recorded: true };
}

export async function lockAssessment() {
  const profile = await requirePrepStudentProfile();
  return db.$transaction(async (transaction) => {
    const current = await transaction.prepStudentProfile.findUniqueOrThrow({
      where: { id: profile.id },
      select: { malpracticeAttempts: true, assessmentLockedUntil: true },
    });
    const now = new Date();
    if (current.assessmentLockedUntil && current.assessmentLockedUntil > now) {
      return {
        lockedUntil: current.assessmentLockedUntil,
        attemptNumber: current.malpracticeAttempts,
        waitMinutes: Math.ceil((current.assessmentLockedUntil.getTime() - now.getTime()) / 60000),
      };
    }

    const updated = await transaction.prepStudentProfile.update({
      where: { id: profile.id },
      data: { malpracticeAttempts: { increment: 1 } },
      select: { malpracticeAttempts: true },
    });
    const attemptNumber = updated.malpracticeAttempts;
    const candidateLockUntil = new Date(now.getTime() + attemptNumber * 5 * 60 * 1000);
    const lockedUntil = current.assessmentLockedUntil && current.assessmentLockedUntil > candidateLockUntil
      ? current.assessmentLockedUntil
      : candidateLockUntil;
    await transaction.prepStudentProfile.update({
      where: { id: profile.id },
      data: { assessmentLockedUntil: lockedUntil },
    });

    return { lockedUntil, attemptNumber, waitMinutes: attemptNumber * 5 };
  });
}
