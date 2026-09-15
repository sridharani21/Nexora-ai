# Nexora AI - Project Report

## 1. Executive summary

Nexora AI is a full-stack career development platform. It combines:

- A web interface for career planning, resumes, interviews, courses, and job preparation.
- Clerk authentication for sign-in, sign-up, and protected pages.
- A PostgreSQL database accessed through Prisma.
- Google Gemini for career advice, resume generation, ATS analysis, quizzes, roadmaps, and recommendations.
- Next.js App Router server components, server actions, and route handlers.
- Inngest for longer-running or asynchronous workflows such as course analysis and resume generation.

The application is not only a chatbot. It stores a user's profile and career journey, generates structured career recommendations, helps the user close skill gaps, builds resumes and cover letters, evaluates interview readiness, and keeps the generated results in the database.

The main application is in the `my-app` directory. The sibling `my-app.worktrees` directories are Git worktree copies and should not be treated as separate products when documenting the project.

## 2. Complete application workflow

This section explains the project as a user journey first, then explains what happens inside the application at each stage.

### 2.1 One-page system workflow

```text
Visitor
  |
  | Opens Nexora AI
  v
Landing page
  |
  | Sign in or create account
  v
Clerk authentication
  |
  | Clerk returns authenticated userId
  v
Onboarding
  |  Saves name, industry, skills, experience, bio, and goals
  v
Dashboard
  |-----------------------|----------------------|----------------------|
  v                       v                      v
Industry insights     Career discovery       Resume workspace
  |                       |                      |
  |                       |                      | Build, upload, or
  |                       |                      | optimize resume
  |                       |                      v
  |                       |                 ATS analysis
  |                       |                      |
  |                       |                      v
  |                       |                 Cover letter
  |                       |
  |                       v
  |                  Career recommendations
  |                       |
  |                       v
  |                  Skill gap analysis
  |                       |
  |                       v
  |                  Roadmap + courses
  |
  |---------------------------------------------------------------|
  v                                                               v
Interview practice                                         Career chat
  |                                                               |
  v                                                               v
Quiz -> score -> assessment history                    Question + resume context

All modules:
  Browser UI -> Next.js page/component -> API route or server action
  -> Clerk authentication -> Prisma -> PostgreSQL
  -> optional Gemini or Inngest -> saved result -> UI response
```

### 2.2 The standard request lifecycle

Almost every feature follows this sequence:

1. The user clicks a button, submits a form, uploads a file, or opens a page.
2. A React component collects the input and either calls a server action or sends `fetch()` to an API route.
3. The Next.js server receives the request.
4. The server calls Clerk `auth()` and gets the Clerk `userId`.
5. The server finds the matching internal `User` using `User.clerkUserId`.
6. The server validates the request and checks that the requested record belongs to that user.
7. Prisma reads or writes PostgreSQL data.
8. If intelligence is needed, the server builds a prompt and calls Gemini.
9. If the operation is long-running, the server sends an event to Inngest instead of waiting.
10. The result is stored in PostgreSQL when it should be available again later.
11. The server returns JSON or a server-action result.
12. React updates its state and displays loading, success, error, or result information.

### 2.3 Where each responsibility lives

```text
app/**/*.jsx                 Screens and interactive feature pages
components/**/*.jsx         Reusable UI components
actions/*.js                Server actions for forms and feature workflows
app/api/**/route.js         HTTP API endpoints and file uploads
lib/prisma.js               Shared Prisma database client
lib/llm.js                  General Gemini JSON generation
lib/resume-llm.js           Resume Gemini text/JSON generation
lib/inngest/*               Background event functions
prisma/schema.prisma        Database tables and relationships
proxy.js                    Protected route matching
```

## 3. Feature-by-feature workflows

### 3.1 Sign-up, sign-in, and onboarding workflow

```text
1. User opens Sign up or Sign in.
2. Clerk displays and processes the authentication form.
3. Clerk creates/authenticates the account and returns a Clerk userId.
4. Clerk middleware allows protected routes for this signed-in user.
5. User is directed to onboarding when profile setup is incomplete.
6. User submits name, industry, experience, skills, bio, and career details.
7. A server action verifies the Clerk session.
8. The action creates or updates the internal User row using clerkUserId.
9. The user is redirected to the dashboard.
```

Data created or updated:

- `User.name`
- `User.industry`
- `User.skills`
- `User.experience`
- `User.bio`
- Related `UserProfile` or `CareerDiscovery` information when that workflow is used

Why this matters: Clerk owns identity, but Nexora's PostgreSQL `User` row owns application data. Every later feature uses the internal database ID to connect records safely.

