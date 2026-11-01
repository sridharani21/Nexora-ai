import { z } from "zod";

const text = (max = 500) => z.string().trim().max(max).default("");
const optionalText = (max = 500) => z.string().trim().max(max).optional().default("");
const dateText = z.string().trim().max(10)
  .regex(/^$|^\d{4}-(0[1-9]|1[0-2])(-([0-2]\d|3[01]))?$/)
  .superRefine((value, context) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
      if (Number(day) > daysInMonth) {
        context.addIssue({ code: "custom", message: "Enter a valid calendar date." });
      }
    }
  })
  .default("");

const academicSchema = z.object({
  institution: optionalText(200),
  degree: optionalText(100),
  branch: optionalText(150),
  specialization: optionalText(150),
  studyStatus: optionalText(80),
  academicYear: optionalText(40),
  semester: optionalText(20),
  gpa: optionalText(20),
  gradingScale: z.enum(["", "10", "4", "100", "other"]).default(""),
  gpaMaximum: optionalText(10),
  expectedGraduationYear: optionalText(4),
  backlogs: optionalText(20),
  achievements: optionalText(3000),
}).prefault({});

const skillSchema = z.object({
  name: text(100),
  category: optionalText(80),
  proficiency: z.enum(["", "Beginner", "Intermediate", "Advanced", "Expert", "Not specified"]).default(""),
  experience: optionalText(40),
  evidence: optionalText(500),
  source: z.enum(["manual", "resume"]).default("manual"),
});

const projectSchema = z.object({
  title: text(150),
  description: optionalText(2000),
  technologies: optionalText(500),
  role: optionalText(150),
  startDate: dateText,
  endDate: dateText,
  url: optionalText(300),
  repositoryUrl: optionalText(300),
  type: optionalText(60),
  outcomes: optionalText(1000),
  source: z.enum(["manual", "resume"]).default("manual"),
});

const experienceSchema = z.object({
  organization: text(150),
  title: text(150),
  employmentType: optionalText(60),
  location: optionalText(150),
  startDate: dateText,
  endDate: dateText,
  current: z.boolean().default(false),
  responsibilities: optionalText(2000),
  achievements: optionalText(1500),
  technologies: optionalText(500),
  url: optionalText(300),
  source: z.enum(["manual", "resume"]).default("manual"),
});

const certificationSchema = z.object({
  name: text(150),
  issuer: optionalText(150),
  issueDate: dateText,
  expiryDate: dateText,
  credentialId: optionalText(120),
  credentialUrl: optionalText(300),
  source: z.enum(["manual", "resume"]).default("manual"),
});

const preferencesSchema = z.object({
  roles: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  domains: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  industries: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  locations: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  workArrangement: optionalText(40),
  employmentType: optionalText(60),
  targetCompanies: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  willingToRelocate: z.enum(["", "yes", "no", "undecided"]).default(""),
  goals: optionalText(1500),
});

const linksSchema = z.object({
  linkedin: optionalText(300),
  github: optionalText(300),
  portfolio: optionalText(300),
  website: optionalText(300),
});

const urlFields = [
  ["links.linkedin", (value) => value.linkedin],
  ["links.github", (value) => value.github],
  ["links.portfolio", (value) => value.portfolio],
  ["links.website", (value) => value.website],
];

function isSafeHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const studentProfileSchema = z.object({
  phone: optionalText(40),
  location: optionalText(150),
  academic: academicSchema,
  skills: z.array(skillSchema).max(100).default([]),
  projects: z.array(projectSchema).max(50).default([]),
  experience: z.array(experienceSchema).max(50).default([]),
  certifications: z.array(certificationSchema).max(50).default([]),
  preferences: preferencesSchema.prefault({}),
  links: linksSchema.prefault({}),
  summary: optionalText(2000),
}).strict().superRefine((profile, context) => {
  const { academic } = profile;
  if (academic.gpa) {
    if (!academic.gradingScale) {
      context.addIssue({
        code: "custom",
        path: ["academic", "gradingScale"],
        message: "Select the grading scale for this GPA.",
      });
    } else {
      const gpa = Number(academic.gpa);
      const max = academic.gradingScale === "4" ? 4
        : academic.gradingScale === "100" ? 100
        : academic.gradingScale === "other" ? Number(academic.gpaMaximum)
        : 10;
      if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(gpa) || gpa < 0 || gpa > max) {
        context.addIssue({
          code: "custom",
          path: ["academic", "gpa"],
          message: academic.gradingScale === "other" && (!Number.isFinite(max) || max <= 0)
            ? "Enter the maximum for this grading scale."
            : `Enter a value from 0 to ${max} for the selected grading scale.`,
        });
      }
    }
  }

  if (academic.expectedGraduationYear) {
    const year = Number(academic.expectedGraduationYear);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      context.addIssue({
        code: "custom",
        path: ["academic", "expectedGraduationYear"],
        message: "Enter a valid graduation year.",
      });
    }
  }

  for (const collection of [profile.projects, profile.experience, profile.certifications]) {
    for (const item of collection) {
      if (item.startDate && item.endDate && item.startDate.slice(0, 7) > item.endDate.slice(0, 7)) {
        context.addIssue({
          code: "custom",
          message: "The end date must be on or after the start date.",
        });
      }
    }
  }

  for (const item of profile.projects) {
    for (const field of ["url", "repositoryUrl"]) {
      if (!isSafeHttpUrl(item[field])) {
        context.addIssue({
          code: "custom",
          path: ["projects", field],
          message: "Use a valid http or https URL.",
        });
      }
    }
  }
  for (const item of profile.experience) {
    if (!isSafeHttpUrl(item.url)) {
      context.addIssue({ code: "custom", path: ["experience", "url"], message: "Use a valid http or https URL." });
    }
  }
  for (const item of profile.certifications) {
    if (!isSafeHttpUrl(item.credentialUrl)) {
      context.addIssue({ code: "custom", path: ["certifications", "credentialUrl"], message: "Use a valid http or https URL." });
    }
    if (item.issueDate && item.expiryDate && item.issueDate.slice(0, 7) > item.expiryDate.slice(0, 7)) {
      context.addIssue({ code: "custom", path: ["certifications", "expiryDate"], message: "Expiry date must be on or after the issue date." });
    }
  }
  const normalizedSkills = profile.skills.map((skill) => skill.name.trim().toLocaleLowerCase()).filter(Boolean);
  if (new Set(normalizedSkills).size !== normalizedSkills.length) {
    context.addIssue({
      code: "custom",
      path: ["skills"],
      message: "Remove duplicate skills before saving.",
    });
  }
  for (const [path, getValue] of urlFields) {
    if (!isSafeHttpUrl(getValue(profile.links))) {
      context.addIssue({ code: "custom", path: path.split("."), message: "Use a valid http or https URL." });
    }
  }
});

export function calculateProfileCompleteness(profile) {
  const checks = [
    Boolean(profile?.academic?.institution),
    Boolean(profile?.academic?.degree),
    Boolean(profile?.academic?.branch),
    Boolean(profile?.academic?.expectedGraduationYear),
    (profile?.skills?.length || 0) > 0,
    (profile?.projects?.length || 0) > 0,
    Boolean(profile?.summary),
    Boolean(profile?.phone),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export const emptyStudentProfile = () => studentProfileSchema.parse({});
