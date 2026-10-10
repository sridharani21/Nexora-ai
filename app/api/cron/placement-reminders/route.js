import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { db } from "@/lib/prisma";
import { decryptWebPushSubscription } from "@/lib/web-push-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINAL_APPLICATION_STATUSES = ["OFFER", "REJECTED", "WITHDRAWN"];

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "Scheduled reminders are not configured." }, { status: 503 });
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY || !process.env.WEB_PUSH_CONTACT) {
    return Response.json({ error: "Web Push VAPID configuration is incomplete." }, { status: 503 });
  }

  webpush.setVapidDetails(
    process.env.WEB_PUSH_CONTACT,
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  );

  const now = new Date();
  const preferences = await db.prepEngagementPreference.findMany({
    where: {
      inAppReminders: true,
      reminderFrequency: { in: ["DAILY", "WEEKLY"] },
      profile: { is: { pushSubscriptions: { some: {} } } },
    },
    orderBy: { updatedAt: "asc" },
    take: 500,
    include: {
      profile: {
        include: {
          pushSubscriptions: { select: { id: true, encryptedSubscription: true, encryptionIv: true } },
          preparationPlans: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { tasks: { where: { status: { not: "COMPLETED" } }, orderBy: { dueDate: "asc" }, take: 30, select: { dueDate: true } } },
          },
          learningRoadmaps: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { steps: { where: { status: { not: "COMPLETED" } }, orderBy: { dueDate: "asc" }, take: 30, select: { dueDate: true } } },
          },
          jobApplications: {
            where: { status: { notIn: FINAL_APPLICATION_STATUSES }, deadline: { not: null } },
            orderBy: { deadline: "asc" },
            take: 30,
            select: { deadline: true },
          },
        },
      },
    },
  });

  let sentNotifications = 0;
  let sentProfiles = 0;
  let expiredSubscriptions = 0;
  let skippedProfiles = 0;
  let failedNotifications = 0;
  const failures = [];

  for (const preference of preferences) {
    const cadenceMs = preference.reminderFrequency === "WEEKLY" ? 7 * 86400000 : 86400000;
    if (preference.lastReminderSentAt && now.getTime() - preference.lastReminderSentAt.getTime() < cadenceMs) {
      skippedProfiles += 1;
      continue;
    }
    const horizon = now.getTime() + cadenceMs;
    const isRelevant = (date) => !date || date.getTime() <= horizon;
    const openTasks = preference.profile.preparationPlans.flatMap((plan) => plan.tasks).filter((task) => isRelevant(task.dueDate)).length;
    const openRoadmapSteps = preference.profile.learningRoadmaps.flatMap((roadmap) => roadmap.steps).filter((step) => isRelevant(step.dueDate)).length;
    const upcomingDeadlines = preference.profile.jobApplications.filter((application) => isRelevant(application.deadline)).length;
    const actionCount = openTasks + openRoadmapSteps + upcomingDeadlines;
    if (!actionCount) {
      skippedProfiles += 1;
      continue;
    }

    let profileSent = 0;
    for (const subscriptionRecord of preference.profile.pushSubscriptions) {
      const subscription = decryptWebPushSubscription(subscriptionRecord.encryptedSubscription, subscriptionRecord.encryptionIv);
      try {
        await webpush.sendNotification(subscription, JSON.stringify({
          title: "Nexora placement reminder",
          body: `You have ${actionCount} saved placement preparation action${actionCount === 1 ? "" : "s"} to review.`,
          url: "/placement-prep/journey",
        }), { TTL: 3600, urgency: "normal" });
        profileSent += 1;
        sentNotifications += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.prepWebPushSubscription.deleteMany({ where: { id: subscriptionRecord.id, profileId: preference.profileId } });
          expiredSubscriptions += 1;
        } else {
          failedNotifications += 1;
          if (failures.length < 100) failures.push({ subscriptionId: subscriptionRecord.id, statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null });
        }
      }
    }
    if (profileSent) {
      await db.prepEngagementPreference.update({
        where: { id: preference.id },
        data: { lastReminderSentAt: now },
      });
      sentProfiles += 1;
    }
  }

  const result = { checkedProfiles: preferences.length, sentProfiles, sentNotifications, expiredSubscriptions, skippedProfiles, failedNotifications, failures };
  return Response.json(result, { status: failedNotifications ? 502 : 200 });
}
