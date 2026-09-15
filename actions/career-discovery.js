"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateJson } from "@/lib/llm";

function serialize(journey) {
  if (!journey) return null;
  return {
    ...journey,
    createdAt: journey.createdAt?.toISOString?.() ?? journey.createdAt,
    updatedAt: journey.updatedAt?.toISOString?.() ?? journey.updatedAt,
  };
}

async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

async function getOrCreateJourney(userId) {
  return db.careerDiscovery.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getCareerDiscovery() {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  return {
    journey: serialize(journey),
    defaults: {
      name: user.name || "",
      skills: user.skills || [],
      experience: user.experience ?? "",
      bio: user.bio || "",
      industry: user.industry || "",
    },
  };
}

export async function saveCareerProfile(form) {
  const user = await requireUser();
  const skills = String(form.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const interests = String(form.interests || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!skills.length) throw new Error("Add at least one skill.");
  if (!form.education?.trim()) throw new Error("Education is required.");

  const journey = await db.careerDiscovery.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      education: form.education.trim(),
      experienceYears: form.experienceYears === "" || form.experienceYears == null
        ? 0
        : Number(form.experienceYears),
      currentRole: form.currentRole?.trim() || null,
      skills,
      interests,
      location: form.location?.trim() || null,
      careerGoal: form.careerGoal?.trim() || null,
      currentStep: "careers",
    },
    update: {
      education: form.education.trim(),
      experienceYears: form.experienceYears === "" || form.experienceYears == null
        ? 0
        : Number(form.experienceYears),
      currentRole: form.currentRole?.trim() || null,
      skills,
      interests,
      location: form.location?.trim() || null,
      careerGoal: form.careerGoal?.trim() || null,
      currentStep: "careers",
      careerRecommendations: null,
      selectedCareer: null,
      selectedCareerReason: null,
      skillGap: null,
      roadmap: null,
      courses: null,
      learningPlan: null,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { skills, experience: Number(form.experienceYears) || 0 },
  });

  return serialize(journey);
}

export async function generateCareerRecommendations() {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  if (!journey.skills?.length) throw new Error("Complete your profile first.");

  const data = await generateJson(`
You are a career counselor.
Recommend 5 suitable job roles for this person.
Return ONLY JSON:
{
  "careers": [
    {
      "title": "string",
      "matchScore": number,
      "why": "string",
      "outlook": "High" | "Medium" | "Growing",
      "salaryRange": "string",
      "keySkills": ["skill"]
    }
  ]
}

Profile:
- Education: ${journey.education}
- Experience years: ${journey.experienceYears ?? 0}
- Current role: ${journey.currentRole || "Not specified"}
- Skills: ${journey.skills.join(", ")}
- Interests: ${journey.interests.join(", ") || "Not specified"}
- Location: ${journey.location || "Not specified"}
- Career goal: ${journey.careerGoal || "Open"}
`);

  if (!Array.isArray(data.careers) || data.careers.length === 0) {
    throw new Error("Could not generate career recommendations.");
  }

  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: {
      careerRecommendations: data,
      currentStep: "careers",
    },
  });

  return serialize(updated);
}

export async function selectCareerAndAnalyzeGaps(careerTitle) {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  const recs = journey.careerRecommendations;
  const careers = recs && typeof recs === "object" && Array.isArray(recs.careers) ? recs.careers : [];
  const chosen = careers.find((c) => c.title === careerTitle) || { title: careerTitle };

  const data = await generateJson(`
Compare this user's skills with what is required for the role "${chosen.title}".
Return ONLY JSON:
{
  "career": "${chosen.title}",
  "have": ["skill the user already has that is relevant"],
  "missing": [
    { "skill": "string", "importance": "High" | "Medium" | "Low", "why": "string" }
  ],
  "summary": "short paragraph"
}

User skills: ${journey.skills.join(", ")}
Education: ${journey.education}
Experience: ${journey.experienceYears ?? 0} years
Role context: ${JSON.stringify(chosen)}
`);

  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: {
      selectedCareer: chosen.title,
      selectedCareerReason: chosen.why || null,
      skillGap: data,
      currentStep: "skillgap",
      roadmap: null,
      courses: null,
      learningPlan: null,
    },
  });

  return serialize(updated);
}

