This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

Run the available project tests with:

```bash
npm test
```

## Module 2: Technical Assessment

The student-facing `/assessment` route uses a validated branch-specific question set, generating one with Gemini when no suitable cached set is available. Validated sets are cached by branch and blueprint version for reuse; a student's recent question wording is excluded when selecting a cached set where possible. This improves start times for later students but means students in the same branch can encounter the same questions. Validated questions and private answer keys are saved in each attempt snapshot so refreshes do not change the exam. Correct answers, explanations, and private coding tests are kept out of the active exam response. A 60-minute deadline is created only after generation and validation complete. MCQ scoring and result analysis are calculated server-side. The current branch blueprint definitions are version 2; seeding inserts the new versions without rewriting older snapshots and deactivates prior active versions.

Apply pending migrations without resetting the database:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run module2:seed-blueprints
```

For Neon, run Prisma migrations with a direct, non-pooled PostgreSQL connection; pooled endpoints may time out while acquiring Prisma's advisory migration lock. If the configured `DATABASE_URL` is a pooled URL, temporarily use the provider's direct connection URL for migration commands, then restore the runtime URL. Do not bypass Prisma's migration lock or mark an unapplied migration as applied.

Configure the server-side `GEMINI_API_KEY` in `.env.local`. Text and structured AI use the Gemini Interactions API and `GEMINI_MODEL` (default `gemini-3.5-flash-lite`); JSON responses are validated by the active feature schemas. Run `npm run gemini:diagnostic` to make a small live provider check. The assessment uses validated cached questions when available and reduces provider calls by batching questions. Coding execution uses `JUDGE0_API_URL` (defaults to `https://ce.judge0.com`) and the optional `JUDGE0_API_KEY`; submitted code and test inputs are sent to that service, and no student code is executed in the Next.js server. The 60-minute deadline and answer writes are enforced on the server with no post-deadline write grace.

Assessment entry requires camera and microphone permission, a desktop/laptop browser, and fullscreen. Browser visibility, focus, fullscreen, clipboard, connection, and camera/microphone interruption events are logged. The first focus, fullscreen, or clipboard event warns; a repeated event ends the attempt and applies a 10-minute retake cooldown. Camera/microphone loss or a mobile user-agent ends the attempt immediately with a device-detected alert. These browser checks are not tamper-proof: they flag a mobile browser/device, but cannot detect a separate phone in the room; a browser camera cannot provide 360-degree room coverage. Camera and microphone streams remain local and are not recorded or uploaded. The countdown uses a database-synchronized clock and derives remaining time from the fixed server deadline.

Per-question time is client-reported only while the question is visible, the window is focused, and fullscreen is active; it is diagnostic, not tamper-proof. Generated and cached assessment questions must use Indian rupees (₹/INR) for money and reject foreign currency references. Branch/blueprint leaderboards are opt-in, anonymous, and show the top 10 eligible students ranked by score then completion time. Integrity-terminated attempts are excluded.

Dashboard salary values and paid course prices are displayed in INR. Newly generated values are requested in INR; legacy USD values are converted using `NEXT_PUBLIC_USD_TO_INR_RATE`. Configure that public environment variable with the current USD-to-INR rate from your chosen exchange-rate source. If it is unset or invalid, legacy USD amounts are shown as unavailable rather than mislabeled as rupees.

The configured AI provider receives the student's assessment branch, topic blueprint, and question wording from up to three prior attempts in that branch to reduce repeats; profile data and answers are not included.

Gemini output is checked for schema, branch-topic fit, exact section counts, difficulty mix, marks, answer format, and duplicates. These checks do not prove factual correctness; question explanations should be reviewed carefully by students and scores are diagnostic rather than placement guarantees. AI generation happens only when the student explicitly starts an assessment. No question bank or admin approval workflow is used by the new assessment route.

Historical `Assessment` and `AssessmentQuestion` tables are retained for compatibility and existing data. The new workflow does not read from them. The short-lived `Module2Question` foundation table is dropped by an additive cleanup migration because no questions were generated into it. Do not run `prisma migrate reset`.

## Module 5: Career preparation

The authenticated `/skill-development` workflow starts from the student's current Module 4 career and stores separate, versioned preparation plans, scheduled learning tasks, and daily/weekly assessment attempts. Setup includes timeline, daily hours, study days, start date, current skill level, and learning preference. The plan snapshots career skill evidence and trusted career resources; missing evidence remains unassessed rather than being treated as a skill gap.

