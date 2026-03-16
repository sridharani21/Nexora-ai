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




import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// ─── Existing Function ─────────────────────────────────────────────────────
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