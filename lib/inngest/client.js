export const courseRecommendation = inngest.createFunction(
  { id: "course-recommendation" },
  { event: "courses/recommend" },
  async ({ event }) => {
    console.log("🔥 Function started");

    try {
      // ⛔ IMPORTANT: dummy return first to test
      return {
        success: true,
        message: "Function working",
      };

    } catch (error) {
      console.error("❌ Error:", error);
      return { success: false };
    }
  }
);