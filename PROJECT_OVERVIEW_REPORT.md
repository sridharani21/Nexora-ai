# Nexora AI: Project and Feature Overview

**Purpose:** A source-grounded description of the current Nexora AI website for project documentation and research-paper preparation.

> This report describes the implementation visible in the repository and verification results available from the development work. It is not a claim of clinical, psychometric, educational-outcome, employment-placement, or production-scale validation. Product copy and marketing figures shown on the homepage are not treated as measured research findings.

## 1. Executive summary

Nexora AI is a web-based career-development and preparation platform. Its current student journey is organized into six connected modules:

1. Student profile and resume-based data entry.
2. Branch-specific technical assessment.
3. RIASEC career-interest reflection.
4. Career exploration and career-goal selection.
5. Career preparation plans, learning resources, progress, and topic assessments.
6. Role-aware mock interviews, including a Tavus video experience when configured.

The project also contains a set of separate career tools: AI career chat, resume builder and resume analysis, cover-letter creation, roadmaps, course recommendations, job matching, and related discovery pages. These tools coexist with the six-module student journey; they are not all the same workflow.

The application uses Next.js App Router with React and JavaScript/JSX. Clerk provides sign-in and identity; Prisma and PostgreSQL provide persistence. OpenAI is used for shared text, structured-output, and image-input tasks. Gemini Live remains an optional, separate audio-interview integration. Tavus supplies the configured video-interview room, while Judge0 is used for supported code execution in Module 2. Server routes and actions enforce access checks for the newer student profile, assessment, career, learning-plan, and mock-interview flows.

## 2. Website walkthrough: homepage to student workspace

### 2.1 Public homepage

The root page (`/`) introduces Nexora AI with:

- A hero heading positioning the product as an AI career coach.
- A **Start Prep** action that sends a visitor through the authenticated preparation entry route.
- A demo button, feature cards, a four-step “How it works” section, testimonials, FAQs, and a call to action.

The public homepage describes capabilities such as career coaching, interview coaching, industry insights, resume/profile building, roadmaps, skill-gap analysis, courses, and job matching. Those descriptions are product presentation, not evidence that each capability has been independently evaluated.

The homepage currently displays figures such as “50+ Industries Covered,” “1000+ Interview Questions,” and “95% Success Rate.” The repository does not provide a study protocol, dataset, denominator, or independent evaluation substantiating those figures. They should not be quoted in a research paper as empirical results unless separately validated.

### 2.2 Sign-in, onboarding, and profile entry

Clerk handles sign-in and sign-up. Protected paths are configured in `proxy.js`. After sign-in, `/start-prep` checks for a saved student profile and routes a user either to profile entry or the dashboard.

Module 1 is `/student-profile`. The profile form includes personal details; education; skills; projects; experience; certifications; career preferences; professional links; and a professional summary. Name and email are drawn from the account, while other new-profile fields begin blank or empty. The user can enter information manually or upload a PDF/DOCX resume for extraction. Resume extraction is consent-gated, limited to 5 MB, and extracted details are presented for review before saving. The form explicitly warns users that resume-derived information can be inaccurate and should be checked.

Profile data is stored in the existing `User` and `UserProfile` records. Module 2 requires a branch in the student profile before it can begin. Profile validation includes GPA-scale, date-range, duplicate-skill, and URL checks.

## 3. The six connected modules

### Module 1 — Student Profile (`/student-profile`)

**Purpose:** Provide the student-entered or resume-derived evidence used to personalize later workflows.

**Main capabilities**

- Account name and verified account email display.
- Academic history, including branch/department and optional GPA.
- Skills, projects, work experience, and certifications.
- Career preferences, links, and goals.
- PDF/DOCX resume parsing with explicit AI-processing consent.
- Review-and-edit of extracted profile fields before persistence.
- Profile completeness indicator based on entered information.

**Data and limitations**

- Profile completeness is a form-progress aid, not an assessment of employability.
- Resume extraction uses a language model to structure text. The extraction contract instructs the model not to infer missing facts, but generated extraction still requires user verification.
- The saved profile is user-scoped. Empty fields are represented as empty values rather than presumed accomplishments.

### Module 2 — Technical Assessment (`/assessment`)

**Purpose:** Present a timed technical assessment based on a declared engineering branch.

**Current design**

- Supported blueprint branches: CSE, IT, ECE, EEE, Mechanical, and Civil.
- The current blueprint definitions use version 2, totaling 60 minutes and 100 marks.
- Sections include aptitude/reasoning and branch-specific technical content; CSE/IT include coding questions.
- A student must have a supported branch in the profile.
- The student accepts rules and required local camera/microphone monitoring before starting; desktop/laptop and fullscreen are required by the current flow.
- Attempt questions and answer keys are snapshotted so an active attempt remains consistent across refreshes.
- The timer begins once question generation and validation have completed.
- MCQ scoring and results are calculated server-side. Coding answers are sent to a configured Judge0 service rather than executed by the Next.js server.
- Results include score, section/topic summaries, answer review, and feedback.

