export const MODULE4_EVIDENCE_VERSION = "career-evidence-v1";
export const MODULE4_BASELINE_VERSION = "transparent-evidence-baseline-v2";
export const MODULE4_MATCH_WEIGHTS = Object.freeze({
  technicalAlignment: 0.5,
  interestAlignment: 0.3,
  profileAlignment: 0.2,
});
export const MODULE4_REQUIRED_RIASEC_DIMENSIONS = Object.freeze(["R", "I", "A", "S", "E", "C"]);

export function getModule4Readiness(student) {
  const missing = [];
  if (!student?.profileReady) {
    missing.push({
      key: "profile",
      label: "Student profile",
      href: "/student-profile",
      reason: "Add a usable academic field or skills record to your profile.",
    });
  }
  if (!student?.assessment?.completed) {
    missing.push({
      key: "assessment",
      label: "Technical assessment",
      href: "/assessment",
      reason: student?.assessment?.status === "invalid"
        ? "The latest submitted result is incomplete or invalid; retake the assessment."
        : "Complete and submit Module 2 to include technical evidence.",
    });
  }
  if (!student?.riasec?.completed) {
    missing.push({
      key: "riasec",
      label: "RIASEC assessment",
      href: "/career-interests",
      reason: student?.riasec?.status === "invalid"
        ? "The latest RIASEC scores are incomplete or invalid; retake the assessment."
        : "Complete Module 3 to include the six interest dimensions.",
    });
  }
  return { eligible: missing.length === 0, missing };
}

export function normalizeEvidenceText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const SKILL_ALIASES = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["database", "databases", "sql", "postgresql", "postgres"],
  ["structured query language", "sql"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["amazon web services", "aws"],
];

