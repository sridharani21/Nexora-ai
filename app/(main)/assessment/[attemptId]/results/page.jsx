import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import { getOwnedAttempt } from "@/lib/module2/assessment-engine";
import { formatAssessmentDateTime, formatAssessmentTime } from "@/lib/assessment-date-format";

export default async function AssessmentResultsPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { attemptId } = await params;
  const attempt = await getOwnedAttempt(attemptId, userId);
  if (!attempt) notFound();
  if (attempt.status === "ACTIVE") redirect(`/assessment/${attemptId}`);
  if (attempt.status === "GENERATING") redirect("/assessment");
  if (!attempt.result) redirect("/assessment");

  const result = attempt.result;
  const startedAt = attempt.startedAt ? new Date(attempt.startedAt) : null;
  const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt) : null;
  const timeTaken = startedAt && submittedAt
    ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 60_000))
    : null;
  const completionDetail = attempt.completionReason === "TIME_EXPIRED"
    ? "Deadline reached"
    : attempt.completionReason === "INTEGRITY_TERMINATION"
      ? "Submitted after a monitoring event"
      : attempt.completionReason === "MONITORING_INTERRUPTED"
        ? result.integritySummary?.eventTypes?.some((eventType) => ["MOBILE_DEVICE_DETECTED", "UNSUPPORTED_CLIENT"].includes(eventType))
          ? "Unsupported mobile assessment client"
          : "Assessment ended because required monitoring was interrupted"
        : "Submitted by you";

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Assessment complete</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Your results</h1>
          <p className="mt-2 text-slate-600">{attempt.branch} · {submittedAt ? formatAssessmentDateTime(submittedAt) : "Submitted"} · {attempt.status}</p>
        </div>
        <Link href={`/assessment/${attemptId}/analysis`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800">
          Assessment Analysis <ArrowRight className="size-4" />
        </Link>
      </header>

      {attempt.cooldownUntil && ["INTEGRITY_TERMINATION", "MONITORING_INTERRUPTED"].includes(attempt.completionReason) && (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This attempt ended with a 10-minute retake cooldown. You can start another assessment after {formatAssessmentTime(attempt.cooldownUntil)}.
        </section>
      )}
      {result.integritySummary?.flaggedForReview && (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This attempt was flagged for review after repeated monitoring incidents. Focus changes alone do not establish cheating.
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Score" value={`${result.score} / ${result.maxMarks}`} detail={`${result.percentage}%`} />
        <Summary label="MCQ accuracy" value={result.accuracy === null ? "—" : `${result.accuracy}%`} detail="Correct MCQs ÷ attempted MCQs" />
        <Summary label="Questions" value={`${result.correct} correct`} detail={`${result.incorrect} incorrect · ${result.unanswered} unanswered`} />
        <Summary label="Time used" value={timeTaken === null ? "—" : `${timeTaken} min`} detail={completionDetail} icon={<Clock3 className="size-4 text-indigo-700" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Section performance</h2>
          <div className="mt-5 space-y-5">
            {result.sections.map((section) => {
              const percent = Math.max(0, Math.min(100, section.score / section.maxMarks * 100));
              return (
                <div key={section.id}>
                  <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-800">{section.name}</span><span className="text-slate-600">{section.score.toFixed(2)} / {section.maxMarks}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Topic strengths and practice areas</h2>
          {result.strengths.length > 0 && <p className="mt-4 flex items-start gap-2 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span><strong>Strengths:</strong> {result.strengths.join(", ")}</span></p>}
          {result.improvementAreas.length > 0 && <p className="mt-3 flex items-start gap-2 text-sm text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span><strong>Practice next:</strong> {result.improvementAreas.join(", ")}</span></p>}
          {!result.strengths.length && !result.improvementAreas.length && <p className="mt-4 text-sm text-slate-600">Topic evidence is limited; use the question review below to guide practice.</p>}
          <p className="mt-5 text-xs leading-5 text-slate-500">A single assessment is a learning snapshot, not a guarantee of placement readiness.</p>
        </div>
      </section>

      {result.codingOutcomes.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Coding outcomes</h2>
          <div className="mt-4 space-y-3">
            {result.codingOutcomes.map((outcome) => (
              <div key={outcome.questionId} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-4 text-sm">
                <span className="font-medium">{outcome.topic}</span>
                <span>{outcome.status || "Not submitted"}{outcome.total ? ` · ${outcome.passed}/${outcome.total} tests passed` : ""}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Private test inputs and expected outputs are not shown.</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Answer review</h2>
        <p className="mt-1 text-sm text-slate-600">This question and answer review is available after this account’s attempt is submitted or expires.</p>
        <div className="mt-4 space-y-4">
          {result.questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{question.sectionName} · {question.topic}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${question.status === "CORRECT" ? "bg-emerald-50 text-emerald-800" : question.status === "UNANSWERED" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-900"}`}>{question.status}</span>
              </div>
              <h3 className="mt-2 font-medium leading-6 text-slate-900">{index + 1}. {question.questionText}</h3>
              <p className="mt-2 text-sm text-slate-600"><strong>Skill:</strong> {question.skillTested} · <strong>Learning objective:</strong> {question.learningObjective}</p>
              {question.type === "MCQ" && (
                <p className="mt-2 text-sm text-slate-700">
                  Your answer: {question.options.find((option) => option.key === question.answer)?.text || "Unanswered"}
                  {" · "}Correct answer: {question.options.find((option) => option.key === question.correctAnswer)?.text}
                </p>
              )}
              {question.type === "CODING" && question.solution && (
                <details className="mt-3 rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-800">View reference solution</summary>
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-slate-800">{question.solution}</pre>
                </details>
              )}
              {question.selectionReason && <p className="mt-3 text-sm leading-6 text-slate-600"><strong>Why selected:</strong> {question.selectionReason}</p>}
              {question.expectedEvidence && <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Expected evidence:</strong> {question.expectedEvidence}</p>}
              {question.evaluationCriteria && <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Evaluation criteria:</strong> {question.evaluationCriteria}</p>}
              <p className="mt-2 text-sm leading-6 text-slate-600">{question.explanation}</p>
              <p className="mt-2 text-xs text-slate-500">Score: {Number(question.score || 0).toFixed(2)} / {question.marks}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Summary({ label, value, detail, icon }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-slate-500">{icon}{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