### 3.2 Dashboard and industry insight workflow

```text
1. User opens Dashboard.
2. The dashboard calls the industry insight server action.
3. The server checks authentication.
4. The server loads the user and selected industry from PostgreSQL.
5. If the user has no industry, the server redirects to onboarding.
6. If an IndustryInsight already exists, it is returned immediately.
7. If it does not exist, the server builds a structured Gemini prompt.
8. Gemini returns salary ranges, growth, demand, skills, trends, and outlook.
9. The response is cleaned and parsed as JSON.
10. The result is saved as IndustryInsight with lastUpdated and nextUpdate.
11. The dashboard renders cards, charts, and recommendations.
```

Data flow:

```text
User.industry -> Gemini prompt -> IndustryInsight row -> Dashboard UI
```

The stored result acts as a cache, so the application does not call Gemini every time the dashboard opens.

### 3.3 Career discovery workflow

Career discovery is a guided wizard. Each step depends on the data saved by the previous step.

#### Step 1: Load or create journey

```text
Open Career Discovery
  -> authenticate user
  -> find CareerDiscovery by userId
  -> create an empty journey if none exists
  -> return saved journey and profile defaults
```

#### Step 2: Save career profile

```text
User enters:
education, experience years, current role, skills,
interests, location, and career goal
  -> server validates required education and at least one skill
  -> comma-separated skills/interests become arrays
  -> CareerDiscovery is created or updated
  -> User.skills and User.experience are synchronized
  -> currentStep becomes "careers"
```

#### Step 3: Generate career recommendations

```text
Saved profile
  -> server builds prompt with education, experience, skills, interests, goal
  -> Gemini returns five career objects
  -> each object contains title, matchScore, why, outlook,
     salaryRange, and keySkills
  -> result is saved in CareerDiscovery.careerRecommendations
  -> UI displays career cards
```

#### Step 4: Select a career and calculate skill gaps

```text
User selects a recommended career
  -> server loads selected career and user skills
  -> Gemini compares existing skills with role requirements
  -> returns have[], missing[], importance, why, and summary
  -> saves selectedCareer and skillGap
  -> currentStep becomes "skillgap"
```

#### Step 5: Generate roadmap

```text
Selected career + missing skills
  -> Gemini generates exactly six monthly phases
  -> each phase includes focus, skills, and milestones
  -> result is saved in CareerDiscovery.roadmap
  -> currentStep becomes "roadmap"
```

#### Step 6: Generate learning resources

```text
Missing skills + roadmap skills + existing skills
  -> duplicate skills are removed
  -> Gemini returns eight resources
  -> each resource has title, platform, URL, skill, cost, and reason
  -> result is saved in CareerDiscovery.courses
  -> currentStep becomes "courses"
```

#### Step 7: Generate learning plan

```text
Career + roadmap + courses
  -> Gemini creates a practical study plan
  -> plan is stored in CareerDiscovery.learningPlan
  -> user sees the final personalized journey
```

If a user returns later, the saved JSON fields and `currentStep` let the wizard resume rather than starting over.

### 3.4 Resume builder workflow

```text
1. User opens Resume Builder.
2. User chooses a template and enters personal information.
3. User adds experiences, education, skills, projects, and certifications.
4. The client keeps form state and section order.
5. The client sends resume data to POST /api/resumes.
6. The route authenticates the user and finds the internal User row.
7. Prisma creates one Resume parent row.
8. Prisma nested-creates Experience, Education, Skill, Project,
   and Certification child rows.
9. Each child receives an order value for display ordering.
10. The API returns the complete resume and related sections.
11. The UI displays the resume preview.
12. Later edits use PATCH /api/resumes/[id].
13. The server verifies ownership before updating or deleting.
```

Database structure:

```text
Resume
  -> experiences[]
  -> education[]
  -> skills[]
  -> projects[]
  -> certifications[]
```

Resume export libraries convert the rendered preview into PDF or image output. The database stores editable structured data, not just a final screenshot.

### 3.5 Resume upload and ATS scanner workflow

```text
1. User selects a resume file and optionally enters a job description.
2. Browser creates multipart FormData.
3. Browser sends POST /api/resumes/analyze-upload.
4. Server checks Clerk authentication.
5. Server reads uploaded file bytes.
6. Gemini extracts plain resume text from the file.
7. Gemini converts the text into structured JSON:
   name, contact data, summary, experience, education, and skills.
8. ATS analyzer compares the structured resume with the job description.
9. Analyzer calculates overall score, formatting score, keyword score,
   strengths, weaknesses, section analysis, and recommendations.
10. Server returns extractedData, analysis, and a raw-text preview.
11. UI shows the score and improvement suggestions.
12. User can request an AI fix for a selected issue.
13. The fix route sends the relevant content to Gemini and returns improved text.
14. When analyzing a saved resume, the result can be added to ATSAnalysisHistory.
```

