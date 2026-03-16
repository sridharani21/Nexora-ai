import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const protectedRoutes = createRouteMatcher([
  "/dashboard(.*)",
  "/resume(.*)",
  "/ai-cover-letter(.*)",
  "/interview(.*)",
  "/onboarding(.*)",
  "/chat(.*)",
  "/career-chat(.*)",
  "/course-recommendations(.*)",
  "/roadmap(.*)",
]);

export default clerkMiddleware({
  matcher: protectedRoutes, // only these paths
});