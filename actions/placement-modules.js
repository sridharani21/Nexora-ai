"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { encryptWebPushSubscription, hashWebPushEndpoint } from "@/lib/web-push-crypto";
import { requirePrepStudentProfile } from "@/lib/prep-student-profile";
import { INTERVIEW_ROLES } from "@/data/prep-interview";

const APPLICATION_STATUSES = ["SAVED", "PLANNING_TO_APPLY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const ELIGIBILITY_STATUSES = ["NEEDS_REVIEW", "MEETS", "DOES_NOT_MEET"];
const INTEGRITY_REVIEW_STATUSES = ["CLEARED", "FOLLOW_UP_REQUIRED"];
const CAREER_RESOURCES = {
  aptitude: { title: "Khan Academy: Math", url: "https://www.khanacademy.org/math" },
  programming: { title: "MDN: JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
  dsa: { title: "VisuAlgo: Data Structures and Algorithms", url: "https://visualgo.net/en" },
  technical: { title: "SQLBolt: Learn SQL", url: "https://sqlbolt.com/" },
  communication: { title: "Purdue OWL: Professional Writing", url: "https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/" },
  projects: { title: "GitHub Skills", url: "https://skills.github.com/" },
  interview: { title: "Nexora AI Interview practice", url: "/placement-prep/interview" },
};

function parseJsonList(value, label) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Saved ${label} data is invalid. Please contact support.`);
  }
  if (!Array.isArray(parsed)) throw new Error(`Saved ${label} data is invalid. Please contact support.`);
  return parsed;
}

function normalizedSkill(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function matchJobSkills(profileSkills, requiredSkills) {
  const matchedSkills = [];
  const missingSkills = [];
  for (const required of requiredSkills) {
    const normalizedRequired = normalizedSkill(required);
    const isMatched = profileSkills.some((skill) => {
      const normalizedProfileSkill = normalizedSkill(skill);
      return normalizedProfileSkill === normalizedRequired ||
        normalizedProfileSkill.split(" ").includes(normalizedRequired) ||
        normalizedRequired.split(" ").includes(normalizedProfileSkill);
    });
    (isMatched ? matchedSkills : missingSkills).push(required);
  }
  const score = requiredSkills.length ? Math.round((matchedSkills.length / requiredSkills.length) * 100) : null;
  return { matchedSkills, missingSkills, score };
}

function safeDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

function parseEligibilityChecklist(value, legacyCriteria = "") {
  let items;
  try {
    items = JSON.parse(value || "[]");
  } catch {
    throw new Error("Saved eligibility checklist data is invalid. Please contact support.");
  }
  if (!Array.isArray(items)) throw new Error("Saved eligibility checklist data is invalid. Please contact support.");
  const checklist = items.map((item) => {
    if (!item || typeof item.criterion !== "string" || !ELIGIBILITY_STATUSES.includes(item.status)) {
      throw new Error("Saved eligibility checklist data is invalid. Please contact support.");
    }
    return { criterion: item.criterion, status: item.status };
  });
  if (checklist.length) return checklist;
  return legacyCriteria.split(/\r?\n/).map((criterion) => criterion.trim()).filter(Boolean).slice(0, 12).map((criterion) => ({ criterion, status: "NEEDS_REVIEW" }));
}

async function requirePlacementOfficer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in with an authorized placement-officer account.");
  const configuredEmails = (process.env.PLACEMENT_OFFICER_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!configuredEmails.length) throw new Error("Placement-officer access is not configured. Set PLACEMENT_OFFICER_EMAILS to a comma-separated allowlist of verified staff emails.");
  const user = await currentUser();
  const email = user?.emailAddresses.find((address) => address.verification?.status === "verified")?.emailAddress?.trim().toLowerCase();
  if (!email || !configuredEmails.includes(email)) throw new Error("This account is not authorized to access placement-officer reviews.");
  return { clerkUserId: userId, email };
}

export async function getPlacementOfficerReviewQueue() {
  await requirePlacementOfficer();
  const [assessments, interviews] = await Promise.all([
    db.prepAssessmentAttempt.findMany({
      where: { reviewRequired: true },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: { id: true, profileId: true, overallScore: true, integrityScore: true, integrityEvents: true, completedAt: true, profile: { select: { fullName: true } } },
    }),
    db.prepInterviewSession.findMany({
      where: { reviewRequired: true },
      orderBy: { startedAt: "desc" },
      take: 100,
      select: { id: true, profileId: true, role: true, companyName: true, startedAt: true, completedAt: true, events: { orderBy: { createdAt: "desc" }, take: 50, select: { eventType: true, source: true, details: true, createdAt: true } }, profile: { select: { fullName: true } } },
    }),
  ]);
  const reviewFilters = [
    ...(assessments.length ? [{ recordType: "ASSESSMENT", recordId: { in: assessments.map((item) => item.id) } }] : []),
    ...(interviews.length ? [{ recordType: "INTERVIEW", recordId: { in: interviews.map((item) => item.id) } }] : []),
  ];
  const reviews = reviewFilters.length
    ? await db.prepIntegrityReview.findMany({ where: { OR: reviewFilters }, orderBy: { createdAt: "desc" }, select: { recordType: true, recordId: true, status: true, decisionNote: true, reviewerEmail: true, createdAt: true } })
    : [];
  const latestReview = new Map();
  for (const review of reviews) {
    const key = `${review.recordType}:${review.recordId}`;
    if (!latestReview.has(key)) latestReview.set(key, review);
  }
  return {
    assessments: assessments.map((attempt) => ({
      ...attempt,
      integrityEvents: parseJsonList(attempt.integrityEvents, "assessment integrity event").map((event) => ({
        type: event && typeof event === "object" && typeof event.type === "string" ? event.type.slice(0, 100) : "Recorded event",
        count: event && typeof event === "object" && Number.isInteger(event.count) && event.count > 0 ? event.count : null,
      })),
      review: latestReview.get(`ASSESSMENT:${attempt.id}`) || null,
    })),
    interviews: interviews.map((session) => ({ ...session, review: latestReview.get(`INTERVIEW:${session.id}`) || null })),
  };
}

export async function savePlacementIntegrityReview({ recordType, recordId, status, decisionNote }) {
  const reviewer = await requirePlacementOfficer();
  if (!["ASSESSMENT", "INTERVIEW"].includes(recordType) || typeof recordId !== "string" || !recordId || !INTEGRITY_REVIEW_STATUSES.includes(status)) {
    throw new Error("Choose a valid flagged record and review decision.");
  }
  if (typeof decisionNote !== "string" || decisionNote.trim().length < 3 || decisionNote.trim().length > 2000) {
    throw new Error("Add a review summary between 3 and 2,000 characters.");
  }
  const record = recordType === "ASSESSMENT"
    ? await db.prepAssessmentAttempt.findFirst({ where: { id: recordId, reviewRequired: true }, select: { id: true, profileId: true } })
    : await db.prepInterviewSession.findFirst({ where: { id: recordId, reviewRequired: true }, select: { id: true, profileId: true } });
  if (!record) throw new Error("Flagged record not found or is no longer awaiting review.");
  return db.prepIntegrityReview.create({
    data: {
      profileId: record.profileId,
      recordType,
      recordId: record.id,
      status,
      decisionNote: decisionNote.trim(),
      reviewerClerkId: reviewer.clerkUserId,
      reviewerEmail: reviewer.email,
    },
    select: { id: true, status: true, decisionNote: true, reviewerEmail: true, createdAt: true },
  });
}

export async function getIntegrityReport() {
  const profile = await requirePrepStudentProfile();
  const [assessmentEvents, interviewSessions, assessments, simulations] = await Promise.all([
    db.prepAssessmentIntegrityEvent.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, metadata: true, createdAt: true },
    }),
    db.prepInterviewSession.findMany({
      where: { profileId: profile.id },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: {
        id: true, role: true, companyName: true, status: true, reviewRequired: true, startedAt: true, completedAt: true, simulationId: true,
        events: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, eventType: true, source: true, details: true, createdAt: true } },
      },
    }),
    db.prepAssessmentAttempt.findMany({
      where: { profileId: profile.id },
      orderBy: { completedAt: "desc" },
      take: 30,
      select: { id: true, completedAt: true, reviewRequired: true, integrityScore: true },
    }),
    db.placementSimulation.findMany({
      where: { profileId: profile.id },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { id: true, role: true, companyName: true, status: true, startedAt: true, completedAt: true },
    }),
  ]);
  const reviewFilters = [
    ...assessments.map((attempt) => ({ recordType: "ASSESSMENT", recordId: attempt.id })),
    ...interviewSessions.map((session) => ({ recordType: "INTERVIEW", recordId: session.id })),
  ];
  const reviews = reviewFilters.length
    ? await db.prepIntegrityReview.findMany({ where: { profileId: profile.id, OR: reviewFilters }, orderBy: { createdAt: "desc" }, select: { recordType: true, recordId: true, status: true, decisionNote: true, createdAt: true } })
    : [];
  const latestReview = new Map();
  for (const review of reviews) {
    const key = `${review.recordType}:${review.recordId}`;
    if (!latestReview.has(key)) latestReview.set(key, review);
  }
  const events = [
    ...assessmentEvents.map((event) => ({
      id: `assessment-${event.id}`,
      type: event.type,
      source: "ASSESSMENT",
      details: parseSafeMetadata(event.metadata),
      createdAt: event.createdAt,
      sessionId: null,
      simulationId: null,
    })),
    ...interviewSessions.flatMap((session) => session.events.map((event) => ({
      id: `interview-${event.id}`,
      type: event.eventType,
      source: event.source,
      details: event.details.slice(0, 240),
      createdAt: event.createdAt,
      sessionId: session.id,
      simulationId: session.simulationId,
    }))),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 150);
  return {
    events,
    assessments: assessments.map(({ id, completedAt, reviewRequired, integrityScore }) => ({ id, completedAt, reviewRequired, integrityScore, review: latestReview.get(`ASSESSMENT:${id}`) || null })),
    interviews: interviewSessions.map(({ id, role, companyName, status, reviewRequired, startedAt, completedAt, simulationId, events: sessionEvents }) => ({
      id, role, companyName, status, reviewRequired, startedAt, completedAt, simulationId, eventCount: sessionEvents.length, review: latestReview.get(`INTERVIEW:${id}`) || null,
    })),
    simulations,
    counts: {
      eventCount: events.length,
      assessmentReviewFlags: assessments.filter((attempt) => attempt.reviewRequired).length,
      interviewReviewFlags: interviewSessions.filter((session) => session.reviewRequired).length,
    },
  };
}

function parseSafeMetadata(metadata) {
  try {
    const parsed = JSON.parse(metadata || "{}");
    return Object.entries(parsed)
      .filter(([key, value]) => ["questionId", "round"].includes(key) && typeof value === "string")
      .map(([key, value]) => `${key}: ${value.slice(0, 120)}`)
      .join(" · ");
  } catch {
    throw new Error("Saved assessment integrity metadata is invalid. Please contact support.");
  }
}

function assessmentSkillGaps(attempt) {
  const labels = {
    aptitude: ["Numerical reasoning & aptitude", "aptitude"],
    programming: ["Programming fundamentals", "programming"],
    dsa: ["Data structures & algorithms", "dsa"],
    technical: ["Core technical concepts", "technical"],
    communication: ["Communication", "communication"],
  };
  let sectionScores;
  let weaknesses;
  try {
    sectionScores = JSON.parse(attempt?.sectionScores || "{}");
    weaknesses = JSON.parse(attempt?.weaknesses || "[]");
  } catch {
    throw new Error("Saved assessment evidence is invalid. Please refresh the assessment analysis.");
  }
  if (!sectionScores || Array.isArray(sectionScores) || typeof sectionScores !== "object" || !Array.isArray(weaknesses)) {
    throw new Error("Saved assessment evidence is invalid. Please refresh the assessment analysis.");
  }
  return Object.entries(labels)
    .filter(([key, [label]]) => weaknesses.includes(key) || weaknesses.includes(label) || (typeof sectionScores[key] === "number" && sectionScores[key] < 70))
    .map(([, [label, key]]) => ({
      skill: label,
      key,
      reason: `Your latest saved assessment records a ${sectionScores[key] ?? "low"}% score in this area.`,
    }));
}

export async function getLearningRoadmapDashboard() {
  const profile = await requirePrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 1 },
    readiness: true,
    learningRoadmaps: { orderBy: { createdAt: "desc" }, take: 10, include: { steps: { orderBy: { order: "asc" } } } },
  });
  const gaps = assessmentSkillGaps(profile.assessments[0]);
  return {
    defaultRole: INTERVIEW_ROLES.includes(profile.preferredRole) ? profile.preferredRole : INTERVIEW_ROLES[0],
    defaultCompany: profile.targetCompany || "",
    evidenceAvailable: Boolean(profile.assessments[0] || profile.readiness),
    evidenceGaps: gaps,
    roles: INTERVIEW_ROLES,
    roadmaps: profile.learningRoadmaps.map((roadmap) => ({
      ...roadmap,
      steps: roadmap.steps.map((step) => ({
        ...step,
        canStart: step.status !== "COMPLETED" && (!step.prerequisiteOrder || roadmap.steps.find((prior) => prior.order === step.prerequisiteOrder)?.status === "COMPLETED"),
      })),
    })),
  };
}

export async function createCareerLearningRoadmap({ targetRole, targetCompany = "", durationMonths = 6 }) {
  if (typeof targetRole !== "string" || !INTERVIEW_ROLES.includes(targetRole)) throw new Error("Choose a supported target role.");
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 12) throw new Error("Choose a roadmap duration from 1 to 12 months.");
  const profile = await requirePrepStudentProfile({ assessments: { orderBy: { completedAt: "desc" }, take: 1 }, readiness: true });
  const gaps = assessmentSkillGaps(profile.assessments[0]);
  const readinessGaps = parseJsonList(profile.readiness?.skillGaps, "readiness skill-gap");
  const additionalGaps = readinessGaps
    .filter((gap) => Number.isFinite(gap.gap) && gap.gap > 0 && typeof gap.label === "string")
    .map((gap) => ({ skill: gap.label, key: inferSkillKey(gap.label), reason: `The latest readiness analysis reports a ${gap.gap}-point gap against its stated target.` }));
  const uniqueGaps = [...gaps, ...additionalGaps].filter((gap, index, all) => all.findIndex((item) => normalizedSkill(item.skill) === normalizedSkill(gap.skill)) === index);
  const defaultSkills = [
    { skill: "Role fundamentals and problem solving", key: "programming" },
    { skill: "Data structures and algorithms", key: "dsa" },
    { skill: "Technical concepts for interviews", key: "technical" },
    { skill: "Build and document a role-relevant project", key: "projects" },
    { skill: "Interview practice and reflection", key: "interview" },
  ];
  const sources = uniqueGaps.length ? uniqueGaps.slice(0, 7) : defaultSkills.map((item) => ({
    ...item,
    reason: "Starter sequence based on the target role; no saved evidence confirms this is a personal skill gap.",
  }));
  if (!sources.some((item) => item.key === "projects")) {
    sources.push({
      skill: "Build and document a role-relevant project",
      key: "projects",
      reason: "A practical project can demonstrate learning; this is a general recommendation, not an assertion that you lack project experience.",
    });
  }
  const steps = sources.slice(0, 8).map((item, index) => {
    const resource = CAREER_RESOURCES[item.key] || CAREER_RESOURCES.programming;
    const prerequisiteOrder = index > 0 ? index : null;
    return {
      order: index + 1,
      title: `${index + 1}. ${item.skill}`,
      skill: item.skill.slice(0, 160),
      objective: `Study ${item.skill} for the ${targetRole} role, practise it with a concrete exercise, and record evidence of what you learned.`,
      reason: item.reason,
      resourceTitle: resource.title,
      resourceUrl: resource.url,
      prerequisiteOrder,
      dueDate: new Date(Date.now() + Math.ceil(((index + 1) * durationMonths * 30) / sources.length) * 86400000),
    };
  });
  const evidenceSummary = uniqueGaps.length
    ? `Prioritized from ${profile.assessments[0] ? "the latest saved assessment" : ""}${profile.assessments[0] && profile.readiness ? " and " : ""}${profile.readiness ? "the saved placement-readiness analysis" : ""}. The sequence is educational guidance, not verified employer requirements.`
    : "No saved assessment/readiness skill gaps were available. This is a generic starter sequence based on your chosen role, not a claim about personal weaknesses or employer requirements.";
  const roadmap = await db.prepLearningRoadmap.create({
    data: {
      profileId: profile.id,
      title: `${targetRole} learning roadmap`,
      targetRole,
      targetCompany: typeof targetCompany === "string" ? targetCompany.trim().replace(/\s+/g, " ").slice(0, 100) || null : null,
      durationMonths,
      evidenceSummary,
      steps: { create: steps },
    },
    select: { id: true },
  });
  return { roadmapId: roadmap.id };
}

function inferSkillKey(label) {
  const normalized = normalizedSkill(label);
  if (normalized.includes("aptitude") || normalized.includes("reason")) return "aptitude";
  if (normalized.includes("dsa") || normalized.includes("data structure") || normalized.includes("algorithm")) return "dsa";
  if (normalized.includes("communication") || normalized.includes("verbal")) return "communication";
  if (normalized.includes("interview")) return "interview";
  if (normalized.includes("project")) return "projects";
  if (normalized.includes("sql") || normalized.includes("technical") || normalized.includes("database")) return "technical";
  return "programming";
}

export async function updateCareerRoadmapStep({ stepId, status }) {
  if (typeof stepId !== "string" || !stepId || !["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(status)) throw new Error("Choose a valid roadmap step update.");
  const profile = await requirePrepStudentProfile();
  const step = await db.prepLearningRoadmapStep.findFirst({ where: { id: stepId, roadmap: { profileId: profile.id } }, include: { roadmap: { include: { steps: { orderBy: { order: "asc" } } } } } });
  if (!step) throw new Error("Roadmap step not found.");
  const prior = step.roadmap.steps.find((item) => item.order === step.prerequisiteOrder);
  if (status !== "NOT_STARTED" && prior && prior.status !== "COMPLETED") throw new Error("Complete the prerequisite milestone first.");
  return db.prepLearningRoadmapStep.update({
    where: { id: step.id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
    select: { id: true, status: true, completedAt: true },
  });
}

export async function getJobTrackerDashboard() {
  const profile = await requirePrepStudentProfile({
    jobApplications: { orderBy: { updatedAt: "desc" }, take: 100, include: { events: { orderBy: { createdAt: "desc" }, take: 50 } } },
    assessments: { orderBy: { completedAt: "desc" }, take: 1 },
  });
  const profileSkills = [...new Set(`${profile.skills},${profile.languages}`.split(",").map((skill) => skill.trim()).filter(Boolean))];
  const resumeSkills = await getSavedResumeSkills(profile.clerkUserId);
  return {
    profileSkills,
    resumeSkills,
    matchingSkills: [...new Set([...profileSkills, ...resumeSkills])],
    resumeHref: "/resume-builder",
    applications: profile.jobApplications.map((application) => ({
      ...application,
      requiredSkills: parseJsonList(application.requiredSkills, "job skill"),
      matchedSkills: parseJsonList(application.matchedSkills, "job match"),
      missingSkills: parseJsonList(application.missingSkills, "job gap"),
      eligibilityChecklist: parseEligibilityChecklist(application.eligibilityChecklist, application.eligibility || ""),
    })),
  };
}

async function getSavedResumeSkills(clerkUserId) {
  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { resumes: { orderBy: { updatedAt: "desc" }, take: 10, select: { skills: { select: { name: true } }, projects: { select: { technologies: true } } } } },
  });
  return [...new Set((user?.resumes || []).flatMap((resume) => [
    ...resume.skills.map((skill) => skill.name.trim()),
    ...resume.projects.flatMap((project) => project.technologies.map((technology) => technology.trim())),
  ]).filter(Boolean))];
}

function parseRequiredSkills(value) {
  if (!Array.isArray(value) || value.length > 40) throw new Error("Enter up to 40 explicitly stated job skills.");
  const skills = [...new Set(value.map((skill) => {
    if (typeof skill !== "string" || !skill.trim() || skill.trim().length > 80) throw new Error("Each required skill must contain 1 to 80 characters.");
    return skill.trim();
  }))];
  return skills;
}

export async function createTrackedJob(input) {
  if (!input || typeof input !== "object") throw new Error("Enter valid job details.");
  const jobTitle = typeof input.jobTitle === "string" ? input.jobTitle.trim() : "";
  const companyName = typeof input.companyName === "string" ? input.companyName.trim() : "";
  const jobDescription = typeof input.jobDescription === "string" ? input.jobDescription.trim() : "";
  if (!jobTitle || jobTitle.length > 160 || !companyName || companyName.length > 160 || jobDescription.length > 15000) throw new Error("Enter a job title, company, and description under 15,000 characters.");
  let jobUrl = null;
  if (input.jobUrl) {
    try {
      const parsed = new URL(input.jobUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP/HTTPS job links are supported.");
      jobUrl = parsed.toString().slice(0, 1000);
    } catch {
      throw new Error("Enter a valid HTTP/HTTPS job link.");
    }
  }
  let deadline = null;
  if (input.deadline) {
    deadline = new Date(`${input.deadline}T00:00:00.000Z`);
    if (!Number.isFinite(deadline.getTime())) throw new Error("Enter a valid application deadline.");
  }
  const requiredSkills = parseRequiredSkills(input.requiredSkills ?? []);
  const eligibility = typeof input.eligibility === "string" ? input.eligibility.trim().slice(0, 2000) : "";
  const eligibilityCriteria = eligibility.split(/\r?\n/).map((criterion) => criterion.trim()).filter(Boolean);
  if (eligibilityCriteria.length > 12 || eligibilityCriteria.some((criterion) => criterion.length > 180)) {
    throw new Error("Enter up to 12 eligibility criteria, one per line, with at most 180 characters each.");
  }
  const profile = await requirePrepStudentProfile();
  const profileSkills = `${profile.skills},${profile.languages}`.split(",").map((skill) => skill.trim()).filter(Boolean);
  const resumeSkills = await getSavedResumeSkills(profile.clerkUserId);
  const match = matchJobSkills([...new Set([...profileSkills, ...resumeSkills])], requiredSkills);
  const application = await db.prepJobApplication.create({
    data: {
      profileId: profile.id,
      jobTitle,
      companyName,
      location: typeof input.location === "string" ? input.location.trim().slice(0, 160) || null : null,
      jobUrl,
      jobDescription,
      requiredSkills: JSON.stringify(requiredSkills),
      eligibility: eligibility || null,
      eligibilityChecklist: JSON.stringify(eligibilityCriteria.map((criterion) => ({ criterion, status: "NEEDS_REVIEW" }))),
      deadline: safeDate(deadline),
      matchScore: match.score,
      matchedSkills: JSON.stringify(match.matchedSkills),
      missingSkills: JSON.stringify(match.missingSkills),
      matchExplanation: requiredSkills.length
        ? `Compared ${requiredSkills.length} manually entered required skills with skills in your Nexora profile and saved resume records. This keyword comparison is not an ATS result or eligibility decision.`
        : "No required skills were entered, so a skill-match percentage cannot be calculated.",
      events: { create: { toStatus: "SAVED", note: "Job added by student." } },
    },
    select: { id: true },
  });
  return { applicationId: application.id };
}

export async function updateJobEligibilityChecklist({ applicationId, checklist }) {
  if (typeof applicationId !== "string" || !applicationId || !Array.isArray(checklist) || checklist.length > 12) {
    throw new Error("Choose a valid saved job and eligibility checklist.");
  }
  const profile = await requirePrepStudentProfile();
  const application = await db.prepJobApplication.findFirst({
    where: { id: applicationId, profileId: profile.id },
    select: { id: true, eligibilityChecklist: true, eligibility: true },
  });
  if (!application) throw new Error("Job application not found.");
  const savedChecklist = parseEligibilityChecklist(application.eligibilityChecklist, application.eligibility || "");
  if (savedChecklist.length !== checklist.length) throw new Error("The eligibility criteria changed. Refresh the page and try again.");
  const updatedChecklist = checklist.map((item, index) => {
    const savedItem = savedChecklist[index];
    if (!item || typeof item.criterion !== "string" || item.criterion !== savedItem.criterion || !ELIGIBILITY_STATUSES.includes(item.status)) {
      throw new Error("Choose a valid self-assessed status for each saved eligibility criterion.");
    }
    return { criterion: savedItem.criterion, status: item.status };
  });
  const updated = await db.prepJobApplication.update({
    where: { id: application.id },
    data: { eligibilityChecklist: JSON.stringify(updatedChecklist) },
    select: { eligibilityChecklist: true },
  });
  return { eligibilityChecklist: parseEligibilityChecklist(updated.eligibilityChecklist) };
}

export async function updateTrackedApplication({ applicationId, status, notes }) {
  if (typeof applicationId !== "string" || !applicationId || !APPLICATION_STATUSES.includes(status)) throw new Error("Choose a valid application status.");
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 4000)) throw new Error("Notes must be at most 4,000 characters.");
  const profile = await requirePrepStudentProfile();
  const application = await db.prepJobApplication.findFirst({ where: { id: applicationId, profileId: profile.id }, select: { id: true, status: true } });
  if (!application) throw new Error("Job application not found.");
  return db.$transaction(async (transaction) => {
    const updated = await transaction.prepJobApplication.update({
      where: { id: application.id },
      data: {
        status,
        ...(notes !== undefined ? { notes: notes.trim() } : {}),
        ...(status === "APPLIED" && application.status !== "APPLIED" ? { appliedAt: new Date() } : {}),
        ...(status !== application.status ? { events: { create: { fromStatus: application.status, toStatus: status, note: "Status updated by student." } } } : {}),
      },
      select: { id: true, status: true, appliedAt: true },
    });
    return updated;
  });
}

export async function saveJourneyPreferences({ inAppReminders, reminderFrequency }) {
  if (typeof inAppReminders !== "boolean" || !["DAILY", "WEEKLY", "NEVER"].includes(reminderFrequency)) {
    throw new Error("Choose a valid in-app reminder preference.");
  }
  const profile = await requirePrepStudentProfile();
  return db.prepEngagementPreference.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, inAppReminders, reminderFrequency },
    update: { inAppReminders, reminderFrequency },
    select: { inAppReminders: true, reminderFrequency: true, updatedAt: true },
  });
}

function validateWebPushSubscription(input) {
  if (!input || typeof input !== "object" || typeof input.endpoint !== "string" || input.endpoint.length > 2048 || !input.keys || typeof input.keys !== "object") {
    throw new Error("The browser did not provide a valid push subscription.");
  }
  let endpoint;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new Error("The browser provided an invalid push service endpoint.");
  }
  const host = endpoint.hostname.toLowerCase();
  const trustedHost = host === "fcm.googleapis.com" ||
    host === "web.push.apple.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".push.services.mozilla.net") ||
    host.endsWith(".notify.windows.com");
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || !trustedHost) {
    throw new Error("This browser push service endpoint is not supported.");
  }
  const { p256dh, auth } = input.keys;
  if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(p256dh) || typeof auth !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(auth)) {
    throw new Error("The browser provided invalid push encryption keys.");
  }
  return { endpoint: endpoint.toString(), keys: { p256dh, auth } };
}

export async function saveWebPushSubscription(input) {
  if (!process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY || !process.env.WEB_PUSH_CONTACT) {
    throw new Error("Browser push is not configured. Set the VAPID public key, private key, and contact address in the server environment.");
  }
  const subscription = validateWebPushSubscription(input);
  const profile = await requirePrepStudentProfile();
  const endpointHash = hashWebPushEndpoint(subscription.endpoint);
  const existing = await db.prepWebPushSubscription.findUnique({ where: { endpointHash }, select: { id: true, profileId: true } });
  if (existing && existing.profileId !== profile.id) throw new Error("This browser subscription is already linked to another Nexora account.");
  const encrypted = encryptWebPushSubscription(subscription);
  await db.prepWebPushSubscription.upsert({
    where: { endpointHash },
    create: { profileId: profile.id, endpointHash, ...encrypted },
    update: encrypted,
  });
  await db.prepEngagementPreference.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, inAppReminders: true, reminderFrequency: "DAILY" },
    update: { updatedAt: new Date() },
  });
  return { subscribed: true };
}

export async function removeWebPushSubscription(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 2048) throw new Error("Choose a valid browser push subscription.");
  const profile = await requirePrepStudentProfile();
  await db.prepWebPushSubscription.deleteMany({
    where: { endpointHash: hashWebPushEndpoint(endpoint), profileId: profile.id },
  });
  return { subscribed: false };
}

export async function getPlacementJourneyDashboard() {
  const profile = await requirePrepStudentProfile({
    assessments: { orderBy: { completedAt: "desc" }, take: 20, select: { id: true, overallScore: true, completedAt: true } },
    readiness: { select: { overallReadiness: true, updatedAt: true } },
    preparationPlans: { orderBy: { createdAt: "desc" }, take: 8, include: { tasks: true } },
    practiceAttempts: { orderBy: { completedAt: "desc" }, take: 20, select: { id: true, subject: true, topic: true, score: true, completedAt: true } },
    placementSimulations: { orderBy: { startedAt: "desc" }, take: 20, include: { stages: { orderBy: { order: "asc" }, select: { id: true, stageKey: true, title: true, status: true, score: true } } } },
    interviewSessions: { orderBy: { startedAt: "desc" }, take: 20, select: { id: true, status: true, startedAt: true, completedAt: true, evaluation: { select: { overallScore: true } } } },
    learningRoadmaps: { orderBy: { createdAt: "desc" }, take: 5, include: { steps: { select: { id: true, status: true, title: true, completedAt: true } } } },
    jobApplications: { orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, jobTitle: true, companyName: true, status: true, updatedAt: true, deadline: true } },
    engagementPreference: { select: { inAppReminders: true, reminderFrequency: true } },
  });
  const allActivities = [
    ...profile.assessments.map((item) => ({ type: "Assessment", title: `Assessment completed · ${item.overallScore}%`, at: item.completedAt, href: "/placement-prep/readiness" })),
    ...profile.practiceAttempts.map((item) => ({ type: "Practice", title: `${item.subject} · ${item.topic} · ${item.score}%`, at: item.completedAt, href: "/placement-prep/practice" })),
    ...profile.preparationPlans.flatMap((plan) => plan.tasks.filter((task) => task.status === "COMPLETED" && task.completedAt).map((task) => ({ type: "Preparation", title: `Completed preparation task · ${task.topic}`, at: task.completedAt, href: "/placement-prep/preparation" }))),
    ...profile.placementSimulations.map((item) => ({ type: "Simulation", title: `Placement simulation · ${item.status.toLowerCase()}`, at: item.completedAt || item.startedAt, href: `/placement-prep/simulation/${item.id}` })),
    ...profile.interviewSessions.filter((item) => item.status === "COMPLETED").map((item) => ({ type: "Interview", title: `AI interview completed${item.evaluation ? ` · evaluation ${item.evaluation.overallScore ?? "unscored"}` : ""}`, at: item.completedAt || item.startedAt, href: `/placement-prep/interview/${item.id}` })),
    ...profile.learningRoadmaps.flatMap((roadmap) => roadmap.steps.filter((step) => step.status === "COMPLETED" && step.completedAt).map((step) => ({ type: "Learning", title: `Completed roadmap milestone · ${step.title}`, at: step.completedAt, href: "/placement-prep/learning" }))),
    ...profile.jobApplications.map((item) => ({ type: "Application", title: `${item.jobTitle} at ${item.companyName} · ${item.status.replaceAll("_", " ").toLowerCase()}`, at: item.updatedAt, href: "/placement-prep/jobs" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const activities = allActivities.slice(0, 20);
  const simulationsCompleted = profile.placementSimulations.filter((item) => item.status === "COMPLETED").length;
  const completedRoadmapSteps = profile.learningRoadmaps.flatMap((item) => item.steps).filter((step) => step.status === "COMPLETED").length;
  const completedPreparationTasks = profile.preparationPlans.flatMap((item) => item.tasks).filter((task) => task.status === "COMPLETED").length;
  const milestones = [
    ...profile.assessments.slice(0, 5).map((item) => ({ title: "Completed a placement assessment", at: item.completedAt, type: "Assessment" })),
    ...profile.placementSimulations.filter((item) => item.status === "COMPLETED").map((item) => ({ title: `Completed a placement simulation${item.overallScore === null ? "" : ` · ${item.overallScore}/100`}`, at: item.completedAt || item.startedAt, type: "Simulation" })),
    ...profile.learningRoadmaps.flatMap((roadmap) => roadmap.steps.filter((step) => step.status === "COMPLETED").map((step) => ({ title: `Completed learning milestone · ${step.title}`, at: step.completedAt || roadmap.createdAt, type: "Learning" }))),
    ...profile.jobApplications.filter((item) => ["OFFER", "INTERVIEW"].includes(item.status)).map((item) => ({ title: `${item.status === "OFFER" ? "Offer received" : "Interview stage"} · ${item.jobTitle} at ${item.companyName}`, at: item.updatedAt, type: "Application" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20);
  const openApplications = profile.jobApplications.filter((item) => !["REJECTED", "WITHDRAWN", "OFFER"].includes(item.status)).length;
  const dateKey = (date) => {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}-${parts.find((part) => part.type === "day").value}`;
  };
  const distinctActivityDays = [...new Set(allActivities.map((item) => dateKey(item.at)))].sort().reverse();
  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(new Date(Date.now() - 86400000));
  let engagementStreak = 0;
  let expectedDay = distinctActivityDays[0] === todayKey ? todayKey : distinctActivityDays[0] === yesterdayKey ? yesterdayKey : null;
  for (const day of distinctActivityDays) {
    if (!expectedDay || day !== expectedDay) break;
    engagementStreak += 1;
    expectedDay = new Date(new Date(`${expectedDay}T00:00:00.000Z`).getTime() - 86400000).toISOString().slice(0, 10);
  }
  const preferences = profile.engagementPreference || { inAppReminders: true, reminderFrequency: "DAILY" };
  const reminderHorizonDays = preferences.reminderFrequency === "WEEKLY" ? 7 : preferences.reminderFrequency === "DAILY" ? 1 : 0;
  const now = new Date();
  return {
    name: profile.fullName,
    readiness: profile.readiness?.overallReadiness ?? null,
    readinessUpdatedAt: profile.readiness?.updatedAt ?? null,
    assessmentCount: profile.assessments.length,
    latestAssessment: profile.assessments[0] || null,
    practiceCount: profile.practiceAttempts.length,
    simulationCount: profile.placementSimulations.length,
    simulationsCompleted,
    interviewCount: profile.interviewSessions.filter((item) => item.status === "COMPLETED").length,
    applicationCount: profile.jobApplications.length,
    openApplications,
    completedPreparationTasks,
    completedRoadmapSteps,
    engagementStreak,
    preferences,
    achievements: [
      ...(profile.assessments.length ? [{ title: "First assessment", detail: "Saved a placement assessment result." }] : []),
      ...(completedPreparationTasks >= 5 ? [{ title: "Consistent preparation", detail: "Completed at least five preparation tasks." }] : []),
      ...(completedRoadmapSteps ? [{ title: "Roadmap milestone", detail: `Completed ${completedRoadmapSteps} long-term learning milestone${completedRoadmapSteps === 1 ? "" : "s"}.` }] : []),
      ...(simulationsCompleted ? [{ title: "Simulation complete", detail: `Completed ${simulationsCompleted} placement simulation${simulationsCompleted === 1 ? "" : "s"}.` }] : []),
      ...(profile.jobApplications.some((item) => item.status === "OFFER") ? [{ title: "Offer recorded", detail: "Manually recorded an offer in the application tracker." }] : []),
    ],
    recentAssessments: profile.assessments.slice(0, 8),
    activities,
    milestones,
    nextActions: [
      ...profile.preparationPlans.flatMap((plan) => plan.tasks.filter((task) => task.status !== "COMPLETED").map((task) => ({ title: task.topic, detail: task.objective, href: "/placement-prep/preparation", dueDate: task.dueDate }))),
      ...profile.learningRoadmaps.flatMap((roadmap) => roadmap.steps.filter((step) => step.status !== "COMPLETED").map((step) => ({ title: step.title, detail: step.reason, href: "/placement-prep/learning", dueDate: null }))),
      ...profile.jobApplications.filter((item) => item.deadline && item.deadline >= new Date() && !["OFFER", "REJECTED", "WITHDRAWN"].includes(item.status)).map((item) => ({ title: `Application deadline · ${item.jobTitle}`, detail: item.companyName, href: "/placement-prep/jobs", dueDate: item.deadline })),
    ].sort((a, b) => (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER))
      .filter((action) => {
        if (!preferences.inAppReminders || !reminderHorizonDays) return false;
        if (!action.dueDate) return true;
        const difference = action.dueDate.getTime() - now.getTime();
        return difference < 0 || difference <= reminderHorizonDays * 86400000;
      })
      .slice(0, 8),
  };
}
