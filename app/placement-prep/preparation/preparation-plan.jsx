"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock3, Dumbbell } from "lucide-react";
import { generatePreparationPlan, updatePreparationTask } from "@/actions/prep-preparation";
import { formatPrepDate } from "@/lib/prep-date";
import PreparationActions from "./preparation-actions";

function expandWeeks(plans) {
  return plans.flatMap((plan) => {
    const lastTaskDay = Math.max(0, ...plan.tasks.map((task) => task.day));
    const weekCount = plan.sequenceId
      ? 1
      : Math.max(1, plan.totalWeeks || 1, Math.ceil(lastTaskDay / 7));
    return Array.from({ length: weekCount }, (_, index) => {
      const weekNumber = plan.sequenceId ? plan.weekNumber : index + 1;
      const tasks = plan.sequenceId
        ? plan.tasks
        : plan.tasks
            .filter((task) => task.day > index * 7 && task.day <= (index + 1) * 7)
            .map((task) => ({ ...task, day: task.day - index * 7 }));
      return {
        ...plan,
        key: `${plan.sequenceId || plan.id}:${weekNumber}`,
        weekNumber,
        totalWeeks: plan.sequenceId ? plan.totalWeeks : weekCount,
        tasks,
      };
    }).sort((first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime() ||
      second.weekNumber - first.weekNumber,
    );
  });
}

export default function PreparationPlan({ plans, practiceAllowed }) {
  const weeks = useMemo(() => expandWeeks(plans), [plans]);
  const latestWeek = weeks[0];
  const [selectedKey, setSelectedKey] = useState(latestWeek.key);
  const selectedWeek = weeks.find((week) => week.key === selectedKey) || latestWeek;
  const [tasks, setTasks] = useState(selectedWeek.tasks);
  const [taskOverrides, setTaskOverrides] = useState({});
  const taskIsComplete = (task) => taskOverrides[task.id] ?? task.status === "COMPLETED";
  const selectedCompleted = selectedWeek.tasks.length > 0 && selectedWeek.tasks.every(taskIsComplete);
  const latestCompleted = latestWeek.tasks.length > 0 && latestWeek.tasks.every(taskIsComplete);

  useEffect(() => {
    setSelectedKey(latestWeek.key);
  }, [latestWeek.key]);

  useEffect(() => {
    setTasks(selectedWeek.tasks);
  }, [selectedWeek]);

  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const hasNextWeek = latestWeek.weekNumber < latestWeek.totalWeeks;

  function setTaskCompleted(taskId, isCompleted, originalStatus) {
    setTaskOverrides((current) => ({ ...current, [taskId]: isCompleted ? true : originalStatus === "COMPLETED" }));
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? { ...task, status: isCompleted ? "COMPLETED" : originalStatus }
          : task,
      ),
    );
  }

  return <>
    <section className="hero">
      <div className="eyebrow">Personalized preparation</div>
      <h1>Personalized placement preparation · Week {selectedWeek.weekNumber}</h1>
      <p className="lead">Target role: {selectedWeek.targetRole}{selectedWeek.targetCompany ? ` · Target company: ${selectedWeek.targetCompany}` : ""}. {selectedWeek.weeklyGoal}</p>
      <div className="grid grid-3">
        <Metric label="Week progress" value={`${progress}%`} />
        <Metric label="Available daily time" value={`${selectedWeek.availableMinutesPerDay} min`} />
        <Metric label="Estimated week time" value={`${selectedWeek.estimatedMinutes} min`} />
      </div>
      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="plan-lock-notice">
        {selectedCompleted ? "This week is complete. Its tasks and progress are saved in your week history." : "Complete every task in this week to unlock the next week."}
      </div>
      <div className="actions">
        {practiceAllowed && <Link className="button button-primary" href="/placement-prep/practice"><Dumbbell size={16} /> Open Practice Center</Link>}
        {latestCompleted && hasNextWeek && <PreparationActions action={generatePreparationPlan} label={`Create week ${latestWeek.weekNumber + 1}`} nextWeek />}
        {latestCompleted && !hasNextWeek && <PreparationActions action={generatePreparationPlan} label="Start another plan" planning />}
      </div>
      {!practiceAllowed && <p className="helper">Complete all planned weeks to unlock the Practice Center.</p>}
    </section>
    <section className="section">
      <div className="section-heading">
        <div><h2>Week history</h2><p>Each week is saved separately. Select a week to review its topics, guidance, and completion progress.</p></div>
        <span className="badge">{weeks.length} {weeks.length === 1 ? "week saved" : "weeks saved"}</span>
      </div>
      <div className="week-picker" aria-label="Saved preparation weeks">
        {weeks.map((week) => {
          const weekComplete = week.tasks.length > 0 && week.tasks.every(taskIsComplete);
          return <button
            className={`week-picker-button ${week.key === selectedWeek.key ? "week-picker-button-active" : ""}`}
            key={week.key}
            onClick={() => setSelectedKey(week.key)}
            type="button"
          >
            <span>Week {week.weekNumber}</span>
            <small>{formatPrepDate(week.weekStart)}</small>
            <small>{weekComplete ? "Complete" : `${week.tasks.filter(taskIsComplete).length}/${week.tasks.length} tasks`}</small>
          </button>;
        })}
      </div>
      <div className="section-heading">
        <div><h2>Week {selectedWeek.weekNumber} preparation</h2><p>Every day includes your priority subjects. Open a task for its topic, objective, study guidance, and practice target.</p></div>
        <span className="badge">{completed} of {tasks.length} completed</span>
      </div>
      <div className="preparation-list">
        {tasks.map((task) => <article className={`card preparation-task ${task.status === "COMPLETED" ? "task-completed" : ""}`} key={task.id}>
          <div>
            <span className="badge">Day {task.day} · {task.category} · {task.type}</span>
            <h3>{task.topic}</h3>
            <p>{task.objective}</p>
            <details>
              <summary>View topic details</summary>
              <p className="helper"><strong>Why this task:</strong> {task.reason}</p>
              <p className="helper"><strong>Study guidance:</strong> {task.resource}</p>
              <p className="helper"><strong>Practice target:</strong> {task.practiceCount} problems at {task.difficulty} level.</p>
            </details>
            <div className="task-meta">
              <span><Clock3 size={14} /> {task.minutes} minutes</span>
              <span><BookOpen size={14} /> {task.practiceCount} practice problems</span>
              <span>{task.difficulty}</span>
              <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
            </div>
          </div>
          <PreparationActions
            taskId={task.id}
            completed={task.status === "COMPLETED"}
            action={updatePreparationTask}
            onOptimisticComplete={(isCompleted) => setTaskCompleted(task.id, isCompleted, task.status)}
          />
        </article>)}
      </div>
    </section>
  </>;
}

function Metric({ label, value }) {
  return <article className="card"><p>{label}</p><div className="stat-value">{value}</div></article>;
}
