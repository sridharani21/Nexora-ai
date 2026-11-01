import { z } from "zod";

export const MODULE2_BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECHANICAL", "CIVIL"];
export const MODULE2_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
export const MODULE2_BLUEPRINT_VERSION = 3;

const difficultyDistributionSchema = z.object({
  EASY: z.number().int().nonnegative(),
  MEDIUM: z.number().int().nonnegative(),
  HARD: z.number().int().nonnegative(),
}).strict();

const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  questionType: z.enum(["MCQ", "CODING"]),
  questionCount: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  marks: z.number().positive(),
  topics: z.array(z.string().min(1)).min(1),
  skills: z.array(z.string().min(1)).min(1),
  learningObjectives: z.array(z.string().min(1)).min(1),
  difficultyDistribution: difficultyDistributionSchema,
}).strict();

export const assessmentBlueprintSchema = z.object({
  branch: z.enum(MODULE2_BRANCHES),
  version: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  durationSeconds: z.number().int().positive().optional(),
  maxMarks: z.literal(100),
  scoringPolicy: z.object({
    version: z.number().int().positive(),
    unansweredMarks: z.literal(0),
    negativeMarking: z.boolean(),
    codingScoring: z.enum(["PASSED_TEST_CASE_RATIO", "NOT_APPLICABLE"]),
  }).strict(),
  sections: z.array(sectionSchema).min(1),
}).strict().superRefine((blueprint, context) => {
  const totals = blueprint.sections.reduce((result, section) => ({
    questions: result.questions + section.questionCount,
    seconds: result.seconds + section.durationSeconds,
    marks: result.marks + section.marks,
  }), { questions: 0, seconds: 0, marks: 0 });

  if (Math.ceil(totals.seconds / 60) !== blueprint.durationMinutes) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section durations must match the configured assessment duration." });
  }
  if (blueprint.durationSeconds !== undefined && totals.seconds !== blueprint.durationSeconds) {
    context.addIssue({ code: "custom", path: ["durationSeconds"], message: "The configured assessment duration must equal its section durations." });
  }
  if (blueprint.sections.some((section) => section.durationMinutes !== Math.ceil(section.durationSeconds / 60))) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section minute labels must match their configured seconds." });
  }
  if (totals.marks !== blueprint.maxMarks) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section marks must total 100." });
  }
  if (blueprint.sections.some((section) => (
    Object.values(section.difficultyDistribution).reduce((sum, count) => sum + count, 0) !== section.questionCount
  ))) {
    context.addIssue({
      code: "custom",
      path: ["sections"],
      message: "Each section's difficulty distribution must equal its question count.",
    });
  }

  const codingSections = blueprint.sections.filter((section) => section.questionType === "CODING");
  const softwareBranch = blueprint.branch === "CSE" || blueprint.branch === "IT";
  if (softwareBranch !== (codingSections.length === 1)) {
    context.addIssue({
      code: "custom",
      path: ["sections"],
      message: "Only CSE and IT blueprints may contain coding questions.",
    });
  }
  if (softwareBranch && codingSections[0]?.questionCount !== 2) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Software assessments must contain exactly two coding questions." });
  }
  if (blueprint.branch === "CSE" && totals.questions !== 40) {
    context.addIssue({ code: "custom", path: ["sections"], message: "The CSE assessment must contain exactly 40 questions." });
  }
  if (softwareBranch) {
    const requiredSections = [
      ["aptitude-reasoning", 10, 300],
      ["programming-fundamentals", 8, 300],
      ["sql-databases", 5, 240],
      ["oop-software-engineering", 5, 180],
      ["web-rest", 5, 180],
      ["debugging-edge-cases", 5, 600],
      ["dsa-coding", 2, 1800],
    ];
    if (blueprint.sections.length !== requiredSections.length || requiredSections.some(([id, count, seconds]) => {
      const section = blueprint.sections.find((item) => item.id === id);
      return !section || section.questionCount !== count || section.durationSeconds !== seconds;
    })) {
      context.addIssue({ code: "custom", path: ["sections"], message: "Software assessment sections must match the configured 40-question blueprint." });
    }
  } else if (blueprint.sections.some((section) => (
    section.durationSeconds !== section.questionCount * 40
  ))) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Standard branch questions must receive 40 seconds each." });
  }
});

