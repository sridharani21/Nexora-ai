import { Suspense } from "react";
import SkillDevelopmentPlanClient from "./plan-client";

export default function SkillDevelopmentPlanPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-6xl">Loading your preparation plan…</div></main>}>
      <SkillDevelopmentPlanClient />
    </Suspense>
  );
}
