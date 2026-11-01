"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MockInterviewReport({ sessionId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/mock-interview/sessions/${encodeURIComponent(sessionId)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load this report.");
      if (active) setData(payload);
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [sessionId]);

  if (error) return <Message error={error} />;
  if (!data) return <main className="mx-auto max-w-5xl px-4 py-12 text-sm text-slate-500">Loading your report…</main>;
  const { session, recommendations } = data;
  const report = session.report;
  if (!report) return <main className="mx-auto max-w-3xl space-y-4 px-4 py-12"><p>This interview has not been finalized yet. Resume it to submit more answers or finish early.</p><Link className="font-semibold text-indigo-700 underline" href={`/mock-interview/session/${session.id}`}>Resume interview</Link></main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-24 sm:px-6 lg:py-12">
      <header className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-950 p-6 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Module 6 · Interview report</p>
        <h1 className="mt-2 break-words text-3xl font-bold sm:text-4xl">{session.careerTitle}</h1>
        <p className="mt-2 text-sm capitalize text-indigo-100">{session.interviewType} · {session.difficulty} · {session.duration} minutes · {report.completedAnswers}/{report.totalQuestions} answers</p>
        <p className="mt-5 text-sm text-indigo-100">Overall practice score</p>
        <p className="text-5xl font-extrabold">{report.overallScore === null ? "—" : `${report.overallScore}%`}</p>
        <p className="mt-3 text-xs leading-5 text-indigo-100">{report.note}</p>
      </header>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
        {Object.entries(report.categoryScores || {}).map(([category, score]) => <article key={category} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5"><p className="break-words text-xs font-semibold uppercase text-slate-500">{category}</p><p className="mt-2 text-2xl font-bold text-slate-950">{score}%</p></article>)}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <ListCard title="Strengths" items={report.strengths} empty="No strengths were scored because no answers were submitted." />
        <ListCard title="Areas to improve" items={report.improvementAreas} empty="No improvement areas were identified." />
      </section>
      {recommendations?.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-bold text-amber-950">Practice these areas in Module 5</h2><ul className="mt-3 space-y-2">{recommendations.map((item) => <li key={item.skill}><Link href={item.href} className="font-semibold text-indigo-800 underline">{item.skill}: {item.title}</Link></li>)}</ul></section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold text-slate-950">Question-by-question review</h2>
        <div className="mt-4 space-y-4">
          {session.questions.map((question, index) => {
            const answer = session.answers.find((item) => item.questionId === question.id);
            return <article key={question.id} className="min-w-0 break-words rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-indigo-700">Question {index + 1} · {question.category}</p>
              <h3 className="mt-2 font-bold leading-6 text-slate-900">{question.question}</h3>
              {answer ? <>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{answer.answerText}</p>
                {answer.evaluation.conversation?.interviewerTurns?.length > 0 && <div className="mt-3 rounded-xl bg-indigo-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Interviewer response and follow-up · {answer.evaluation.conversation.mode === "tavus_video" ? "Tavus video interview" : "Gemini Live"}</p>
                  {answer.evaluation.conversation.interviewerTurns.map((turn, turnIndex) => <p key={`${turn.savedAt}-${turnIndex}`} className="mt-2 whitespace-pre-wrap text-sm leading-6 text-indigo-950">{turn.text}</p>)}
                </div>}
                <p className="mt-2 font-bold text-indigo-800">Practice score: {answer.score}%</p>
                {answer.evaluation.improvements?.map((item) => <p key={item} className="mt-1 text-sm text-slate-600">• {item}</p>)}
                {answer.evaluation.modelAnswerOutline?.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">View answer outline</summary><ul className="mt-2 list-inside list-disc text-sm text-slate-700">{answer.evaluation.modelAnswerOutline.map((point) => <li key={point}>{point}</li>)}</ul></details>}
              </> : <p className="mt-3 text-sm italic text-slate-500">No answer submitted.</p>}
            </article>;
          })}
        </div>
      </section>
      <div className="flex flex-wrap gap-3"><Link href="/mock-interview/setup" className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white">Practice again</Link><Link href="/mock-interview/history" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Interview history</Link><Link href="/skill-development/setup" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">Return to Module 5</Link></div>
    </main>
  );
}

function ListCard({ title, items = [], empty }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-950">{title}</h2>{items.length ? <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{empty}</p>}</section>;
}

function Message({ error }) {
  return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p></main>;
}