Plan creation archives the previous active plan without deleting its history. Task progress, answers, grades, feedback, and assessment attempts are stored in PostgreSQL and read through owner-scoped API queries. Daily topic practice contains 30 varied questions shown one at a time with a question navigator; weekly reviews remain short. These deterministic checks are introductory practice only; they do not execute or automatically grade coding exercises or certify skill mastery.

Before applying pending migrations to a development database, confirm both database URLs target that environment, then inspect status and deploy the additive migration:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

Never run `prisma migrate reset` to enable Module 5. Existing saved plans and attempts are retained when the student changes their selected career or creates a new plan version.

## Module 6: AI mock interview

The separate authenticated `/mock-interview` experience is not the legacy `/interview` quiz. It uses the student's current Module 4 career and can link to an owned Module 5 plan. Setup includes interview type, focus, difficulty, and duration. When Tavus is configured, the session uses its live CVI room for spoken questions, contextual follow-ups, and a rendered video avatar. The session's final Tavus transcript is matched to planned questions and saved with practice feedback in owner-scoped records before the report is finalized. Text practice uses the shared Gemini provider. Gemini Live audio-only interviews use a separate Live API protocol.

Configure `GEMINI_API_KEY` for server-side text/structured AI and Gemini Live audio, plus `TAVUS_API_KEY` and `TAVUS_PAL_ID` for live video interviews. Restart the server after changing environment variables. The Tavus PAL must be enabled for CVI and have its interviewer face configured. Never send API keys in chat or expose them to the browser. Tavus receives live audio/video to provide the conversation; Nexora explicitly disables Tavus recording and persists the returned transcript and feedback, not raw media. If the embedded Tavus room stays blank, open it using the session's **Open Tavus interview in a new tab** link. Gemini Live uses a short-lived token for the authenticated owner's active session; its permanent API key is never sent to the browser. The old optional local camera preview is not a rendered avatar. Browser-interruption integrity monitoring is not implemented.

Tavus conversation metadata is kept in the existing private `profileSnapshot` JSON field, so no schema migration is required and existing session records are preserved. The metadata is excluded from the API's public profile snapshot. A live Tavus conversation, spoken follow-up, and final report require valid local Tavus credentials, a configured CVI PAL, and available Tavus service access. Automated tests validate request construction and transcript mapping but do not simulate a real provider response.

Questions start from a bounded role-aware prompt bank; when an AI provider is configured, it adapts the outline and validates the result for exact IDs, count, and shape. Invalid or unavailable question generation falls back to the bank. Per-answer feedback is for practice and is not a hiring decision. Coding submissions are not executed.

The Module 6 migration is additive: the original migration creates its two tables; the Tavus migration adds only nullable conversation fields and a unique index, preserving existing records. Never run `prisma migrate reset`. The dashboard, header, and Module 5 plan/progress actions open `/mock-interview`; the legacy Interview Prep code remains separate. Gemini Live model, SDK, ephemeral-token, and WebSocket details are documented at [Google AI Live API](https://ai.google.dev/gemini-api/docs/live) and [ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Career-interest assessment (Module 3)

The authenticated `/career-interests` flow generates a balanced 24-question RIASEC questionnaire (four questions per dimension) when a student explicitly starts. Answers can be saved and resumed without a timer. The server validates ownership and answer values, requires every answer before submission, and calculates all six means and response-scale percentages using the fixed scoring algorithm in `lib/module3/riasec-scoring.js`. The configured AI provider can generate question statements and explain completed results, but it never computes or changes scores. A deterministic explanation is persisted before optional AI interpretation.

Module 3 uses its own additive `RiasecAttempt` table and migration, separate from the existing Career Discovery workflow. Career recommendations may use the latest completed RIASEC profile as optional context; it does not override a student's goals or skills. The migration `prisma/migrations/20261019220000_create_riasec_module3` has been applied to the configured database; deploy pending Prisma migrations for other environments before enabling the new routes there.

Text and structured AI features use the shared server-side provider service in `lib/ai/`, routed to the configured Gemini model through the Interactions API. Requests use bounded retries, a 60-second timeout, strict application-level JSON parsing, and the existing feature validators. Module 2 batches questions to reduce calls and will only reuse cached sets that pass the active blueprint checks. Gemini Live audio token/WebSocket flows and Tavus video interviews remain separate provider-specific protocols; both Gemini APIs use the server-side `GEMINI_API_KEY`. Keep all keys server-side, never commit them, and restart the development server after changing environment variables.
