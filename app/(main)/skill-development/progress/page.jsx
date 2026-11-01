import { Suspense } from "react";
import SkillDevelopmentProgressClient from "./progress-client";

export default function SkillDevelopmentProgressPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-5xl">Loading your progress…</div></main>}>
      <SkillDevelopmentProgressClient />
    </Suspense>
  );
}