Quota fallback:

```text
Gemini quota error + PDF
  -> local PDF text extraction with unpdf
  -> local keyword and section analysis
  -> basic ATS report returned with source = "local"
```

This fallback is less intelligent than Gemini but keeps the feature useful during temporary AI quota problems.

### 3.6 AI resume writing workflow

The AI writing endpoint supports two main field types:

```text
Summary request
  -> receives resumeData and optional jobDescription
  -> creates prompt from name, experience, and skills
  -> Gemini returns a 3-4 sentence summary
  -> server removes unwanted formatting
  -> UI places result in summary field
```

```text
Experience request
  -> receives position, company, and optional jobDescription
  -> Gemini creates action-oriented achievement bullets
  -> server returns one bullet per line
  -> UI places bullets in the selected experience section
```

The separate resume improvement action takes existing text and a content type, asks Gemini to improve it, and returns the replacement text.

### 3.7 Cover letter workflow

```text
1. User enters company, job title, job description, and optional details.
2. Server authenticates the user.
3. Server loads the user's newest resume and all related sections.
4. Server builds a prompt using verified resume information.
5. Gemini writes a maximum-length professional cover letter.
6. Server creates a CoverLetter row with content and job details.
7. UI displays the generated letter.
8. User can later list and open saved cover letters.
```

The prompt tells Gemini to avoid inventing achievements. The resume is used as evidence for skills and experience.

### 3.8 Career chat workflow

```text
1. User opens Career Chat.
2. Client calls GET /api/career-chat-sessions.
3. Server returns only sessions belonging to the authenticated user.
4. User selects an existing session or starts a new one.
5. User sends a message to POST /api/career-chat.
6. Server authenticates and resolves the internal User row.
7. Existing session is loaded, or a new ChatSession is created.
8. User message is saved in Message.
9. Previous messages are converted to Gemini chat history.
10. If resumeText exists, it is added to the system context.
11. Gemini generates career guidance.
12. Response formatting is normalized to plain text.
13. Assistant response is saved in Message.
14. ChatSession.updatedAt is refreshed.
15. API returns content, sessionId, and sessionTitle.
16. Client adds the assistant response to the conversation.
```

Chat resume upload:

```text
PDF/TXT/MD file
  -> /api/career-chat-upload
  -> verify session ownership
  -> extract text locally
  -> reject unsupported or unreadable files
  -> trim to 8,000 characters
  -> save as ChatSession.resumeText
```

### 3.9 Interview practice workflow

```text
1. User opens Interview Practice.
2. Server loads industry and skills from User.
3. Gemini generates ten technical multiple-choice questions.
4. Client displays questions and records answers.
5. User submits the quiz.
6. Server compares each answer with correctAnswer.
7. Server calculates or receives the total score.
8. Wrong answers are collected.
9. If wrong answers exist, Gemini generates a focused improvement tip.
10. Assessment is saved with questions, answers, correctness, score, and tip.
11. Interview dashboard retrieves assessment history.
12. Charts and statistics show progress over time.
```

### 3.10 Course recommendation workflow

```text
1. User uploads a resume and selects a target domain.
2. Server authenticates and verifies the internal user.
3. Server extracts resume text from the PDF using pdf2json.
4. Server sends courses/analyze to Inngest with userId, resumeText, and domain.
5. Server immediately returns "Analysis started".
6. Inngest processes the event in the background.
7. Background job asks Gemini to identify skills and recommend courses.
8. Job saves the result in CourseRecommendation.
9. Client polls or requests GET /api/courses/recommend.
10. Server returns the latest recommendations for that user.
```

Course-to-resume workflow:

```text
User selects a CourseRecommendation
  -> POST /api/resumes/from-courses
  -> ownership of recommendation is verified
  -> Inngest resume-generation event is triggered
  -> background job creates a resume
  -> GET request checks whether the generated resume is ready
```

### 3.11 Standalone roadmap workflow

