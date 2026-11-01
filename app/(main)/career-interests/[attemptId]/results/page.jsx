import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";
import { getRiasecAttempt, getRiasecHistory } from "@/actions/module3-riasec";
import { RIASEC_DIMENSIONS, RIASEC_DIMENSION_INFO } from "@/lib/module3/riasec-scoring.js";

export const metadata = {
  title: "Career Interest Results | Nexora AI",
  description: "Review your RIASEC career-interest results and assessment history.",
};

export default async function RiasecResultsPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { attemptId } = await params;
  const [attempt, history] = await Promise.all([getRiasecAttempt(attemptId), getRiasecHistory()]);
  if (!attempt) notFound();
  if (attempt.status !== "COMPLETE") redirect(`/career-interests/${attemptId}`);

  const ranking = [...RIASEC_DIMENSIONS].sort((left, right) => (
    attempt.scores[right].mean - attempt.scores[left].mean ||
    RIASEC_DIMENSIONS.indexOf(left) - RIASEC_DIMENSIONS.indexOf(right)
  ));
  const topScore = attempt.scores[ranking[0]].mean;
  const tiedTop = ranking.filter((dimension) => attempt.scores[dimension].mean === topScore);

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <header className="rounded-3xl bg-slate-950 p-7 text-white sm:p-10">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-cyan-200"><Compass className="size-5" /></div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-cyan-200">Your career-interest profile</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your interest code: {attempt.interestCode}</h1>
        <p className="mt-3 text-slate-300">A reflection of the activities you enjoy—not a measure of your ability or a limit on your options.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Your six interest areas</h2>
          <p className="mt-1 text-sm text-slate-600">Mean response from 1 (strongly dislike) to 5 (strongly like).</p>
          <ol className="mt-5 space-y-4">
            {ranking.map((dimension, position) => {
              const info = RIASEC_DIMENSION_INFO[dimension];
              const score = attempt.scores[dimension];
              return (
                <li key={dimension}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{position < 3 ? `${position + 1}. ` : ""}{info.name}{tiedTop.includes(dimension) ? " · tied highest" : ""}</span>
                    <span className="tabular-nums text-slate-600">{score.mean.toFixed(2)} / 5 · {score.percentage}%</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-100" role="img" aria-label={`${info.name}: ${score.mean.toFixed(2)} out of 5, ${score.percentage} percent`}>
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${score.percentage}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs leading-5 text-slate-500">The percentage maps the 1–5 response scale to 0–100 for visualization; it is not a percentile or comparison with other students.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">What your pattern can suggest</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{attempt.interpretation}</p>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">RIASEC results are a self-reflection tool, not clinical advice, a skills assessment, or a guaranteed career recommendation. You remain in control of what to explore.</p>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/career-explorer" className="group rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 transition hover:bg-indigo-50">
          <h2 className="font-bold text-slate-950">Explore career paths</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Use your skills, goals, and interests to explore options in Career Discovery.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">Career Discovery <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
        <Link href="/career-interests" className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50">
          <h2 className="font-bold text-slate-950">Assessment history</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{history.filter((item) => item.status === "COMPLETE").length} completed result{history.filter((item) => item.status === "COMPLETE").length === 1 ? "" : "s"} saved. Start another whenever you want.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">View history <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
      </section>
    </main>
  );
}