**Question generation and integrity**

- OpenAI may generate a question set when no valid cached set is available.
- Candidate questions are validated for structure, branch topics, marks, difficulty distribution, currency conventions, and duplicates.
- Cached sets are reused by branch and blueprint version to reduce waiting. Consequently, students in the same branch can receive the same question set.
- Correct answers, explanations, and private coding tests are stripped from the active exam response and are presented only in the account owner's finalized results.
- Browser events such as focus/visibility, fullscreen, clipboard, connection, and media interruptions are logged. The system warns or terminates according to its policy, but these checks are not tamper-proof and cannot detect a second phone or provide 360-degree surveillance.

**Known operational caveat**

The supplied development log showed quota/unavailability during the earlier Gemini question-generation integration. That shared provider has since been switched to OpenAI with bounded request timeouts and retry handling. This does **not** create an offline assessment bank: if no suitable cached question set exists and OpenAI is unavailable or its project quota is exhausted, a new attempt can still fail before its timer starts.

### Module 3 — Career Interests (`/career-interests`)

**Purpose:** Let a student reflect on preferred work activities and environments.

- A balanced 24-item questionnaire covers six RIASEC dimensions: Realistic, Investigative, Artistic, Social, Enterprising, and Conventional.
- The questionnaire is untimed and can be saved and resumed.
- The user must complete all responses before submitting.
- Server-side logic calculates the six scores and interest code deterministically.
- OpenAI can help generate question wording or explain results, but it does not calculate or modify scores.
- Results and attempts are stored in a separate RIASEC attempt model, with an account-owned history view.

**Interpretation limitation:** The interface presents the outcome as a starting point for exploration, not a measure of ability or a definitive career prediction. The repository does not document an external psychometric validation study of the adapted questionnaire.

### Module 4 — Career Exploration and Recommendation (`/career-explorer`)

**Purpose:** Help students explore catalog careers using profile evidence, technical assessment, and optional RIASEC results.

**Main capabilities**

- Search and filter career options by name, domain, family, RIASEC interest, and skill.
- View details about responsibilities, work environments, tools, qualifications/themes, and project ideas.
- Save/unsave careers and compare up to three selected careers.
- Store career preferences and current career goals.
- Generate personalized recommendation runs when the required evidence is available.
- View recommendation history and saved careers.
- Choose a career as the current goal, which starts the Module 5 handoff.

**Evidence and eligibility**

The recommendation engine checks profile readiness, a submitted technical assessment, and a completed RIASEC profile. Missing prerequisites are shown explicitly; a catalog listing remains browseable but is not represented as a personalized recommendation. Its documented scoring weights are 50% technical alignment, 30% interest alignment, and 20% profile alignment. Match scores are framed as exploration aids, not probabilities of employment or measures of ability.

Career catalog entries include role-skill requirements and, where present, career learning resources and competency progressions. Catalog sources link to O*NET/ESCO references, while the repository labels its descriptions as Nexora-authored adaptations rather than official recommendations.

### Module 5 — Career Preparation (`/skill-development`)

**Purpose:** Turn the current Module 4 goal into a scheduled, career-specific learning plan.

**Plan setup**

- Preparation duration (weeks), daily study hours, study days, start date, skill level, and learning preference.
- Plan ownership is checked against the authenticated student and current goal.
- New plans are versioned; an older active plan is archived rather than deleted.
- Skill evidence is captured in the plan snapshot so missing information stays “not yet assessed,” not falsely labeled as a deficit.

**Plan and progress**

- Skill-gap/evidence analysis, weekly goals, dated tasks, objectives, activities, and completion criteria.
- Topic learning pages and task-status tracking.
- Daily topic assessments and weekly review assessments.
- Saved attempt history, scores, feedback, weak concepts, and progress metrics.
- A dashboard for plan progress and assessment history.
- A resource page aggregating task links.

Every scheduled task is now intended to have at least one resource. A vetted career-catalog link is used when the skill matches one. If no catalog match exists, the plan supplies a skill-specific search link on a learning platform. Search results are not individually vetted, and the UI communicates that the student should review quality and suitability. Existing plans with an empty resource array also receive this fallback when retrieved.

Daily checks contain 30 varied introductory questions; correct answers and explanations are not included in the question payload before submission. Server code validates and grades submitted answers. The pass threshold is 70%. Weekly assessments become available after that week's tasks have been completed.

**Limitations**

- These deterministic checks are introductory practice, not a validated certification or proof of mastery.
- Coding activities are not executed or automatically graded by Module 5.
- Search fallback links are queries, not endorsements of each result.
- Changing career or generating a new plan preserves earlier plan history, but archived plans cannot accept new assessments.

