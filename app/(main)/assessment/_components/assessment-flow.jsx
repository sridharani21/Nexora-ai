"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BookOpen, BriefcaseBusiness, CheckCircle2, Loader2, Target } from "lucide-react";
import { savePlacementAssessment } from "@/actions/assessment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const TECHNICAL_QUESTIONS = [
  {
    id: "programming",
    category: "Programming",
    question: "Which approach is best for solving a new programming problem?",
    options: ["Guess and submit immediately", "Break it into smaller steps and test each one", "Copy the first solution you find", "Avoid writing test cases"],
    answer: 1,
  },
  {
    id: "data-structures",
    category: "DSA",
    question: "Which data structure follows the First-In, First-Out principle?",
    options: ["Stack", "Queue", "Tree", "Graph"],
    answer: 1,
  },
  {
    id: "databases",
    category: "DBMS",
    question: "What is the main purpose of a database index?",
    options: ["To speed up data retrieval", "To delete duplicate tables", "To encrypt every value", "To replace backups"],
    answer: 0,
  },
  {
    id: "web",
    category: "Web Development",
    question: "Which HTTP method is normally used to create a new resource?",
    options: ["GET", "DELETE", "POST", "HEAD"],
    answer: 2,
  },
  {
    id: "aptitude",
    category: "Aptitude",
    question: "A product priced at ₹100 is discounted by 20%. What is its sale price?",
    options: ["₹20", "₹80", "₹100", "₹120"],
    answer: 1,
  },
  {
    id: "collaboration",
    category: "Work readiness",
    question: "When you are blocked by a technical problem, what is the strongest response?",
    options: ["Hide the problem", "Stop working permanently", "Investigate, document what you tried, and ask for help", "Blame another teammate"],
    answer: 2,
  },
];

const INTEREST_OPTIONS = [
  { id: "fullstack", label: "Building websites and applications", role: "Full Stack Developer", courses: ["JavaScript and React", "Node.js APIs", "SQL and system design"] },
  { id: "ai-ml", label: "Working with data and intelligent systems", role: "AI / ML Engineer", courses: ["Python for data", "Machine learning foundations", "Model deployment"] },
  { id: "cybersecurity", label: "Protecting systems and finding vulnerabilities", role: "Cybersecurity Analyst", courses: ["Networking fundamentals", "Linux and security", "OWASP and ethical testing"] },
  { id: "devops", label: "Automating delivery and cloud infrastructure", role: "Cloud / DevOps Engineer", courses: ["Linux and Git", "Docker and CI/CD", "Cloud fundamentals"] },
  { id: "mobile", label: "Creating mobile experiences", role: "Mobile Developer", courses: ["React Native or Flutter", "Mobile UI patterns", "App publishing"] },
];

function readinessLabel(score) {
  if (score >= 80) return "Strong foundation";
  if (score >= 60) return "Developing foundation";
  return "Starting foundation";
}

