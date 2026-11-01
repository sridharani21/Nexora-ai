"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { startRiasecAttempt } from "@/actions/module3-riasec";

export default function StartRiasecButton({ attemptId }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function start() {
    setError("");
    startTransition(async () => {
      const result = attemptId
        ? { success: true, attemptId }
        : await startRiasecAttempt();
      if (!result.success) {
        setError(result.error || "The assessment could not be started.");
        return;
      }
      router.push(`/career-interests/${result.attemptId}`);
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={start}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {isPending ? "Preparing questions..." : attemptId ? "Continue assessment" : "Start assessment"}
      </button>
      {error && <p role="alert" className="mt-3 max-w-md text-sm text-rose-200">{error}</p>}
    </div>
  );
}