export async function generateDiscoveryRoadmap() {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  if (!journey.selectedCareer) throw new Error("Select a career first.");

  const missing = (journey.skillGap?.missing || []).map((s) => s.skill || s).join(", ");

  const data = await generateJson(`
Create a 6-month personalized career roadmap for becoming a ${journey.selectedCareer}.
Return ONLY JSON:
{
  "career": "${journey.selectedCareer}",
  "months": 6,
  "phases": [
    {
      "month": 1,
      "title": "string",
      "focus": "string",
      "skills": ["skill"],
      "milestones": ["milestone"]
    }
  ]
}

User skills: ${journey.skills.join(", ")}
Missing skills to close: ${missing || "general role readiness"}
Goal: ${journey.careerGoal || journey.selectedCareer}
Include exactly 6 phases (months 1-6).
`);

  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: { roadmap: data, currentStep: "roadmap", courses: null, learningPlan: null },
  });

  return serialize(updated);
}

export async function generateDiscoveryCourses() {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  if (!journey.selectedCareer) throw new Error("Select a career first.");

  const missing = (journey.skillGap?.missing || []).map((s) => (typeof s === "string" ? s : s.skill));
  const roadmapSkills = (journey.roadmap?.phases || []).flatMap((p) => p.skills || []);
  const targets = [...new Set([...missing, ...roadmapSkills])].filter(Boolean);

  const data = await generateJson(`
Recommend 8 learning resources for someone becoming a ${journey.selectedCareer}.
Prefer well-known platforms (Coursera, Udemy, freeCodeCamp, YouTube, official docs).
Return ONLY JSON:
{
  "items": [
    {
      "title": "string",
      "platform": "string",
      "url": "https://...",
      "skill": "string",
      "cost": "Free" | "Paid",
      "reason": "string"
    }
  ]
}

Skills to learn: ${targets.join(", ") || "core skills for the role"}
User already knows: ${journey.skills.join(", ")}
Use real, typical course titles. For Coursera, use search URLs like https://www.coursera.org/search?query=SKILL if you do not have a specific course URL.
`);

  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: { courses: data, currentStep: "courses", learningPlan: null },
  });

  return serialize(updated);
}

export async function generateLearningPlan() {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  if (!journey.roadmap) throw new Error("Generate a roadmap first.");

  const data = await generateJson(`
Turn this 6-month roadmap into a 12-week learning plan with 3-5 tasks per week.
Return ONLY JSON:
{
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "tasks": [
        { "title": "string", "hours": 4 }
      ]
    }
  ]
}

Roadmap: ${JSON.stringify(journey.roadmap)}
Courses: ${JSON.stringify(journey.courses?.items || [])}
Career: ${journey.selectedCareer}
Include weeks 1 through 12.
`);

  const weeks = (data.weeks || []).map((week, wi) => ({
    ...week,
    week: week.week || wi + 1,
    tasks: (week.tasks || []).map((task, ti) => ({
      id: `w${week.week || wi + 1}-t${ti + 1}`,
      title: task.title,
      hours: task.hours || 3,
      done: false,
    })),
  }));

  const plan = { weeks };
  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: { learningPlan: plan, currentStep: "planner" },
  });

  const total = weeks.reduce((n, w) => n + (w.tasks?.length || 0), 0);
  return serialize(updated);
}

export async function toggleLearningTask(taskId, done) {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  const plan = journey.learningPlan;
  if (!plan?.weeks) throw new Error("No learning plan yet.");

  const weeks = plan.weeks.map((week) => ({
    ...week,
    tasks: (week.tasks || []).map((task) =>
      task.id === taskId ? { ...task, done: Boolean(done) } : task
    ),
  }));

  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: { learningPlan: { weeks } },
  });

  return serialize(updated);
}

export async function setDiscoveryStep(step) {
  const user = await requireUser();
  const journey = await getOrCreateJourney(user.id);
  const updated = await db.careerDiscovery.update({
    where: { id: journey.id },
    data: { currentStep: step },
  });
  return serialize(updated);
}
