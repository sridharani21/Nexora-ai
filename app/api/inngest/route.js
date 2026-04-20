// // app/api/inngest/route.js

// import { inngest } from "@/lib/inngest/client";
// import { serve } from "inngest/next";

// // Existing function
// import { generateIndustryInsights } from "@/lib/inngest/functions";

// // New course recommendation functions
// import {  generateCourseRecommendations } from "@/lib/inngest/functions";

// export const { GET, POST, PUT } = serve({
//   client: inngest,
//   functions: [
//     generateIndustryInsights,
//     generateCourseRecommendations
//   ],
// });


export const dynamic = "force-dynamic";

import { inngest } from "@/lib/inngest/client";
import { serve } from "inngest/next";
import { inngestFunctions } from "@/lib/inngest/functions";

export const { GET, POST } = serve({
  client: inngest,
  functions: inngestFunctions,
});