export default function AssessmentFlow() {
  const [stage, setStage] = useState("assessment");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [interests, setInterests] = useState([]);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const current = TECHNICAL_QUESTIONS[index];
  const selectedInterest = useMemo(
    () => INTEREST_OPTIONS.find((interest) => interest.id === interests[0]),
    [interests]
  );

  const chooseAnswer = (answer) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: answer }));
  };

  const finish = async () => {
    const correctAnswers = TECHNICAL_QUESTIONS.reduce(
        (total, question) => total + (answers[question.id] === question.answer ? 1 : 0),
        0
      );
    const score = Math.round((correctAnswers / TECHNICAL_QUESTIONS.length) * 100);
    const assessmentAnswers = TECHNICAL_QUESTIONS.map((question) => ({
      question: question.question,
      category: question.category,
      answer: question.answer,
      userAnswer: answers[question.id],
      isCorrect: answers[question.id] === question.answer,
    }));
    const categoryScores = TECHNICAL_QUESTIONS.reduce((scores, question) => {
      const currentCategory = scores[question.category] || { correct: 0, total: 0 };
      currentCategory.total += 1;
      currentCategory.correct += answers[question.id] === question.answer ? 1 : 0;
      scores[question.category] = currentCategory;
      return scores;
    }, {});
    const categoryResults = Object.fromEntries(
      Object.entries(categoryScores).map(([category, values]) => [
        category,
        Math.round((values.correct / values.total) * 100),
      ])
    );
    const strengths = Object.entries(categoryResults)
      .filter(([, categoryScore]) => categoryScore >= 70)
      .map(([category]) => category);
    const improvementAreas = Object.entries(categoryResults)
      .filter(([, categoryScore]) => categoryScore < 70)
      .map(([category]) => category);

    setSaving(true);
    try {
      await savePlacementAssessment({
        score,
        answers: assessmentAnswers,
        interests,
        categoryScores: categoryResults,
        strengths,
        improvementAreas,
      });
      setResult({
        score,
        role: selectedInterest?.role || "Career path",
        courses: selectedInterest?.courses || [],
        categoryScores: categoryResults,
        strengths,
        improvementAreas,
      });
      setStage("result");
    } catch (error) {
      toast.error(error.message || "We could not save your assessment.");
    } finally {
      setSaving(false);
    }
  };

  if (stage === "interest") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <AssessmentHeader title="Discover what interests you" description="Choose up to two areas you would enjoy preparing for. This shapes your role and course recommendations." />
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            {INTEREST_OPTIONS.map((interest) => {
              const selected = interests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() =>
                    setInterests((currentInterests) =>
                      selected
                        ? currentInterests.filter((id) => id !== interest.id)
                        : currentInterests.length < 2
                          ? [...currentInterests, interest.id]
                          : currentInterests
                    )
                  }
                  className={`rounded-lg border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{interest.label}</span>
                    {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                  <span className="mt-2 block text-sm text-muted-foreground">{interest.role}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
        <Button className="w-full" disabled={!interests.length || saving} onClick={finish}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "See my placement plan"}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <AssessmentHeader title="Your placement readiness report" description="Your score and interests are now the starting point for a personalized preparation journey." />
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard icon={Target} title="Readiness score" value={`${result.score}%`} detail={readinessLabel(result.score)} />
          <SummaryCard icon={BriefcaseBusiness} title="Suggested target" value={result.role} detail="Based on your interests" />
          <SummaryCard icon={BookOpen} title="Next focus" value="Build your plan" detail="Courses, projects and practice" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your recommended preparation path</CardTitle>
            <CardDescription>
              Your assessment combines knowledge, aptitude, work readiness, and interests. Career discovery will refine this into skill gaps, courses, a roadmap, and a weekly plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <ProfileList title="Current strengths" items={result.strengths} empty="Keep practising to build your first strengths." />
              <ProfileList title="Priority improvement areas" items={result.improvementAreas} empty="You have a strong foundation across the assessed areas." />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Knowledge and readiness breakdown</p>
              {Object.entries(result.categoryScores).map(([category, categoryScore]) => (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{category}</span>
                    <span className="text-muted-foreground">{categoryScore}%</span>
                  </div>
                  <Progress value={categoryScore} />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {["Evaluate", "Learn", "Practice", "Get placed"].map((step, stepIndex) => (
                <div key={step} className="rounded-lg border p-3">
                  <Badge variant={stepIndex === 0 ? "default" : "secondary"}>{stepIndex + 1}</Badge>
                  <p className="mt-2 font-medium">{step}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Initial course focus</p>
              <div className="flex flex-wrap gap-2">
                {result.courses.map((course) => <Badge key={course} variant="outline">{course}</Badge>)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/career-discovery">
                <Button className="w-full">Build my career plan <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/course-recommendations">
                <Button variant="outline" className="w-full">Explore recommended courses</Button>
              </Link>
              <Link href="/job-matcher">
                <Button variant="outline" className="w-full">Find matching jobs</Button>
              </Link>
              <Link href="/interview">
                <Button variant="outline" className="w-full">Practise interviews</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = ((index + 1) / TECHNICAL_QUESTIONS.length) * 100;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AssessmentHeader title="Placement readiness assessment" description="Answer honestly. This is a diagnostic, not an exam. We use it to identify your strengths and the skills to practise next." />
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground"><span>Question {index + 1} of {TECHNICAL_QUESTIONS.length}</span><span>{Math.round(progress)}%</span></div>
        <Progress value={progress} />
      </div>
      <Card>
        <CardHeader>
          <Badge className="w-fit">{current.category}</Badge>
          <CardTitle className="text-2xl">{current.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {current.options.map((option, optionIndex) => (
            <button key={option} type="button" onClick={() => chooseAnswer(optionIndex)} className={`w-full rounded-lg border p-4 text-left transition-colors ${answers[current.id] === optionIndex ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}>
              <span className="mr-3 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>{option}
            </button>
          ))}
          <Button className="mt-3 w-full" disabled={answers[current.id] === undefined} onClick={() => index < TECHNICAL_QUESTIONS.length - 1 ? setIndex(index + 1) : setStage("interest")}>
            {index < TECHNICAL_QUESTIONS.length - 1 ? "Next question" : "Continue to interest check"} <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AssessmentHeader({ title, description }) {
  return <div className="space-y-2"><h1 className="gradient-title text-4xl font-bold">{title}</h1><p className="max-w-2xl text-muted-foreground">{description}</p></div>;
}

function SummaryCard({ icon: Icon, title, value, detail }) {
  return <Card><CardContent className="pt-6"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></CardContent></Card>;
}

function ProfileList({ title, items, empty }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 font-medium">{title}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