### Module 6 — AI Mock Interview (`/mock-interview`)

**Purpose:** Provide role-oriented interview practice that is distinct from the legacy interview quiz route (`/interview`).

**Setup and personalization**

- Requires the student's current Module 4 career.
- Setup offers interview type, difficulty, duration, and focus; an owned Module 5 plan may be linked.
- The planned question set is generated from the selected career and its role skills, with the profile and preparation evidence included where available.
- Duration selects a bounded number of planned questions: 5, 8, or 12.

**Providers and experience**

- When server-side `TAVUS_API_KEY` and `TAVUS_PAL_ID` are configured, the session uses Tavus CVI for a spoken video-avatar interview. Tavus receives the career context and planned questions, is instructed to ask them in order, and can ask contextual follow-ups.
- If Tavus is not configured, Gemini Live audio is available only when its optional Gemini key is set; otherwise the product uses OpenAI-backed text practice.
- Provider credentials remain server-side; Tavus room URLs are validated before returning to the authorized session owner.
- The final Tavus transcript is mapped to planned questions. User answers and interviewer turns are saved to the authenticated user's session, then an interview report is persisted and reopenable from history.
- The report includes answer-level practice feedback and may link weak skills to matching Module 5 practice tasks.

**Real-world verification and limitations**

A real Tavus room was created with a provider response; the user confirmed the avatar asked a question, the user answered, and a follow-up occurred. The provider returned assistant and candidate transcript turns; the app saved a report and it was reopened. This was a real spoken question/answer/follow-up/report cycle, but only **one** planned question was answered in that verification, not the entire 8-question interview. The interview was saved as ended rather than fully completed.

The embedded Tavus frame previously appeared black/loading in the user's browser. A direct “Open Tavus interview in a new tab” link and reconnect action are included as workarounds. Tavus recording is disabled; Nexora persists transcript/report data, not raw interview media. Real provider availability depends on valid credentials, Tavus PAL configuration, permissions, and service availability.

## 4. Other website features outside the six-module sequence

The repository also contains these separate routes/tools:

- **Career guidance chat** (`/career-chat`): authenticated conversational assistance with mode options for general guidance, resume review, skill-gap analysis, and mock-interview preparation. Chat sessions are stored for the user.
- **Resume builder** (`/resume-builder`): create, edit, list, and delete resumes; resume APIs support upload/analyze/improve flows.
- **ATS scanner** (`/ats-scanner`): PDF-based resume review against a target role.
- **AI cover letters** (`/ai-cover-letter`): create, list, and open saved cover letters.
- **Roadmap generator** (`/roadmap`): generate and save a separate roadmap workflow; this is distinct from the newer Module 5 plan.
- **Course recommendations** (`/course-recommendations`): submit resume/domain information, view course recommendations, and inspect history.
- **Job matcher** (`/job-matcher`): resume/job matching tool.
- **Career discovery** (`/career-discovery`), company explorer, resume optimizer, resume-job modules, and interview preparation/quiz routes are also present.
- **Growth Tools** (`/growth-tools`) is a directory of separate utilities. Module 5 is not implemented by redirecting its learning workflow to this page.

Some of these are legacy/parallel feature routes and should not be described as equivalent to the new six-module workflow without testing each independently.

## 5. Technical architecture and data handling

### Front end and routing

- Next.js App Router and React components using JavaScript/JSX.
- Shared root layout with Clerk, theme provider, navigation header, toast notifications, and an application shell.
- Tailwind CSS and reusable Radix-based UI components.
- Authenticated pages are guarded by Clerk middleware and/or route-level server checks.

### Server and data

- Next.js route handlers and server actions mediate persistence and provider access.
- Prisma ORM with PostgreSQL.
- User identity is associated with Clerk user IDs; private operations query records by the authenticated user's database ID.
- New module data is persisted in dedicated models, including profile, technical attempts/blueprints, RIASEC attempts, Module 4 career records, Module 5 plans/tasks/attempts, and Module 6 mock-interview sessions/answers.
- No production data reset was performed as part of the recent work.

### AI and third-party services

- **OpenAI:** question generation/adaptation and selected explanations; keys are server-side. **Gemini Live** remains a separate optional audio protocol.
- **Tavus:** configured real-time video interviewer; API key and PAL ID are server-side.
- **Judge0:** code execution service for Module 2 coding questions; submitted code/test inputs leave the Nexora server for that provider.
- **Clerk:** authentication and account identity.
- **Inngest** is included for background/event workflows.

AI output validation varies by feature. Module 2 has structural and blueprint checks, while Module 3 scores deterministically. None of these checks alone demonstrates factual accuracy or learning effectiveness. Provider quotas and network access remain external operational dependencies.

## 6. Verification status available for this report

