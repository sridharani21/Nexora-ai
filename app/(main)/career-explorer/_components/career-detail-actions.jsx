"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, GitCompareArrows, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { chooseModule4Career, toggleModule4SavedCareer } from "@/actions/module4-careers";

export default function CareerDetailActions({ slug, title, saved: initialSaved, initialNotes, alternatives, isCurrentGoal }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [notes, setNotes] = useState(initialNotes);
  const [compareWith, setCompareWith] = useState(alternatives[0]?.slug || "");
  const [pending, startTransition] = useTransition();

  function chooseCareer() {
    if (!isCurrentGoal && !window.confirm(`Set ${title} as your current career goal and continue to Module 5?`)) return;
    startTransition(async () => {
      const result = await chooseModule4Career({ slug });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${title} is saved as your current career goal.`);
      router.push(result.module5Url);
    });
  }

  function saveCareer(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await toggleModule4SavedCareer({ slug, saved: true, notes });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(true);
      toast.success("Career saved to your shortlist.");
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <form onSubmit={saveCareer} className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-1 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-semibold text-slate-300">Private note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1500} rows={2} placeholder="Why are you considering this path?" className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400" /></label>
        <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 disabled:opacity-50"><Bookmark className="size-4" aria-hidden="true" />{saved ? "Update saved career" : "Save career"}</button>
        {saved && <button type="button" disabled={pending} onClick={() => startTransition(async () => {
          const result = await toggleModule4SavedCareer({ slug, saved: false });
          if (!result.success) toast.error(result.error);
          else { setSaved(false); setNotes(""); toast.success("Career removed from your shortlist."); router.refresh(); }
        })} className="h-10 rounded-lg border border-white/25 px-4 text-sm font-semibold text-white">Unsave</button>}
      </form>
      <button type="button" disabled={pending} onClick={chooseCareer} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
        <GraduationCap className="size-4" aria-hidden="true" />{isCurrentGoal ? "Continue to Module 5" : "Choose this career"}
      </button>
      {isCurrentGoal && <Link href="/mock-interview/setup" className="inline-flex h-10 items-center justify-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white hover:bg-white/10">Start AI Mock Interview</Link>}
      {alternatives.length > 0 && (
        <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-300 sm:flex-none">Compare with<select value={compareWith} onChange={(event) => setCompareWith(event.target.value)} className="mt-1 block h-10 w-full max-w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white sm:w-auto">{alternatives.map((career) => <option key={career.slug} value={career.slug}>{career.title}</option>)}</select></label>
          <Link href={`/career-explorer/compare?careers=${slug},${compareWith}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-indigo-500 px-3 text-sm font-bold text-white hover:bg-indigo-400"><GitCompareArrows className="size-4" aria-hidden="true" />Compare</Link>
        </div>
      )}
    </div>
  );
}
