import {
  Building2,
  FileSearch,
  FileText,
  PenLine,
  SearchCheck,
  Target,
} from "lucide-react";

export const resumeJobModules = [
  {
    title: "AI Resume Builder",
    description:
      "Create a professional, ATS-friendly resume with AI-assisted content, templates, preview, and PDF export.",
    href: "/resume-builder",
    action: "Build Resume",
    icon: FileText,
  },
  {
    title: "ATS Resume Scanner",
    description:
      "Upload a resume and receive an ATS score, strengths, missing keywords, and actionable formatting feedback.",
    href: "/ats-scanner",
    action: "Scan Resume",
    icon: FileSearch,
  },
  {
    title: "Resume Optimizer",
    description:
      "Align an existing resume with one target job by identifying keywords, missing skills, and weak sections.",
    href: "/resume-optimizer",
    action: "Optimize Resume",
    icon: Target,
  },
  {
    title: "Job Matcher",
    description:
      "Compare your profile, skills, resume, and career goal with relevant opportunities and match explanations.",
    href: "/job-matcher",
    action: "Find Matching Jobs",
    icon: SearchCheck,
  },
  {
    title: "Company Explorer",
    description:
      "Research a company’s products, industry, common roles, required skills, interview information, and jobs.",
    href: "/company-explorer",
    action: "Explore Companies",
    icon: Building2,
  },
  {
    title: "Cover Letter AI",
    description:
      "Generate a personalized cover letter grounded in your actual resume, target job, and company details.",
    href: "/ai-cover-letter",
    action: "Create Cover Letter",
    icon: PenLine,
  },
];
