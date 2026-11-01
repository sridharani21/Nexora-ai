# Module 4: Career Explorer

Module 4 uses a deterministic, evidence-based ranking baseline. It does not train, call, or require a machine-learning model.

## Recommendation behavior

Career match scores combine the available evidence dimensions using provisional weights:

- Technical alignment from mapped Module 2 assessment topics: 0.50
- Interest alignment from the configured RIASEC dimensions: 0.30
- Profile alignment from listed skills, projects, and experience: 0.20

If a dimension cannot be calculated, its weight is excluded and the remaining weights are normalized. Missing evidence is not treated as a zero or proof that a student lacks a skill. Ranking ties are resolved from available evidence counts and then career title. These scores are exploration aids, not employment probabilities or measures of ability.

Personalized recommendations require a usable student profile and valid completed Module 2 and Module 3 results. Gemini may provide catalogue-grounded explanations when configured; explanation generation does not affect recommendation scores or order, and a deterministic catalogue explanation is used when Gemini is unavailable.

Career saves, private notes, current goals, and ended goal history are scoped to the authenticated student. The Module 5 handoff verifies both the selected career and current goal belong to that student, then snapshots the catalogue's skills, competency progression, resources, and available evidence into a separate versioned preparation plan.

The Module 5 workflow is served at `/skill-development/setup` and persists plans, scheduled tasks, and assessment attempts in its dedicated Prisma models. To inspect and apply its pending additive migration, first confirm `DATABASE_URL` and `DIRECT_URL` point to the intended development database, then run `npx prisma migrate status` and `npx prisma migrate deploy`. Never use `prisma migrate reset` for this workflow. Daily and weekly checks are deterministic knowledge reviews; they do not execute or automatically grade coding exercises.

The database retains legacy recommendation version columns for compatibility with existing migrations and historical runs. New runs record the deterministic ranking and evidence versions there; those columns do not indicate a model dependency.
