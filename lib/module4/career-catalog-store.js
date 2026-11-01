import { randomUUID } from "node:crypto";
import { db } from "@/lib/prisma";
import { MODULE4_CAREER_CATALOG, MODULE4_REVIEWED_AT } from "./career-catalog.js";

let catalogInitializationPromise;

export function ensureModule4CareerCatalog() {
  if (!catalogInitializationPromise) {
    catalogInitializationPromise = seedModule4CareerCatalog().catch((error) => {
      catalogInitializationPromise = undefined;
      throw error;
    });
  }
  return catalogInitializationPromise;
}

async function seedModule4CareerCatalog() {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('nexora-module4-career-catalog'))::text AS "lock"`;
    const careers = MODULE4_CAREER_CATALOG.map((career) => ({
      id: randomUUID(),
      slug: career.slug,
      title: career.title,
      family: career.family,
      domain: career.domain,
      summary: career.summary,
      description: career.description,
      responsibilities: career.responsibilities,
      workEnvironments: career.workEnvironments,
      entryLevelRoles: career.entryLevelRoles,
      tools: career.tools,
      educationThemes: career.educationThemes,
      projectIdeas: career.projectIdeas,
      learningResources: career.learningResources || [],
      competencyProgression: career.competencyProgression,
      qualifications: career.qualifications,
      interestDimensions: career.interestDimensions,
      technicalTopics: career.technicalTopics,
      adjacentSlugs: career.adjacentSlugs,
      sources: career.sources,
      reviewedAt: MODULE4_REVIEWED_AT,
    }));
    await tx.$executeRaw`
      INSERT INTO "Module4Career"
        ("id", "slug", "title", "family", "domain", "summary", "description",
         "responsibilities", "workEnvironments", "entryLevelRoles", "tools",
         "educationThemes", "projectIdeas", "learningResources", "competencyProgression", "qualifications", "interestDimensions",
         "technicalTopics", "adjacentSlugs", "sources", "reviewedAt", "isActive",
         "createdAt", "updatedAt")
      SELECT
        c."id", c."slug", c."title", c."family", c."domain", c."summary", c."description",
        c."responsibilities", c."workEnvironments", c."entryLevelRoles", c."tools",
        c."educationThemes", c."projectIdeas", c."learningResources", c."competencyProgression", c."qualifications",
        ARRAY(SELECT jsonb_array_elements_text(c."interestDimensions")),
        ARRAY(SELECT jsonb_array_elements_text(c."technicalTopics")),
        ARRAY(SELECT jsonb_array_elements_text(c."adjacentSlugs")),
        c."sources", c."reviewedAt"::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(careers)}::jsonb) AS c(
        "id" text, "slug" text, "title" text, "family" text, "domain" text,
        "summary" text, "description" text, "responsibilities" jsonb,
        "workEnvironments" jsonb, "entryLevelRoles" jsonb, "tools" jsonb,
        "educationThemes" jsonb, "projectIdeas" jsonb, "learningResources" jsonb, "competencyProgression" jsonb, "qualifications" jsonb,
        "interestDimensions" jsonb, "technicalTopics" jsonb, "adjacentSlugs" jsonb,
        "sources" jsonb, "reviewedAt" text
      )
      ON CONFLICT ("slug") DO UPDATE SET
        "title" = EXCLUDED."title",
        "family" = EXCLUDED."family",
        "domain" = EXCLUDED."domain",
        "summary" = EXCLUDED."summary",
        "description" = EXCLUDED."description",
        "responsibilities" = EXCLUDED."responsibilities",
        "workEnvironments" = EXCLUDED."workEnvironments",
        "entryLevelRoles" = EXCLUDED."entryLevelRoles",
        "tools" = EXCLUDED."tools",
        "educationThemes" = EXCLUDED."educationThemes",
        "projectIdeas" = EXCLUDED."projectIdeas",
        "learningResources" = EXCLUDED."learningResources",
        "competencyProgression" = EXCLUDED."competencyProgression",
        "qualifications" = EXCLUDED."qualifications",
        "interestDimensions" = EXCLUDED."interestDimensions",
        "technicalTopics" = EXCLUDED."technicalTopics",
        "adjacentSlugs" = EXCLUDED."adjacentSlugs",
        "sources" = EXCLUDED."sources",
        "reviewedAt" = EXCLUDED."reviewedAt",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE ("Module4Career"."title", "Module4Career"."family", "Module4Career"."domain",
        "Module4Career"."summary", "Module4Career"."description", "Module4Career"."responsibilities",
        "Module4Career"."workEnvironments", "Module4Career"."entryLevelRoles", "Module4Career"."tools",
        "Module4Career"."educationThemes", "Module4Career"."projectIdeas", "Module4Career"."learningResources",
        "Module4Career"."competencyProgression",
        "Module4Career"."qualifications", "Module4Career"."interestDimensions", "Module4Career"."technicalTopics",
        "Module4Career"."adjacentSlugs", "Module4Career"."sources", "Module4Career"."reviewedAt")
      IS DISTINCT FROM
        (EXCLUDED."title", EXCLUDED."family", EXCLUDED."domain", EXCLUDED."summary",
        EXCLUDED."description", EXCLUDED."responsibilities", EXCLUDED."workEnvironments",
        EXCLUDED."entryLevelRoles", EXCLUDED."tools", EXCLUDED."educationThemes", EXCLUDED."projectIdeas",
        EXCLUDED."learningResources", EXCLUDED."competencyProgression", EXCLUDED."qualifications", EXCLUDED."interestDimensions",
        EXCLUDED."technicalTopics", EXCLUDED."adjacentSlugs", EXCLUDED."sources", EXCLUDED."reviewedAt")
    `;
    const skillRows = MODULE4_CAREER_CATALOG.flatMap((career) => career.skills.map((skill) => ({
      id: randomUUID(),
      careerSlug: career.slug,
      skillName: skill.name,
      normalizedName: skill.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim().replace(/\s+/g, " "),
      importance: skill.importance,
      category: skill.category,
      evidenceTopics: skill.evidenceTopics,
      sourceLabel: skill.sourceLabel,
    })));
    await tx.$executeRaw`
      INSERT INTO "Module4CareerSkill"
        ("id", "careerId", "skillName", "normalizedName", "importance", "category", "evidenceTopics", "sourceLabel", "createdAt")
      SELECT
        s."id", c."id", s."skillName", s."normalizedName", s."importance", s."category",
        ARRAY(SELECT jsonb_array_elements_text(s."evidenceTopics")), s."sourceLabel", CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(skillRows)}::jsonb) AS s(
        "id" text, "careerSlug" text, "skillName" text, "normalizedName" text,
        "importance" text, "category" text, "evidenceTopics" jsonb, "sourceLabel" text
      )
      JOIN "Module4Career" c ON c."slug" = s."careerSlug"
      ON CONFLICT ("careerId", "normalizedName") DO UPDATE SET
        "skillName" = EXCLUDED."skillName",
        "importance" = EXCLUDED."importance",
        "category" = EXCLUDED."category",
        "evidenceTopics" = EXCLUDED."evidenceTopics",
        "sourceLabel" = EXCLUDED."sourceLabel"
    `;
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function getModule4CareerCatalog() {
  await ensureModule4CareerCatalog();
  const careers = await db.$queryRaw`
    SELECT c."id", c."slug", c."title", c."family", c."domain", c."summary",
      c."description", c."responsibilities", c."workEnvironments", c."entryLevelRoles",
      c."tools", c."educationThemes", c."projectIdeas", c."learningResources", c."competencyProgression",
      c."qualifications", c."interestDimensions", c."technicalTopics", c."adjacentSlugs",
      c."sources", c."reviewedAt", c."isActive", c."createdAt", c."updatedAt",
      COALESCE(jsonb_agg(jsonb_build_object(
        'name', s."skillName",
        'importance', s."importance",
        'category', s."category",
        'evidenceTopics', to_jsonb(s."evidenceTopics"),
        'sourceLabel', s."sourceLabel"
      )) FILTER (WHERE s."id" IS NOT NULL), '[]'::jsonb) AS "skills"
    FROM "Module4Career" c
    LEFT JOIN "Module4CareerSkill" s ON s."careerId" = c."id"
    WHERE c."isActive" = true
    GROUP BY c."id"
    ORDER BY c."family", c."title"
  `;
  return careers;
}
