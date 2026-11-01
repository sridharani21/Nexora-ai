"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ListChecks } from "lucide-react";
import { completeRiasecAttempt, saveRiasecResponse } from "@/actions/module3-riasec";

const OPTIONS = [
  { value: 1, label: "Strongly dislike" },
  { value: 2, label: "Dislike" },
  { value: 3, label: "Neutral / unsure" },
  { value: 4, label: "Like" },
  { value: 5, label: "Strongly like" },
];

export default function RiasecQuestionnaire({ attempt }) {
  const router = useRouter();
  const [responses, setResponses] = useState(attempt.responses || {});
  const [index, setIndex] = useState(() => {
    const firstUnanswered = attempt.questions.findIndex((question) => attempt.responses?.[question.id] === undefined);
    return firstUnanswered < 0 ? 0 : firstUnanswered;
  });
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingSaves = useRef(new Map());
  const question = attempt.questions[index];
  const answeredCount = Object.keys(responses).length;

  function answer(value) {
    setError("");
    setResponses((current) => ({ ...current, [question.id]: value }));
    const previous = pendingSaves.current.get(question.id) || Promise.resolve();
    const save = previous.catch(() => {}).then(() => saveRiasecResponse({
      attemptId: attempt.id,
      questionId: question.id,
      score: value,
    }));
    pendingSaves.current.set(question.id, save);
    save.then((result) => {
      if (!result.success) setError(result.error || "Your answer could not be saved. Try again.");
    }).catch(() => setError("Your answer could not be saved. Check your connection and try again."));
  }

  async function submit() {
    const missingIndex = attempt.questions.findIndex((item) => responses[item.id] === undefined);
    if (missingIndex !== -1) {
      setConfirm(false);
      setReview(true);
      setIndex(missingIndex);
      setError("Answer every question before submitting.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const saveResults = await Promise.all([...pendingSaves.current.values()]);
        const failedSave = saveResults.find((result) => !result.success);
        if (failedSave) {
          setError(failedSave.error || "An answer could not be saved. Please try again.");
          return;
        }
        const result = await completeRiasecAttempt({ attemptId: attempt.id });
        if (!result.success) {
          setError(result.error || "Your results could not be calculated.");
          return;
        }
        router.push(`/career-interests/${attempt.id}/results`);
      } catch {
        setError("Your answers could not be submitted. Check your connection and try again.");
      }
    });
  }

  if (review) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Review answers</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Check your responses</h1>
            <p className="mt-2 text-sm text-slate-600">{answeredCount} of {attempt.questions.length} answered</p>
          </div>
          <button type="button" onClick={() => setReview(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to question</button>
        </header>
        <ol className="mt-6 space-y-2">
          {attempt.questions.map((item, itemIndex) => (
            <li key={item.id}>
              <button type="button" onClick={() => { setIndex(itemIndex); setReview(false); }} className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40">
                <span className="text-sm text-slate-800"><span className="mr-2 font-semibold text-slate-500">{itemIndex + 1}.</span>{item.statement}</span>
                <span className={`shrink-0 text-xs font-semibold ${responses[item.id] ? "text-emerald-700" : "text-amber-700"}`}>{responses[item.id] ? OPTIONS[responses[item.id] - 1].label : "Unanswered"}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setConfirm(true)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">Review and submit <ArrowRight className="size-4" /></button>
        {confirm && <ConfirmSubmit onCancel={() => setConfirm(false)} onSubmit={submit} isPending={isPending} />}
        {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-700">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">Career interests · No timer</p>
          <button type="button" onClick={() => setReview(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ListChecks className="size-4" /> Review</button>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <span>Question {index + 1} of {attempt.questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Assessment progress" aria-valuemin={0} aria-valuemax={attempt.questions.length} aria-valuenow={answeredCount}>
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(answeredCount / attempt.questions.length) * 100}%` }} />
        </div>
      </header>

      <div className="mt-9 min-h-56">
        <h1 className="text-2xl font-bold leading-snug text-slate-950 sm:text-3xl">{question.statement}</h1>
        <p className="mt-3 text-sm text-slate-600">How much would you enjoy doing this activity?</p>
        <fieldset className="mt-7">
          <legend className="sr-only">Choose how much you would enjoy this activity</legend>
          <div className="grid gap-2 sm:grid-cols-5">
            {OPTIONS.map((option) => {
              const selected = responses[question.id] === option.value;
              return (
                <button key={option.value} type="button" aria-pressed={selected} onClick={() => answer(option.value)} className={`min-h-16 rounded-xl border px-3 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? "border-indigo-700 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-700" : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"}`}>
                  <span className="block text-xs text-slate-500">{option.value}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ArrowLeft className="size-4" /> Previous</button>
        {index < attempt.questions.length - 1 ? (
          <button type="button" onClick={() => setIndex((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">Next <ArrowRight className="size-4" /></button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800"><Check className="size-4" /> Finish assessment</button>
        )}
      </footer>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-700">{error}</p>}
      {confirm && <ConfirmSubmit onCancel={() => setConfirm(false)} onSubmit={submit} isPending={isPending} />}
    </section>
  );
}

function ConfirmSubmit({ onCancel, onSubmit, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="submit-riasec-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="submit-riasec-title" className="text-lg font-bold text-slate-950">Submit your answers?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your six interest scores will be calculated from these responses. You cannot change answers after submitting.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={isPending} onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Keep reviewing</button>
          <button type="button" disabled={isPending} onClick={onSubmit} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isPending && <LoaderCircle className="size-4 animate-spin" />}
            {isPending ? "Calculating..." : "Submit"}
          </button>
        </div>
      </section>
    </div>
  );
}
