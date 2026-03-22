// import { db } from "@/lib/prisma";
// import { inngest } from "./client";
// import { GoogleGenerativeAI } from "@google/generative-ai";


// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// export const generateIndustryInsights = inngest.createFunction(
//   { name: "Generate Industry Insights" },
//   { cron: "0 0 * * 0" }, // Run every Sunday at midnight
//   async ({ event, step }) => {
//     const industries = await step.run("Fetch industries", async () => {
//       return await db.industryInsight.findMany({
//         select: { industry: true },
//       });
//     });

//     for (const { industry } of industries) {
//       const prompt = `
//           Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
//           {
//             "salaryRanges": [
//               { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
//             ],
//             "growthRate": number,
//             "demandLevel": "HIGH" | "MEDIUM" | "LOW",
//             "topSkills": ["skill1", "skill2"],
//             "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
//             "keyTrends": ["trend1", "trend2"],
//             "recommendedSkills": ["skill1", "skill2"]
//           }
          
//           IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
//           Include at least 5 common roles for salary ranges.
//           Growth rate should be a percentage.
//           Include at least 5 skills and trends.
//         `;

//       const res = await step.ai.wrap(
//         "gemini",
//         async (p) => {
//           return await model.generateContent(p);
//         },
//         prompt
//       );

//       const text = res.response.candidates[0].content.parts[0].text || "";
//       const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

//       const insights = JSON.parse(cleanedText);

//       await step.run(`Update ${industry} insights`, async () => {
//         await db.industryInsight.update({
//           where: { industry },
//           data: {
//             ...insights,
//             lastUpdated: new Date(),
//             nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//           },
//         });
//       });
//     }
//   }
// ); 




// import { db } from "@/lib/prisma";
// import { inngest } from "./client";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// // ─── Existing Function ─────────────────────────────────────────────────────
// export const generateIndustryInsights = inngest.createFunction(
//   { name: "Generate Industry Insights" },
//   { cron: "0 0 * * 0" },
//   async ({ event, step }) => {
//     const industries = await step.run("Fetch industries", async () => {
//       return await db.industryInsight.findMany({
//         select: { industry: true },
//       });
//     });

//     for (const { industry } of industries) {
//       const prompt = `
//           Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
//           {
//             "salaryRanges": [
//               { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
//             ],
//             "growthRate": number,
//             "demandLevel": "HIGH" | "MEDIUM" | "LOW",
//             "topSkills": ["skill1", "skill2"],
//             "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
//             "keyTrends": ["trend1", "trend2"],
//             "recommendedSkills": ["skill1", "skill2"]
//           }
          
//           IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
//           Include at least 5 common roles for salary ranges.
//           Growth rate should be a percentage.
//           Include at least 5 skills and trends.
//         `;

//       const res = await step.ai.wrap(
//         "gemini",
//         async (p) => {
//           return await model.generateContent(p);
//         },
//         prompt
//       );

//       const text = res.response.candidates[0].content.parts[0].text || "";
//       const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
//       const insights = JSON.parse(cleanedText);

//       await step.run(`Update ${industry} insights`, async () => {
//         await db.industryInsight.update({
//           where: { industry },
//           data: {
//             ...insights,
//             lastUpdated: new Date(),
//             nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//           },
//         });
//       });
//     }
//   }
// );

// export const generateCourseRecommendations = inngest.createFunction(
//   { id: "generate-course-recommendations", name: "Generate Course Recommendations" },
//   { event: "courses/analyze" },

//   async ({ event, step }) => {
//     const { userId, resumeText, domain } = event.data;

//     // Step 1: Find DB user - tries multiple field names
//     const dbUser = await step.run("fetch-db-user", async () => {
//       let user = null;

//       try {
//         user = await db.user.findUnique({ where: { clerkUserId: userId } });
//       } catch {}

//       if (!user) {
//         try {
//           user = await db.user.findUnique({ where: { clerkId: userId } });
//         } catch {}
//       }

//       if (!user) {
//         try {
//           user = await db.user.findFirst({ where: { id: userId } });
//         } catch {}
//       }

//       if (!user) throw new Error(`User not found for id: ${userId}`);
//       return user;
//     });

//     // Step 2: Analyze resume + generate recommendations
//     const recommendations = await step.run("analyze-resume-and-recommend", async () => {
//       const prompt = `
// You are an expert career coach and course advisor.

// Analyze the following resume and the user's domain of interest.

// RESUME:
// ${resumeText}

// DOMAIN OF INTEREST: ${domain}

