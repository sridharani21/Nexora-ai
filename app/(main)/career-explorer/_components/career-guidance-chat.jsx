"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";

export default function CareerGuidanceChat({ slug }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function ask(event) {
    event.preventDefault();
    const message = question.trim();
    if (!message || pending) return;
    setPending(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch("/api/career-explorer/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, message }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Career guidance is unavailable. Please try again.");
        return;
      }
      setAnswer(result);
      setQuestion("");
    } catch {
      setError("Could not reach career guidance. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-5 text-indigo-700" aria-hidden="true" />
        <h2 className="text-xl font-bold text-slate-950">Ask about this career</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">Answers use the career catalogue and relevant evidence available in your account. Do not include sensitive personal information.</p>
      <form onSubmit={ask} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Ask a career question</span>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} rows={2} required placeholder="What beginner project could help me explore this role?" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>
        <button type="submit" disabled={pending || !question.trim()} className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">
          <Send className="size-4" aria-hidden="true" />{pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {answer && (
        <div className="mt-4 rounded-xl bg-indigo-50 p-4" aria-live="polite">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{answer.answer}</p>
          <p className="mt-3 text-xs text-slate-500">Career guidance based on this profile</p>
        </div>
      )}
    </section>
  );
}