const nonComputerCore = {
  ECE: ["Digital Electronics", "Electronic Circuits", "Analog Circuits", "Signals and Systems", "Communication Systems", "Electronic Devices", "Microprocessors"],
  EEE: ["Electrical Circuits", "Electrical Machines", "Power Systems", "Control Systems", "Power Electronics"],
  MECHANICAL: ["Thermodynamics", "Fluid Mechanics", "Manufacturing", "Engineering Materials", "Strength of Materials", "Machine Design"],
  CIVIL: ["Structural Analysis", "Concrete Technology", "Geotechnical Engineering", "Surveying", "Construction Materials"],
};

const roleByBranch = {
  CSE: "Software Engineer",
  IT: "Software Developer",
  ECE: "Embedded Systems Engineer",
  EEE: "Electrical Design Engineer",
  MECHANICAL: "Mechanical Design Engineer",
  CIVIL: "Civil Design Engineer",
};

function createSection({
  id,
  name,
  questionType = "MCQ",
  questionCount,
  durationSeconds,
  marks,
  topics,
  skills,
  learningObjectives,
  difficultyDistribution,
}) {
  return {
    id,
    name,
    questionType,
    questionCount,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    marks,
    topics,
    skills,
    learningObjectives,
    difficultyDistribution,
  };
}

function createBlueprint(branch, sections, codingScoring) {
  const durationSeconds = sections.reduce((sum, section) => sum + section.durationSeconds, 0);
  return {
    branch,
    version: MODULE2_BLUEPRINT_VERSION,
    durationMinutes: Math.ceil(durationSeconds / 60),
    durationSeconds,
    maxMarks: 100,
    scoringPolicy: {
      version: 1,
      unansweredMarks: 0,
      negativeMarking: true,
      codingScoring,
    },
    sections,
  };
}

const softwareTopics = {
  programming: ["Python", "Java", "C", "C++", "Programming Fundamentals"],
  databases: ["SQL", "DBMS", "Relational Databases"],
  oop: ["Object-Oriented Programming", "Software Engineering"],
  web: ["Web Development", "REST APIs", "HTTP"],
  debugging: ["Debugging", "Edge Cases", "Testing"],
  coding: ["Data Structures and Algorithms", "Problem Solving"],
};

function createSoftwareBlueprint(branch) {
  const sections = [
    createSection({
      id: "aptitude-reasoning",
      name: "Aptitude and Logical Reasoning",
      questionCount: 10,
      durationSeconds: 300,
      marks: 15,
      topics: ["Quantitative Aptitude", "Logical Reasoning"],
      skills: ["Numerical reasoning", "Logical reasoning"],
      learningObjectives: ["Apply quantitative methods", "Recognize logical relationships"],
      difficultyDistribution: { EASY: 4, MEDIUM: 4, HARD: 2 },
    }),
    createSection({
      id: "programming-fundamentals",
      name: "Programming Fundamentals",
      questionCount: 8,
      durationSeconds: 300,
      marks: 15,
      topics: softwareTopics.programming,
      skills: ["Programming fundamentals", "Control flow", "Data representation"],
      learningObjectives: ["Trace program behavior", "Choose correct language constructs"],
      difficultyDistribution: { EASY: 2, MEDIUM: 4, HARD: 2 },
    }),
    createSection({
      id: "sql-databases",
      name: "SQL and Databases",
      questionCount: 5,
      durationSeconds: 240,
      marks: 12,
      topics: softwareTopics.databases,
      skills: ["SQL querying", "Relational data modeling"],
      learningObjectives: ["Reason about relational data", "Construct and interpret SQL operations"],
      difficultyDistribution: { EASY: 1, MEDIUM: 3, HARD: 1 },
    }),
    createSection({
      id: "oop-software-engineering",
      name: "OOP and Software Engineering",
      questionCount: 5,
      durationSeconds: 180,
      marks: 12,
      topics: softwareTopics.oop,
      skills: ["Object-oriented design", "Software engineering"],
      learningObjectives: ["Apply object-oriented principles", "Select maintainable engineering practices"],
      difficultyDistribution: { EASY: 1, MEDIUM: 3, HARD: 1 },
    }),
    createSection({
      id: "web-rest",
      name: "Web Development and REST APIs",
      questionCount: 5,
      durationSeconds: 180,
      marks: 12,
      topics: softwareTopics.web,
      skills: ["Web fundamentals", "API design"],
      learningObjectives: ["Interpret web protocols", "Apply REST conventions"],
      difficultyDistribution: { EASY: 1, MEDIUM: 3, HARD: 1 },
    }),
    createSection({
      id: "debugging-edge-cases",
      name: "Debugging and Edge Cases",
      questionCount: 5,
      durationSeconds: 600,
      marks: 14,
      topics: softwareTopics.debugging,
      skills: ["Debugging", "Test design", "Edge-case analysis"],
      learningObjectives: ["Diagnose defects", "Identify boundary conditions and useful tests"],
      difficultyDistribution: { EASY: 1, MEDIUM: 2, HARD: 2 },
    }),
    createSection({
      id: "dsa-coding",
      name: "DSA Coding",
      questionType: "CODING",
      questionCount: 2,
      durationSeconds: 1800,
      marks: 20,
      topics: softwareTopics.coding,
      skills: ["Data structures", "Algorithm design", "Implementation"],
      learningObjectives: ["Select and implement an algorithm", "Handle constraints and edge cases"],
      difficultyDistribution: { EASY: 0, MEDIUM: 1, HARD: 1 },
    }),
  ];
  return createBlueprint(branch, sections, "PASSED_TEST_CASE_RATIO");
}