// Return ONLY a valid JSON object in this exact format. No markdown, no explanation, no extra text:
// {
//   "currentSkills": ["skill1", "skill2"],
//   "skillGaps": ["gap1", "gap2"],
//   "free": [
//     {
//       "title": "exact course title as it appears on the platform",
//       "platform": "platform name",
//       "url": "exact direct URL to the course",
//       "level": "Beginner or Intermediate or Advanced",
//       "duration": "estimated hours",
//       "topic": "which skill gap this addresses"
//     }
//   ],
//   "paid": [
//     {
//       "title": "exact course title as it appears on the platform",
//       "platform": "platform name",
//       "url": "exact direct URL to the course",
//       "level": "Beginner or Intermediate or Advanced",
//       "duration": "estimated hours",
//       "price": "approximate price in USD",
//       "topic": "which skill gap this addresses"
//     }
//   ]
// }

// STRICT RULES FOR URLS - THIS IS CRITICAL:
// - For Coursera: URL must be https://www.coursera.org/learn/COURSE-SLUG (e.g. https://www.coursera.org/learn/machine-learning)
// - For Udemy: URL must be https://www.udemy.com/course/COURSE-SLUG (e.g. https://www.udemy.com/course/the-web-developer-bootcamp)
// - For YouTube: URL must be a real playlist https://www.youtube.com/playlist?list=PLAYLIST_ID
// - For freeCodeCamp: URL must be https://www.freecodecamp.org/learn (specific section)
// - For Great Learning: URL must be https://www.mygreatlearning.com/academy (specific course)
// - For LinkedIn Learning: URL must be https://www.linkedin.com/learning/COURSE-SLUG
// - For Pluralsight: URL must be https://www.pluralsight.com/courses/COURSE-SLUG
// - For MIT OpenCourseWare: URL must be https://ocw.mit.edu/courses/COURSE-SLUG

// ONLY recommend courses you are 100% certain exist with that exact URL.
// If unsure about a URL, use the platform homepage for that topic instead.
// Recommend exactly 5 free and 5 paid courses.
// IMPORTANT: Return ONLY the JSON. No markdown, no backticks, no extra text.
// `;

//       const res = await model.generateContent(prompt);
//       const text = res.response.candidates[0].content.parts[0].text || "";
//       const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
//       return JSON.parse(cleanedText);
//     });

//     // Step 3: Save to DB
//     await step.run("save-recommendations-to-db", async () => {
//       await db.courseRecommendation.create({
//         data: {
//           userId: dbUser.id,
//           domain,
//           resumeText,
//           skills: recommendations.currentSkills || [],
//           courses: recommendations,
//         },
//       });
//     });

//     return { success: true, recommendations };
//   }
// );



// ==================================================================
// File: inngest/functions.js (or wherever you keep your Inngest functions)
// Description: Complete Inngest functions including resume builder
// ==================================================================

import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeResumeATS, suggestKeywords } from "@/lib/ats-analyzer";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// ═══════════════════════════════════════════════════════════════════
// EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" },
  async ({ event, step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
      const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "HIGH" | "MEDIUM" | "LOW",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }
          
          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

      const res = await step.ai.wrap(
        "gemini",
        async (p) => {
          return await model.generateContent(p);
        },
        prompt
      );

      const text = res.response.candidates[0].content.parts[0].text || "";
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      const insights = JSON.parse(cleanedText);

      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);