| Area | Current evidence | Status and boundary |
|---|---|---|
| Core automated tests | The last full `npm test` run reported **71 passing, 0 failing**. | Verified at that test run; does not constitute deployment or user-outcome validation. |
| Targeted lint | Lint passed for the changed Module 2, profile, onboarding, and Module 5/resource code. | Targeted files only. A complete current-project lint/build was not run for this report. |
| Prisma schema | `npx prisma validate` passed. | Schema validity only; not a database write/read test. |
| Database migration status | Earlier session verification reported 27 migrations and schema up to date. | Not rechecked while preparing this report; do not treat as a fresh status result. |
| Module 5 persistence | Source paths use Prisma-owned plans, tasks, and attempts with owner-scoped lookups. | Code path inspected and covered by unit tests; no new isolated end-to-end database fixture was run in the latest verification. |
| Module 6 live Tavus | Actual room, spoken turn(s), follow-up, transcript, saved report, and reopening were previously observed. | Real provider success for one answer cycle; not a full interview. |
| Earlier Module 2 Gemini generation | The provided dev logs contain repeated quota/unavailable failures from the prior provider integration. | The shared provider has since moved to OpenAI; live generation still depends on the configured provider's quota. |
| Two-account isolation | Owner checks are present in inspected new flows. | A complete two-account browser/database acceptance test was not run during the latest work. |
| Production build | No production build was run during the recent change sequence. | Not verified. |

The test output also includes Node.js module-type warnings for ESM files in a package without `"type": "module"`. These did not fail the test run. Development logs also show Clerk development-key warnings and `/sw.js` 404 responses. Those are not evidence that the production deployment is configured correctly.

## 7. Limitations relevant to a research paper

1. **No user study is documented here.** The repository does not establish effectiveness, satisfaction, learning gain, job placement, or fairness.
2. **No psychometric validation is documented for RIASEC wording/scoring adaptation.** Treat the result as guided self-reflection.
3. **AI-generated questions may be inaccurate.** Schema checks do not independently fact-check content.
4. **Provider availability affects workflow.** OpenAI quota failures can prevent a fresh Module 2 question set when there is no valid cache.
5. **Question reuse is possible.** Validated assessment sets can be reused for students on the same branch.
6. **Integrity controls are browser-limited.** They are not proctoring guarantees and cannot detect all external devices or behaviors.
7. **Interview evaluation is practice feedback.** Scores are heuristic/model-generated coaching signals, not hiring decisions.
8. **Some integrations transmit user data to external services.** Resume text, generated prompts, live audio/video, or submitted code may be sent to the selected AI or execution provider according to that feature's documented flow and user consent.
9. **Marketing claims need substantiation.** Homepage success and scale figures should be omitted from empirical findings until their sources and measurement methods are established.
10. **Parallel/legacy tools exist.** Distinguish the new Modules 1–6 from older interview, roadmap, resume, and career-discovery tools in any study protocol.

## 8. Suggested research-paper framing

This project can be described as a **prototype career-development platform** that integrates structured student profiling, self-reflection, rule-based evidence analysis, generative-AI assistance, scheduled learning activities, and interview practice. A defensible study could evaluate:

- Usability and task completion across the six-module sequence.
- Profile/resume extraction correction rates and user trust.
- Reliability and content quality of generated assessments under quota and model variation.
- Changes in learning behavior or knowledge using a controlled pre/post design.
- Career recommendation transparency, perceived relevance, and subgroup fairness.
- Accessibility, privacy comprehension, and user consent.
- Interview transcript accuracy and usefulness of follow-up feedback.

Any such findings require a defined sample, consent/ethics process, measures, analysis plan, and reproducible versioning of question banks, prompts, model/provider versions, and scoring logic. The implementation itself should not be presented as proof of those outcomes.

## 9. Key project references

- Homepage: `app/page.jsx`, `components/hero.jsx`
- Auth and application shell: `proxy.js`, `app/layout.js`, `components/AppShell.jsx`
- Six-module dashboard: `app/(main)/dashboard/page.jsx`
- Profile and resume extraction: `app/(main)/student-profile/`, `app/api/student-profile/extract/`
- Module 2: `app/(main)/assessment/`, `lib/module2/`, `actions/module2.js`
- Module 3: `app/(main)/career-interests/`, `lib/module3/`, `actions/module3-riasec.js`
- Module 4: `app/(main)/career-explorer/`, `lib/module4/`, `actions/module4-careers.js`
- Module 5: `app/(main)/skill-development/`, `lib/module5/`, `app/api/skill-development/`
- Module 6: `app/(main)/mock-interview/`, `lib/module6/`, `app/api/mock-interview/`
- Database models: `prisma/schema.prisma`
- Project scripts and dependencies: `package.json`
- Existing detailed setup notes: `README.md`
