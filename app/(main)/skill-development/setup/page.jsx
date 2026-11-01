import { Suspense } from "react";
import SkillDevelopmentSetup from "./setup-client";

export default function SkillDevelopmentSetupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-12 text-sm text-slate-900"><div className="mx-auto max-w-4xl">Loading career preparation setup…</div></main>}>
      <SkillDevelopmentSetup />
    </Suspense>
  );
}
