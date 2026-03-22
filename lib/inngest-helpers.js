// ==================================================================
// File: lib/inngest-helpers.js
// Description: Helper functions to trigger Inngest events
// ==================================================================

import { inngest } from "@/lib/inngest/client";

/**
 * Trigger background ATS analysis
 */
export async function triggerResumeAnalysis(resumeId, userId, jobDescription = null) {
  return await inngest.send({
    name: "resume/analyze.requested",
    data: {
      resumeId,
      userId,
      jobDescription,
    },
  });
}

/**
 * Trigger resume update event (will auto-analyze after 5s)
 */
export async function triggerResumeUpdate(resumeId, userId) {
  return await inngest.send({
    name: "resume/updated",
    data: {
      resumeId,
      userId,
    },
  });
}

/**
 * Trigger content improvement
 */
export async function triggerContentImprovement(resumeId, userId, section, improvements) {
  return await inngest.send({
    name: "resume/improve.requested",
    data: {
      resumeId,
      userId,
      section,
      improvements,
    },
  });
}

/**
 * Generate resume from course recommendations
 */
export async function triggerResumeFromCourses(userId, courseRecommendationId) {
  return await inngest.send({
    name: "resume/generate-from-courses",
    data: {
      userId,
      courseRecommendationId,
    },
  });
}

/**
 * Batch analyze multiple resumes
 */
export async function triggerBatchAnalysis(userId, resumeIds) {
  return await inngest.send({
    name: "resume/batch-analyze",
    data: {
      userId,
      resumeIds,
    },
  });
}

/**
 * Trigger course analysis (existing function)
 */
export async function triggerCourseAnalysis(userId, resumeText, domain) {
  return await inngest.send({
    name: "courses/analyze",
    data: {
      userId,
      resumeText,
      domain,
    },
  });
}