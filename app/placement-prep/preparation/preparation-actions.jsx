"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

export default function PreparationActions({ action, label, taskId, completed, planning, nextWeek, onOptimisticComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minutes, setMinutes] = useState(120);
  const [weeks, setWeeks] = useState(1);
  const router = useRouter();
  async function run() {
    setLoading(true);
    setError("");
    if (completed !== undefined) onOptimisticComplete?.(true);
    try {
      if (planning || nextWeek) {
        await action(planning ? { availableMinutesPerDay: minutes, weeks } : undefined);
        router.refresh();
      } else {
        await action(taskId, "COMPLETED");
      }
    } catch (error) {
      if (completed !== undefined) onOptimisticComplete?.(false);
      setError(error instanceof Error ? error.message : "Unable to update preparation.");
    } finally {
      setLoading(false);
    }
  }
  if (completed !== undefined) return <div><button className="button button-secondary" disabled={completed || loading} onClick={run}>{loading ? <Loader2 size={16} /> : <CheckCircle2 size={16} />} {completed ? "Completed" : "Mark complete"}</button>{error && <p className="error-message">{error}</p>}</div>;
  return <div>{planning && !nextWeek && <div className="plan-options"><label className="plan-time-label">Minutes available per day<select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}><option value="60">1 hour</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option></select></label><label className="plan-time-label">Plan length<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index}>{index + 1} {index === 0 ? "week" : "weeks"}</option>)}</select></label></div>}<button className="button button-primary" disabled={loading} onClick={run}>{loading ? <Loader2 size={16} /> : <Sparkles size={16} />} {label}</button>{error && <p className="error-message">{error}</p>}</div>;
}
