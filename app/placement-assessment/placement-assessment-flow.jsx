"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { savePlacementAssessment } from "@/actions/placement-assessment";
import { PLACEMENT_ASSESSMENT_SECTIONS } from "@/data/placement-assessment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlacementAssessmentFlow({ latest, careerTwin }) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [adaptiveTrail, setAdaptiveTrail] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const initialQuestionOrders = useMemo(() => {
    const rank = { foundation: 0, intermediate: 1, advanced: 2 };
    const targetRank = rank[careerTwin?.dsaLevel ?? "foundation"] ?? 0;
    return Object.fromEntries(
      PLACEMENT_ASSESSMENT_SECTIONS.map((item) => [
        item.id,
        [...item.questions]
          .sort((first, second) =>
            Math.abs((rank[first.difficulty ?? "foundation"] ?? 0) - targetRank) -
            Math.abs((rank[second.difficulty ?? "foundation"] ?? 0) - targetRank)
          )
          .map((item) => item.id),
      ])
    );
  }, [careerTwin]);
  const [questionOrders, setQuestionOrders] = useState(initialQuestionOrders);
  const section = PLACEMENT_ASSESSMENT_SECTIONS[sectionIndex];
  const question = section.questions.find(
    (item) => item.id === questionOrders[section.id]?.[questionIndex]
  ) ?? section.questions[questionIndex];
  const totalQuestions = PLACEMENT_ASSESSMENT_SECTIONS.reduce((sum, item) => sum + item.questions.length, 0);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / totalQuestions) * 100);
  const isLastQuestion = questionIndex === section.questions.length - 1;
  const isLastSection = sectionIndex === PLACEMENT_ASSESSMENT_SECTIONS.length - 1;

  const previousAttempt = useMemo(() => {
    if (!latest) return null;
    return {
      score: latest.overallScore,
      field: latest.careerField,
      date: new Date(latest.completedAt).toLocaleDateString(),
      twinField: careerTwin?.careerField,
    };
  }, [latest, careerTwin]);

  const choose = (value) => setAnswers((current) => ({ ...current, [question.id]: value }));

  const finish = async () => {
    setSaving(true);
    try {
      const saved = await savePlacementAssessment({ answers, adaptiveTrail });
      setResult(saved);
      toast.success("Assessment saved to your placement journey.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!answers[question.id]) {
      toast.error("Choose an answer before continuing.");
      return;
    }
    const isCorrect = question.answer ? answers[question.id] === question.answer : false;
    setAdaptiveTrail((current) => ({
      ...current,
      [question.id]: { difficulty: question.difficulty ?? "foundation", isCorrect },
    }));
    const remaining = section.questions.filter(
      (item) => item.id !== question.id && !answers[item.id]
    );
    const rank = { foundation: 0, intermediate: 1, advanced: 2 };
    const currentRank = rank[question.difficulty ?? "foundation"] ?? 0;
    const targetRank = Math.max(0, Math.min(2, currentRank + (isCorrect ? 1 : -1)));
    const nextOrder = [
      question.id,
      ...remaining
        .sort((first, second) =>
          Math.abs((rank[first.difficulty ?? "foundation"] ?? 0) - targetRank) -
          Math.abs((rank[second.difficulty ?? "foundation"] ?? 0) - targetRank)
        )
        .map((item) => item.id),
    ];
    setQuestionOrders((current) => ({ ...current, [section.id]: nextOrder }));
    if (!isLastQuestion) {
      setQuestionIndex((index) => index + 1);
    } else if (!isLastSection) {
      setSectionIndex((index) => index + 1);
      setQuestionIndex(0);
    } else {
      finish();
    }
  };

  if (result) {
    const profile = result.suitabilityProfile;
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <Card className="border-primary/40">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" /> Diagnostic loop completed</div>
            <CardTitle className="text-3xl">Your career suitability profile</CardTitle>
            <CardDescription>This evidence is saved in your Career Twin and will guide readiness, preparation, and practice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultMetric label="Assessment score" value={`${result.overallScore}%`} />
              <ResultMetric label="Recommended career field" value={profile.careerField} />
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h2 className="font-semibold">Career Twin updated</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your assessment evidence now updates your ongoing skill profile and future recommendations.
              </p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <span>DSA: {result.careerTwin.dsaLevel}</span>
                <span>Coding: {result.careerTwin.codingLevel}</span>
                <span>Readiness: {result.careerTwin.placementReadiness}%</span>
              </div>
            </div>
            <div>
              <h2 className="font-semibold">Recommended roles</h2>
              <p className="mt-2 text-muted-foreground">{profile.recommendedRoles.join(" · ")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultList title="Strengths" values={profile.assessmentStrengths.length ? profile.assessmentStrengths : profile.interestStrengths} />
              <ResultList title="Focus areas" values={profile.improvementAreas.length ? profile.improvementAreas : ["Keep building consistency"]} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link href="/placement-dashboard">Open placement dashboard</Link></Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Retake assessment</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 space-y-3">
        <Link href="/placement-dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <p className="text-sm font-medium text-primary">Modules 3–5 of 21 · Diagnostic loop {progress}% complete</p>
        <h1 className="gradient-title text-4xl font-bold">{section.title}</h1>
        <p className="text-muted-foreground">{section.description}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
      </div>
      {previousAttempt && (
        <p className="mb-4 text-sm text-muted-foreground">Previous attempt: {previousAttempt.score}% in {previousAttempt.field} on {previousAttempt.date}. {previousAttempt.twinField ? `Current Career Twin field: ${previousAttempt.twinField}. ` : ""}You can retake this diagnostic assessment.</p>
      )}
      <Card>
      <CardHeader>
        <CardDescription>
          Question {questionIndex + 1} of {section.questions.length} · Adaptive difficulty: {question.difficulty ?? "foundation"}
        </CardDescription>
        <CardTitle>{question.prompt}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {question.options.map((option) => (
          <button key={option.value} type="button" onClick={() => choose(option.value)} className={`w-full rounded-lg border p-4 text-left transition-colors ${answers[question.id] === option.value ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}>
            {option.label}
          </button>
          ))}
          <div className="flex justify-end pt-4">
            <Button onClick={next} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isLastSection && isLastQuestion ? "Save my assessment" : <><span>Continue</span><ArrowRight className="h-4 w-4" /></>}</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ResultMetric({ label, value }) {
  return <div className="rounded-lg bg-muted/50 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function ResultList({ title, values }) {
  return <div><h2 className="font-semibold">{title}</h2><ul className="mt-2 space-y-1 text-muted-foreground">{values.map((value) => <li key={value}>• {value}</li>)}</ul></div>;
}
