"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSearch, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function ATSScanner() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [savedReports, setSavedReports] = useState([]);

  useEffect(() => {
    try {
      setSavedReports(JSON.parse(localStorage.getItem("nexora-ats-reports") || "[]"));
    } catch {
      setSavedReports([]);
    }
  }, []);

  const saveReport = () => {
    const next = [
      { id: Date.now(), createdAt: new Date().toISOString(), jobDescription, result },
      ...savedReports,
    ].slice(0, 10);
    localStorage.setItem("nexora-ats-reports", JSON.stringify(next));
    setSavedReports(next);
  };

  const deleteReport = (id) => {
    const next = savedReports.filter((report) => report.id !== id);
    localStorage.setItem("nexora-ats-reports", JSON.stringify(next));
    setSavedReports(next);
  };

  const scanResume = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setResult(null);

    if (!file) {
      setError("Choose a PDF resume before scanning.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF resumes are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescription", jobDescription);

    setIsScanning(true);
    try {
      const response = await fetch("/api/resumes/analyze-upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to scan this resume.");
      }

      setResult(payload.analysis);
      setNotice(payload.notice || "");
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="lg:col-span-2">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/resume-job-modules">
            <ArrowLeft className="h-4 w-4" />
            Back to Resume & Job Modules
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Upload resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={scanResume}>
            <label className="block space-y-2 text-sm font-medium">
              Resume PDF
              <input
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Target job description
              <Textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Optional: paste the job description to check keyword alignment."
                rows={8}
              />
            </label>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isScanning} className="w-full">
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning resume...
                </>
              ) : (
                "Scan Resume"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ATS report</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground">
              <FileSearch className="mb-3 h-10 w-10" />
              <p>Your score and recommendations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {notice && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  {notice}
                </p>
              )}
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold text-primary">
                  {result.overallScore ?? 0}
                </span>
                <span className="pb-1 text-muted-foreground">/ 100 ATS score</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={saveReport}>
                <Save className="h-4 w-4" />
                Save report
              </Button>
              <ReportList
                title="What is working"
                items={result.strengths}
                icon={CheckCircle2}
                color="text-emerald-500"
              />
              <ReportList
                title="What to improve"
                items={result.recommendations}
                icon={AlertTriangle}
                color="text-amber-500"
              />
            </div>
          )}
        </CardContent>
      </Card>
      {savedReports.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Saved ATS reports</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {savedReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-md border p-3">
                <button type="button" className="text-sm hover:text-primary" onClick={() => {
                  setJobDescription(report.jobDescription);
                  setResult(report.result);
                  setError("");
                }}>
                  {new Date(report.createdAt).toLocaleString()} — Score {report.result?.overallScore ?? 0}
                </button>
                <Button type="button" variant="ghost" size="icon" onClick={() => deleteReport(report.id)} aria-label="Delete saved report">
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

function ReportList({ title, items = [], icon: Icon, color }) {
  return (
    <div>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {items.length ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
              <span>
                {typeof item === "string"
                  ? item
                  : item.suggestion || item.message || item.issue || item.title}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items returned.</p>
      )}
    </div>
  );
}
