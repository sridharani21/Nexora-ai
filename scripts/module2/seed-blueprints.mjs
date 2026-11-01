import "dotenv/config";
import { PrismaClient } from "../../lib/generated/prisma/index.js";
import { MODULE2_BLUEPRINTS } from "../../lib/module2/blueprints.js";

const prisma = new PrismaClient();

try {
  const { createdOrActivated, deactivated } = await prisma.$transaction(async (transaction) => {
    let inserted = 0;
    let disabled = 0;
    for (const blueprint of MODULE2_BLUEPRINTS) {
      disabled += await transaction.$executeRaw`
        UPDATE "Module2Blueprint"
        SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "branch" = ${blueprint.branch}
          AND "version" < ${blueprint.version}
          AND "isActive" = true
      `;
      inserted += await transaction.$executeRaw`
        INSERT INTO "Module2Blueprint" (
          "id", "branch", "version", "durationMinutes", "maxMarks",
          "sections", "scoringPolicy", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${`module2_blueprint_${blueprint.branch.toLocaleLowerCase()}_v${blueprint.version}`},
          ${blueprint.branch}, ${blueprint.version}, ${blueprint.durationMinutes}, ${blueprint.maxMarks},
          ${JSON.stringify(blueprint.sections)}::jsonb, ${JSON.stringify(blueprint.scoringPolicy)}::jsonb,
          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("branch", "version") DO UPDATE
        SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
      `;
    }
    return { createdOrActivated: inserted, deactivated: disabled };
  });
  console.log(JSON.stringify({
    configuredBlueprints: MODULE2_BLUEPRINTS.length,
    createdOrActivated,
    deactivated,
  }, null, 2));
} catch (error) {
  console.error(`Module 2 blueprint seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