function createNonComputerBlueprint(branch) {
  const core = nonComputerCore[branch];
  const questionCount = 40;
  const standardTime = 40;
  return createBlueprint(branch, [
    createSection({
      id: "aptitude-reasoning",
      name: "Aptitude and Logical Reasoning",
      questionCount: 10,
      durationSeconds: 10 * standardTime,
      marks: 20,
      topics: ["Quantitative Aptitude", "Logical Reasoning"],
      skills: ["Numerical reasoning", "Logical reasoning"],
      learningObjectives: ["Apply quantitative methods", "Recognize logical relationships"],
      difficultyDistribution: { EASY: 4, MEDIUM: 4, HARD: 2 },
    }),
    createSection({
      id: "branch-fundamentals",
      name: "Branch Fundamentals",
      questionCount: 15,
      durationSeconds: 15 * standardTime,
      marks: 40,
      topics: core,
      skills: core,
      learningObjectives: [`Apply foundational concepts from ${branch} engineering`],
      difficultyDistribution: { EASY: 3, MEDIUM: 9, HARD: 3 },
    }),
    createSection({
      id: "applied-branch-problem-solving",
      name: "Applied Branch Problem-Solving",
      questionCount: questionCount - 25,
      durationSeconds: (questionCount - 25) * standardTime,
      marks: 40,
      topics: [...core, "Applied Technical Problem-Solving"],
      skills: [...core, "Engineering problem-solving"],
      learningObjectives: [`Analyze practical scenarios using ${branch} engineering principles`],
      difficultyDistribution: { EASY: 3, MEDIUM: 9, HARD: 3 },
    }),
  ], "NOT_APPLICABLE");
}

export const MODULE2_BLUEPRINTS = Object.freeze([
  createSoftwareBlueprint("CSE"),
  createSoftwareBlueprint("IT"),
  ...Object.keys(nonComputerCore).map(createNonComputerBlueprint),
]);

export function defaultCareerRoleForBranch(branch) {
  return roleByBranch[branch] || roleByBranch.CSE;
}

export function validateBlueprint(input) {
  const parsed = assessmentBlueprintSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const durationSeconds = parsed.data.sections.reduce((sum, section) => sum + section.durationSeconds, 0);
  return { success: true, blueprint: { ...parsed.data, durationSeconds } };
}

export function normalizeBranch(value) {
  const normalized = String(value || "").normalize("NFKC").toLocaleUpperCase().replace(/[^A-Z]/g, "");
  if (["CSE", "COMPUTERSCIENCE", "COMPUTERSCIENCEENGINEERING", "COMPUTERSCIENCEANDENGINEERING"].includes(normalized)) return "CSE";
  if (["IT", "INFORMATIONTECHNOLOGY"].includes(normalized)) return "IT";
  if (["ECE", "ELECTRONICSANDCOMMUNICATION", "ELECTRONICSANDCOMMUNICATIONENGINEERING", "ELECTRONICANDCOMMUNICATION", "ELECTRONICANDCOMMUNICATIONENGINEERING"].includes(normalized)) return "ECE";
  if (["EEE", "ELECTRICALANDELECTRONICS", "ELECTRICALANDELECTRONICSENGINEERING"].includes(normalized)) return "EEE";
  if (["ME", "MECHANICAL", "MECHANICALENGINEERING"].includes(normalized)) return "MECHANICAL";
  if (["CE", "CIVIL", "CIVILENGINEERING"].includes(normalized)) return "CIVIL";
  return null;
}

export function getBlueprintForBranch(branch) {
  const normalizedBranch = normalizeBranch(branch);
  if (!normalizedBranch) return null;
  return MODULE2_BLUEPRINTS.find((blueprint) => blueprint.branch === normalizedBranch) || null;
}
