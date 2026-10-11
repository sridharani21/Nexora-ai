"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { createPracticeQuestionSet, savePracticeAttempt } from "@/actions/prep-practice";

export default function PracticeClient({ subjects, mistakeQuestionIds = [], mistakeTopics = [] }) {
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
  const [questions, setQuestions] = useState([]);
  const [questionSetId, setQuestionSetId] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const selected = subjects.find((item) => item.id === subject);
  async function start() {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const generated = await createPracticeQuestionSet({ subject, topic, difficulty, questionCount });
      setQuestionSetId(generated.id);
      setQuestions(generated.questions);
      setIndex(0);
      setAnswers({});
      setStartedAt(Date.now());
      setElapsed(0);
      setStarted(true);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate practice questions.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!started) return undefined;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started, startedAt]);
  async function submit() {
    setLoading(true);
    try { setResult(await savePracticeAttempt({ subject, topic, difficulty, mode, answers, questionSetId, durationSeconds: elapsed })); setStarted(false); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save practice attempt."); } finally { setLoading(false); }
  }
  if (result) return <section className="section"><article className="card practice-result"><div className="eyebrow"><CheckCircle2 size={16} /> Attempt saved</div><h2>{result.score}% score</h2><p>{result.score < 60 ? "This topic has been added to your weakness history for remedial practice." : "Good progress. Try a harder difficulty or another topic next."}</p><button className="button button-primary" onClick={() => setResult(null)}><RotateCcw size={16} /> Practice again</button></article></section>;
  if (started && questions.length) {
    const question = questions[index];
    return <section className="section"><article className="card practice-question"><span className="badge">{question.difficulty} · Question {index + 1} of {questions.length} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map(([value, label]) => <button className={`button ${answers[question.id] === value ? "button-primary" : "button-secondary"}`} key={value} onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))}>{label}</button>)}</div><div className="actions"><button className="button button-secondary" onClick={() => setStarted(false)}>Exit</button><button className="button button-primary" disabled={!answers[question.id] || loading} onClick={() => index === questions.length - 1 ? submit() : setIndex((value) => value + 1)}>{loading ? <Loader2 size={16} /> : <Play size={16} />} {index === questions.length - 1 ? "Submit attempt" : "Next question"}</button></div></article></section>;
  }
  return <section className="section"><article className="card practice-config"><div className="form-grid"><div className="field"><label>Subject</label><select value={subject} onChange={(event) => { const nextSubject = event.target.value; setSubject(nextSubject); setTopic(nextSubject === "mistakes" ? (mistakeTopics[0] || "") : ""); if (nextSubject === "mistakes") setMode("MISTAKE_REVIEW"); else if (mode === "MISTAKE_REVIEW") setMode("PRACTICE"); }}><option value="mixed">Mixed placement set</option><option value="mistakes">Mistake Bank ({mistakeQuestionIds.length})</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div><div className="field"><label>Topic</label><select value={topic} onChange={(event) => setTopic(event.target.value)} disabled={subject === "mixed"}><option value="">All topics</option>{(subject === "mistakes" ? mistakeTopics : selected?.topics || []).map((item) => <option value={item} key={item}>{item}</option>)}</select></div><div className="field"><label>Difficulty</label><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div><div className="field"><label>Question count</label><select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}><option value="10">10 questions</option><option value="15">15 questions</option><option value="20">20 questions</option><option value="25">25 questions</option><option value="30">30 questions</option></select></div><div className="field"><label>Mode</label><select value={mode} onChange={(event) => { const nextMode = event.target.value; setMode(nextMode); if (nextMode === "MISTAKE_REVIEW") { setSubject("mistakes"); setTopic(mistakeTopics[0] || ""); } else if (subject === "mistakes") { setSubject("mixed"); setTopic(""); } }}><option value="PRACTICE">Practice</option><option value="TIMED">Timed test</option><option value="COMPANY_PATTERN">Company-pattern practice</option><option value="MISTAKE_REVIEW">Mistake review</option></select></div></div><p className="helper">Gemini generates exactly {questionCount} fresh questions for each session. Previous questions are excluded; Mistake Bank creates new questions for your saved weak topics rather than repeating the old wording.</p>{subject === "mistakes" && !mistakeTopics.length && <p className="helper">Complete a practice attempt with incorrect answers to populate the Mistake Bank.</p>}{error && <p className="error-message" role="alert">{error}</p>}<button className="button button-primary" disabled={loading || (subject === "mistakes" && (!mistakeTopics.length || !topic))} onClick={start}>{loading ? <><Loader2 size={16} /> {started ? "Saving" : "Generating questions"}</> : <><Play size={16} /> {subject === "mistakes" ? "Generate remedial practice" : "Generate fresh practice"}</>}</button></article></section>;
}