```text
1. User enters a target career and number of months.
2. Client sends POST /api/roadmap.
3. Server asks Gemini for structured monthly and weekly topics.
4. Server parses the JSON response.
5. Client displays the generated roadmap.
6. User saves it through /api/roadmap/save.
7. Prisma stores title, career, month count, and JSON roadmap data.
8. GET /api/roadmap lists the user's saved roadmaps.
9. GET /api/roadmap/[id] returns one full roadmap.
10. DELETE /api/roadmap/[id] removes an owned roadmap.
```

### 3.12 Error and loading workflow

```text
Request starts
  -> React sets loading state
  -> server validates authentication and input
  -> success: data is stored and returned
  -> client updates UI and shows result
  -> failure: server logs error and returns status/message
  -> client stores error and shows a Sonner toast
  -> finally: loading state is cleared
```

Common statuses:

- `401`: user is not authenticated.
- `404`: user or requested owned record does not exist.
- `400`: required input is missing or invalid.
- `415`: unsupported uploaded file type.
- `422`: file could not be interpreted as usable text.
- `429`: Gemini quota/rate limit.
- `503`: Gemini model temporarily unavailable.
- `500`: unexpected server/database/AI failure.

## 4. Technology stack

### Application and language

| Technology | What it is | How Nexora uses it |
|---|---|---|
| JavaScript | The primary programming language | Pages, components, server actions, API handlers, and utility modules use JavaScript. |
| React 19 | UI library based on components and state | Interactive forms, dashboards, chat, quizzes, resume editors, charts, and wizards are React components. |
| Next.js 16 | Full-stack React framework | Provides the App Router, layouts, pages, server rendering, API route handlers, server actions, and production build. |
| JSX | JavaScript syntax for describing UI | Used by `.jsx` pages and components to render React elements. |
| Node.js runtime | Server-side JavaScript runtime | Executes server actions, API handlers, Prisma queries, file parsing, and Gemini requests. |

Example page structure:

```text
app/
  layout.js                 Root layout
  (auth)/                    Sign-in and sign-up routes
  (main)/dashboard/page.jsx Dashboard page
  api/career-chat/route.js   Server API endpoint
```

### Styling and UI

| Technology | What it is | How Nexora uses it |
|---|---|---|
| Tailwind CSS 4 | Utility-first CSS framework | Styling and responsive layout classes throughout the UI. |
| Radix UI | Accessible, unstyled UI primitives | Dialogs, dropdowns, tabs, progress indicators, selects, radio groups, and accordions. |
| `lucide-react` | Icon library | Icons in navigation, cards, forms, and actions. |
| `next-themes` | Theme state integration | Dark/system theme support. |
| `sonner` | Toast notification library | Success and error messages, including errors handled by `use-fetch.js`. |
| Recharts | React charting library | Interview performance and dashboard visualizations. |
| React Flow | Node/edge diagram library | Suitable for visual roadmaps or career graphs used by the application. |
| React Markdown and remark-gfm | Markdown rendering | Rendering generated cover letters and other formatted content. |

### Authentication

Clerk is the identity provider. `ClerkProvider` is installed in the root layout, and `clerkMiddleware` protects selected routes in `proxy.js`.

The application follows this identity mapping:

```text
Clerk userId
    |
    v
User.clerkUserId in PostgreSQL
    |
    v
Internal User.id used by Prisma relationships
```

Server code normally calls `auth()` from `@clerk/nextjs/server`, verifies the returned `userId`, and then finds the internal database user by `clerkUserId`.

Protected route groups include dashboard, resume, cover letter, interview, onboarding, career chat, course recommendations, and roadmap pages. Authentication is still checked inside server actions and API handlers; middleware is not the only protection.

### Database and ORM

| Technology | What it is | How Nexora uses it |
|---|---|---|
| PostgreSQL | Relational database | Persistent storage for users, resumes, assessments, chat, career journeys, roadmaps, and recommendations. |
| Prisma | Type-safe database ORM | Defines the schema in `prisma/schema.prisma` and provides queries through the generated client. |
| `@prisma/client` | Prisma runtime client | Used through the shared `db` instance in `lib/prisma.js`. |

`lib/prisma.js` creates one Prisma client and stores it on `globalThis` during development. This prevents a new database connection from being created on every hot reload.

### Artificial intelligence

The project uses Google Gemini through `@google/generative-ai` and also includes `@google/genai`.

There are two main AI helper paths:

1. `lib/llm.js`
   - Uses `GEMINI_API_KEY`.
   - Provides `generateJson(prompt)`.
   - Adds an instruction to return JSON, removes markdown fences, and parses the JSON.
   - Used by the career discovery server actions.