export const generateCourseRecommendations = inngest.createFunction(
  { id: "generate-course-recommendations", name: "Generate Course Recommendations" },
  { event: "courses/analyze" },
  async ({ event, step }) => {
    const { userId, resumeText, domain } = event.data;

    // Step 1: Find DB user - tries multiple field names
    const dbUser = await step.run("fetch-db-user", async () => {
      let user = null;

      try {
        user = await db.user.findUnique({ where: { clerkUserId: userId } });
      } catch {}

      if (!user) {
        try {
          user = await db.user.findUnique({ where: { clerkId: userId } });
        } catch {}
      }

      if (!user) {
        try {
          user = await db.user.findFirst({ where: { id: userId } });
        } catch {}
      }

      if (!user) throw new Error(`User not found for id: ${userId}`);
      return user;
    });

    // Step 2: Analyze resume + generate recommendations
    const recommendations = await step.run("analyze-resume-and-recommend", async () => {
      const prompt = `
You are an expert career coach and course advisor.

Analyze the following resume and the user's domain of interest.

RESUME:
${resumeText}

DOMAIN OF INTEREST: ${domain}

Return ONLY a valid JSON object in this exact format. No markdown, no explanation, no extra text:
{
  "currentSkills": ["skill1", "skill2"],
  "skillGaps": ["gap1", "gap2"],
  "free": [
    {
      "title": "exact course title as it appears on the platform",
      "platform": "platform name",
      "url": "exact direct URL to the course",
      "level": "Beginner or Intermediate or Advanced",
      "duration": "estimated hours",
      "topic": "which skill gap this addresses"
    }
  ],
  "paid": [
    {
      "title": "exact course title as it appears on the platform",
      "platform": "platform name",
      "url": "exact direct URL to the course",
      "level": "Beginner or Intermediate or Advanced",
      "duration": "estimated hours",
      "price": "approximate price in USD",
      "topic": "which skill gap this addresses"
    }
  ]
}

STRICT RULES FOR URLS - THIS IS CRITICAL:
- For Coursera: URL must be https://www.coursera.org/learn/COURSE-SLUG (e.g. https://www.coursera.org/learn/machine-learning)
- For Udemy: URL must be https://www.udemy.com/course/COURSE-SLUG (e.g. https://www.udemy.com/course/the-web-developer-bootcamp)
- For YouTube: URL must be a real playlist https://www.youtube.com/playlist?list=PLAYLIST_ID
- For freeCodeCamp: URL must be https://www.freecodecamp.org/learn (specific section)
- For Great Learning: URL must be https://www.mygreatlearning.com/academy (specific course)
- For LinkedIn Learning: URL must be https://www.linkedin.com/learning/COURSE-SLUG
- For Pluralsight: URL must be https://www.pluralsight.com/courses/COURSE-SLUG
- For MIT OpenCourseWare: URL must be https://ocw.mit.edu/courses/COURSE-SLUG

ONLY recommend courses you are 100% certain exist with that exact URL.
If unsure about a URL, use the platform homepage for that topic instead.
Recommend exactly 5 free and 5 paid courses.
IMPORTANT: Return ONLY the JSON. No markdown, no backticks, no extra text.
`;

      const res = await model.generateContent(prompt);
      const text = res.response.candidates[0].content.parts[0].text || "";
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      return JSON.parse(cleanedText);
    });

    // Step 3: Save to DB
    await step.run("save-recommendations-to-db", async () => {
      await db.courseRecommendation.create({
        data: {
          userId: dbUser.id,
          domain,
          resumeText,
          skills: recommendations.currentSkills || [],
          courses: recommendations,
        },
      });
    });

    return { success: true, recommendations };
  }
);

// ═══════════════════════════════════════════════════════════════════
// NEW RESUME BUILDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Background ATS Analysis
 * Triggered by: { event: "resume/analyze.requested" }
 */
export const analyzeResumeBackground = inngest.createFunction(
  {
    id: "analyze-resume-background",
    name: "Analyze Resume in Background",
  },
  { event: "resume/analyze.requested" },
  async ({ event, step }) => {
    const { resumeId, userId, jobDescription } = event.data;

    // Fetch resume data with all relations
    const resume = await step.run("fetch-resume", async () => {
      return await db.resume.findUnique({
        where: { id: resumeId },
        include: {
          experiences: { orderBy: { order: "asc" } },
          education: { orderBy: { order: "asc" } },
          skills: { orderBy: { order: "asc" } },
          projects: { orderBy: { order: "asc" } },
          certifications: { orderBy: { order: "asc" } },
        },
      });
    });

    if (!resume || resume.userId !== userId) {
      throw new Error("Resume not found or access denied");
    }

    // Perform ATS analysis
    const analysis = await step.run("analyze-ats", async () => {
      return await analyzeResumeATS(resume, jobDescription);
    });

    // Generate keyword suggestions
    const keywords = await step.run("suggest-keywords", async () => {
      return await suggestKeywords(resume, jobDescription);
    });

    // Update resume with analysis results
    await step.run("update-resume", async () => {
      return await db.resume.update({
        where: { id: resumeId },
        data: {
          atsScore: analysis.overallScore,
          atsAnalysis: analysis,
          lastAnalyzedAt: new Date(),
        },
      });
    });

    // Save to analysis history
    await step.run("save-history", async () => {
      return await db.aTSAnalysisHistory.create({
        data: {
          resumeId,
          score: analysis.overallScore,
          analysis: analysis,
          recommendations: {
            recommendations: analysis.recommendations,
            keywordAnalysis: analysis.keywordAnalysis,
            suggestedKeywords: keywords,
          },
        },
      });
    });

    return {
      success: true,
      score: analysis.overallScore,
      resumeId,
    };
  }
);

/**
 * Improve Resume Content
 * Triggered by: { event: "resume/improve.requested" }
 */
export const improveResumeContent = inngest.createFunction(
  {
    id: "improve-resume-content",
    name: "Improve Resume Content",
  },
  { event: "resume/improve.requested" },
  async ({ event, step }) => {
    const { resumeId, userId, section, improvements } = event.data;

    // Verify ownership
    const resume = await step.run("verify-resume", async () => {
      return await db.resume.findFirst({
        where: {
          id: resumeId,
          userId,
        },
        include: {
          experiences: true,
          education: true,
          skills: true,
        },
      });
    });

    if (!resume) {
      throw new Error("Resume not found or access denied");
    }

    // Process improvements based on section
    await step.run("apply-improvements", async () => {
      console.log(`Applying improvements to ${section}:`, improvements);
      // You can expand this with actual improvement logic
      // For example, update specific experiences, education entries, etc.
    });

    return {
      success: true,
      resumeId,
      section,
    };
  }
);

