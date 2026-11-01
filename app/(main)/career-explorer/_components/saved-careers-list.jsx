"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import { toggleModule4SavedCareer } from "@/actions/module4-careers";

export default function SavedCareersList({ initialCareers }) {
  const [careers, setCareers] = useState(initialCareers);
  const [selected, setSelected] = useState([]);
  const [pending, startTransition] = useTransition();
  function updateCareer(career, remove) {
    startTransition(async () => {
      const result = await toggleModule4SavedCareer({
        slug: career.slug,
        saved: !remove,
        notes: career.notes,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (remove) setSelected((items) => items.filter((item) => item !== career.slug));
      setCareers((items) => remove
        ? items.filter((item) => item.slug !== career.slug)
        : items.map((item) => item.slug === career.slug ? { ...item, notes: career.notes } : item));
      toast.success(remove ? "Career removed." : "Note saved.");
    });
  }
  if (!careers.length) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Your shortlist is empty. Browse the career catalog and save paths you would like to explore.</p>;
  return (
    <>
    <p className="mb-3 text-xs text-slate-500">Select up to three paths to compare.</p>
    {selected.length >= 2 && <Link href={`/career-explorer/compare?careers=${selected.join(",")}`} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white"><GitCompareArrows className="size-4" aria-hidden="true" />Compare selected saved careers ({selected.length})</Link>}
    <div className="grid gap-4 md:grid-cols-2">
      {careers.map((career) => <article key={career.slug} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{career.family} · Saved {career.savedAt.slice(0, 10)}</p><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={selected.includes(career.slug)} disabled={selected.length >= 3 && !selected.includes(career.slug)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, career.slug] : items.filter((item) => item !== career.slug))} />Compare</label></div>
        <h2 className="mt-2 text-xl font-bold text-slate-950">{career.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{career.summary}</p>
        <label className="mt-4 block text-xs font-semibold text-slate-600">Private note<textarea value={career.notes} onChange={(event) => setCareers((items) => items.map((item) => item.slug === career.slug ? { ...item, notes: event.target.value } : item))} maxLength={1500} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-900" /></label>
        <div className="mt-4 flex flex-wrap gap-3"><Link href={`/career-explorer/${career.slug}`} className="text-sm font-bold text-indigo-700">Explore details</Link><button disabled={pending} onClick={() => updateCareer(career, false)} className="text-sm font-semibold text-slate-700 disabled:opacity-50">Save note</button><button disabled={pending} onClick={() => updateCareer(career, true)} className="text-sm font-semibold text-rose-700 disabled:opacity-50">Remove</button></div>
      </article>)}
    </div>
    </>
  );
}
