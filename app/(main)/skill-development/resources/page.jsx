import { Suspense } from "react";
import SkillDevelopmentResourcesClient from "./resources-client";

export default function SkillDevelopmentResourcesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-5xl">Loading learning resources…</div></main>}>
      <SkillDevelopmentResourcesClient />
    </Suspense>
  );
}
