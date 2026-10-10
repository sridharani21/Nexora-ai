export const COMPANY_OPTIONS = [
  "Microsoft",
  "Amazon",
  "Google",
  "TCS",
  "Infosys",
  "Accenture",
  "Zoho",
  "Other company",
];

export const COMPANY_PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

export const COMPANY_ROLE_PROFILES = [
  {
    key: "software-engineer",
    label: "Software Engineer",
    aliases: ["SDE", "Software Developer", "Software Development Engineer"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "dsa", label: "DSA & problem solving", required: 75, weight: 30, practiceSubjects: ["dsa"] },
      { skill: "programming", label: "Programming", required: 75, weight: 20, practiceSubjects: ["coding"] },
      { skill: "technical", label: "Core technical subjects", required: 70, weight: 25, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & reasoning", required: 65, weight: 10, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 65, weight: 15, practiceSubjects: [] },
    ],
  },
  {
    key: "frontend-developer",
    label: "Frontend Developer",
    aliases: ["Frontend Engineer", "UI Developer"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "programming", label: "Programming", required: 75, weight: 25, practiceSubjects: ["coding"] },
      { skill: "dsa", label: "DSA & problem solving", required: 60, weight: 15, practiceSubjects: ["dsa"] },
      { skill: "technical", label: "Core technical subjects", required: 75, weight: 30, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & reasoning", required: 60, weight: 10, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 70, weight: 20, practiceSubjects: [] },
    ],
  },
  {
    key: "backend-developer",
    label: "Backend Developer",
    aliases: ["Backend Engineer", "Server-side Developer"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "programming", label: "Programming", required: 80, weight: 25, practiceSubjects: ["coding"] },
      { skill: "dsa", label: "DSA & problem solving", required: 75, weight: 25, practiceSubjects: ["dsa"] },
      { skill: "technical", label: "Core technical subjects", required: 80, weight: 30, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & reasoning", required: 60, weight: 5, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 65, weight: 15, practiceSubjects: [] },
    ],
  },
  {
    key: "data-analyst",
    label: "Data Analyst",
    aliases: ["Business Analyst", "Analytics Associate"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "programming", label: "Programming & data handling", required: 65, weight: 15, practiceSubjects: ["coding"] },
      { skill: "dsa", label: "DSA & problem solving", required: 55, weight: 10, practiceSubjects: ["dsa"] },
      { skill: "technical", label: "SQL & technical foundations", required: 75, weight: 30, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & quantitative reasoning", required: 75, weight: 25, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 70, weight: 20, practiceSubjects: [] },
    ],
  },
  {
    key: "cloud-devops-engineer",
    label: "Cloud / DevOps Engineer",
    aliases: ["Cloud Engineer", "DevOps Engineer", "Systems Engineer"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "programming", label: "Programming", required: 65, weight: 15, practiceSubjects: ["coding"] },
      { skill: "dsa", label: "DSA & problem solving", required: 60, weight: 10, practiceSubjects: ["dsa"] },
      { skill: "technical", label: "Systems & technical foundations", required: 80, weight: 40, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & reasoning", required: 60, weight: 10, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 70, weight: 25, practiceSubjects: [] },
    ],
  },
  {
    key: "security-analyst",
    label: "Security Analyst",
    aliases: ["Cybersecurity Analyst", "Application Security Engineer"],
    requirementsSource: "GENERAL_ROLE_BENCHMARK",
    requirements: [
      { skill: "programming", label: "Programming", required: 65, weight: 15, practiceSubjects: ["coding"] },
      { skill: "dsa", label: "DSA & problem solving", required: 60, weight: 10, practiceSubjects: ["dsa"] },
      { skill: "technical", label: "Security & technical foundations", required: 80, weight: 40, practiceSubjects: ["core", "sql", "oop", "dbms", "os", "networks"] },
      { skill: "aptitude", label: "Aptitude & reasoning", required: 70, weight: 15, practiceSubjects: ["aptitude", "reasoning"] },
      { skill: "communication", label: "Communication", required: 70, weight: 20, practiceSubjects: [] },
    ],
  },
];

export function findCompanyRole(key) {
  return COMPANY_ROLE_PROFILES.find((role) => role.key === key) || null;
}

export function getGapPriority(gap, weight) {
  if (gap === null) return weight >= 25 ? "HIGH" : "MEDIUM";
  if (gap >= 25) return "HIGH";
  if (gap >= 10) return "MEDIUM";
  return "LOW";
}