2. `lib/resume-llm.js`
   - Uses `GEMINI_API_RESUME_KEY`.
   - Provides text and JSON generation for resume-related functions.
   - Has a fallback model when the primary resume model is temporarily unavailable.
   - Used for resume extraction, content improvement, cover letters, and resume tools.

Gemini is called from the server, not directly from browser code. This keeps API keys out of client bundles.

### File and document processing

| Package | Purpose |
|---|---|
| `unpdf` | Extract text from uploaded PDF files. |
| `pdf2json` | Extract text for the course recommendation upload path. |
| `pdf-parse`, `pdfjs-dist` | PDF-related support dependencies. |
| `mammoth` | Word document conversion support. |
| `docx` | DOCX generation or manipulation. |
| `jspdf`, `html2pdf.js`, `html2canvas`, `html-to-image` | Exporting resume or other UI content into images/PDF files. |

### Background processing

Inngest is used for event-driven background jobs. The Inngest endpoint is exposed by `app/api/inngest/route.js`.

The course recommendation flow sends a `courses/analyze` event after a resume has been parsed. The client receives an immediate "analysis started" response and later reads the saved recommendation. Resume generation from courses follows the same asynchronous pattern.

### Validation and utility packages

- `zod`: schema validation dependency for structured input validation.
- `react-hook-form`: form state and submission handling.
- `@hookform/resolvers`: connects form validation schemas to React Hook Form.
- `axios`: HTTP client used by some client-side or legacy integrations.
- `date-fns`: date formatting and date calculations.
- `clsx`, `tailwind-merge`, and `class-variance-authority`: conditional and conflict-free CSS class composition.

## 5. Main features

### Authentication and onboarding

- Clerk sign-in and sign-up pages.
- Protected application routes.
- Onboarding profile collection.
- User industry, skills, experience, bio, and related profile data.
- Industry-specific insight generation on first use.

### Dashboard and industry insights

The dashboard can show career-related information for the user's selected industry:

- Salary ranges by role.
- Growth rate.
- Demand level.
- Top skills.
- Market outlook.
- Key industry trends.
- Recommended skills.

The server action `getIndustryInsights()` first checks authentication and the user's industry. If a cached `IndustryInsight` exists, it returns it. Otherwise, it asks Gemini for JSON, stores the result in PostgreSQL, and schedules the next update for approximately seven days later.

### Career discovery

Career discovery is a multi-step workflow:

1. Load or create a `CareerDiscovery` record.
2. Collect education, years of experience, current role, skills, interests, location, and career goal.
3. Generate five possible career roles with match scores and salary/outlook information.
4. Let the user select a career.
5. Compare current skills with the selected role and create a skill gap.
6. Generate a six-month roadmap with phases, skills, and milestones.
7. Generate eight learning resources.
8. Generate a learning plan from the roadmap and target skills.

The current step is stored in `CareerDiscovery.currentStep`, while generated sections are stored as JSON fields. This lets a user continue the journey instead of losing progress after a page refresh.

### Resume builder

The resume builder supports:

- Personal details.
- Summary.
- Work experience.
- Education.
- Skills and skill levels.
- Projects and technologies.
- Certifications.
- Multiple templates such as modern, classic, minimal, and professional.
- Ordering of resume sections.
- Resume list, detail, update, and delete operations.
- Public/private metadata.
- Generated PDF/image export dependencies.

The data is normalized in the database. A `Resume` is the parent record and `Experience`, `Education`, `Skill`, `Project`, and `Certification` are child records.

### Resume upload, extraction, and ATS analysis

The resume analysis workflow can:

- Receive a file and optional job description.
- Extract text from the file.
- Ask Gemini to structure resume data into JSON.
- Analyze the result for ATS compatibility.
- Return score, strengths, weaknesses, keywords, section analysis, and recommendations.
- Apply AI fixes to selected ATS issues.

If Gemini is rate-limited for a PDF upload, the code has a local fallback that extracts PDF text and calculates a simpler report from detected sections and job-description keywords. This means the user can still receive a basic result when AI quota is temporarily exhausted.

### AI resume writing tools

The project includes AI tools for:

- Generating a professional summary.
- Generating experience bullet points.
- Improving a resume section with stronger verbs, metrics, and keywords.
- Optimizing a resume against a job description.
- Matching a profile to possible roles.
- Explaining a company and preparing for its interviews.

The route `app/api/ai/generate-content/route.js` selects a prompt based on the requested field. The route rejects unsupported field types instead of generating arbitrary content.

### Cover letters

The cover letter workflow:

