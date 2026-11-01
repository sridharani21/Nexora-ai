"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function MockInterviewSetup() {
  const router = useRouter();
  const search = useSearchParams();
  const requestedPlanId = search.get("planId");
  const [career, setCareer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tavusAvailable, setTavusAvailable] = useState(false);
  const [geminiLiveAvailable, setGeminiLiveAvailable] = useState(false);
  const [interviewType, setInterviewType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [duration, setDuration] = useState(30);
  const [focus, setFocus] = useState("job_readiness");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/mock-interview").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load interview setup.");
      if (!active) return;
      setCareer(data.career);
      setProfile(data.profile);
      setTavusAvailable(data.tavusAvailable);
      setGeminiLiveAvailable(data.geminiLiveAvailable);
    }).catch((loadError) => { if (active) setError(loadError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function startInterview(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewType, difficulty, duration, language: "English", focus, planId: requestedPlanId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start your interview.");
      router.push(`/mock-interview/check?sessionId=${encodeURIComponent(data.session.id)}`);
    } catch (requestError) {
      setError(requestError.message);
      setCreating(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading interview setup…</main>;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/mock-interview" className="text-sm font-semibold text-indigo-700 underline">Back to Module 6</Link>
      <header><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Module 6 · Setup</p><h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Configure your interview</h1><p className="mt-2 text-sm text-slate-600">Choose a practice format. Your selected career and saved learning evidence shape the questions.</p></header>
      {!career ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">Choose a career first</h2><p className="mt-2 text-sm">Module 6 uses your current Module 4 career. Select one to continue.</p><Link href="/career-explorer" className="mt-4 inline-flex rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white">Open Career Explorer</Link></section>
      ) : (
        <form onSubmit={startInterview} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="min-w-0 rounded-xl bg-indigo-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Selected Module 4 career</p><p className="mt-1 break-words text-lg font-bold text-slate-950">{career.title}</p><p className="mt-1 break-words text-sm text-slate-600">{career.skills.slice(0, 8).join(" · ") || "Role-specific questions will use this career profile."}</p><Link href="/career-explorer" className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">Change career in Module 4</Link></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Interview type"><select value={interviewType} onChange={(event) => setInterviewType(event.target.value)} className={selectClass}><option value="mixed">Mixed interview</option><option value="technical">Technical</option><option value="coding">Coding reasoning (spoken; not executed)</option><option value="behavioral">HR & behavioral</option><option value="project">Project-based</option></select></Field>
            <Field label="Difficulty"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={selectClass}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
            <Field label="Duration"><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={selectClass}><option value="15">15 minutes · 5 questions</option><option value="30">30 minutes · 8 questions</option><option value="45">45 minutes · 12 questions</option></select></Field>
            <Field label="Language"><select value="English" disabled className={`${selectClass} bg-slate-100`}><option>English</option></select></Field>
            <Field label="Interview focus"><select value={focus} onChange={(event) => setFocus(event.target.value)} className={selectClass}><option value="skills">Role skills</option><option value="projects">Projects</option><option value="problem_solving">Problem solving</option><option value="communication">Communication</option><option value="job_readiness">Job readiness</option></select></Field>
          </div>
          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-900">Profile evidence used</h2>
            <p className="mt-1 text-sm text-slate-600">Only saved details are included. Missing information is left blank.</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Evidence label="Skills" value={profile?.skills?.join(", ") || "No profile skills saved"} />
              <Evidence label="Experience" value={profile?.experience || "Not provided"} />
              <Evidence label="Education" value={profile?.education || "Not provided"} />
              <Evidence label="Module 5" value={requestedPlanId ? "Selected preparation plan will be linked" : "Latest career preparation evidence, if available"} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-slate-500">Module 2 assessment history</dt>
                <dd className="mt-1 space-y-1 text-slate-800">
                  {profile?.module2Assessments?.length
                    ? profile.module2Assessments.map((assessment, index) => (
                      <p key={`${assessment.branch}-${index}`}>
                        {assessment.branch} assessment
                        {assessment.percentage !== null ? ` · ${assessment.percentage}%` : ""}
                        {assessment.topics.length ? ` · Topics: ${assessment.topics.map((topic) => topic.topic).join(", ")}` : ""}
                      </p>
                    ))
                    : "No completed Module 2 assessments saved"}
                </dd>
              </div>
            </dl>
          </section>
          <p className="text-xs leading-5 text-slate-500">{tavusAvailable ? "Tavus provides the live video interview and processes live audio/video. Nexora does not record or save raw media; your verified spoken transcript and practice feedback are saved to your private account." : geminiLiveAvailable ? "Gemini Live provides optional audio interviews. Nexora does not record or save raw media; your spoken transcript and practice feedback are saved to your private account." : "Gemini powers text-based interview questions and feedback."} Your current Module 4 career and its role skills shape the planned questions. {tavusAvailable || geminiLiveAvailable ? "You can choose text practice if voice is unavailable." : ""} Coding answers are not executed, and feedback is not a hiring decision.</p>
          {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
          <button disabled={creating} className="w-full rounded-xl bg-indigo-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60">{creating ? "Preparing your interview…" : "Continue to pre-interview check"}</button>
        </form>
      )}
    </main>
  );
}

const selectClass = "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900";

function Field({ label, children }) {
  return <label className="block text-sm font-semibold text-slate-800">{label}{children}</label>;
}

function Evidence({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-800">{value}</dd></div>;
}
