"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { updatePreparationTask } from "@/actions/placement-preparation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PreparationPlan({ plan, report }) {
  const [tasks, setTasks] = useState(plan.tasks ?? []);
  const [saving, setSaving] = useState(null);
  const completed = tasks.filter((task) => task.completed).length;

  const toggleTask = async (task) => {
    setSaving(task.id);
    try {
      const updated = await updatePreparationTask({ taskId: task.id, completed: !task.completed });
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update task.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Adaptive difficulty" value={plan.adaptiveDifficulty} detail="Changes as your performance improves" />
        <SummaryCard label="Weekly progress" value={`${completed}/${tasks.length}`} detail="Daily tasks completed" />
        <SummaryCard label="Readiness baseline" value={`${report.overallScore}%`} detail={`Focused on ${report.targetRole || "your target role"}`} />
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Daily learning tasks</CardTitle><CardDescription>Complete the task, then reinforce it with a focused practice set.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className={`flex items-start gap-3 rounded-lg border p-4 ${task.completed ? "bg-primary/5" : ""}`}>
                <button type="button" aria-label={`Mark day ${task.day} ${task.completed ? "incomplete" : "complete"}`} onClick={() => toggleTask(task)} disabled={saving === task.id} className={`mt-1 h-5 w-5 rounded border text-xs ${task.completed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>{task.completed ? "✓" : ""}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className={`font-medium ${task.completed ? "line-through" : ""}`}>Day {task.day}: {task.title}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{task.difficulty}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                  <p className="mt-2 text-xs text-primary">Goal: {task.goal}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Performance recommendations</CardTitle></CardHeader>
            <CardContent><ul className="space-y-3 text-sm text-muted-foreground">{(plan.recommendations ?? []).map((item) => <li key={item}>• {item}</li>)}</ul></CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-lg">Ready to practise?</CardTitle><CardDescription>Use the center for timed and company-pattern sets.</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><Link href="/placement-practice">Open practice center</Link></Button></CardContent></Card>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value, detail }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl capitalize">{value}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{detail}</p></CardContent></Card>;
}