1. Authenticates the user.
2. Loads the most recently updated resume and its related records.
3. Combines verified resume details with company, job title, and job description.
4. Asks Gemini for a targeted letter.
5. Saves the result in `CoverLetter`.
6. Allows the user to list and open saved letters.

The prompt explicitly tells the model not to invent achievements and to use verified resume details.

### Career chat

Career chat provides persistent, authenticated conversations:

- Chat sessions are stored in `ChatSession`.
- Messages are stored in `Message`.
- A session gets an automatic title from the first message.
- Previous messages are loaded in chronological order and converted to Gemini chat history.
- A resume can be uploaded to a session.
- Resume text is included as context for later answers.
- Sessions can be renamed or deleted.
- The response is normalized to plain text before being saved.

The system prompt directs the assistant to act as a career coach, answer about paths, skill gaps, resumes, interviews, salary, and roadmaps, and finish with a follow-up question.

### Interview practice

The interview feature:

- Generates ten multiple-choice technical questions based on the user's industry and skills.
- Displays the quiz in the client.
- Calculates the score.
- Stores each question, correct answer, user's answer, and correctness.
- Generates an improvement tip when answers are wrong.
- Provides assessment history and performance statistics.

The `Assessment.questions` field stores the detailed question result as JSON.

### Course recommendations

There are two course recommendation patterns:

1. Career discovery recommendations:
   - Gemini receives missing skills and roadmap skills.
   - It returns learning resources with title, platform, URL, target skill, cost, and reason.
   - The result is saved inside the career discovery record.

2. Resume upload recommendations:
   - The user uploads a PDF and chooses a domain.
   - The server extracts text with `pdf2json`.
   - An Inngest `courses/analyze` event is sent.
   - A background function analyzes the resume and stores a `CourseRecommendation`.
   - The client can fetch the latest recommendations.

### Roadmaps

The standalone roadmap feature accepts a career and duration in months. Gemini returns a month-by-month JSON structure with four weeks and two to three topics per week.

The generated roadmap can be saved to the `Roadmap` model. The roadmap list endpoint returns lightweight metadata, while the detail endpoint returns the full JSON data for a selected roadmap.

## 6. Data model overview

```text
User
 |-- Assessment[]
 |-- CoverLetter[]
 |-- Resume[]
 |     |-- Experience[]
 |     |-- Education[]
 |     |-- Skill[]
 |     |-- Project[]
 |     `-- Certification[]
 |-- CourseRecommendation[]
 |-- Roadmap[]
 |-- IndustryInsight?       (linked by industry)
 `-- CareerDiscovery?       (one per user)

ChatSession
 `-- Message[]
```

Important models in `prisma/schema.prisma`:

- `User`: internal user identity, profile, industry, skills, and relationships.
- `IndustryInsight`: cached AI-generated market and salary information.
- `CareerDiscovery`: state and generated JSON for the career planning wizard.
- `Resume`: resume metadata, personal data, ATS data, and child sections.
- `ATSAnalysisHistory`: historical ATS results.
- `CoverLetter`: generated letter content and target job data.
- `Assessment`: interview quiz results.
- `ChatSession` and `Message`: persistent chat history.
- `CourseRecommendation`: asynchronous course analysis results.
- `Roadmap`: saved standalone learning roadmaps.

PostgreSQL arrays are used for simple lists such as skills, technologies, achievements, and bullet points. JSON fields are used where the generated structure can vary, such as recommendations, roadmaps, ATS reports, and course results.

## 7. API and server-action surface

### API routes

| Endpoint | Purpose |
|---|---|
| `/api/career-chat` | Send a message and receive a Gemini response. |
| `/api/career-chat-sessions` | List or create chat sessions. |
| `/api/career-chat-sessions/[sessionId]` | Rename or delete a chat session. |
| `/api/career-chat-upload` | Attach PDF, TXT, or Markdown resume text to a chat session. |
| `/api/resumes` | List and create resumes. |
| `/api/resumes/[id]` | Read, update, or delete one resume. |
| `/api/resumes/analyze-upload` | Extract and analyze an uploaded resume. |
| `/api/resumes/[id]/analyze` | Analyze a saved resume and read analysis history. |
| `/api/resumes/improve` | Improve resume content with AI. |
| `/api/resumes/from-courses` | Start or read resume generation from course recommendations. |
| `/api/ai/generate-content` | Generate summary or experience content. |
| `/api/ai/apply-ats-fix` | Apply a selected ATS improvement. |
| `/api/resume-tools` | Run optimizer, matcher, or company research tools. |
| `/api/courses/recommend` | Start course analysis and fetch saved recommendations. |
| `/api/roadmap` | Generate a roadmap or list saved roadmaps. |
| `/api/roadmap/[id]` | Read or delete a saved roadmap. |
| `/api/roadmap/save` | Persist a generated roadmap. |
| `/api/inngest` | Inngest webhook and function serving endpoint. |

### Server actions

Server actions in `actions/` are called by React forms or server-rendered pages:

- `actions/user.js`: create/update the user and initialize industry information.
- `actions/dashboard.js`: generate and retrieve industry insights.
- `actions/career-discovery.js`: run the career discovery workflow.
- `actions/resume.js`: save, load, and improve resume content.
- `actions/cover-letter.js`: generate and retrieve cover letters.
- `actions/interview.js`: generate quizzes, save results, and retrieve assessments.
- `actions/courseRecommendActions.js`: course recommendation-related actions.

The `"use server"` directive makes these functions execute on the server. They can call `auth()`, Prisma, and Gemini without exposing credentials to the browser.

## 8. How data is fetched and moved through the system

### Normal authenticated database request

```text
Browser or server-rendered page
    |
    | fetch("/api/resumes") or call a server action
    v
