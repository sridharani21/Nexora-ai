import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getModule4Run } from "@/actions/module4-careers";

export default async function RecommendationRunPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { runId } = await params;
  const run = await getModule4Run(runId);
  if (!run) notFound();
  return (
    <main className="module4-theme mx-auto w-full max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/career-explorer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft className="size-4" aria-hidden="true" />Back to Career Explorer</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Historical snapshot</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Career options from {new Date(run.createdAt).toLocaleDateString("en-IN")}</h1><p className="mt-2 text-sm text-slate-600">Ranking: {run.rankingMethod}.</p></header>
      {run.limitations.length > 0 && <ul className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{run.limitations.map((item) => <li key={item}>• {item}</li>)}</ul>}
      <section className="grid gap-4 md:grid-cols-2">{run.recommendations.map((career) => <article key={career.slug} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Option {career.rank}</p><h2 className="mt-2 text-xl font-bold text-slate-950">{career.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{career.explanation}</p><Link href={`/career-explorer/${career.slug}`} className="mt-4 inline-block text-sm font-bold text-indigo-700">Open current career profile</Link></article>)}</section>
    </main>
  );
}