/**
 * Auto-analyze resume after update (with debounce)
 * Triggered by: { event: "resume/updated" }
 */
export const autoAnalyzeResume = inngest.createFunction(
  {
    id: "auto-analyze-resume",
    name: "Auto Analyze Resume After Update",
  },
  { event: "resume/updated" },
  async ({ event, step }) => {
    const { resumeId, userId } = event.data;

    // Wait 5 seconds to allow user to make multiple changes
    await step.sleep("wait-for-changes", "5s");

    // Check if resume still exists
    const resume = await step.run("check-resume", async () => {
      return await db.resume.findUnique({
        where: { id: resumeId },
      });
    });

    if (!resume) {
      return { skipped: true, reason: "Resume deleted" };
    }

    // Trigger background analysis
    await step.sendEvent("trigger-analysis", {
      name: "resume/analyze.requested",
      data: {
        resumeId,
        userId,
      },
    });

    return { success: true };
  }
);

/**
 * Generate resume from course recommendations
 * Triggered by: { event: "resume/generate-from-courses" }
 * This helps users build resumes based on their completed courses
 */
export const generateResumeFromCourses = inngest.createFunction(
  {
    id: "generate-resume-from-courses",
    name: "Generate Resume from Course Recommendations",
  },
  { event: "resume/generate-from-courses" },
  async ({ event, step }) => {
    const { userId, courseRecommendationId } = event.data;

    // Fetch user and course recommendations
    const data = await step.run("fetch-data", async () => {
      const user = await db.user.findUnique({ where: { id: userId } });
      const courseRec = await db.courseRecommendation.findUnique({
        where: { id: courseRecommendationId },
      });

      if (!user || !courseRec) {
        throw new Error("User or course recommendation not found");
      }

      return { user, courseRec };
    });

    // Generate skills section from courses
    const skills = await step.run("generate-skills", async () => {
      const allSkills = [
        ...(data.courseRec.skills || []),
        ...(data.courseRec.courses?.currentSkills || []),
      ];

      // Group skills by category
      const categorized = {
        technical: [],
        soft: [],
        tools: [],
      };

      allSkills.forEach((skill) => {
        // Simple categorization - you can enhance this
        if (skill.match(/javascript|python|java|react|node/i)) {
          categorized.technical.push(skill);
        } else if (skill.match(/communication|leadership|teamwork/i)) {
          categorized.soft.push(skill);
        } else {
          categorized.tools.push(skill);
        }
      });

      return [
        { category: "Technical Skills", name: categorized.technical.join(", "), level: "" },
        { category: "Soft Skills", name: categorized.soft.join(", "), level: "" },
        { category: "Tools & Technologies", name: categorized.tools.join(", "), level: "" },
      ].filter((s) => s.name);
    });

    // Create a suggested resume
    const resume = await step.run("create-resume", async () => {
      return await db.resume.create({
        data: {
          userId,
          title: `Resume - ${data.courseRec.domain}`,
          template: "modern",
          fullName: data.user.name || "",
          email: data.user.email || "",
          phone: "",
          summary: `Aspiring ${data.courseRec.domain} professional with coursework and practical knowledge in key technologies and methodologies.`,
          skills: {
            create: skills.map((skill, index) => ({ ...skill, order: index })),
          },
        },
      });
    });

    return { success: true, resumeId: resume.id };
  }
);

/**
 * Batch analyze multiple resumes
 * Triggered by: { event: "resume/batch-analyze" }
 */
export const batchAnalyzeResumes = inngest.createFunction(
  {
    id: "batch-analyze-resumes",
    name: "Batch Analyze Multiple Resumes",
  },
  { event: "resume/batch-analyze" },
  async ({ event, step }) => {
    const { userId, resumeIds } = event.data;

    const results = [];

    for (const resumeId of resumeIds) {
      const result = await step.run(`analyze-${resumeId}`, async () => {
        // Trigger individual analysis
        await inngest.send({
          name: "resume/analyze.requested",
          data: { resumeId, userId },
        });

        return { resumeId, triggered: true };
      });

      results.push(result);
    }

    return { success: true, analyzed: results.length, results };
  }
);

/**
 * Export all Inngest functions
 */
export const inngestFunctions = [
  generateIndustryInsights,
  generateCourseRecommendations,
  analyzeResumeBackground,
  improveResumeContent,
  autoAnalyzeResume,
  generateResumeFromCourses,
  batchAnalyzeResumes,
];