Next.js route handler/action
    |
    | auth() -> Clerk userId
    | Prisma lookup by User.clerkUserId
    v
PostgreSQL through Prisma
    |
    v
JSON response or serialized server-action result
    |
    v
React state updates and UI rendering
```

For example, `GET /api/resumes`:

1. Calls Clerk `auth()`.
2. Returns 401 if there is no signed-in user.
3. Finds the internal user by Clerk ID.
4. Finds the user's resumes.
5. Includes experiences, education, skills, projects, and certifications.
6. Orders child sections by their `order` field.
7. Orders resumes by most recently updated.
8. Returns `{ resumes }` as JSON.

### Client-side fetch helper

`hooks/use-fetch.js` wraps an asynchronous callback and exposes:

```text
data
loading
error
fn(...)
setData
```

It resets errors before a request, stores the result, displays an error toast when the callback fails, and always clears the loading state in `finally`.

### Gemini request flow

```text
Authenticated server action or API route
    |
    | Build prompt from profile/resume/job data
    v
GoogleGenerativeAI model.generateContent(...)
    |
    | Read response.text()
    | Remove code fences when JSON is expected
    | JSON.parse(...) or return text
    v
Save structured result with Prisma or return it to client
```

The prompts often ask for a strict JSON shape. `lib/llm.js` and `lib/resume-llm.js` then clean and parse model output. The application should still treat model output as untrusted input because a model can return invalid or incomplete JSON.

### Resume upload flow

```text
Resume file + job description
    |
    v
FormData POST /api/resumes/analyze-upload
    |
    v
Read bytes and encode file for Gemini
    |
    v
Gemini extracts plain text
    |
    v
Gemini converts text into structured resume JSON
    |
    v
ATS analyzer calculates score and recommendations
    |
    v
Return extractedData + analysis + short rawText preview
```

The career chat upload path is separate. It extracts PDF/TXT/Markdown text locally, limits stored chat resume context to 8,000 characters, and stores the result in `ChatSession.resumeText`.

### Asynchronous course flow

```text
User uploads resume and selects domain
    |
    v
Route extracts PDF text
    |
    v
Inngest event: courses/analyze
    |
    v
Background function analyzes resume with Gemini
    |
    v
CourseRecommendation saved to PostgreSQL
    |
    v
