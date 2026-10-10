export const ROLE_REQUIREMENTS = {
  default: {
    label: "Software Engineer",
    requirements: { programming: 80, dsa: 80, aptitude: 70, technical: 70, communication: 65 },
  },
  frontend: {
    label: "Frontend Developer",
    requirements: { programming: 78, dsa: 65, aptitude: 65, technical: 72, communication: 65 },
  },
  fullstack: {
    label: "Full Stack Developer",
    requirements: { programming: 80, dsa: 70, aptitude: 65, technical: 78, communication: 65 },
  },
  backend: {
    label: "Backend Developer",
    requirements: { programming: 82, dsa: 78, aptitude: 68, technical: 80, communication: 65 },
  },
  data: {
    label: "Data Analyst",
    requirements: { programming: 70, dsa: 60, aptitude: 78, technical: 72, communication: 70 },
  },
  cloud: {
    label: "Cloud / DevOps Engineer",
    requirements: { programming: 72, dsa: 65, aptitude: 68, technical: 82, communication: 65 },
  },
  security: {
    label: "Security Analyst",
    requirements: { programming: 72, dsa: 68, aptitude: 72, technical: 82, communication: 68 },
  },
};

export function classifyScore(score) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Needs Improvement";
  return "Weak";
}

export function readinessStatus(score) {
  if (score >= 90) return "Highly Ready";
  if (score >= 75) return "Placement Ready";
  if (score >= 60) return "Developing";
  if (score >= 40) return "Early Preparation";
  return "Not Ready";
}

export function roleKey(preferredRole = "") {
  const role = (preferredRole || "").toLowerCase();
  if (role.includes("front")) return "frontend";
  if (role.includes("full")) return "fullstack";
  if (role.includes("back")) return "backend";
  if (role.includes("data") || role.includes("anal")) return "data";
  if (role.includes("cloud") || role.includes("devops") || role.includes("system")) return "cloud";
  if (role.includes("security")) return "security";
  return "default";
}
