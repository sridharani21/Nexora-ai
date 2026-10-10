"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { PRACTICE_QUESTIONS } from "@/data/prep-practice";
import { savePracticeAttempt } from "@/actions/prep-practice";

export default function PracticeClient({ subjects, usedQuestionIds = [], mistakeQuestionIds = [] }) {
  const [subject, setSubject] = useState("mixed");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [mode, setMode] = useState("PRACTICE");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const selected = subjects.find((item) => item.id === subject);
  const pool = PRACTICE_QUESTIONS.filter((item) => (subject === "mistakes" ? mistakeQuestionIds.includes(item.id) : (subject === "mixed" || item.subject === subject) && !usedQuestionIds.includes(item.id)) && (difficulty === "all" || item.difficulty === difficulty) && (!topic || item.topic === topic));
  const availableQuestions = pool.length;
  const effectiveQuestionCount = subject !== "mistakes" && availableQuestions > 0 && availableQuestions < questionCount
    ? [30, 25, 20, 15, 10].find((count) => count <= availableQuestions) || availableQuestions
    : questionCount;
  const questions = pool.slice(0, effectiveQuestionCount);
  function start() { setResult(null); setError(""); setIndex(0); setAnswers({}); setStartedAt(Date.now()); setElapsed(0); setStarted(true); }
  useEffect(() => {
    if (!started) return undefined;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started, startedAt]);
  async function submit() {
    setLoading(true);
    try { setResult(await savePracticeAttempt({ subject, topic, difficulty, mode, answers, questionIds: questions.map((question) => question.id), durationSeconds: elapsed })); setStarted(false); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save practice attempt."); } finally { setLoading(false); }
  }
  if (result) return <section className="section"><article className="card practice-result"><div className="eyebrow"><CheckCircle2 size={16} /> Attempt saved</div><h2>{result.score}% score</h2><p>{result.score < 60 ? "This topic has been added to your weakness history for remedial practice." : "Good progress. Try a harder difficulty or another topic next."}</p><button className="button button-primary" onClick={() => setResult(null)}><RotateCcw size={16} /> Practice again</button></article></section>;
  if (started && questions.length) {
    const question = questions[index];
    return <section className="section"><article className="card practice-question"><span className="badge">{question.difficulty} · Question {index + 1} of {questions.length} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map(([value, label]) => <button className={`button ${answers[question.id] === value ? "button-primary" : "button-secondary"}`} key={value} onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))}>{label}</button>)}</div><div className="actions"><button className="button button-secondary" onClick={() => setStarted(false)}>Exit</button><button className="button button-primary" disabled={!answers[question.id] || loading} onClick={() => index === questions.length - 1 ? submit() : setIndex((value) => value + 1)}>{loading ? <Loader2 size={16} /> : <Play size={16} />} {index === questions.length - 1 ? "Submit attempt" : "Next question"}</button></div></article></section>;
  }
  return <section className="section"><article className="card practice-config"><div className="form-grid"><div className="field"><label>Subject</label><select value={subject} onChange={(event) => { setSubject(event.target.value); setTopic(""); }}><option value="mixed">Mixed placement set</option><option value="mistakes">Mistake Bank ({mistakeQuestionIds.length})</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div><div className="field"><label>Topic</label><select value={topic} onChange={(event) => setTopic(event.target.value)} disabled={subject === "mixed" || subject === "mistakes"}><option value="">All topics</option>{selected?.topics.map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="field"><label>Difficulty</label><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div><div className="field"><label>Question count</label><select value={effectiveQuestionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}><option value="10">10 questions</option><option value="15">15 questions</option><option value="20">20 questions</option><option value="25">25 questions</option><option value="30">30 questions</option></select></div><div className="field"><label>Mode</label><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="PRACTICE">Practice</option><option value="TIMED">Timed test</option><option value="COMPANY_PATTERN">Company-pattern practice</option><option value="MISTAKE_REVIEW">Mistake review</option></select></div></div><p className="helper">{availableQuestions} questions available. The session size automatically adjusts to the largest available option when previous questions have been used.</p>{!mistakeQuestionIds.length && subject === "mistakes" && <p className="helper">Complete a practice attempt with incorrect answers to populate the Mistake Bank.</p>}{error && <p className="error-message">{error}</p>}<button className="button button-primary" disabled={availableQuestions < 1} onClick={start}><Play size={16} /> {subject === "mistakes" ? "Review mistakes" : "Start practice"}</button></article></section>;
}
