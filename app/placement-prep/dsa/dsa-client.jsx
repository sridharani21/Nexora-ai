"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Code2, ExternalLink, Loader2, Save, Target } from "lucide-react";
import { recordDsaActivity, savePreferredDsaLanguage } from "@/actions/prep-dsa";
import { DSA_STATUS_LABELS, DSA_TOPICS } from "@/data/prep-dsa";
import { formatPrepDate } from "@/lib/prep-date";

const statusActions = [
  ["ATTEMPTED", "Record attempt"],
  ["FAILED", "Report not solved"],
  ["STUDENT_MARKED_SOLVED", "Mark solved (self-reported)"],
];

export default function DsaClient({ data }) {
  const router = useRouter();
  const [language, setLanguage] = useState(data.preferredLanguage);
  const [topicFilter, setTopicFilter] = useState("All topics");
  const [difficultyFilter, setDifficultyFilter] = useState("All difficulties");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const filteredProblems = useMemo(
    () => data.problems.filter((problem) =>
      (topicFilter === "All topics" || problem.topic === topicFilter) &&
      (difficultyFilter === "All difficulties" || problem.difficulty === difficultyFilter),
    ),
    [data.problems, topicFilter, difficultyFilter],
  );

  async function saveLanguage(event) {
    event.preventDefault();
    setPending("language");
    setError("");
    setMessage("");
    try {
      await savePreferredDsaLanguage(language);
      setMessage("Preferred language saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your language.");
    } finally {
      setPending("");
    }
  }

  async function record(problem, activityType) {
    setPending(`${problem.slug}:${activityType}`);
    setError("");
    setMessage("");
    try {
      await recordDsaActivity(problem.slug, activityType, language);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this DSA activity.");
    } finally {
      setPending("");
    }
  }

  function openLeetCode(problem) {
    setError("");
    record(problem, "OPENED");
  }

  const { stats } = data;

  return <>
    <section className="hero">
      <div className="eyebrow">DSA &amp; Coding</div>
      <h1>Your next coding problem, chosen with purpose.</h1>
      <p className="lead">Nexora uses your assessment, DSA practice, and adaptive-learning evidence to guide your LeetCode practice. Code and submissions stay on LeetCode.</p>
      <div className="dsa-notice"><strong>Activity transparency:</strong> Nexora records when you click a LeetCode link and any attempt or solve status you report here. There is no automatic LeetCode submission sync, so reported solves are clearly marked unverified.</div>
      <form className="dsa-language-form" onSubmit={saveLanguage}>
        <label className="plan-time-label" htmlFor="preferred-dsa-language">Preferred programming language
          <select id="preferred-dsa-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {data.languages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="button button-secondary" disabled={pending === "language"} type="submit">
          {pending === "language" ? <Loader2 size={16} /> : <Save size={16} />} Save language
        </button>
      </form>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="actions">
        <Link className="button button-secondary" href="/placement-prep/levels">Review adaptive learning</Link>
        <Link className="button button-secondary" href="/placement-prep/practice">Open Practice Center</Link>
      </div>
      <div className="grid grid-4">
        <Metric
          label={stats.levelSource === "practice" ? "Adaptive DSA level" : stats.levelSource === "assessment" ? "Assessment-based starting level" : "DSA level"}
          value={stats.levelName}
          detail={stats.levelSource === "practice" ? `Level ${stats.level} of 6 · Based on your DSA practice` : `Level ${stats.level} of 6 · ${stats.levelSource === "assessment" ? "Based on your assessment" : "Awaiting assessment evidence"}`}
        />
        <Metric label="Assessment evidence" value={stats.assessmentScore === null ? "Not available" : `${stats.assessmentScore}%`} detail="From your latest DSA assessment" />
        <Metric label="Problems marked solved" value={`${stats.markedSolvedCount} / ${stats.catalogCount}`} detail="Student-reported, unverified" />
        <Metric label="Analyzed test answers" value={stats.analyzedQuestionCount} detail={`${stats.weakTopicCount} evidence-backed weak topics`} />
      </div>
      <div className="dsa-level-card card">
        <div className="section-heading">
          <div><span className="badge">Recommended difficulty: {stats.recommendationDifficulty}</span><h2>Adaptive learning guidance</h2></div>
          <Code2 className="icon" size={22} />
        </div>
        <p>{stats.levelReason}</p>
        {stats.levelSource === "practice" && <><div className="progress"><span style={{ width: `${stats.levelProgress}%` }} /></div><p className="helper">{stats.levelProgress}% toward your next evidence-based adaptive level.</p></>}
        {stats.practiceAverage !== null && <p className="helper">Recent DSA practice average: {stats.practiceAverage}%.</p>}
        {stats.readinessPriorities.length > 0 && <p className="helper">Current preparation priorities: {stats.readinessPriorities.join(", ")}.</p>}
      </div>
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>Recommended from your results</h2><p>Each recommendation is based on your topic-level assessment or practice answers, mistake counts, and personal difficulty level.</p></div><Target className="icon" size={22} /></div>
      <div className="grid grid-3">
        {data.recommendations.map((problem) => <ProblemCard
          key={`recommendation-${problem.slug}`}
          problem={problem}
          pending={pending}
          onOpen={openLeetCode}
          onRecord={record}
          recommended
        />)}
      </div>
      {!data.recommendations.length && (data.hasDsaEvidence
        ? <p className="helper">No unsolved catalog problems match your analyzed topics and current difficulty. Continue DSA practice to refresh your recommendations.</p>
        : <article className="card"><h3>Complete a DSA test to personalize recommendations</h3><p className="helper">Nexora will recommend LeetCode problems only after it has topic-level evidence from your DSA assessment or DSA practice answers. We won’t guess your weak topics.</p><div className="actions"><Link className="button button-primary" href="/placement-prep/assessment">Take the assessment</Link><Link className="button button-secondary" href="/placement-prep/practice">Complete DSA practice</Link></div></article>)}
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>DSA topic analysis</h2><p>Scores are calculated from your own DSA assessment answers and practice answers. A topic without test evidence is shown as not assessed.</p></div></div>
      <div className="grid grid-2">
        {data.topics.map((topic) => <article className="card dsa-topic-card" key={topic.topic}>
          <div className="section-heading"><h3>{topic.topic}</h3><span className="badge">{topic.score === null ? "Not assessed" : `${topic.score}% accuracy`}</span></div>
          {topic.score !== null && <div className="progress"><span style={{ width: `${topic.score}%` }} /></div>}
          <p className="helper">{topic.evidenceCount ? `${topic.evidenceCount} answers analyzed · ${topic.mistakes} incorrect` : "No assessment or practice answers recorded for this topic yet."}</p>
          {topic.evidenceCount > 0 && <p className="helper">Evidence: {[topic.assessmentQuestions ? `${topic.assessmentQuestions} assessment` : null, topic.practiceQuestions ? `${topic.practiceQuestions} practice` : null].filter(Boolean).join(" · ")}</p>}
          <p className="helper">LeetCode catalog: {topic.markedSolved}/{topic.total} student-reported solved; unverified.</p>
        </article>)}
      </div>
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>LeetCode problem catalog</h2><p>Choose a problem, solve it on LeetCode, then report your progress here.</p></div><span className="badge">{stats.catalogProgress}% catalog marked solved</span></div>
      <div className="dsa-filters">
        <label className="plan-time-label" htmlFor="dsa-topic-filter">Topic
          <select id="dsa-topic-filter" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
            <option>All topics</option>
            {DSA_TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
          </select>
        </label>
        <label className="plan-time-label" htmlFor="dsa-difficulty-filter">Difficulty
          <select id="dsa-difficulty-filter" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
            <option>All difficulties</option>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </label>
      </div>
      <div className="grid grid-3">
        {filteredProblems.map((problem) => <ProblemCard
          key={problem.slug}
          problem={problem}
          pending={pending}
          onOpen={openLeetCode}
          onRecord={record}
        />)}
      </div>
      {!filteredProblems.length && <p className="helper">No problems match these filters.</p>}
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>Difficulty progress</h2><p>Counts include only problems marked solved by you; LeetCode submissions are not automatically verified.</p></div></div>
      <div className="grid grid-3">{stats.difficultyProgress.map((item) => <Metric key={item.difficulty} label={item.difficulty} value={`${item.markedSolved} marked solved`} detail={`${item.total} catalog problems`} />)}</div>
    </section>

    <section className="section">
      <div className="section-heading"><div><h2>Recent DSA activity</h2><p>Link clicks are kept distinct from student-reported attempts and solves.</p></div></div>
      <article className="card">
        {data.activities.map((activity) => <div className="history-row" key={activity.id}>
          <span>{formatPrepDate(activity.createdAt)} · {activity.title} · {activity.topic}</span>
          <strong>{activity.statusLabel}{activity.verified ? " · verified" : activity.source === "STUDENT_CONFIRMED" ? " · unverified" : ""}</strong>
        </div>)}
        {!data.activities.length && <p className="helper">Your LeetCode link clicks and self-reported progress will appear here.</p>}
      </article>
    </section>
  </>;
}

function ProblemCard({ problem, pending, onOpen, onRecord, recommended = false }) {
  const loading = pending.startsWith(`${problem.slug}:`);
  return <article className={`card dsa-problem-card ${problem.status === "STUDENT_MARKED_SOLVED" ? "task-completed" : ""}`}>
    <div className="section-heading">
      <div><span className="badge">{problem.topic} · {problem.difficulty}</span><h3>{problem.title}</h3></div>
      {problem.status === "STUDENT_MARKED_SOLVED" && <CheckCircle2 className="icon" size={20} />}
    </div>
    {recommended && <p className="helper"><strong>Why this problem:</strong> {problem.reason}</p>}
    <p className="helper">Status: {DSA_STATUS_LABELS[problem.status] || DSA_STATUS_LABELS.NOT_STARTED}{problem.attemptCount > 0 ? ` · ${problem.attemptCount} recorded attempts` : ""}</p>
    <a
      className="button button-primary dsa-external-link"
      href={problem.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(problem)}
    >
      Solve on LeetCode <ExternalLink size={15} />
    </a>
    <div className="dsa-status-actions">
      {statusActions.map(([status, label]) => <button
        className="button button-secondary"
        disabled={loading}
        key={status}
        onClick={() => onRecord(problem, status)}
        type="button"
      >
        {loading ? <Loader2 size={14} /> : null}{label}
      </button>)}
    </div>
    {loading && <p className="helper" role="status">Saving activity…</p>}
    <p className="helper dsa-unverified-note">Student-reported updates are not verified against LeetCode.</p>
  </article>;
}

function Metric({ label, value, detail }) {
  return <article className="card"><p>{label}</p><div className="stat-value">{value}</div><p className="helper">{detail}</p></article>;
}
