"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { savePracticeAttempt } from "@/actions/placement-practice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COMPANY_PATTERNS = ["General placement", "Product company", "Service company", "Startup screening"];

export default function PracticeCenter({ topics, questions, attempts: initialAttempts, profile }) {
  const [topicId, setTopicId] = useState(topics[0]?.id);
  const [answers, setAnswers] = useState({});
  const [timed, setTimed] = useState(false);
  const [mode, setMode] = useState("practice");
  const [companyPattern, setCompanyPattern] = useState(COMPANY_PATTERNS[0]);
  const [difficulty, setDifficulty] = useState("adaptive");
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(initialAttempts ?? []);

  const topic = topics.find((item) => item.id === topicId) ?? topics[0];
  const topicQuestions = useMemo(() => questions.filter((question) => question.topic === topic?.id), [questions, topic]);
  const answeredCount = topicQuestions.filter((question) => answers[question.id]).length;

  useEffect(() => {
    if (!timed || result) return undefined;
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [timed, result]);

  const selectTopic = (value) => {
    setTopicId(value);
    setAnswers({});
    setSeconds(0);
    setResult(null);
  };

  const submit = async () => {
    if (answeredCount !== topicQuestions.length) {
      toast.error("Answer every question before submitting.");
      return;
    }
    setSaving(true);
    try {
      const saved = await savePracticeAttempt({
        topic: topic.id,
        category: topic.category,
        answers,
        mode,
        companyPattern: mode === "company-pattern" ? companyPattern : undefined,
        timed,
        difficulty,
        durationSeconds: seconds,
      });
      setResult(saved);
      setAttempts((current) => [saved.attempt, ...current].slice(0, 12));
      toast.success("Practice attempt saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save practice attempt.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setSeconds(0);
    setResult(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Topic practice</CardTitle><CardDescription>{profile?.preferredRole ? `Personalised for ${profile.preferredRole}` : "Choose a topic to begin."}</CardDescription></div>
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm"><Clock3 className="h-4 w-4" /> {formatTime(seconds)}</div>
          </div>
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Topic<select value={topicId} onChange={(event) => selectTopic(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 font-normal">{topics.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.category}</option>)}</select></label>
            <label className="text-sm font-medium">Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 font-normal"><option value="adaptive">Adaptive</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={timed} onChange={(event) => { setTimed(event.target.checked); setSeconds(0); }} /> Timed mode</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={mode === "company-pattern"} onChange={(event) => setMode(event.target.checked ? "company-pattern" : "practice")} /> Company-pattern</label>
            {mode === "company-pattern" && <select aria-label="Company pattern" value={companyPattern} onChange={(event) => setCompanyPattern(event.target.value)} className="rounded-md border bg-background p-1.5">{COMPANY_PATTERNS.map((pattern) => <option key={pattern}>{pattern}</option>)}</select>}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {result ? (
            <Result result={result} reset={reset} />
          ) : (
            <>
              <div className="flex justify-between text-sm text-muted-foreground"><span>{topic?.label} · {answeredCount}/{topicQuestions.length} answered</span><span>{timed ? "Timer running" : "Untimed practice"}</span></div>
              {topicQuestions.map((question, index) => (
                <div key={question.id} className="rounded-lg border p-4">
                  <p className="font-medium">{index + 1}. {question.prompt}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <button key={option.value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))} className={`rounded-md border p-3 text-left text-sm transition-colors ${answers[question.id] === option.value ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}>{option.label}</button>)}</div>
                </div>
              ))}
              <Button onClick={submit} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving attempt</> : "Submit practice attempt"}</Button>
            </>
          )}
        </CardContent>
      </Card>
      <aside className="space-y-6">
        <Card><CardHeader><CardTitle className="text-lg">Recent attempts</CardTitle><CardDescription>Mistakes and weak topics are saved for future insights.</CardDescription></CardHeader><CardContent className="space-y-3">{attempts.length ? attempts.map((attempt) => <div key={attempt.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2 text-sm font-medium"><span>{topics.find((item) => item.id === attempt.topic)?.label || attempt.topic}</span><span>{attempt.score}%</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(attempt.completedAt).toLocaleDateString()} · {attempt.correctCount}/{attempt.questionCount} correct</p></div>) : <p className="text-sm text-muted-foreground">No attempts yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Next step</CardTitle></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link href="/placement-preparation">Back to preparation plan</Link></Button></CardContent></Card>
      </aside>
    </div>
  );
}

function Result({ result, reset }) {
  return (
    <div className="space-y-5 rounded-lg border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Attempt saved</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Score" value={`${result.score}%`} />
        <Metric label="Correct" value={`${result.correctCount}/${result.questionCount}`} />
        <Metric label="Mistakes" value={String(result.mistakes.length)} />
      </div>
      {result.mistakes.length ? (
        <div>
          <p className="font-medium">Review these mistakes</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {result.mistakes.map((mistake) => <li key={mistake.questionId}>• {mistake.prompt}</li>)}
          </ul>
        </div>
      ) : <p className="text-sm text-muted-foreground">Perfect set. Try a higher difficulty next.</p>}
      {result.weaknessReport?.remedialRequired && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Remedial practice recommended</p>
          <p className="mt-1 text-muted-foreground">
            This result has been added to your Career Twin weakness evidence. Your next preparation plan will prioritize {result.weaknessReport.topic}.
          </p>
        </div>
      )}
      <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Practise again</Button>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
