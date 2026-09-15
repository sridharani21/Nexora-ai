import {
  BookOpen,
  Compass,
  BriefcaseBusiness,
  FileText,
  SearchCheck,
  GraduationCap,
  Map,
  PenBox,
} from "lucide-react";

export const growthTools = [
  {
    title: "Resume Builder",
    description:
      "Create ATS-optimized resumes with AI-assisted content, templates, and scoring aligned to your target roles.",
    href: "/resume-builder",
    action: "Build Resume",
    icon: FileText,
  },
  {
    title: "Cover Letter",
    description:
      "Generate tailored cover letters that match the job description and highlight your most relevant experience.",
    href: "/ai-cover-letter",
    action: "Create Cover Letter",
    icon: PenBox,
  },
  {
    title: "Interview Prep",
    description:
      "Practice role-based mock interviews, review your history, and get AI feedback to improve your answers.",
    href: "/interview",
    action: "Start Prep",
    icon: GraduationCap,
  },
  {
    title: "Roadmap Generator",
    description:
      "Build a month-by-month learning path for the career you want, with skills, milestones, and next steps.",
    href: "/roadmap",
    action: "Generate Roadmap",
    icon: Map,
  },
  {
    title: "Course Recommendations",
    description:
      "Upload your resume, pick a domain, and get free and paid courses matched to your skill gaps.",
    href: "/course-recommendations",
    action: "Get Courses",
    icon: BookOpen,
  },
  {
    title: "Career Discovery & Learning",
    description:
      "From your profile to a weekly plan: career matches, skill gaps, a roadmap, courses, and a learning calendar.",
    href: "/career-discovery",
    action: "Start Discovery",
    icon: Compass,
  },
  {
    title: "Resume & Job Modules",
    description:
      "Build, scan, and optimize your resume, match with jobs, explore companies, and create tailored cover letters from one workspace.",
    href: "/resume-job-modules",
    action: "Explore Modules",
    icon: BriefcaseBusiness,
  },
];
