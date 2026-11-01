import { Suspense } from "react";
import MockInterviewSetup from "../_components/mock-interview-setup";

export const metadata = { title: "Interview Setup · Module 6 | Nexora AI" };

export default function MockInterviewSetupPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading interview setup…</main>}>
      <MockInterviewSetup />
    </Suspense>
  );
}