Client GET request reads latest recommendations
```

This design avoids making the upload request wait for the full AI recommendation process.

## 9. Example end-to-end workflows

### Example A: New user to personalized career roadmap

1. User signs up through Clerk.
2. User completes onboarding with industry, experience, and skills.
3. The application creates or updates the internal `User`.
4. Dashboard requests industry insights.
5. If no cached insight exists, Gemini returns salary, trend, demand, and skill data.
6. The user opens Career Discovery and fills in profile details.
7. Gemini returns five career options.
8. User selects one option.
9. Gemini compares the selected role with existing skills.
10. Gemini creates a six-month roadmap.
11. Gemini returns recommended learning resources.
12. Each result is stored in `CareerDiscovery` JSON fields and can be resumed later.

### Example B: Resume upload to job-specific ATS improvements

1. User uploads a resume and enters a target job description.
2. The browser sends multipart `FormData`.
3. The server authenticates the request.
4. Gemini extracts and structures the resume.
5. `analyzeResumeATS()` compares the resume to the target.
6. The UI displays the score, keywords, weak sections, and recommendations.
7. User requests a fix for one issue.
8. `/api/ai/apply-ats-fix` sends the selected problem and resume content to Gemini.
9. The improved content is returned and can be applied to the resume.
10. A saved-resume analysis can also be stored in `ATSAnalysisHistory`.

### Example C: Career chat with resume context

1. The user opens Career Chat.
2. The client loads sessions from `/api/career-chat-sessions`.
3. The user uploads a PDF or text resume.
4. The server extracts text, validates it, truncates it to 8,000 characters, and stores it on the selected session.
5. The user sends a question.
6. The API loads all messages for that user's session.
7. Messages are mapped to Gemini's `user` and `model` roles.
8. Resume text is added to the system context.
9. Gemini responds.
10. The assistant response is cleaned, saved as a `Message`, and returned with the session ID.

### Example D: Interview assessment

1. The server loads the user's industry and skills.
2. Gemini generates ten multiple-choice questions.
3. The client records selected answers.
4. The server compares each answer with `correctAnswer`.
5. Wrong answers are sent to Gemini for a short improvement tip.
6. The complete assessment is saved.
7. The interview dashboard retrieves assessment history for charts and statistics.

## 10. Important implementation notes

### Security

- Authentication checks are present in the main API routes and server actions.
- Database queries generally scope records to the authenticated internal user.
- Resume detail routes should continue to verify ownership before every read, update, and delete.
- Uploaded files should have explicit size, MIME type, and extension limits in production.
- AI output should be validated against schemas before writing to JSON database fields.

The local `.env` file contains credential-shaped values for Clerk, Gemini, database, Inngest, Redis, and Chroma services. Those values must never be committed or shared. Because credentials were found in the local environment during this review, rotate any real keys that may have been exposed, remove `.env` from version control, and use a redacted `.env.example` for documentation.

### Reliability

- Gemini calls can fail because of quota limits, model unavailability, malformed JSON, or network errors.
- Resume AI code has explicit quota/unavailable handling and a local PDF fallback for one path.
- Inngest is appropriate for work that may exceed a normal request time.
- JSON responses from Gemini should be validated using Zod or equivalent validation before persistence.
- The application has several prompt-specific JSON parsers; a shared schema validation layer would make failures safer and easier to diagnose.

### Data consistency

- Resume child records use an `order` integer to preserve the user's section ordering.
- Chat messages use `onDelete: Cascade` through the session relationship.
- User-owned records use internal `User.id` foreign keys rather than raw Clerk IDs.
- `CareerDiscovery` is one record per user and is updated as the wizard progresses.

### Current codebase caveats

- The root `README.md` is still the default create-next-app README and does not describe Nexora AI.
- `lib/inngest/functions.js` contains large commented-out implementations. The active background behavior should be checked against the deployed Inngest configuration before release.
- Some dependencies and integrations appear broader than the currently visible route usage. Remove unused packages only after confirming they are not required by hidden or future pages.
- There are multiple AI model names and two Gemini helper implementations. Centralizing model configuration would make upgrades and fallback behavior more consistent.

## 11. How to run the project

From `my-app`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production-style commands:

```bash
npm run build
npm start
```

Available scripts:

- `npm run dev`: starts Next.js development mode with Webpack.
- `npm run build`: creates the production build.
- `npm start`: starts the compiled production server.
- `npm run lint`: runs ESLint.

Required environment categories:

```text
Clerk public and secret keys
PostgreSQL DATABASE_URL
Gemini API key(s)
Inngest event/signing keys
Optional Redis and Chroma configuration
```

Use placeholder values in documentation and provision actual values through a secure environment manager.

## 12. Recommended next improvements

1. Replace the default README with a project-specific setup guide and architecture summary.
2. Add Zod validation at API boundaries and for every Gemini JSON response.
3. Add file size, MIME type, extension, and request-rate limits to upload routes.
4. Centralize Clerk-to-database user lookup in one helper.
5. Centralize Gemini model selection, JSON cleanup, retry behavior, and error mapping.
6. Add automated tests for ownership checks, resume CRUD, chat sessions, upload parsing, and ATS fallback behavior.
7. Add observability for background Inngest events and failed AI generations.
8. Add database migrations and a documented seed process for local development.
9. Remove or archive obsolete commented-out Inngest code after confirming the active implementation.
10. Ensure all real credentials are rotated and excluded from Git history.

## 13. One-sentence system description

Nexora AI is an authenticated Next.js and React career platform that stores user career data in PostgreSQL through Prisma, uses Gemini to generate personalized guidance and documents, and uses Inngest to process longer-running recommendation workflows.
