import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, ArrowRight, TrendingUp } from "lucide-react";
import {
  getAttemptLeaderboard,
  getOwnedAttempt,
  getStudentAttemptList,
} from "@/lib/module2/assessment-engine";

export default async function AssessmentAnalysisPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { attemptId } = await params;
  const [attempt, attempts] = await Promise.all([
    getOwnedAttempt(attemptId, userId),
    getStudentAttemptList(userId),
  ]);
  if (!attempt) notFound();
  if (!attempt.result) redirect(`/assessment/${attemptId}`);

  const result = attempt.result;
  const history = attempts.filter((item) => (
    item.branch === attempt.branch
    && item.blueprintVersion === attempt.blueprintVersion
    && item.score !== null
  )).reverse();
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const change = previous ? Number(result.score) - Number(previous.score) : null;
  const leaderboard = await getAttemptLeaderboard(attemptId, userId);
  const questionTimes = result.questionTimes || [];
  const maxQuestionSeconds = Math.max(1, ...questionTimes.map((item) => item.seconds));

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <Link href={`/assessment/${attemptId}/results`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline"><ArrowLeft className="size-4" />Back to results</Link>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Measured performance</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Assessment Analysis</h1>
        <p className="mt-2 text-slate-600">Analysis from your saved {attempt.branch} assessment. Recommendations below are inferred from this attempt, not a placement prediction.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm text-slate-500">Overall measured score</p><p className="mt-2 text-4xl font-bold text-slate-950">{result.score}<span className="text-xl text-slate-400"> / {result.maxMarks}</span></p></div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><TrendingUp className="size-6" /></div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }} /></div>
          <p className="mt-2 text-sm text-slate-600">{result.percentage}% score · {result.accuracy === null ? "No answered MCQs to calculate accuracy" : `${result.accuracy}% MCQ accuracy`} · {result.correct} correct, {result.incorrect} incorrect, {result.unanswered} unanswered</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Progress across attempts</h2>
          {previous ? (
            <p className="mt-4 text-sm leading-6 text-slate-700">
              Previous result: <strong>{previous.score} / 100</strong>. This attempt changed by <strong>{change > 0 ? "+" : ""}{change.toFixed(2)} points</strong>.
            </p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">This is your first completed attempt. Historical progress will appear after a later attempt.</p>
          )}
          {history.length > 1 && (
            <ol className="mt-4 flex flex-wrap gap-2">
              {history.map((item, index) => <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">Attempt {index + 1}: {item.score} / 100</li>)}
            </ol>
          )}
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Section performance</h2>
          <div className="mt-5 space-y-5">
            {result.sections.map((section) => {
              const percentage = Math.max(0, Math.min(100, section.score / section.maxMarks * 100));
              return <div key={section.id}><div className="flex justify-between gap-3 text-sm"><span>{section.name}</span><span>{section.score.toFixed(2)} / {section.maxMarks} ({percentage.toFixed(0)}%)</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${percentage}%` }} /></div></div>;
            })}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Topic evidence</h2>
          <div className="mt-4 space-y-3">
            {result.topics.map((topic) => (
              <div key={topic.topic} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span className="font-medium text-slate-800">{topic.topic}</span>
                <span className="text-slate-600">{topic.percentage === null ? "Unknown" : `${topic.percentage}%`} · {topic.correct}/{topic.total}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-slate-950">Inferred practice priorities</h2>
          {result.improvementAreas.length ? (
            <>
              <p className="mt-2 text-sm text-slate-700">Topics below scored under 60% on this attempt:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">{result.improvementAreas.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            </>
          ) : <p className="mt-2 text-sm text-slate-700">No topic fell below the current practice threshold. Continue building skills with targeted exercises.</p>}
          <Link href="/skill-development/setup" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Start your skill development plan <ArrowRight className="size-4" /></Link>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Time and coding</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Attempt completion: {result.completionReason}. Coding scores are based on tests actually evaluated by Judge0; private test inputs and outputs are never included here.</p>
          {result.codingOutcomes.length > 0 && <ul className="mt-3 space-y-2 text-sm">{result.codingOutcomes.map((code) => <li key={code.questionId}>{code.topic}: {code.status || "not submitted"}{code.total ? ` (${code.passed}/${code.total})` : ""}</li>)}</ul>}
          <Link href="/career-explorer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Explore career paths <ArrowRight className="size-4" /></Link>
          <Link href="/career-interests" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Explore your career interests <ArrowRight className="size-4" /></Link>
        </article>
      </section>

      {leaderboard.length > 0 && (
        <section className="rounded-2xl border border-indigo-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Branch leaderboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Anonymous opt-in participants · {leaderboard[0].participantCount} student{leaderboard[0].participantCount === 1 ? "" : "s"} · ranked by score, then faster completion. Only each student&apos;s best opted-in attempt counts.
          </p>
          <ol className="mt-4 space-y-2">
            {leaderboard.filter((item) => item.rank <= 10).map((item) => (
              <li key={item.rank} className={`grid grid-cols-[4rem_1fr_auto_auto] items-center gap-3 rounded-lg px-3 py-2 text-sm ${item.isYou ? "bg-indigo-50 font-semibold text-indigo-950" : "bg-slate-50 text-slate-700"}`}>
                <span>#{item.rank}</span>
                <span>{item.isYou ? "You" : `Student ${item.rank}`}</span>
                <span>{item.score} / 100</span>
                <span>{Math.floor(item.timeUsedSeconds / 60)}m {item.timeUsedSeconds % 60}s</span>
              </li>
            ))}
          </ol>
          {leaderboard.some((item) => item.isYou && item.rank > 10) && (
            <p className="mt-3 text-sm font-medium text-indigo-800">
              Your current position: #{leaderboard.find((item) => item.isYou).rank} of {leaderboard.find((item) => item.isYou).participantCount}.
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Time spent per question</h2>
        <p className="mt-1 text-sm text-slate-600">Measured while each question was visible in the focused, fullscreen assessment. This graph is for practice, not ranking.</p>
        <div className="mt-5 space-y-2">
          {questionTimes.map((item) => (
            <div key={item.questionNumber} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3 text-xs">
              <span className="truncate text-slate-600">Q{item.questionNumber} · {item.sectionName}</span>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.max(item.seconds > 0 ? 2 : 0, item.seconds / maxQuestionSeconds * 100)}%` }} />
              </div>
              <span className="text-right font-medium text-slate-700">{Math.floor(item.seconds / 60)}:{String(item.seconds % 60).padStart(2, "0")}</span>
            </div>
          ))}
          {!questionTimes.length && <p className="text-sm text-slate-600">Per-question timing is not available for this attempt.</p>}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Performance by difficulty</h2>
          <div className="mt-4 space-y-3">
            {result.difficulties.map((item) => (
              <div key={item.difficulty} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                <span className="font-medium capitalize">{item.difficulty.toLocaleLowerCase()}</span>
                <span>{item.correct} correct · {item.incorrect} incorrect · {item.unanswered} unanswered</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Time management</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Total time used: {result.timeUsedSeconds === null ? "Unknown" : `${Math.floor(result.timeUsedSeconds / 60)} minutes ${result.timeUsedSeconds % 60} seconds`}.
            The exam does not collect per-question or per-section dwell times, so no finer time-use estimate is shown.
          </p>
        </article>
      </section>
    </main>
  );
}
