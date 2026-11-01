import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const protectedRoutes = createRouteMatcher([
  "/dashboard(.*)",
  "/assessment(.*)",
  "/resume(.*)",
  "/ai-cover-letter(.*)",
  "/interview(.*)",
  "/onboarding(.*)",
  "/student-profile(.*)",
  "/start-prep(.*)",
  "/chat(.*)",
  "/career-chat(.*)",
  "/course-recommendations(.*)",
  "/roadmap(.*)",
  "/skill-development(.*)",
  "/mock-interview(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (protectedRoutes(request)) await auth.protect();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nexora-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});