import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { getModule4SavedCareers } from "@/actions/module4-careers";
import SavedCareersList from "../_components/saved-careers-list";

export const metadata = { title: "Saved careers | Nexora AI" };

export default async function SavedCareersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const careers = await getModule4SavedCareers();
  return (
    <main className="module4-theme mx-auto w-full max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/career-explorer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ArrowLeft className="size-4" aria-hidden="true" />Back to Career Explorer</Link>
      <header><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-700"><Bookmark className="size-4" aria-hidden="true" />Your private shortlist</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Saved careers</h1><p className="mt-2 text-sm text-slate-600">Only you can access saved paths and personal notes.</p></header>
      <SavedCareersList initialCareers={careers} />
    </main>
  );
}
