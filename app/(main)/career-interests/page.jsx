import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { getRiasecHistory } from "@/actions/module3-riasec";
import StartRiasecButton from "./_components/start-riasec-button";

export const metadata = {
  title: "Career Interests | Nexora AI",
  description: "Explore your career interests with a balanced RIASEC self-reflection assessment.",
};

export default async function CareerInterestsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const history = await getRiasecHistory();
  const active = history.find((attempt) => attempt.status === "IN_PROGRESS");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="rounded-3xl bg-slate-950 p-8 text-white sm:p-12">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
          <Compass className="size-6" />
        </div>
        <p className="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Career interests</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Discover the activities and environments that interest you.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          Reflect on 24 everyday work activities across six interest areas. There is no timer and no right or wrong answer. Your results are a starting point for exploration—not a test of ability or a career prediction.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <StartRiasecButton attemptId={active?.id} />
          <span className="text-sm text-slate-300">About 5 minutes · Save and continue anytime</span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="RIASEC interest areas">
        {[
          ["R", "Realistic", "Practical, hands-on activities"],
          ["I", "Investigative", "Research and problem-solving"],
          ["A", "Artistic", "Creative expression and design"],
          ["S", "Social", "Helping, teaching, and supporting"],
          ["E", "Enterprising", "Initiative and leading action"],
          ["C", "Conventional", "Organization and accurate processes"],
        ].map(([code, name, description]) => (
          <article key={code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">{code}</span>
            <h2 className="mt-3 font-semibold text-slate-950">{name}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-cyan-800" />
          <p className="text-sm leading-6 text-slate-700">
            Your six scores are calculated consistently by the assessment service from your answers. AI may help explain the result, but it cannot change your scores. You can review your past results below.
          </p>
        </div>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="riasec-history-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="riasec-history-heading" className="text-xl font-bold text-slate-950">Your assessment history</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {history.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-slate-900">{attempt.status === "COMPLETE" ? `Interest code: ${attempt.interestCode}` : "Assessment in progress"}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(attempt.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                </div>
                {attempt.status === "COMPLETE" ? (
                  <Link href={`/career-interests/${attempt.id}/results`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">
                    View results <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link href={`/career-interests/${attempt.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">
                    Continue <ArrowRight className="size-4" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