function equivalentSkill(left, right) {
  const a = normalizeEvidenceText(left);
  const b = normalizeEvidenceText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  return SKILL_ALIASES.some((aliases) => aliases.includes(a) && aliases.includes(b));
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function topicRelated(topic, expectedTopics) {
  const normalized = normalizeEvidenceText(topic);
  return expectedTopics.some((expected) => {
    const candidate = normalizeEvidenceText(expected);
    if (!normalized || !candidate) return false;
    return normalized === candidate ||
      (candidate.length > 4 && normalized.includes(candidate)) ||
      (normalized.length > 4 && candidate.includes(normalized));
  });
}

export function buildCareerEvidence(career, student) {
  const skills = list(career.skills);
  const knownSkills = list(student.skills);
  const projectText = normalizeEvidenceText(list(student.projects).map((project) => [
    project?.title, project?.description, project?.technologies, project?.role, project?.outcomes,
  ].join(" ")).join(" "));
  const projectTechnologies = list(student.projects).flatMap((project) => (
    String(project?.technologies || "").split(/[,;|]/).map((technology) => technology.trim())
  ));
  const experienceText = normalizeEvidenceText(list(student.experience).map((item) => [
    item?.title, item?.organization, item?.responsibilities, item?.technologies,
  ].join(" ")).join(" "));
  const certificationText = normalizeEvidenceText(list(student.certifications).map((item) => item?.name).join(" "));
  const assessedTopics = list(student.assessment?.topics)
    .filter((topic) => Number.isFinite(topic?.percentage) && topic.percentage >= 0 && topic.percentage <= 100)
    .map((topic) => ({ name: topic.topic || topic.name, percentage: topic.percentage }))
    .filter((topic) => typeof topic.name === "string" && topic.name.trim());
  const profileMatches = [];
  const projectMatches = [];
  const assessmentMatches = [];
  const unknownSkills = [];
  const developmentSkills = [];
  const skillEvidence = [];

  for (const skill of skills) {
    const inProfile = knownSkills.find((item) => equivalentSkill(item.name || item, skill.name));
    const normalizedSkill = normalizeEvidenceText(skill.name);
    const inProject = normalizedSkill.length > 3 && (
      projectText.includes(normalizedSkill) ||
      projectTechnologies.some((technology) => equivalentSkill(technology, skill.name))
    );
    const inExperience = normalizedSkill.length > 3 && experienceText.includes(normalizedSkill);
    const inCertification = normalizedSkill.length > 3 && certificationText.includes(normalizedSkill);
    const topicMatches = assessedTopics.filter((topic) => (
      list(skill.evidenceTopics).some((expected) => topicRelated(topic.name, [expected]))
    ));

    if (inProfile) {
      profileMatches.push({
        skill: skill.name,
        evidence: inProfile.source === "resume" ? "Mentioned in resume-derived profile" : "Mentioned in student profile",
      });
    }
    const projectEvidence = [];
    if (inProject || inExperience || inCertification) {
      projectEvidence.push(
        inProject && "Project details",
        inExperience && "Experience details",
        inCertification && "Certification details",
      );
      projectMatches.push({ skill: skill.name, evidence: projectEvidence.filter(Boolean) });
    }
    const matchedTopics = [];
    for (const topic of topicMatches) {
      matchedTopics.push(topic);
      assessmentMatches.push({
        skill: skill.name,
        topic: topic.name,
        result: topic.percentage >= 60 ? "Positive topic signal" : "Topic to strengthen",
        percentage: topic.percentage,
      });
    }
    const meanAssessment = topicMatches.length
      ? topicMatches.reduce((sum, topic) => sum + topic.percentage, 0) / topicMatches.length
      : null;
    const status = meanAssessment !== null
      ? meanAssessment >= 80
        ? "Demonstrated"
        : meanAssessment >= 60 ? "Developing" : "Gap identified"
      : projectEvidence.length
        ? "Demonstrated"
        : inProfile ? "Self-reported" : "Not yet assessed";
    if (status === "Developing" || status === "Gap identified") developmentSkills.push(skill.name);
    if (status === "Not yet assessed") unknownSkills.push(skill.name);
    skillEvidence.push({
      skill: skill.name,
      importance: skill.importance || "related",
      category: skill.category || "technical",
      status,
      evidence: [
        ...(inProfile ? [inProfile.source === "resume" ? "Resume-derived profile mention" : "Student profile mention"] : []),
        ...projectEvidence,
        ...matchedTopics.map((topic) => `Module 2: ${topic.name} (${topic.percentage}%)`),
      ],
      assessmentPercentage: meanAssessment,
      recommendedAction: status === "Developing" || status === "Gap identified"
        ? `Practise ${skill.name} with a small career-relevant task.`
        : status === "Not yet assessed"
          ? `Gather a project or assessment example for ${skill.name} before judging proficiency.`
          : null,
      progressEvidence: `Record a project, practical exercise, or relevant assessment result demonstrating ${skill.name}.`,
    });
  }

  const interestDimensions = list(career.interestDimensions);
  const studentInterestCode = student.riasec?.interestCode || null;
  const studentInterestSet = new Set(studentInterestCode ? studentInterestCode.split("-") : []);
  const interestScores = student.riasec?.completed ? student.riasec.scores || {} : {};
  const validInterestScores = MODULE4_REQUIRED_RIASEC_DIMENSIONS.filter((dimension) => (
    Number.isFinite(interestScores[dimension]?.mean) &&
    interestScores[dimension].mean >= 1 &&
    interestScores[dimension].mean <= 5
  ));
  const interestMatches = student.riasec?.completed
    ? interestDimensions.filter((dimension) => validInterestScores.includes(dimension) && studentInterestSet.has(dimension))
    : [];
  const interestScore = interestDimensions.length > 0 &&
    interestDimensions.every((dimension) => validInterestScores.includes(dimension))
    ? Math.round(
      (interestDimensions.reduce((sum, dimension) => sum + interestScores[dimension].mean, 0) /
        interestDimensions.length - 1) / 4 * 100,
    )
    : null;
  const importanceWeight = (skill) => skill.importance === "core" ? 1.5 : skill.importance === "preferred" ? 0.5 : 1;
  const assessedRequirements = skills.flatMap((skill) => {
    const matches = assessedTopics.filter((topic) => (
      list(skill.evidenceTopics).some((expected) => topicRelated(topic.name, [expected]))
    ));
    return matches.length
      ? [{ value: matches.reduce((sum, item) => sum + item.percentage, 0) / matches.length, weight: importanceWeight(skill) }]
      : [];
  });
  const profileEvidenceSkills = new Set([
    ...profileMatches.map((item) => item.skill),
    ...projectMatches.map((item) => item.skill),
  ]);
  const profileAlignment = student.profileReady && skills.length > 0
    ? Math.round(
      skills.reduce((sum, skill) => sum + (profileEvidenceSkills.has(skill.name) ? importanceWeight(skill) : 0), 0) /
      skills.reduce((sum, skill) => sum + importanceWeight(skill), 0) * 100,
    )
    : null;
  const dimensionScores = {
    technicalAlignment: assessedRequirements.length
      ? Math.round(assessedRequirements.reduce((sum, item) => sum + item.value * item.weight, 0) /
        assessedRequirements.reduce((sum, item) => sum + item.weight, 0))
      : null,
    interestAlignment: interestScore,
    profileAlignment,
  };
  const availableDimensions = Object.entries(dimensionScores).filter(([, score]) => score !== null);
  const effectiveWeightTotal = availableDimensions.reduce((sum, [dimension]) => sum + MODULE4_MATCH_WEIGHTS[dimension], 0);
  const matchScore = effectiveWeightTotal > 0
    ? Math.round(availableDimensions.reduce((sum, [dimension, score]) => (
      sum + score * MODULE4_MATCH_WEIGHTS[dimension] / effectiveWeightTotal
    ), 0))
    : null;
  const preferenceText = normalizeEvidenceText([
    ...list(student.preferences?.roles),
    ...list(student.preferences?.domains),
    ...list(student.preferences?.interests),
    student.preferences?.goals,
  ].join(" "));
  const preferenceMatch = Boolean(preferenceText && (
    preferenceText.includes(normalizeEvidenceText(career.title)) ||
    preferenceText.includes(normalizeEvidenceText(career.family)) ||
    preferenceText.includes(normalizeEvidenceText(career.domain))
  ));

  const signals = [];
  if (profileMatches.length) signals.push("Profile skills");
  if (projectMatches.length) signals.push("Projects, experience, or certifications");
  if (assessmentMatches.length) signals.push("Technical assessment");
  if (interestMatches.length) signals.push("RIASEC interests");
  if (preferenceMatch) signals.push("Career preferences");

  return {
    signals,
    profileMatches,
    projectMatches,
    assessmentMatches,
    unknownSkills,
    developmentSkills,
    skillEvidence,
    matchScore,
    dimensionScores,
    scoring: {
      method: MODULE4_BASELINE_VERSION,
      weights: Object.fromEntries(availableDimensions.map(([dimension]) => [
        dimension,
        Number((MODULE4_MATCH_WEIGHTS[dimension] / effectiveWeightTotal).toFixed(4)),
      ])),
      missingDimensions: Object.entries(dimensionScores)
        .filter(([, score]) => score === null)
        .map(([dimension]) => dimension),
      interpretation: "A career exploration score, not a probability of employment or a measure of ability.",
    },
    interestAlignment: student.riasec?.completed
      ? { status: interestMatches.length ? "Aligned interests" : "No leading-interest overlap", dimensions: interestMatches, code: studentInterestCode, score: interestScore }
      : { status: "RIASEC assessment not completed", dimensions: [], code: null },
    technicalAssessment: student.assessment?.completed
      ? {
        status: assessmentMatches.length ? "Relevant assessed topics" : "Completed assessment; no directly mapped topic",
        matches: assessmentMatches,
      }
      : { status: "Technical assessment not completed", matches: [] },
    preferenceMatch,
  };
}

export function rankCareerOptions(careers, student) {
  const options = careers.map((career) => ({ ...career, evidence: buildCareerEvidence(career, student) }));

  options.sort((left, right) => (
    (right.evidence.matchScore ?? -1) - (left.evidence.matchScore ?? -1) ||
    right.evidence.signals.length - left.evidence.signals.length ||
    right.evidence.profileMatches.length - left.evidence.profileMatches.length ||
    right.evidence.projectMatches.length - left.evidence.projectMatches.length ||
    right.evidence.assessmentMatches.length - left.evidence.assessmentMatches.length ||
    (left.title < right.title ? -1 : left.title > right.title ? 1 : 0)
  ));

  return {
    method: MODULE4_BASELINE_VERSION,
    options,
  };
}

export function buildFallbackExplanation(career, evidence) {
  const signals = evidence.signals.length
    ? `Relevant available evidence: ${evidence.signals.join(", ").toLowerCase()}.`
    : "There is not enough profile or assessment evidence to call this a personalised match yet; treat it as an option to explore.";
  const skills = evidence.profileMatches.map((match) => match.skill);
  const strengths = skills.length
    ? `Skills you have listed that relate to this path: ${skills.join(", ")}.`
    : "No directly matching skills were found in the information currently available.";
  const interests = evidence.interestAlignment.dimensions.length
    ? `Your leading RIASEC interests include ${evidence.interestAlignment.dimensions.join(", ")}, which are linked to this career profile as an exploration signal, not an ability measure.`
    : evidence.interestAlignment.status;
  const assessed = evidence.assessmentMatches.length
    ? ` Assessment evidence: ${evidence.assessmentMatches.map((match) => `${match.topic} (${match.percentage}%)`).join(", ")}.`
    : " No directly mapped technical assessment evidence was found.";
  const gaps = evidence.developmentSkills.length
    ? ` Skills not yet evidenced in the available information: ${evidence.developmentSkills.join(", ")}.`
    : " Missing evidence should not be treated as proof that a skill is absent.";
  const project = list(career.projectIdeas)[0];
  const nextStep = project ? ` A practical exploration idea is: ${project}.` : "";
  return `${career.title}: ${signals} ${strengths} ${assessed} ${interests}${gaps}${nextStep} Review the role responsibilities and use this information to decide what you would like to explore next.`;
}