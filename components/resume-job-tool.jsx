"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const configs = {
  optimizer: {
    title: "Resume Optimizer",
    description: "Paste a resume and one target job to get focused improvements.",
    primary: "Resume text",
    secondary: "Target job description",
    action: "Optimize Resume",
  },
  matcher: {
    title: "Job Matcher",
    description: "Use your saved resume or paste a profile and describe your target role.",
    primary: "Resume or profile",
    secondary: "Target role or job description",
    action: "Find Matches",
  },
  company: {
    title: "Company Explorer",
    description: "Get a practical preparation brief for a company you are researching.",
    primary: "Company name",
    secondary: "Optional role or job description",
    action: "Explore Company",
  },
};

export default function ResumeJobTool({ tool }) {
  const config = configs[tool];
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const storageKey = `nexora-resume-tool-${tool}`;

  useEffect(() => {
    try {
      setSavedResults(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
      setSavedResults([]);
    }
  }, [storageKey]);

  const saveResult = () => {
    const entry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      input: { primary, secondary },
      result,
    };
    const next = [entry, ...savedResults].slice(0, 10);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedResults(next);
  };

  const loadSavedResult = (entry) => {
    setPrimary(entry.input.primary);
    setSecondary(entry.input.secondary);
    setResult(entry.result);
    setError("");
  };

  const deleteSavedResult = (id) => {
    const next = savedResults.filter((entry) => entry.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedResults(next);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!primary.trim() && tool === "company") {
      setError("Enter a company name.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/resume-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool,
          resumeText: tool === "company" ? "" : primary,
          companyName: tool === "company" ? primary : "",
          jobDescription: secondary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      setResult(payload.result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/resume-job-modules">
          <ArrowLeft className="h-4 w-4" />
          Back to Resume & Job Modules
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {tool === "company" ? (
              <Input value={primary} onChange={(event) => setPrimary(event.target.value)} placeholder={config.primary} />
            ) : (
              <Textarea value={primary} onChange={(event) => setPrimary(event.target.value)} placeholder={`${config.primary} (leave blank to use your saved resume)`} rows={8} />
            )}
            <Textarea value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder={config.secondary} rows={8} />
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Working..." : config.action}
            </Button>
          </form>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Results</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={saveResult}>
              <Save className="h-4 w-4" />
              Save result
            </Button>
          </CardHeader>
          <CardContent>
            {tool === "matcher" && Array.isArray(result.matches) ? (
              <JobMatches matches={result.matches} />
            ) : (
              <ResultView value={result} />
            )}
          </CardContent>
        </Card>
      )}
      {savedResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Saved results</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {savedResults.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <button type="button" className="text-left text-sm hover:text-primary" onClick={() => loadSavedResult(entry)}>
                  {new Date(entry.createdAt).toLocaleString()}
                </button>
                <Button type="button" variant="ghost" size="icon" onClick={() => deleteSavedResult(entry.id)} aria-label="Delete saved result">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultView({ value }) {
  if (Array.isArray(value)) {
    return <ul className="list-disc space-y-2 pl-5 text-sm">{value.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul>;
  }

  if (value && typeof value === "object") {
    return <div className="space-y-4">{Object.entries(value).map(([key, item]) => (
      <section key={key}>
        <h3 className="mb-1 font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</h3>
        <ResultView value={item} />
      </section>
    ))}</div>;
  }
  return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{String(value ?? "")}</p>;
}

function JobMatches({ matches }) {
  if (!matches.length) {
    return <p className="text-sm text-muted-foreground">No matching roles found.</p>;
  }

  return (
    <div className="space-y-4">
      {matches.map((match, index) => (
        <article key={`${match.title}-${match.company}-${index}`} className="rounded-xl border bg-background/50 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-lg font-semibold">{match.title || "Matching role"}</h3>
              <p className="text-sm text-muted-foreground">{match.company || "Company not specified"}</p>
            </div>
            <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {match.matchPercent ?? 0}% match
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SkillList title="Matching skills" items={match.matchedSkills} icon={CheckCircle2} color="text-emerald-500" />
            <SkillList title="Skills to build" items={match.missingSkills} icon={TriangleAlert} color="text-amber-500" />
          </div>
          {match.reason && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why this matches: </span>{match.reason}
            </p>
          )}
          {match.nextStep && (
            <p className="mt-3 rounded-md bg-primary/5 p-3 text-sm">
              <span className="font-medium">Next step: </span>{match.nextStep}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function SkillList({ title, items = [], icon: Icon, color }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />{item}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">None listed</p>}
    </div>
  );
}
