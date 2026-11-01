import assert from "node:assert/strict";
import test from "node:test";
import { MODULE4_CAREER_CATALOG } from "./career-catalog.js";

test("every active career has three usable competency stages", () => {
  const levels = ["beginner", "intermediate", "advanced"];
  assert.equal(MODULE4_CAREER_CATALOG.length, 17);

  for (const career of MODULE4_CAREER_CATALOG) {
    for (const level of levels) {
      const stage = career.competencyProgression[level];
      assert.ok(stage, `${career.slug} is missing ${level} progression`);
      assert.ok(stage.competencies.length > 0, `${career.slug} has no ${level} competencies`);
      assert.ok(stage.project, `${career.slug} has no ${level} portfolio example`);
    }
  }
});

test("every career has at least one verified learning resource with complete metadata", () => {
  for (const career of MODULE4_CAREER_CATALOG) {
    assert.ok(career.learningResources.length > 0, `${career.slug} has no learning resource`);
    for (const resource of career.learningResources) {
      assert.match(resource.url, /^https:\/\/\S+$/);
      assert.ok(resource.provider);
      assert.ok(resource.contentType);
      assert.ok(resource.relatedSkill);
      assert.ok(resource.cost);
      assert.match(resource.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
    }
  }
});

test("career profiles have unique routes and comparable evidence fields", () => {
  const slugs = MODULE4_CAREER_CATALOG.map((career) => career.slug);
  assert.equal(new Set(slugs).size, slugs.length);

  const knownSlugs = new Set(slugs);
  for (const career of MODULE4_CAREER_CATALOG) {
    assert.ok(career.title.trim(), `${career.slug} is missing a title`);
    assert.ok(career.responsibilities.length, `${career.slug} is missing responsibilities`);
    assert.ok(career.skills.length, `${career.slug} is missing profiled skills`);
    assert.ok(career.projectIdeas.length, `${career.slug} is missing project ideas`);
    assert.ok(career.adjacentSlugs.every((slug) => knownSlugs.has(slug)), `${career.slug} links to an unknown adjacent career`);
  }
});
