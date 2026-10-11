import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const protectedRoutes = createRouteMatcher([
  "/dashboard(.*)",
  "/assessment(.*)",
  "/resume(.*)",
  "/ai-cover-letter(.*)",
  "/interview(.*)",
  "/onboarding(.*)",
  "/chat(.*)",
  "/career-chat(.*)",
  "/course-recommendations(.*)",
  "/roadmap(.*)",
  "/placement-dashboard(.*)",
  "/placement-assessment(.*)",
  "/placement-prep(.*)",
]);

export default clerkMiddleware({
  matcher: protectedRoutes, // only these paths
});